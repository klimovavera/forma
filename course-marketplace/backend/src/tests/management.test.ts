
import express from 'express';
import type { ErrorRequestHandler } from 'express';
import type { Server } from 'node:http';
import bcrypt from 'bcryptjs';
import { ZodError } from 'zod';
import {
  describe, it, expect, vi,
  beforeAll, afterAll, beforeEach,
} from 'vitest';

const queryMock = vi.hoisted(() => vi.fn());

vi.mock('../db/pool.js', () => ({
  query: queryMock,
}));

import auth from '../routes/auth.js';
import admin from '../routes/admin.js';
import { signAccess, signRefresh } from '../services/security.js';

const app = express();
app.use(express.json());
app.use('/api/auth', auth);
app.use('/api/admin', admin);

const errors: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR' } });
    return;
  }
  res.status(500).json({ error: { code: 'INTERNAL_ERROR' } });
};
app.use(errors);

let server: Server;
let url: string;
let passwordHash: string;

const user = {
  id: 2,
  name: 'Тестовый пользователь',
  email: 'test@example.com',
  role: 'student',
  blocked: false,
};

function mockRows(...results: any[][]) {
  const queue = [...results];

  queryMock.mockImplementation(async (sql: string, params: any[]) => {
    if (sql.includes('SELECT blocked,role FROM users')) {
      const id = Number(params[0]);
      const role = id === 3 ? 'moderator'
        : id === 1 ? 'teacher' : 'student';
      return [{ blocked: false, role }];
    }
    return queue.shift() ?? [];
  });
}

function token(role: 'student' | 'teacher' | 'moderator') {
  const id = role === 'moderator' ? 3 : role === 'teacher' ? 1 : 2;
  return signAccess({ id, role });
}

async function api(
  path: string,
  method = 'GET',
  body?: unknown,
  role?: 'student' | 'teacher' | 'moderator',
) {
  const response = await fetch(url + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(role ? { Authorization: `Bearer ${token(role)}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

  return {
    status: response.status,
    body: await response.json(),
  };
}

beforeAll(async () => {
  passwordHash = await bcrypt.hash('Password123!', 4);

  server = await new Promise<Server>((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Сервер тестов не запущен');
  }
  url = `http://127.0.0.1:${address.port}/api`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close(err => err ? reject(err) : resolve());
  });
});

beforeEach(() => {
  queryMock.mockReset();
  mockRows();
});

describe('Регистрация и авторизация', () => {
  it('регистрирует нового пользователя', async () => {
    mockRows([user], []);
    const r = await api('/auth/register', 'POST', {
      name: user.name,
      email: user.email,
      password: 'Password123!',
    });
    expect(r.status).toBe(201);
    expect(r.body.data.accessToken).toBeTruthy();
  });

  it('запрещает повторную регистрацию', async () => {
    mockRows([]);
    const r = await api('/auth/register', 'POST', {
      name: user.name,
      email: user.email,
      password: 'Password123!',
    });
    expect(r.status).toBe(409);
  });

  it('проверяет корректность email', async () => {
    const r = await api('/auth/register', 'POST', {
      name: 'Студент',
      email: 'wrong-email',
      password: 'Password123!',
    });
    expect(r.status).toBe(400);
  });

  it('выполняет вход с правильным паролем', async () => {
    mockRows([{ ...user, password_hash: passwordHash }], []);
    const r = await api('/auth/login', 'POST', {
      email: user.email,
      password: 'Password123!',
    });
    expect(r.status).toBe(200);
    expect(r.body.data.refreshToken).toBeTruthy();
  });

  it('отклоняет неправильный пароль', async () => {
    mockRows([{ ...user, password_hash: passwordHash }]);
    const r = await api('/auth/login', 'POST', {
      email: user.email,
      password: 'WrongPassword!',
    });
    expect(r.status).toBe(401);
  });

  it('запрещает вход заблокированному пользователю', async () => {
    mockRows([{ ...user, blocked: true, password_hash: passwordHash }]);
    const r = await api('/auth/login', 'POST', {
      email: user.email,
      password: 'Password123!',
    });
    expect(r.status).toBe(403);
  });

  it('отклоняет неверный refresh-токен', async () => {
    const r = await api('/auth/refresh', 'POST', {
      refreshToken: 'invalid-token',
    });
    expect(r.status).toBe(401);
  });

  it('обновляет токены авторизации', async () => {
    const refresh = signRefresh({ id: 2, role: 'student' });
    mockRows([{ id: 10 }], [user], []);
    const r = await api('/auth/refresh', 'POST', {
      refreshToken: refresh,
    });
    expect(r.status).toBe(200);
    expect(r.body.data.accessToken).toBeTruthy();
  });

  it('выполняет выход', async () => {
    mockRows([]);
    const r = await api('/auth/logout', 'POST', {
      refreshToken: 'some-token',
    });
    expect(r.status).toBe(200);
    expect(r.body.data.success).toBe(true);
  });

  it('не раскрывает наличие email при восстановлении', async () => {
    mockRows([]);
    const r = await api('/auth/forgot-password', 'POST', {
      email: 'unknown@example.com',
    });
    expect(r.status).toBe(200);
  });

  it('отклоняет недействительный токен сброса', async () => {
    mockRows([]);
    const r = await api('/auth/reset-password', 'POST', {
      token: 'invalid-reset-token',
      password: 'NewPassword123!',
    });
    expect(r.status).toBe(400);
  });
});

describe('Личный кабинет', () => {
  it('запрещает доступ без авторизации', async () => {
    const r = await api('/auth/me');
    expect(r.status).toBe(401);
  });

  it('возвращает профиль пользователя', async () => {
    mockRows([user]);
    const r = await api('/auth/me', 'GET', undefined, 'student');
    expect(r.status).toBe(200);
    expect(r.body.data.email).toBe(user.email);
  });

  it('изменяет имя пользователя', async () => {
    mockRows([{ ...user, name: 'Новое имя' }]);
    const r = await api('/auth/me', 'PATCH',
      { name: 'Новое имя' }, 'student');
    expect(r.status).toBe(200);
    expect(r.body.data.name).toBe('Новое имя');
  });

  it('отклоняет неправильный текущий пароль', async () => {
    mockRows([{ password_hash: passwordHash }]);
    const r = await api('/auth/change-password', 'POST', {
      currentPassword: 'WrongPassword!',
      newPassword: 'NewPassword123!',
    }, 'student');
    expect(r.status).toBe(400);
  });

  it('разрешает смену пароля', async () => {
    mockRows([{ password_hash: passwordHash }], [], []);
    const r = await api('/auth/change-password', 'POST', {
      currentPassword: 'Password123!',
      newPassword: 'NewPassword123!',
    }, 'student');
    expect(r.status).toBe(200);
    expect(r.body.data.success).toBe(true);
  });
});

describe('Администрирование', () => {
  it('запрещает студенту список пользователей', async () => {
    const r = await api('/admin/users', 'GET', undefined, 'student');
    expect(r.status).toBe(403);
  });

  it('разрешает модератору список пользователей', async () => {
    mockRows([user]);
    const r = await api('/admin/users', 'GET', undefined, 'moderator');
    expect(r.status).toBe(200);
    expect(r.body.data).toHaveLength(1);
  });

  it('запрещает модератору менять свои права', async () => {
    const r = await api('/admin/users/3', 'PATCH',
      { role: 'student' }, 'moderator');
    expect(r.status).toBe(400);
    expect(r.body.error.code).toBe('SELF_CHANGE');
  });

  it('позволяет модератору блокировать пользователя', async () => {
    mockRows([{ ...user, blocked: true }], []);
    const r = await api('/admin/users/2', 'PATCH',
      { blocked: true }, 'moderator');
    expect(r.status).toBe(200);
    expect(r.body.data.blocked).toBe(true);
  });

  it('возвращает журнал аудита модератору', async () => {
    mockRows([{ id: 1, action: 'update_user' }]);
    const r = await api('/admin/audit', 'GET', undefined, 'moderator');
    expect(r.status).toBe(200);
    expect(r.body.data).toHaveLength(1);
  });

  it('возвращает дашборд студента', async () => {
    mockRows([{ enrollments: 2, completed: 4 }], []);
    const r = await api('/admin/dashboard', 'GET', undefined, 'student');
    expect(r.status).toBe(200);
    expect(r.body.data.stats.enrollments).toBe(2);
  });

  it('возвращает дашборд преподавателя', async () => {
    mockRows([{ courses: 3, enrollments: 12 }], []);
    const r = await api('/admin/dashboard', 'GET', undefined, 'teacher');
    expect(r.status).toBe(200);
    expect(r.body.data.stats.courses).toBe(3);
  });

  it('возвращает дашборд модератора', async () => {
    mockRows([{ users: 15, courses: 5, pending: 2 }], []);
    const r = await api('/admin/dashboard', 'GET', undefined, 'moderator');
    expect(r.status).toBe(200);
    expect(r.body.data.stats.users).toBe(15);
  });
});
