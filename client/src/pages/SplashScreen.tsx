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

        {/* Minimal arch silhouette */}
        <svg
          viewBox="0 0 100 120"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ width: 80, height: 96 }}
          aria-hidden="true"
        >
          <path
            d="M10 120 L10 54 Q10 6 50 2 Q90 6 90 54 L90 120 Z"
            stroke="#0F4C3A"
            strokeWidth="2.5"
            fill="#FAF7F0"
          />
          <path
            d="M18 116 L18 57 Q18 16 50 12 Q82 16 82 57 L82 116 Z"
            stroke="#B8862A"
            strokeWidth="1"
            fill="none"
            strokeDasharray="3 3"
          />
          <polygon points="50,0 54,5 50,10 46,5" fill="#B8862A" />
          {/* Rahl + Quran */}
          <line x1="35" y1="96" x2="28" y2="114" stroke="#0F4C3A" strokeWidth="2" strokeLinecap="round" />
          <line x1="65" y1="96" x2="72" y2="114" stroke="#0F4C3A" strokeWidth="2" strokeLinecap="round" />
          <line x1="30" y1="108" x2="70" y2="108" stroke="#0F4C3A" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M35 96 L40 78 Q50 74 50 74 L50 96 Z" fill="rgba(184,134,42,0.2)" stroke="#0F4C3A" strokeWidth="1" />
          <path d="M65 96 L60 78 Q50 74 50 74 L50 96 Z" fill="rgba(184,134,42,0.2)" stroke="#0F4C3A" strokeWidth="1" />
          <line x1="50" y1="74" x2="50" y2="96" stroke="#0F4C3A" strokeWidth="1.5" strokeLinecap="round" />
        </svg>

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
