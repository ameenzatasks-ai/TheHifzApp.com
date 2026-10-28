import { Suspense, lazy, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { TourContext } from './contexts/TourContext';
import ErrorBoundary from './components/ErrorBoundary';
import GlobalBottomNav from './components/GlobalBottomNav';
import TourModal from './components/TourModal';
import Spinner from './components/Spinner';
import UpdatePrompt from './components/UpdatePrompt';

/* ── Lazy-loaded pages ───────────────────────────────────── */
const SplashScreen     = lazy(() => import('./pages/SplashScreen'));
const WelcomeScreen    = lazy(() => import('./pages/WelcomeScreen'));
const AuthCallback     = lazy(() => import('./pages/AuthCallback'));
const OnboardingScreen = lazy(() => import('./pages/OnboardingScreen'));
const HomeDashboard    = lazy(() => import('./pages/HomeDashboard'));
const ClassesList      = lazy(() => import('./pages/ClassesList'));
const ProfileScreen    = lazy(() => import('./pages/ProfileScreen'));
const ClassShell       = lazy(() => import('./pages/class/ClassShell'));
const PagesGrid        = lazy(() => import('./pages/class/PagesGrid'));
const StudentDetail    = lazy(() => import('./pages/class/StudentDetail'));
const AuditPage           = lazy(() => import('./pages/AuditPage'));
const NazirahLogsList      = lazy(() => import('./pages/class/NazirahLogsList'));
const NazirahLogDetailPage = lazy(() => import('./pages/class/NazirahLogDetail'));
const NazirahTrack         = lazy(() => import('./pages/NazirahTrack'));
const NazirahDatePicker    = lazy(() => import('./pages/NazirahDatePicker'));
const HistoryPage          = lazy(() => import('./pages/HistoryPage'));
const HistoryLogDetail     = lazy(() => import('./pages/class/NazirahLogDetail'));
const HifzHome             = lazy(() => import('./pages/hifz/HifzHome'));
const DawrLog              = lazy(() => import('./pages/hifz/DawrLog'));
const StudentDawrLog       = lazy(() => import('./pages/hifz/StudentDawrLog'));
const HifzHistoryPage      = lazy(() => import('./pages/class/HifzHistoryPage'));
const SettingsPage         = lazy(() => import('./pages/SettingsPage'));
const ListenPage           = lazy(() => import('./pages/ListenPage'));

/* ── Spinner fallback ────────────────────────────────────── */
function PageFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--c-bg)' }}>
      <Spinner size={32} color="var(--c-gold)" />
    </div>
  );
}

/* ── Protected layout ────────────────────────────────────── */
function ProtectedLayout() {
  const { user, loading } = useAuth();
  const [tourOpen, setTourOpen] = useState<boolean>(() => {
    try { return !localStorage.getItem('nazirah-tour-seen'); } catch { return false; }
  });

  function openTour() { setTourOpen(true); }
  function closeTour() {
    setTourOpen(false);
    try { localStorage.setItem('nazirah-tour-seen', '1'); } catch {}
  }

  if (loading) return <PageFallback />;
  if (!user)        return <Navigate to="/welcome"    replace />;
  if (!user.role)   return <Navigate to="/onboarding" replace />;

  return (
    <TourContext.Provider value={{ open: openTour }}>
      <Outlet />
      <GlobalBottomNav />
      <TourModal open={tourOpen} onClose={closeTour} />
    </TourContext.Provider>
  );
}

/* ── Public-only layout (redirect away if already authed) ── */
function PublicLayout() {
  const { user, loading } = useAuth();

  if (loading) return <PageFallback />;
  if (user?.role) return <Navigate to={user.role === 'student' ? '/classes' : '/home'} replace />;

  return <Outlet />;
}

/* ── Theme-aware Toaster ─────────────────────────────────── */
function ThemedToaster() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  return (
    <Toaster
      position="top-center"
      toastOptions={{
        style: {
          background: isDark ? '#1c1c1e' : '#FFFFFF',
          color: isDark ? '#FAF7F0' : '#1A1208',
          borderRadius: 12,
          border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)',
          fontSize: 14,
          boxShadow: isDark
            ? '0 4px 20px rgba(0,0,0,0.5)'
            : '0 4px 20px rgba(0,0,0,0.12)',
        },
      }}
    />
  );
}

/* ── App routes ──────────────────────────────────────────── */
function AppRoutes() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        {/* Splash — handles its own auth redirect */}
        <Route path="/" element={<SplashScreen />} />

        {/* Public routes */}
        <Route element={<PublicLayout />}>
          <Route path="/welcome"    element={<WelcomeScreen />} />
          <Route path="/onboarding" element={<OnboardingScreen />} />
        </Route>

        {/* OAuth callback — refreshUser then ProtectedLayout redirects */}
        <Route path="/auth/callback" element={<AuthCallback />} />

        {/* Protected routes */}
        <Route element={<ProtectedLayout />}>
          <Route path="/dashboard" element={<Navigate to="/home" replace />} />

          {/* Home dashboard */}
          <Route path="/home" element={<HomeDashboard />} />

          {/* Nazirah tracker — direct access (bottom nav) */}
          <Route path="/nazirah" element={<NazirahTrack />} />
          {/* Date picker → then /nazirah?date=… (from ClassShell button) */}
          <Route path="/nazirah/date" element={<NazirahDatePicker />} />
          <Route path="/nazirah/audit" element={<AuditPage />} />

          {/* Listen to the Quran — direct access (bottom nav) */}
          <Route path="/listen" element={<ListenPage />} />

          {/* Classes list */}
          <Route path="/classes" element={<ClassesList />} />

          {/* Class detail (single Track view) */}
          <Route path="/classes/:classId" element={<ClassShell />} />

          {/* Student page grid (own pages) */}
          <Route path="/classes/:classId/pages" element={<PagesGrid />} />

          {/* Ustadh → student detail (Juz grid in write-mode against student) */}
          <Route path="/classes/:classId/student/:studentId" element={<StudentDetail />} />

          {/* Audit timelines (Bank Statement view) */}
          <Route path="/classes/:classId/audit" element={<AuditPage />} />
          <Route path="/classes/:classId/student/:studentId/audit" element={<AuditPage />} />

          {/* Nazira log history — student's own */}
          <Route path="/classes/:classId/nazirah-logs" element={<NazirahLogsList />} />
          <Route path="/classes/:classId/nazirah-logs/:logId" element={<NazirahLogDetailPage />} />

          {/* Nazira log history — Ustadh viewing a student */}
          <Route path="/classes/:classId/student/:studentId/nazirah-logs" element={<NazirahLogsList />} />
          <Route path="/classes/:classId/student/:studentId/nazirah-logs/:logId" element={<NazirahLogDetailPage />} />

          {/* Hifz history — Ustadh viewing a student's Hifz sessions + SP log */}
          <Route path="/classes/:classId/student/:studentId/hifz-history" element={<HifzHistoryPage />} />

          {/* History tab */}
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/history/:logId" element={<HistoryLogDetail />} />

          {/* Hifz module (standalone — legacy/no-class) */}
          <Route path="/hifz" element={<HifzHome />} />
          <Route path="/hifz/dawr" element={<DawrLog />} />

          {/* Hifz module (class-scoped — data isolation) */}
          <Route path="/classes/:classId/hifz" element={<HifzHome />} />
          <Route path="/classes/:classId/hifz/dawr" element={<DawrLog />} />

          {/* Per-student scoring (Ustadh) */}
          <Route path="/classes/:classId/student/:studentId/dawr" element={<StudentDawrLog />} />

          {/* Settings */}
          <Route path="/settings" element={<SettingsPage />} />

          {/* Profile */}
          <Route path="/profile" element={<ProfileScreen />} />
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

/* ── Root ────────────────────────────────────────────────── */
export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <AuthProvider>
            <AppRoutes />
            <ThemedToaster />
            <UpdatePrompt />
          </AuthProvider>
        </BrowserRouter>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
