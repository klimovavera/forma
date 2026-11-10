
import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  BrowserRouter,
  Link,
  NavLink,
  Navigate,
  Route,
  Routes,
  useNavigate,
} from 'react-router-dom';
import {
  ArrowUpRight,
  LogOut,
  Menu,
  UserRound,
  X,
} from 'lucide-react';

import { session, post, type User } from './lib/api';
import { Home } from './pages/Home';
import { Catalog } from './pages/Catalog';
import { CourseDetail } from './pages/CourseDetail';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { MyCourses } from './pages/MyCourses';
import { Manage } from './pages/Manage';
import { Admin } from './pages/Admin';
import { Profile } from './pages/Profile';
import './style.css';

function App() {
  const [user, setUser] = useState<User | null>(
    session.get()?.user || null
  );

  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const cb = () => setUser(session.get()?.user || null);

    window.addEventListener('session-changed', cb);

    return () => {
      window.removeEventListener('session-changed', cb);
    };
  }, []);

  async function logout() {
    try {
      await post('/auth/logout', {
        refreshToken: session.get()?.refreshToken,
      });
    } catch {}

    session.clear();
    setUser(null);
    navigate('/');
  }

  return (
    <>
      <header className="header">
        <div className="container nav">
          <Link to="/" className="logo">
            <span className="logo-mark">f.</span>
            forma
            <span className="logo-dot">.</span>
          </Link>

          <nav className={open ? 'links open' : 'links'}>
            <NavLink
              to="/catalog"
              onClick={() => setOpen(false)}
            >
              Все курсы
            </NavLink>

            {user && (
              <NavLink
                to="/dashboard"
                onClick={() => setOpen(false)}
              >
                Мой кабинет
              </NavLink>
            )}

            {(user?.role === 'teacher' ||
              user?.role === 'moderator') && (
              <NavLink
                to="/manage"
                onClick={() => setOpen(false)}
              >
                Создать курс
              </NavLink>
            )}

            {user?.role === 'moderator' && (
              <NavLink
                to="/admin"
                onClick={() => setOpen(false)}
              >
                Модерация
              </NavLink>
            )}
          </nav>

          <div className="nav-actions">
            {user ? (
              <>
                <Link className="user-link" to="/profile">
                  <UserRound size={18} />
                  <span>{user.name.split(' ')[0]}</span>
                </Link>

                <button
                  className="icon-button"
                  onClick={logout}
                  title="Выйти"
                >
                  <LogOut size={19} />
                </button>
              </>
            ) : (
              <Link to="/login" className="btn btn-dark">
                Войти <ArrowUpRight size={16} />
              </Link>
            )}

            <button
              className="menu-toggle"
              onClick={() => setOpen(!open)}
            >
              {open ? <X /> : <Menu />}
            </button>
          </div>
        </div>
      </header>

      <main>
        <Routes>
          <Route path="/" element={<Home />} />

          <Route
            path="/catalog"
            element={<Catalog />}
          />

          <Route
            path="/courses/:id"
            element={<CourseDetail user={user} />}
          />

          <Route
            path="/login"
            element={<Login onLogin={setUser} />}
          />

          <Route
            path="/reset-password"
            element={<Login onLogin={setUser} />}
          />

          <Route
            path="/dashboard"
            element={
              user
                ? <Dashboard user={user} />
                : <Navigate to="/login" />
            }
          />

          <Route
            path="/my-courses"
            element={
              user
                ? <MyCourses />
                : <Navigate to="/login" />
            }
          />

          <Route
            path="/manage"
            element={
              user?.role === 'teacher' ||
              user?.role === 'moderator'
                ? <Manage />
                : <Navigate to="/" />
            }
          />

          <Route
            path="/admin"
            element={
              user?.role === 'moderator'
                ? <Admin />
                : <Navigate to="/" />
            }
          />

          <Route
            path="/profile"
            element={
              user
                ? (
                  <Profile
                    user={user}
                    onChange={setUser}
                  />
                )
                : <Navigate to="/login" />
            }
          />

          <Route
            path="*"
            element={<Navigate to="/" />}
          />
        </Routes>
      </main>

      <footer className="footer">
        <div className="container footer-inner">
          <Link to="/" className="logo">
            <span className="logo-mark">f.</span>
            forma
            <span className="logo-dot">.</span>
          </Link>

          <span>Знания, которые двигают вперёд.</span>
          <span>© 2026 Forma Education</span>
        </div>
      </footer>
    </>
  );
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);

