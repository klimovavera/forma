# Forma — маркетплейс учебных курсов

Учебный fullstack MVP с минималистичным интерфейсом на **Manrope**. Роли: студент, преподаватель и модератор. Реализованы каталог, категории, поиск, сортировка, пагинация, курсы и уроки, запись, прогресс, отзывы, авторизация (JWT access + refresh), восстановление пароля, личный кабинет, администрирование, загрузка файлов, дашборд, аудит и Swagger.

## Запуск

Нужен установленный **Docker Desktop / Docker Engine + Docker Compose**.

```bash
cp .env.example .env
# для локальной демонстрации можно оставить значения по умолчанию;
# перед размещением в сети замените пароли и JWT-секреты

docker compose up --build
```

- Сайт: http://localhost:5173
- API: http://localhost:4000/api
- Swagger UI: http://localhost:4000/api/docs
- PostgreSQL: localhost:5432

При первом старте создаются таблицы (SQL-миграция) и демоданные (6 курсов и 4 урока в каждом). Данные сохраняются в Docker volume.

## Демо-аккаунты

| Роль | Email | Пароль |
|---|---|---|
| Студент | student@demo.ru | Demo12345! |
| Преподаватель | teacher@demo.ru | Demo12345! |
| Модератор | moderator@demo.ru | Demo12345! |

Пользователь, зарегистрированный через интерфейс, получает роль **студент**. Преподавателя можно назначить из панели модератора.

## Технологии

Frontend: React 18, TypeScript strict, Vite, React Router, Recharts, lucide-react, адаптивный CSS, Manrope.

Backend: Node.js, Express, TypeScript strict, PostgreSQL (`pg`, параметризованные SQL-запросы), bcrypt, JWT, Zod, multer, swagger-ui-express, rate limiting. Инфраструктура: Docker Compose, GitHub Actions.

## Структура

```text
backend/src/routes/       REST-маршруты
backend/src/services/     бизнес-правила, токены
backend/src/middleware/   JWT/RBAC
backend/src/db/           PostgreSQL, миграции, сиды
backend/migrations/       SQL-миграции
frontend/src/pages/       интерфейсы ролей
frontend/src/components/  UI-компоненты
frontend/src/lib/         API-клиент и refresh
frontend/src/style.css    дизайн-система и адаптивность
docs/                     user stories, ER, архитектура, тест-план
.github/workflows/        CI
```

## Проверки без Docker

```bash
cd backend && npm install && npm test && npm run lint && npm run build
cd ../frontend && npm install && npm test -- --run && npm run lint && npm run build
```

## Известные ограничения учебного MVP

- Это исходный проект, не опубликованный на VPS. Укажите собственную публичную ссылку после деплоя.
- Автоматические **интеграционные тесты с реальной тестовой PostgreSQL** ещё не добавлены; текущее покрытие не подтверждено как ≥60%.
- Обновление уроков и удаление доступно через API, но экран преподавателя пока реализует создание уроков.
- Загрузка файла реализована, но изображение следует выбирать для обложки; PDF используется как учебный материал через API.
- Для продакшена нужны HTTPS, более строгая обработка загрузок и ограничение их доступности, безопасное хранение refresh-токена (httpOnly cookie), сборка статики вместо dev-сервера и отдельная конфигурация переменных `VITE_API_URL`.
- Swagger содержит основные маршруты и может быть дополнен полными схемами запросов/ответов.
- Разделы отчёта, дневник, реальные PR, фактические результаты тестирования и деплой следует заполнить результатами собственной работы.
