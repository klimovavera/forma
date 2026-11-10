
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import type { Server } from 'node:http';
import bcrypt from 'bcryptjs';

import { app } from '../index.js';
import { pool, query } from '../db/pool.js';

let server: Server;
let baseUrl: string;

type ApiResult = {
  status: number;
  body: any;
};

async function api(
  path: string,
  method = 'GET',
  body?: unknown,
  token?: string,
): Promise<ApiResult> {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body === undefined
      ? {}
      : { body: JSON.stringify(body) }),
  });

  return {
    status: response.status,
    body: await response.json(),
  };
}

const courseData = {
  title: 'Основы программирования',
  description: 'Полный практический курс для начинающих',
  categoryId: 1,
  level: 'beginner',
};

async function createTeacher() {
  const password = 'Teacher123!';
  const passwordHash = await bcrypt.hash(password, 10);

  const rows = await query<{ id: number }>(
    `INSERT INTO users(name, email, password_hash, role)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [
      'Тестовый преподаватель',
      'teacher.integration@test.ru',
      passwordHash,
      'teacher',
    ],
  );

  const login = await api('/auth/login', 'POST', {
    email: 'teacher.integration@test.ru',
    password,
  });

  expect(login.status).toBe(200);

  return {
    id: rows[0].id,
    token: login.body.data.accessToken as string,
  };
}

async function createCourse(token: string) {
  const response = await api(
    '/courses',
    'POST',
    courseData,
    token,
  );

  expect(response.status).toBe(201);
  return response.body.data as { id: number; title: string };
}

beforeAll(async () => {
  if (
    !process.env.DATABASE_URL?.includes('coursehub_test')
  ) {
    throw new Error(
      'Интеграционные тесты разрешены только в тестовой БД',
    );
  }

  server = await new Promise<Server>((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => {
      resolve(instance);
    });
  });

  const address = server.address();

  if (!address || typeof address === 'string') {
    throw new Error('Не удалось запустить тестовый сервер');
  }

  baseUrl = `http://127.0.0.1:${address.port}/api`;
});

beforeEach(async () => {
  await pool.query(
    'TRUNCATE TABLE users, categories RESTART IDENTITY CASCADE',
  );

  await query(
    'INSERT INTO categories(name) VALUES($1)',
    ['Программирование'],
  );
});

afterAll(async () => {
  if (server) {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }

  await pool.end();
});

describe('Интеграционные тесты Forma', () => {
  it('1. Регистрация сохраняет пользователя в PostgreSQL', async () => {
    const response = await api('/auth/register', 'POST', {
      name: 'Тестовый студент',
      email: 'student.integration@test.ru',
      password: 'Student123!',
    });

    expect(response.status).toBe(201);
    expect(response.body.data.user.role).toBe('student');
    expect(response.body.data.accessToken).toBeTruthy();

    const users = await query<{
      email: string;
      role: string;
      password_hash: string;
    }>(
      'SELECT email, role, password_hash FROM users WHERE email=$1',
      ['student.integration@test.ru'],
    );

    expect(users).toHaveLength(1);
    expect(users[0].role).toBe('student');
    expect(users[0].password_hash).not.toBe('Student123!');
  });

  it('2. Преподаватель создаёт курс через API', async () => {
    const teacher = await createTeacher();

    const course = await createCourse(teacher.token);

    const rows = await query<{
      title: string;
      teacher_id: number;
      status: string;
    }>(
      'SELECT title, teacher_id, status FROM courses WHERE id=$1',
      [course.id],
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe(courseData.title);
    expect(rows[0].teacher_id).toBe(teacher.id);
    expect(rows[0].status).toBe('draft');
  });

  it('3. Студент не может редактировать курс преподавателя', async () => {
    const teacher = await createTeacher();
    const course = await createCourse(teacher.token);

    const registration = await api(
      '/auth/register',
      'POST',
      {
        name: 'Обычный студент',
        email: 'student2.integration@test.ru',
        password: 'Student123!',
      },
    );

    expect(registration.status).toBe(201);

    const studentToken = registration.body.data.accessToken;

    const response = await api(
      `/courses/${course.id}`,
      'PATCH',
      { title: 'Чужое название' },
      studentToken,
    );

    expect(response.status).toBe(403);

    const rows = await query<{ title: string }>(
      'SELECT title FROM courses WHERE id=$1',
      [course.id],
    );

    expect(rows[0].title).toBe(courseData.title);
  });
});
