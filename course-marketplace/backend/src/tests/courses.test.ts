
import express, {
  type ErrorRequestHandler,
} from 'express';
import type { Server } from 'node:http';
import { ZodError } from 'zod';
import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  afterAll,
  beforeEach,
} from 'vitest';

const queryMock = vi.hoisted(() => vi.fn());

vi.mock('../db/pool.js', () => ({
  query: queryMock,
}));

import coursesRouter from '../routes/courses.js';
import { signAccess } from '../services/security.js';

const app = express();
app.use(express.json());
app.use('/api/courses', coursesRouter);

const errorHandler: ErrorRequestHandler = (
  error,
  _req,
  res,
  _next,
) => {
  if (error instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: error.message,
      },
    });
    return;
  }

  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Ошибка сервера',
    },
  });
};

app.use(errorHandler);

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  server = await new Promise<Server>((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => {
      resolve(instance);
    });
  });

  const address = server.address();

  if (!address || typeof address === 'string') {
    throw new Error('Не удалось открыть тестовый сервер');
  }

  baseUrl = `http://127.0.0.1:${address.port}/api/courses`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
});

beforeEach(() => {
  queryMock.mockReset();

  queryMock.mockImplementation(async (sql: string, params: unknown[]) => {
    if (sql.includes('SELECT blocked,role FROM users')) {
      const id = Number(params[0]);
      const role =
        id === 1
          ? 'teacher'
          : id === 3
            ? 'moderator'
            : 'student';

      return [{ blocked: false, role }];
    }

    return [];
  });
});

function mockQueries(...results: unknown[][]) {
  const queue = [...results];

  queryMock.mockImplementation(async (sql: string, params: unknown[]) => {
    if (sql.includes('SELECT blocked,role FROM users')) {
      const id = Number(params[0]);

      return [{
        blocked: false,
        role: id === 1
          ? 'teacher'
          : id === 3
            ? 'moderator'
            : 'student',
      }];
    }

    return queue.shift() ?? [];
  });
}

function token(role: 'student' | 'teacher' | 'moderator') {
  const id = role === 'teacher' ? 1 : role === 'moderator' ? 3 : 2;
  return signAccess({ id, role });
}

async function request(
  path: string,
  method = 'GET',
  role?: 'student' | 'teacher' | 'moderator',
  body?: unknown,
) {
  const response = await fetch(baseUrl + path, {
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

const validCourse = {
  title: 'Основы TypeScript',
  description: 'Полный курс для начинающих разработчиков',
  categoryId: 1,
  level: 'beginner',
};

describe('Каталог курсов', () => {
  it('возвращает список категорий', async () => {
    mockQueries([{ id: 1, name: 'Программирование' }]);

    const result = await request('/categories');

    expect(result.status).toBe(200);
    expect(result.body.data).toHaveLength(1);
  });

  it('возвращает опубликованные курсы', async () => {
    mockQueries(
      [{ count: '1' }],
      [{ id: 5, title: 'Основы TypeScript' }],
    );

    const result = await request('/');

    expect(result.status).toBe(200);
    expect(result.body.data).toHaveLength(1);
    expect(result.body.meta.total).toBe(1);
  });

  it('корректно рассчитывает пагинацию', async () => {
    mockQueries([{ count: '35' }], []);

    const result = await request('/?page=2&limit=10');

    expect(result.body.meta.page).toBe(2);
    expect(result.body.meta.limit).toBe(10);
    expect(result.body.meta.pages).toBe(4);
  });

  it('не показывает неопубликованный курс гостю', async () => {
    mockQueries([{ id: 5, teacher_id: 1, status: 'draft' }]);

    const result = await request('/5');

    expect(result.status).toBe(404);
  });
});

describe('Управление курсами', () => {
  it('запрещает студенту создавать курс', async () => {
    const result = await request(
      '/',
      'POST',
      'student',
      validCourse,
    );

    expect(result.status).toBe(403);
  });

  it('разрешает преподавателю создавать курс', async () => {
    mockQueries([{ id: 10, ...validCourse }]);

    const result = await request(
      '/',
      'POST',
      'teacher',
      validCourse,
    );

    expect(result.status).toBe(201);
    expect(result.body.data.id).toBe(10);
  });

  it('отклоняет курс с коротким названием', async () => {
    const result = await request(
      '/',
      'POST',
      'teacher',
      { ...validCourse, title: 'A' },
    );

    expect(result.status).toBe(400);
  });

  it('запрещает редактировать чужой курс', async () => {
    mockQueries([{ id: 10, teacher_id: 99 }]);

    const result = await request(
      '/10',
      'PATCH',
      'teacher',
      { title: 'Новое название' },
    );

    expect(result.status).toBe(403);
  });

  it('разрешает редактировать свой курс', async () => {
    mockQueries(
      [{ id: 10, teacher_id: 1, ...validCourse }],
      [{ id: 10, title: 'Новое название', status: 'draft' }],
    );

    const result = await request(
      '/10',
      'PATCH',
      'teacher',
      { title: 'Новое название' },
    );

    expect(result.status).toBe(200);
    expect(result.body.data.status).toBe('draft');
  });

  it('разрешает удалить собственный курс', async () => {
    mockQueries([{ teacher_id: 1 }], []);

    const result = await request('/10', 'DELETE', 'teacher');

    expect(result.status).toBe(200);
    expect(result.body.data.success).toBe(true);
  });
});

describe('Уроки и модерация', () => {
  it('разрешает преподавателю создавать урок', async () => {
    mockQueries(
      [{ teacher_id: 1 }],
      [{ id: 20, title: 'Первый урок' }],
    );

    const result = await request(
      '/10/lessons',
      'POST',
      'teacher',
      { title: 'Первый урок', content: 'Материалы урока' },
    );

    expect(result.status).toBe(201);
  });

  it('запрещает добавлять урок в чужой курс', async () => {
    mockQueries([{ teacher_id: 99 }]);

    const result = await request(
      '/10/lessons',
      'POST',
      'teacher',
      { title: 'Чужой урок' },
    );

    expect(result.status).toBe(403);
  });

  it('разрешает модератору публиковать курс', async () => {
    mockQueries([{ id: 10, status: 'published' }], []);

    const result = await request(
      '/10/moderate',
      'PATCH',
      'moderator',
      { status: 'published' },
    );

    expect(result.status).toBe(200);
    expect(result.body.data.status).toBe('published');
  });

  it('запрещает студенту модерацию', async () => {
    const result = await request(
      '/10/moderate',
      'PATCH',
      'student',
      { status: 'published' },
    );

    expect(result.status).toBe(403);
  });
});

describe('Обучение и прогресс', () => {
  it('записывает студента на курс', async () => {
    mockQueries([{ id: 15, student_id: 2, course_id: 10 }]);

    const result = await request(
      '/10/enroll',
      'POST',
      'student',
    );

    expect(result.status).toBe(201);
    expect(result.body.data.course_id).toBe(10);
  });

  it('не записывает на недоступный курс', async () => {
    mockQueries([]);

    const result = await request(
      '/10/enroll',
      'POST',
      'student',
    );

    expect(result.status).toBe(404);
  });

  it('отмечает урок пройденным', async () => {
    mockQueries([{ id: 1 }]);

    const result = await request(
      '/10/progress/20',
      'POST',
      'student',
    );

    expect(result.body.data.completed).toBe(true);
    expect(result.body.data.firstTime).toBe(true);
  });

  it('не дублирует прохождение урока', async () => {
    mockQueries([]);

    const result = await request(
      '/10/progress/20',
      'POST',
      'student',
    );

    expect(result.body.data.firstTime).toBe(false);
  });
});

describe('Отзывы', () => {
  it('запрещает отзыв без записи на курс', async () => {
    mockQueries([]);

    const result = await request(
      '/10/reviews',
      'POST',
      'student',
      { rating: 5, comment: 'Отличный курс!' },
    );

    expect(result.status).toBe(403);
  });

  it('разрешает студенту оставить отзыв', async () => {
    mockQueries([{ id: 8, rating: 5 }]);

    const result = await request(
      '/10/reviews',
      'POST',
      'student',
      { rating: 5, comment: 'Полезные материалы' },
    );

    expect(result.status).toBe(201);
    expect(result.body.data.rating).toBe(5);
  });
});
