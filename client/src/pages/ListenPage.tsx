/**
 * ListenPage — play the recitation of a single Mus'haf page.
 *
 * Reached from the bottom nav, or from the page editor's "Listen to this page"
 * button, which deep-links as /listen?page=N.
 *
 * The <audio> element is declarative and keyed by page number: changing the
 * page remounts it, so the previous recitation is torn down by React rather
 * than left playing in the background.
 */
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Play, Pause, AlertCircle, RotateCw, RotateCcw } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { juzForPage } from '../../../shared/juz-map';

const TOTAL_PAGES = 604;
/** Transient archive errors are common during ingest; do not give up at once. */
const RETRY_LIMIT = 3;

/**
 * Where the recitations are served from. Defaults to same-origin `/audio`,
 * which the API serves locally; in production it points at object storage,
 * because 2.47 GB of recordings cannot ride along with the deploy.
 */
const AUDIO_BASE = (import.meta.env.VITE_AUDIO_BASE_URL || '/audio').replace(/\/$/, '');

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function ListenPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [pageInput, setPageInput] = useState(searchParams.get('page') ?? '');
  const [playing,  setPlaying]  = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [failed,   setFailed]   = useState(false);
  const [current,  setCurrent]  = useState(0);
  const [duration, setDuration] = useState(0);
  const [attempt,  setAttempt]  = useState(0);
  const [speed,    setSpeed]    = useState(1);

  const audioRef   = useRef<HTMLAudioElement | null>(null);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pageNum   = parseInt(pageInput, 10);
  const pageValid = Number.isInteger(pageNum) && pageNum >= 1 && pageNum <= TOTAL_PAGES;
  const juz       = pageValid ? juzForPage(pageNum) : undefined;
  // Files are named 001.mp3 … 604.mp3
  const audioUrl  = pageValid ? `${AUDIO_BASE}/${String(pageNum).padStart(3, '0')}.mp3` : null;

  // Reset transport state whenever the track changes.
  useEffect(() => {
    setPlaying(false);
    setFailed(false);
    setCurrent(0);
    setDuration(0);
    setAttempt(0);
  }, [audioUrl]);

  useEffect(() => () => {
    if (retryTimer.current) clearTimeout(retryTimer.current);
  }, []);

  /**
   * The recordings are served from an archive that returns transient errors
   * while it is ingesting uploads. Treating the first error as final made a
   * momentary blip look like a permanently broken page — it stayed broken
   * until the page number was changed. So retry a few times, backing off,
   * before admitting defeat.
   */
  function handleError() {
    setLoading(false);
    setPlaying(false);
    if (attempt >= RETRY_LIMIT) {
      setFailed(true);
      return;
    }
    const next = attempt + 1;
    if (retryTimer.current) clearTimeout(retryTimer.current);
    retryTimer.current = setTimeout(() => {
      setAttempt(next);
      audioRef.current?.load();
    }, 700 * next);
  }

  /** Manual recovery, so a failed page need not be navigated away from. */
  function retryNow() {
    setFailed(false);
    setAttempt(0);
    setLoading(true);
    audioRef.current?.load();
  }

  function toggle() {
    const el = audioRef.current;
    if (!el || failed) return;
    if (el.paused) {
      setLoading(true);
      el.play()
        .then(() => setLoading(false))
        .catch(() => { setLoading(false); setFailed(true); });
    } else {
      el.pause();
    }
  }

  function seek(to: number) {
    const el = audioRef.current;
    if (!el || !Number.isFinite(duration) || duration <= 0) return;
    el.currentTime = to;
    setCurrent(to);
  }

  function skip(seconds: number) {
    const el = audioRef.current;
    if (!el || !Number.isFinite(duration) || duration <= 0) return;
    const newTime = Math.max(0, Math.min(duration, current + seconds));
    el.currentTime = newTime;
    setCurrent(newTime);
  }

  function changeSpeed(newSpeed: number) {
    setSpeed(newSpeed);
    const el = audioRef.current;
    if (el) {
      el.playbackRate = newSpeed;
    }
  }

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
          {pageValid && audioUrl && (
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

              {/* Keyed so a page change remounts the element and stops playback */}
              <audio
                key={audioUrl}
                ref={audioRef}
                src={audioUrl}
                preload="metadata"
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
                onEnded={() => { setPlaying(false); setCurrent(0); }}
                onTimeUpdate={e => setCurrent(e.currentTarget.currentTime)}
                onLoadedMetadata={e => {
                  setDuration(e.currentTarget.duration);
                  e.currentTarget.playbackRate = speed;
                  setAttempt(0);
                }}
                onWaiting={() => setLoading(true)}
                onPlaying={() => setLoading(false)}
                onError={handleError}
              />

              {failed ? (
                <div className="flex flex-col items-center gap-2 py-6">
                  <AlertCircle className="w-10 h-10" style={{ color: 'var(--c-text-faint)' }} />
                  <p className="text-sm font-semibold" style={{ color: 'var(--c-text)' }}>
                    Recording unavailable
                  </p>
                  <p className="text-xs px-4" style={{ color: 'var(--c-text-muted)' }}>
                    Page {pageNum} could not be loaded after {RETRY_LIMIT} attempts.
                  </p>
                  <button
                    onClick={retryNow}
                    className="mt-3 flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95"
                    style={{ backgroundColor: 'var(--c-gold)', color: '#0d0d0d' }}
                  >
                    <RotateCw className="w-4 h-4" />
                    Try again
                  </button>
                </div>
              ) : (
                <>
                  {/* Skip back, Play/Pause, Skip forward */}
                  <div className="flex items-center justify-center gap-6 mb-6">
                    <button
                      onClick={() => skip(-5)}
                      className="p-3 rounded-full transition-all active:scale-90"
                      style={{ backgroundColor: 'var(--c-bg-subtle)', color: 'var(--c-text)' }}
                      title="Go back 5 seconds"
                    >
                      <RotateCcw className="w-6 h-6" />
                    </button>

                    <button
                      onClick={toggle}
                      className="flex items-center justify-center rounded-full transition-all active:scale-95"
                      style={{
                        width: 120, height: 120,
                        backgroundColor: 'var(--c-gold)',
                        color: '#0d0d0d',
                        boxShadow: '0 8px 28px rgba(0,0,0,0.18)',
                      }}
                      aria-label={playing ? `Pause page ${pageNum}` : `Play page ${pageNum}`}
                    >
                      {playing
                        ? <Pause className="w-12 h-12" fill="currentColor" strokeWidth={0} />
                        : <Play  className="w-12 h-12 ml-1" fill="currentColor" strokeWidth={0} />}
                    </button>

                    <button
                      onClick={() => skip(5)}
                      className="p-3 rounded-full transition-all active:scale-90"
                      style={{ backgroundColor: 'var(--c-bg-subtle)', color: 'var(--c-text)' }}
                      title="Skip forward 5 seconds"
                    >
                      <RotateCw className="w-6 h-6" />
                    </button>
                  </div>

                  {/* Scrub bar — a page can run several minutes */}
                  <input
                    type="range"
                    min={0}
                    max={duration || 0}
                    step={0.5}
                    value={current}
                    onChange={e => seek(parseFloat(e.target.value))}
                    disabled={!duration}
                    className="w-full accent-current"
                    style={{ accentColor: 'var(--c-gold)' }}
                    aria-label="Seek"
                  />
                  <div className="flex justify-between text-[11px] mt-1 mb-6" style={{ color: 'var(--c-text-muted)' }}>
                    <span>{formatTime(current)}</span>
                    <span>{loading ? 'Loading…' : formatTime(duration)}</span>
                  </div>

                  {/* Speed controls */}
                  <div className="flex flex-wrap gap-2 justify-center">
                    {[0.5, 0.75, 1, 1.25, 1.5].map(s => (
                      <button
                        key={s}
                        onClick={() => changeSpeed(s)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-95"
                        style={{
                          backgroundColor: speed === s ? 'var(--c-gold)' : 'var(--c-bg-subtle)',
                          color: speed === s ? '#0d0d0d' : 'var(--c-text)',
                          border: speed === s ? 'none' : '1px solid var(--c-border)',
                        }}
                      >
                        {s}x
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
