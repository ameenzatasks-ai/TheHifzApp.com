/**
 * PracticeCounter — tally the practices for one page, up to the target.
 *
 * Every tap is saved on the server with its time, against the student's account,
 * so the count and its times are the same on every device and for the Ustadh.
 * The number changes the moment the student taps; the save follows in the
 * background, in the order the taps happened.
 *
 * Finish sets the page to Ready for Final Test.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { X } from 'lucide-react';
import { hifzApi, type PracticeState } from '../api/hifz';

interface Props {
  open: boolean;
  pageNumber: number;
  /** Set when an Ustadh tallies for a student. Omitted for the student's own page. */
  studentId?: number;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

/** The count used to live only on this device. Removed once the counter opens. */
const LEGACY_KEY = (pageNum: number) => `practice-counter-${pageNum}`;

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

export default function PracticeCounter({ open, pageNumber, studentId, onConfirm, onCancel }: Props) {
  const [count, setCount] = useState<number | null>(null);
  const [target, setTarget] = useState(18);
  const [entries, setEntries] = useState<string[]>([]);
  const [finishing, setFinishing] = useState(false);

  // Mirrors `count` so a quick second tap is checked against the latest value.
  const countRef = useRef<number | null>(null);
  // Saves run one after another, so the server gets them in the order they happened.
  const queue = useRef<Promise<void>>(Promise.resolve());

  const applyState = useCallback((state: PracticeState) => {
    countRef.current = state.count;
    setCount(state.count);
    setTarget(state.target);
    setEntries(state.entries);
  }, []);

  const load = useCallback(async () => {
    const state = studentId !== undefined
      ? await hifzApi.studentPractice(studentId, pageNumber)
      : await hifzApi.practice(pageNumber);
    applyState(state);
  }, [applyState, pageNumber, studentId]);

  useEffect(() => {
    if (!open) return;
    try { localStorage.removeItem(LEGACY_KEY(pageNumber)); } catch { /* storage unavailable */ }
    load().catch(err => toast.error(err instanceof Error ? err.message : 'Could not load practices'));
  }, [open, pageNumber, load]);

  /** Queue a save. If it fails, show why and reload the true count from the server. */
  function enqueue(save: () => Promise<PracticeState>) {
    queue.current = queue.current.then(async () => {
      try {
        await save();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not save that practice');
        await load().catch(() => { /* keep what is showing */ });
      }
    });
  }

  if (!open) return null;

  const handleTally = () => {
    const current = countRef.current;
    if (current === null || current >= target) return;
    countRef.current = current + 1;
    setCount(current + 1);
    setEntries(prev => [...prev, new Date().toISOString()]);
    enqueue(() => studentId !== undefined
      ? hifzApi.studentPracticeTally(studentId, pageNumber)
      : hifzApi.practiceTally(pageNumber));
  };

  const handleReset = () => {
    countRef.current = 0;
    setCount(0);
    setEntries([]);
    enqueue(() => studentId !== undefined
      ? hifzApi.studentPracticeReset(studentId, pageNumber)
      : hifzApi.practiceReset(pageNumber));
  };

  const handleFinish = async () => {
    setFinishing(true);
    try {
      await queue.current; // every tap is saved before the page changes
      await onConfirm();
      // The practice is complete, so the next one starts from zero. The taps stay in the log.
      countRef.current = 0;
      setCount(0);
      setEntries([]);
      await (studentId !== undefined
        ? hifzApi.studentPracticeReset(studentId, pageNumber)
        : hifzApi.practiceReset(pageNumber));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not finish the practice');
    } finally {
      setFinishing(false);
    }
  };

  const shown = count ?? 0;
  const atTarget = count !== null && count >= target;
  const lastAt = entries.length > 0 ? entries[entries.length - 1] : null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center px-4 py-6 overflow-y-auto"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)' }}
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full rounded-3xl overflow-hidden animate-fade-in-up flex flex-col"
        style={{
          backgroundColor: 'var(--c-bg-card)',
          maxWidth: 420,
          border: '1px solid var(--c-border)',
          boxShadow: '0 12px 40px rgba(0,0,0,0.25)',
          maxHeight: '80vh',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="px-5 py-4 flex items-center justify-between border-b flex-shrink-0"
          style={{ borderColor: 'var(--c-border)' }}
        >
          <div>
            <p
              className="text-[10px] uppercase tracking-[0.22em] font-semibold"
              style={{ color: 'var(--c-text-muted)' }}
            >
              Page {pageNumber}
            </p>
            <h2 className="font-bold text-xl mt-0.5" style={{ color: 'var(--c-text)' }}>
              Practice Tally
            </h2>
          </div>
          <button
            onClick={onCancel}
            className="p-1.5 rounded-lg transition-all active:scale-90 flex-shrink-0"
            style={{ color: 'var(--c-text-muted)' }}
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-6 flex flex-col gap-6">
          {/* Counter display */}
          <div className="text-center">
            <p
              className="text-6xl font-bold"
              style={{ color: atTarget ? 'var(--c-gold)' : 'var(--c-text)' }}
            >
              {count === null ? '–' : shown}
            </p>
            <p className="text-sm mt-2" style={{ color: 'var(--c-text-muted)' }}>
              of {target} practices
            </p>
            <p className="text-[11px] mt-2" style={{ color: 'var(--c-text-faint)' }}>
              {lastAt ? `Last practice: ${formatWhen(lastAt)}` : 'No practices yet'}
            </p>
          </div>

          {/* Progress bar */}
          <div
            className="w-full h-2 rounded-full overflow-hidden"
            style={{ backgroundColor: 'var(--c-bg-subtle)' }}
          >
            <div
              className="h-full transition-all duration-300"
              style={{
                width: `${(shown / target) * 100}%`,
                backgroundColor: 'var(--c-gold)',
              }}
            />
          </div>

          {/* Add tally button */}
          <button
            onClick={handleTally}
            disabled={count === null || atTarget}
            className="py-4 rounded-2xl font-bold text-lg transition-all active:scale-95 disabled:opacity-50"
            style={{
              backgroundColor: atTarget ? 'var(--c-bg-subtle)' : 'var(--c-gold)',
              color: atTarget ? 'var(--c-text-muted)' : '#0d0d0d',
            }}
          >
            Add Tally ({shown}/{target})
          </button>

          {/* Reset (only once counting has started) */}
          {shown > 0 && (
            <button
              onClick={handleReset}
              className="py-2 rounded-xl text-sm font-semibold transition-all active:scale-95"
              style={{
                backgroundColor: 'var(--c-bg-subtle)',
                color: 'var(--c-text-muted)',
                border: '1px solid var(--c-border)',
              }}
            >
              Reset
            </button>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t flex-shrink-0" style={{ borderColor: 'var(--c-border)' }}>
          <button
            onClick={handleFinish}
            disabled={shown === 0 || finishing}
            className="w-full py-3 rounded-2xl font-bold transition-all active:scale-95 disabled:opacity-50"
            style={{
              backgroundColor: shown > 0 ? 'var(--c-green-dark)' : 'var(--c-bg-subtle)',
              color: shown > 0 ? '#FAF7F0' : 'var(--c-text-muted)',
            }}
          >
            {shown > 0 ? 'Finish & Mark as Ready' : 'Add tallies to finish'}
          </button>
        </div>
      </div>
    </div>
  );
}
