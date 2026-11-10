# Архитектура Forma

```mermaid
flowchart TD
    Browser[React + TypeScript / Vite] -->|HTTP JSON + JWT| Express[Express API]
    Express --> Auth[Auth + RBAC middleware]
    Auth --> Controller[Маршруты и контроллеры]
    Controller --> Services[Сервисы и правила доступа]
    Services --> Repo[SQL репозитории / pg]
    Repo --> Postgres[(PostgreSQL)]
    Express --> Files[(Uploads)]
```

## Таблицы и связи

```mermaid
erDiagram
 USERS ||--o{ COURSES : teaches
 USERS ||--o{ ENROLLMENTS : studies
 USERS ||--o{ REVIEWS : writes
 CATEGORIES ||--o{ COURSES : groups
 COURSES ||--o{ LESSONS : includes
 COURSES ||--o{ ENROLLMENTS : has
 COURSES ||--o{ REVIEWS : has
 ENROLLMENTS ||--o{ LESSON_PROGRESS : tracks
 LESSONS ||--o{ LESSON_PROGRESS : completed
 USERS ||--o{ REFRESH_TOKENS : owns
 USERS ||--o{ AUDIT_LOG : acts
```

Ключевые бизнес-правила: публиковать курсы может только модератор; редактировать — автор или модератор; студент видит только свой прогресс; отзыв доступен только после записи на курс. Пароли хранятся в bcrypt, refresh-токены — в SHA-256.
