import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Toast } from './Toast';

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [message, setMessage] = useState<string | null>(null);

  async function handleSignOut() {
    try {
      await signOut();
      navigate('/login', { replace: true });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'تعذر تسجيل الخروج.');
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <NavLink className="brand" to="/" aria-label="منظّم النشر، لوحة التحكم">
          <span className="brand-mark" aria-hidden="true">م</span>
          <span>
            <strong>منظّم النشر</strong>
            <small>خطتك للمحتوى، في مكان واحد</small>
          </span>
        </NavLink>
        <nav className="main-nav" aria-label="التنقل الرئيسي">
          <NavLink to="/" end className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
            لوحة التحكم
          </NavLink>
          <NavLink to="/settings" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
            الإعدادات
          </NavLink>
        </nav>
        <div className="user-menu">
          <span className="user-email" title={user?.email ?? ''}>{user?.email}</span>
          <button className="button button-quiet button-small" type="button" onClick={() => void handleSignOut()}>
            خروج
          </button>
        </div>
      </header>
      <main className="page-container">{children}</main>
      {message && <Toast message={message} type="error" onClose={() => setMessage(null)} />}
    </div>
  );
}
