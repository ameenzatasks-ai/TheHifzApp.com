import { useNavigate } from 'react-router-dom';
import { LogOut, Sun, Moon, Map } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useTour } from '../contexts/TourContext';

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const { open: openTour } = useTour();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/welcome', { replace: true });
    toast.success('Signed out');
  }

  if (!user) return null;

  const initial = user.name[0]?.toUpperCase();

  return (
    <div
      className="min-h-screen pb-layout pt-safe"
      style={{ backgroundColor: 'var(--c-bg)' }}
    >
      <div className="p-5 max-w-md mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-semibold" style={{ color: 'var(--c-text)' }}>Profile</h1>
          {/* Theme toggle */}
          <button
            onClick={toggle}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium transition-all active:scale-95"
            style={{
              backgroundColor: 'var(--c-bg-subtle)',
              color: 'var(--c-text-muted)',
              border: '1px solid var(--c-border-soft)',
            }}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark'
              ? <><Sun className="w-3.5 h-3.5" style={{ color: 'var(--c-gold)' }} /> Light</>
              : <><Moon className="w-3.5 h-3.5" style={{ color: 'var(--c-gold)' }} /> Dark</>
            }
          </button>
        </div>

        {/* Avatar + name */}
        <div className="flex flex-col items-center gap-3 mb-8">
          {user.avatar_url ? (
            <img src={user.avatar_url} alt={user.name} className="w-20 h-20 rounded-full object-cover" loading="lazy" />
          ) : (
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold"
              style={{ backgroundColor: 'var(--c-green-dark)', color: 'var(--c-gold)' }}
            >
              {initial}
            </div>
          )}
          <div className="text-center">
            <p className="text-lg font-semibold" style={{ color: 'var(--c-text)' }}>{user.name}</p>
            <p className="text-sm capitalize" style={{ color: 'var(--c-text-muted)' }}>
              {user.role ?? 'No role'}
            </p>
          </div>
        </div>

        {/* Info rows */}
        <div
          className="rounded-2xl overflow-hidden divide-y"
          style={{ backgroundColor: 'var(--c-bg-card)', borderColor: 'var(--c-border)' }}
        >
          {[
            { label: 'Name',         value: user.name },
            { label: 'Email',        value: user.email },
            { label: 'Role',         value: user.role ? (user.role === 'ustadh' ? 'Ustadh (Teacher)' : 'Student') : '—' },
            { label: 'Member since', value: new Date(user.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) },
          ].map(({ label, value }) => (
            <div
              key={label}
              className="px-4 py-3 flex items-center justify-between"
              style={{ borderColor: 'var(--c-border)' }}
            >
              <span className="text-sm" style={{ color: 'var(--c-text-muted)' }}>{label}</span>
              <span className="text-sm font-medium" style={{ color: 'var(--c-text)' }}>{value}</span>
            </div>
          ))}
        </div>

        {/* Take a Tour */}
        <button
          onClick={openTour}
          className="mt-6 w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-medium text-sm border transition-all active:scale-95"
          style={{
            color: 'var(--c-gold)',
            borderColor: 'var(--c-gold-bg)',
            backgroundColor: 'var(--c-gold-bg)',
          }}
        >
          <Map className="w-4 h-4" />
          Take a Tour
        </button>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="mt-3 w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-medium text-sm border transition-all active:scale-95"
          style={{
            color: 'var(--c-red)',
            borderColor: 'var(--c-red-bg)',
            backgroundColor: 'var(--c-red-bg)',
          }}
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </div>
  );
}
