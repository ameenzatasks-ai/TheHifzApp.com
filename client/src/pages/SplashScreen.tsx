import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../api/auth';
import { loadRole, homeFor } from '../lib/savedRole';

export default function SplashScreen() {
  const navigate = useNavigate();

  useEffect(() => {
    // Kick off the auth check IMMEDIATELY while the splash animation plays,
    // then navigate as soon as both the request finishes AND a minimum
    // brand-display time has elapsed — whichever is later.
    const MIN_SPLASH_MS = 1200;
    const start = Date.now();

    const authPromise = authApi.me()
      .then(({ user }) => ({ ok: true as const, user }))
      .catch(() => ({ ok: false as const }));

    let cancelled = false;
    (async () => {
      const result = await authPromise;

      // Not logged in → go straight to welcome with no delay (no splash)
      if (!result.ok) {
        if (!cancelled) navigate('/welcome', { replace: true });
        return;
      }

      // Logged in → honour the minimum brand-display time
      const elapsed = Date.now() - start;
      const remaining = Math.max(0, MIN_SPLASH_MS - elapsed);
      await new Promise(r => setTimeout(r, remaining));
      if (cancelled) return;

      if (!result.user.role) {
        // DB was wiped (redeploy) — restore the role saved for THIS account
        const saved = loadRole(result.user);
        if (saved) {
          try {
            await authApi.setRole(saved);
            navigate(homeFor(saved), { replace: true });
            return;
          } catch { /* fall through to onboarding */ }
        }
        navigate('/onboarding', { replace: true });
      } else {
        // Students land on classes list; Ustadh lands on home dashboard
        navigate(homeFor(result.user.role), { replace: true });
      }
    })();

    return () => { cancelled = true; };
  }, [navigate]);

  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center pt-safe pb-safe"
      style={{ backgroundColor: '#FAF7F0' }}
    >
      <div className="animate-fade-in-up flex flex-col items-center gap-6">
        {/* Gold Arabic حِفْظ calligraphy */}
        <p
          className="font-amiri leading-none"
          style={{
            color: '#B8862A',
            fontSize: 84,
            textShadow: '0 1px 0 rgba(184,134,42,0.15)',
          }}
          lang="ar"
        >
          حفظ
        </p>

        {/* App logo */}
        <img src="/logo.png" alt="The Hifz App logo" style={{ width: 120, height: 120 }} />

        {/* Name */}
        <div className="flex flex-col items-center gap-2">
          <p
            className="font-inter font-bold tracking-[0.20em] uppercase text-xs"
            style={{ color: '#0F4C3A' }}
          >
            The Hifz App
          </p>
          <div className="flex items-center gap-2">
            <div style={{ width: 28, height: 1, backgroundColor: '#B8862A', opacity: 0.5 }} />
            <svg width="6" height="6" viewBox="0 0 6 6" aria-hidden="true">
              <polygon points="3,0 6,3 3,6 0,3" fill="#B8862A" />
            </svg>
            <div style={{ width: 28, height: 1, backgroundColor: '#B8862A', opacity: 0.5 }} />
          </div>
          <p
            className="font-inter text-[10px] tracking-[0.24em] uppercase"
            style={{ color: '#B8862A' }}
          >
            Read · Recite · Reflect
          </p>
        </div>
      </div>
    </div>
  );
}
