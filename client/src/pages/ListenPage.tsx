/**
 * ListenPage — play the recitation of a single Mus'haf page.
 *
 * Reached from the bottom nav, or from the page editor's "Listen to this page"
 * button, which deep-links as /listen?page=N. The player itself lives in
 * RecitationPlayer, which the Mus'haf page view also uses.
 */
import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { juzForPage } from '../../../shared/juz-map';
import RecitationPlayer from '../components/RecitationPlayer';

const TOTAL_PAGES = 604;

export default function ListenPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [pageInput, setPageInput] = useState(searchParams.get('page') ?? '');

  const pageNum   = parseInt(pageInput, 10);
  const pageValid = Number.isInteger(pageNum) && pageNum >= 1 && pageNum <= TOTAL_PAGES;
  const juz       = pageValid ? juzForPage(pageNum) : undefined;

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
            Listen
          </h1>
          <p className="text-[10px] uppercase tracking-[0.2em]" style={{ color: 'var(--c-text-muted)' }}>
            Ayman Suwayd
          </p>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 px-4 py-6">
        <div className="mx-auto w-full" style={{ maxWidth: 420 }}>
          {/* Page finder */}
          <label
            htmlFor="listen-page"
            className="block text-xs font-semibold uppercase tracking-wider mb-2"
            style={{ color: 'var(--c-text-muted)' }}
          >
            Which page do you want to hear?
          </label>
          <input
            id="listen-page"
            type="number"
            inputMode="numeric"
            min={1}
            max={TOTAL_PAGES}
            value={pageInput}
            onChange={e => setPageInput(e.target.value)}
            placeholder={`1 – ${TOTAL_PAGES}`}
            className="w-full px-4 py-3 rounded-xl text-sm outline-none"
            style={{
              backgroundColor: 'var(--c-bg-card)',
              border: '1.5px solid var(--c-border-soft)',
              color: 'var(--c-text)',
            }}
          />
          <p className="text-[11px] mt-1.5 mb-6" style={{ color: 'var(--c-text-muted)' }}>
            {pageInput.trim() === ''
              ? 'Enter a page number to find its recitation.'
              : pageValid
                ? `Page ${pageNum} is in Juz ${juz?.juz}.`
                : `Enter a page between 1 and ${TOTAL_PAGES}.`}
          </p>

          {/* Player */}
          {pageValid && (
            <div
              className="rounded-3xl px-6 py-8 text-center"
              style={{ backgroundColor: 'var(--c-bg-card)', border: '1px solid var(--c-border-soft)' }}
            >
              <p className="text-[10px] uppercase tracking-[0.22em] font-semibold" style={{ color: 'var(--c-text-muted)' }}>
                Juz {juz?.juz}
              </p>
              <p className="font-bold text-2xl mt-1 mb-6" style={{ color: 'var(--c-text)' }}>
                Page {pageNum}
              </p>
              <RecitationPlayer page={pageNum} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
