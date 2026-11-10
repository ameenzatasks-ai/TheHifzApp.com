/**
 * MushafPage — look at one page of the Mus'haf as it is printed.
 *
 * Each page is a WebP image made from the PDF (server/public/quran-pages), so it
 * looks exactly like the printed page. While a page is on screen, the pages either
 * side are fetched in the background, so turning over shows at once. Pages you
 * have seen are kept by the app, so they open straight away next time.
 *
 * Reached from the page editor's "View page" button, as /mushaf?page=N.
 */
import { useEffect, useState } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, RotateCw } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { juzForPage } from '../../../shared/juz-map';
import Spinner from '../components/Spinner';

const TOTAL_PAGES = 604;

/** Page images are 1001 × 1415 pixels, so the frame keeps that shape while loading. */
const PAGE_ASPECT = '1001 / 1415';

function pageSrc(n: number): string {
  return `/quran-pages/${String(n).padStart(3, '0')}.webp`;
}

export default function MushafPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = parseInt(searchParams.get('page') ?? '', 10);
  const page = Number.isInteger(requested) && requested >= 1 && requested <= TOTAL_PAGES ? requested : 1;

  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [jump, setJump] = useState(String(page));

  // A different page: start loading it again and show its number in the box.
  useEffect(() => {
    setLoaded(false);
    setFailed(false);
    setJump(String(page));
  }, [page]);

  // Fetch the neighbouring pages now, so the next turn is instant.
  useEffect(() => {
    for (const n of [page + 1, page - 1, page + 2]) {
      if (n >= 1 && n <= TOTAL_PAGES) {
        const warm = new Image();
        warm.src = pageSrc(n);
      }
    }
  }, [page]);

  function goTo(n: number) {
    if (!Number.isInteger(n) || n < 1 || n > TOTAL_PAGES) {
      setJump(String(page));
      return;
    }
    setSearchParams({ page: String(n) });
  }

  const juz = juzForPage(page)?.juz;

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--c-bg)' }}>
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 pt-safe pb-3 border-b flex-shrink-0"
        style={{ backgroundColor: 'var(--c-bg-nav)', borderColor: 'var(--c-border)' }}
      >
        <button
          onClick={() => navigate(-1)}
          className="p-1.5 -ml-1.5 rounded-lg transition-all active:scale-90"
          style={{ color: 'var(--c-text-muted)' }}
          aria-label="Back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="font-semibold text-base" style={{ color: 'var(--c-text)' }}>
            Mus'haf
          </h1>
          <p className="text-[10px] uppercase tracking-[0.2em]" style={{ color: 'var(--c-text-muted)' }}>
            {juz ? `Juz ${juz} · ` : ''}Page {page}
          </p>
        </div>
      </div>

      {/* Page */}
      <div className="flex-1 px-3 py-4">
        <div className="mx-auto w-full" style={{ maxWidth: 520 }}>
          <div
            className="relative w-full overflow-hidden rounded-2xl"
            style={{
              aspectRatio: PAGE_ASPECT,
              backgroundColor: '#FFFDF5',
              border: '1px solid var(--c-border-soft)',
            }}
          >
            {!loaded && !failed && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Spinner size={28} color="var(--c-gold)" />
              </div>
            )}

            {failed ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
                <p className="text-sm font-semibold" style={{ color: 'var(--c-text)' }}>
                  This page did not load.
                </p>
                <button
                  onClick={() => { setFailed(false); setAttempt(a => a + 1); }}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all active:scale-95"
                  style={{ backgroundColor: 'var(--c-gold)', color: '#0d0d0d' }}
                >
                  <RotateCw className="w-4 h-4" />
                  Try again
                </button>
              </div>
            ) : (
              <img
                key={`${page}-${attempt}`}
                src={pageSrc(page)}
                alt={`Mus'haf page ${page}`}
                width={1001}
                height={1415}
                decoding="async"
                onLoad={() => setLoaded(true)}
                onError={() => setFailed(true)}
                className="w-full h-full block"
                style={{ opacity: loaded ? 1 : 0, transition: 'opacity 120ms ease-out' }}
              />
            )}
          </div>

          {/* Turn the page, or type a page number */}
          <div className="mt-4 flex items-center justify-between gap-3">
            <button
              onClick={() => goTo(page - 1)}
              disabled={page <= 1}
              className="flex items-center gap-1 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95 disabled:opacity-40"
              style={{ backgroundColor: 'var(--c-bg-card)', color: 'var(--c-text)', border: '1px solid var(--c-border-soft)' }}
              aria-label="Previous page"
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </button>

            <form
              className="flex items-center gap-2"
              onSubmit={e => { e.preventDefault(); goTo(parseInt(jump, 10)); }}
            >
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={TOTAL_PAGES}
                value={jump}
                onChange={e => setJump(e.target.value)}
                className="w-20 px-3 py-2 rounded-xl text-sm text-center outline-none"
                style={{ backgroundColor: 'var(--c-bg-card)', border: '1.5px solid var(--c-border-soft)', color: 'var(--c-text)' }}
                aria-label="Page number"
              />
              <span className="text-xs" style={{ color: 'var(--c-text-muted)' }}>of {TOTAL_PAGES}</span>
            </form>

            <button
              onClick={() => goTo(page + 1)}
              disabled={page >= TOTAL_PAGES}
              className="flex items-center gap-1 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95 disabled:opacity-40"
              style={{ backgroundColor: 'var(--c-bg-card)', color: 'var(--c-text)', border: '1px solid var(--c-border-soft)' }}
              aria-label="Next page"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
