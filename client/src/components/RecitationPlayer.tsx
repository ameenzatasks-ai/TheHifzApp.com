/**
 * RecitationPlayer — the recitation of one Mus'haf page: play and pause, five
 * seconds back and forward, a scrub bar, and speeds from 0.5x to 1.5x.
 *
 * Used by the Listen tab and beside the printed page. Changing the page loads
 * that page's recitation from the beginning and keeps the speed you chose.
 */
import { useEffect, useRef, useState } from 'react';
import { AlertCircle, Play, Pause, RotateCw, RotateCcw } from 'lucide-react';

/**
 * Where the recitations are served from. Defaults to same-origin `/audio`,
 * which the API serves locally; in production it points at object storage,
 * because 2.47 GB of recordings cannot ride along with the deploy.
 */
const AUDIO_BASE = (import.meta.env.VITE_AUDIO_BASE_URL || '/audio').replace(/\/$/, '');

/** Transient archive errors are common during ingest; do not give up at once. */
const RETRY_LIMIT = 3;

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5];

/** Files are named 001.mp3 … 604.mp3, one per Mus'haf page. */
export function recitationUrl(page: number): string {
  return `${AUDIO_BASE}/${String(page).padStart(3, '0')}.mp3`;
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function RecitationPlayer({ page }: { page: number }) {
  const src = recitationUrl(page);

  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [failed,  setFailed]  = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [speed,   setSpeed]   = useState(1);

  const audioRef   = useRef<HTMLAudioElement | null>(null);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // A different page: start its recitation from the beginning.
  useEffect(() => {
    setPlaying(false);
    setFailed(false);
    setCurrent(0);
    setDuration(0);
    setAttempt(0);
  }, [src]);

  useEffect(() => () => {
    if (retryTimer.current) clearTimeout(retryTimer.current);
  }, []);

  /**
   * Retry a few times, backing off, before admitting defeat. The archive returns
   * transient errors while it is ingesting uploads, and a single blip used to
   * look like a permanently broken page.
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
    const next = Math.max(0, Math.min(duration, current + seconds));
    el.currentTime = next;
    setCurrent(next);
  }

  function changeSpeed(next: number) {
    setSpeed(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  }

  return (
    <div>
      {/* Keyed by source so a page change remounts the element and stops playback */}
      <audio
        key={src}
        ref={audioRef}
        src={src}
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
        <div className="flex flex-col items-center gap-2 py-4">
          <AlertCircle className="w-8 h-8" style={{ color: 'var(--c-text-faint)' }} />
          <p className="text-sm font-semibold" style={{ color: 'var(--c-text)' }}>
            Recording unavailable
          </p>
          <p className="text-xs px-4 text-center" style={{ color: 'var(--c-text-muted)' }}>
            Page {page} could not be loaded after {RETRY_LIMIT} attempts.
          </p>
          <button
            onClick={retryNow}
            className="mt-2 flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95"
            style={{ backgroundColor: 'var(--c-gold)', color: '#0d0d0d' }}
          >
            <RotateCw className="w-4 h-4" />
            Try again
          </button>
        </div>
      ) : (
        <>
          {/* Back 5 seconds, play or pause, forward 5 seconds */}
          <div className="flex items-center justify-center gap-6">
            <button
              onClick={() => skip(-5)}
              className="p-3 rounded-full transition-all active:scale-90"
              style={{ backgroundColor: 'var(--c-bg-subtle)', color: 'var(--c-text)' }}
              title="Go back 5 seconds"
              aria-label="Go back 5 seconds"
            >
              <RotateCcw className="w-5 h-5" />
            </button>

            <button
              onClick={toggle}
              className="flex items-center justify-center rounded-full transition-all active:scale-95"
              style={{
                width: 80, height: 80,
                backgroundColor: 'var(--c-gold)',
                color: '#0d0d0d',
                boxShadow: '0 6px 20px rgba(0,0,0,0.18)',
              }}
              aria-label={playing ? 'Pause' : 'Play'}
            >
              {playing
                ? <Pause className="w-9 h-9" fill="currentColor" strokeWidth={0} />
                : <Play  className="w-9 h-9 ml-1" fill="currentColor" strokeWidth={0} />}
            </button>

            <button
              onClick={() => skip(5)}
              className="p-3 rounded-full transition-all active:scale-90"
              style={{ backgroundColor: 'var(--c-bg-subtle)', color: 'var(--c-text)' }}
              title="Skip forward 5 seconds"
              aria-label="Skip forward 5 seconds"
            >
              <RotateCw className="w-5 h-5" />
            </button>
          </div>

          {/* Scrub bar: a page can run several minutes */}
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.5}
            value={current}
            onChange={e => seek(parseFloat(e.target.value))}
            disabled={!duration}
            className="w-full mt-4"
            style={{ accentColor: 'var(--c-gold)' }}
            aria-label="Seek"
          />
          <div className="flex justify-between text-[11px] mt-1" style={{ color: 'var(--c-text-muted)' }}>
            <span>{formatTime(current)}</span>
            <span>{loading ? 'Loading…' : formatTime(duration)}</span>
          </div>

          {/* Speeds */}
          <div className="flex flex-wrap gap-2 justify-center mt-3">
            {SPEEDS.map(s => (
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
  );
}
