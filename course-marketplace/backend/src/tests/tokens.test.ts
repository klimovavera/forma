
import { describe, it, expect } from 'vitest';

import {
  signAccess,
  signRefresh,
  verifyAccess,
  verifyRefresh,
  hashToken,
  canManageCourse,
  pageParams,
} from '../services/security.js';

describe('JWT авторизация', () => {
  it('создаёт access-токен', () => {
    const token = signAccess({ id: 1, role: 'student' });
    expect(typeof token).toBe('string');
  });

  it('сохраняет роль пользователя', () => {
    const token = signAccess({ id: 2, role: 'teacher' });
    expect(verifyAccess(token).role).toBe('teacher');
  });

  it('отклоняет повреждённый токен', () => {
    expect(() => verifyAccess('invalid.token')).toThrow();
  });

  it('создаёт refresh-токен', () => {
    const token = signRefresh({ id: 3, role: 'student' });
    expect(verifyRefresh(token).id).toBe(3);
  });

  it('запрещает использовать refresh вместо access', () => {
    const token = signRefresh({ id: 1, role: 'student' });
    expect(() => verifyAccess(token)).toThrow();
  });

  it('запрещает использовать access вместо refresh', () => {
    const token = signAccess({ id: 1, role: 'student' });
    expect(() => verifyRefresh(token)).toThrow();
  });
});

describe('Безопасность токенов', () => {
  it('создаёт SHA-256 хэш', () => {
    expect(hashToken('secret')).toMatch(/^[a-f0-9]{64}$/);
  });

  it('одинаковые токены имеют одинаковый хэш', () => {
    expect(hashToken('abc')).toBe(hashToken('abc'));
  });

  it('разные токены имеют разные хэши', () => {
    expect(hashToken('abc')).not.toBe(hashToken('xyz'));
  });
});

describe('Разграничение ролей', () => {
  it('преподаватель управляет своим курсом', () => {
    expect(canManageCourse('teacher', 1, 1)).toBe(true);
  });

  it('преподаватель не управляет чужим курсом', () => {
    expect(canManageCourse('teacher', 1, 2)).toBe(false);
  });

  it('модератор управляет любым курсом', () => {
    expect(canManageCourse('moderator', 1, 2)).toBe(true);
  });

  it('студент не редактирует курсы', () => {
    expect(canManageCourse('student', 1, 1)).toBe(false);
  });
});

describe('Пагинация', () => {
  it('устанавливает страницу по умолчанию', () => {
    expect(pageParams(undefined, undefined).page).toBe(1);
  });

  it('вычисляет смещение', () => {
    expect(pageParams(3, 10).offset).toBe(20);
  });

  it('ограничивает количество записей', () => {
    expect(pageParams(1, 100).limit).toBe(30);
  });

  it('исправляет отрицательную страницу', () => {
    expect(pageParams(-10, 10).page).toBe(1);
  });
});
