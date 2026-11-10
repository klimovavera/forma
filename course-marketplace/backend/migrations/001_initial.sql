CREATE TABLE IF NOT EXISTS users (
 id SERIAL PRIMARY KEY, name VARCHAR(120) NOT NULL, email VARCHAR(255) NOT NULL UNIQUE,
 password_hash TEXT NOT NULL, role VARCHAR(20) NOT NULL DEFAULT 'student' CHECK (role IN ('student','teacher','moderator')),
 blocked BOOLEAN NOT NULL DEFAULT FALSE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS categories (id SERIAL PRIMARY KEY, name VARCHAR(100) NOT NULL UNIQUE);
CREATE TABLE IF NOT EXISTS courses (
 id SERIAL PRIMARY KEY, teacher_id INT NOT NULL REFERENCES users(id), category_id INT REFERENCES categories(id),
 title VARCHAR(180) NOT NULL, description TEXT NOT NULL, cover_url TEXT,
 level VARCHAR(20) NOT NULL DEFAULT 'beginner' CHECK(level IN('beginner','intermediate','advanced')),
 status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK(status IN('draft','pending','published','rejected')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS lessons (
 id SERIAL PRIMARY KEY, course_id INT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
 title VARCHAR(180) NOT NULL, content TEXT NOT NULL DEFAULT '', attachment_url TEXT,
 position INT NOT NULL DEFAULT 0, UNIQUE(course_id,position)
);
CREATE TABLE IF NOT EXISTS enrollments (
 id SERIAL PRIMARY KEY, student_id INT NOT NULL REFERENCES users(id), course_id INT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(student_id,course_id)
);
CREATE TABLE IF NOT EXISTS lesson_progress (
 enrollment_id INT NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
 lesson_id INT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
 completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY(enrollment_id,lesson_id)
);
CREATE TABLE IF NOT EXISTS reviews (
 id SERIAL PRIMARY KEY, course_id INT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
 student_id INT NOT NULL REFERENCES users(id), rating INT NOT NULL CHECK(rating BETWEEN 1 AND 5),
 comment TEXT NOT NULL DEFAULT '', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(course_id,student_id)
);
CREATE TABLE IF NOT EXISTS refresh_tokens (
 id SERIAL PRIMARY KEY, user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 token_hash VARCHAR(64) NOT NULL UNIQUE, expires_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE IF NOT EXISTS password_resets (
 id SERIAL PRIMARY KEY, user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 token_hash VARCHAR(64) NOT NULL UNIQUE, expires_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE IF NOT EXISTS audit_log (
 id SERIAL PRIMARY KEY, actor_id INT REFERENCES users(id) ON DELETE SET NULL,
 action VARCHAR(100) NOT NULL, entity_type VARCHAR(60) NOT NULL, entity_id INT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_courses_title ON courses(lower(title));
CREATE INDEX IF NOT EXISTS idx_courses_status_category ON courses(status,category_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_student ON enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_lessons_course ON lessons(course_id,position);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_log(actor_id,created_at DESC);
