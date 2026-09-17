/**
 * GlobalNav — Left sidebar on desktop, bottom bar on mobile.
 *
 *   Student:  Classes → /classes | Nazirah | Hifz | History | Settings
 *   Ustadh:   Home    → /home    | Nazirah | Hifz | History | Settings
 *
 * Note: Listen page is accessible via "Listen to this page" button in PageEditor
 */
import { NavLink } from 'react-router-dom';
import { Home, Grid3x3, Clock, Settings, Users } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface TabProps {
  to: string;
  label: string;
  icon: React.ReactNode;
}

/* ── Single nav item ─────────────────────────────────────────── */
function NavItem({ to, label, icon }: TabProps) {
  return (
    <NavLink
      to={to}
      className="nav-item group flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all"
      style={({ isActive }) => ({
        color: isActive ? 'var(--c-gold)' : 'var(--c-text-faint)',
        backgroundColor: isActive ? 'var(--c-gold-bg)' : 'transparent',
      })}
    >
      {icon}
      <span className="nav-label text-xs font-semibold">{label}</span>
    </NavLink>
  );
}

export default function GlobalBottomNav() {
  const { user } = useAuth();
  const isStudent = user?.role === 'student';

  const items: TabProps[] = [
    isStudent
      ? { to: '/classes', label: 'Classes', icon: <Users className="w-5 h-5" strokeWidth={2} /> }
      : { to: '/home',    label: 'Home',    icon: <Home  className="w-5 h-5" strokeWidth={2} /> },
    { to: '/nazirah', label: 'Nazirah', icon: <Grid3x3  className="w-5 h-5" strokeWidth={2} /> },
    { to: '/history', label: 'History', icon: <Clock    className="w-5 h-5" strokeWidth={2} /> },
    { to: '/settings', label: 'Settings', icon: <Settings className="w-5 h-5" strokeWidth={2} /> },
  ];

  return (
    <>
      {/* ── Desktop: Left sidebar ─────────────────────────────── */}
      <aside
        className="global-sidebar hidden md:flex fixed top-0 left-0 h-full z-40 flex-col border-r"
        style={{
          width: 'var(--sidebar-w)',
          backgroundColor: 'var(--c-bg-nav)',
          borderColor: 'var(--c-border)',
        }}
        aria-label="Main navigation"
      >
        {/* Logo / brand */}
        <div className="flex items-center justify-center py-6">
          <span
            className="font-amiri text-2xl leading-none"
            style={{ color: 'var(--c-gold)' }}
            lang="ar"
          >
            حفظ
          </span>
        </div>

        {/* Nav items */}
        <nav className="flex-1 flex flex-col gap-1 px-3 pt-2">
          {items.map(item => (
            <NavItem key={item.to} {...item} />
          ))}
        </nav>

        {/* Bottom section */}
        <div className="px-3 pb-4">
          <div className="h-px mb-3" style={{ backgroundColor: 'var(--c-border)' }} />
          <p className="text-[9px] text-center font-semibold uppercase tracking-wider" style={{ color: 'var(--c-text-faint)' }}>
            The Hifz App
          </p>
        </div>
      </aside>

      {/* ── Mobile: Bottom bar ────────────────────────────────── */}
      <nav
        className="global-bottom-nav md:hidden fixed bottom-0 left-0 right-0 z-40 flex border-t"
        style={{
          backgroundColor: 'var(--c-bg-nav)',
          borderColor: 'var(--c-border)',
          paddingBottom: 'env(safe-area-inset-bottom)',
          height: 'calc(56px + env(safe-area-inset-bottom))',
        }}
        aria-label="Main navigation"
      >
        {items.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 min-h-[44px] transition-colors"
            style={({ isActive }) => ({ color: isActive ? 'var(--c-gold)' : 'var(--c-text-faint)' })}
          >
            {item.icon}
            <span className="text-[9px] font-medium">{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </>
  );
}
