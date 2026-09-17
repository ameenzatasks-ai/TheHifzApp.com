/**
 * PracticeCounter — Modal for tracking practice sessions.
 *
 * Flow:
 * 1. User sees tally counter directly (no confirmation dialog)
 * 2. User adds tallies up to 18
 * 3. User clicks "Finish" button to confirm and set page to AMBER
 * 4. Progress is saved to localStorage if modal is closed mid-way
 */
import { useState, useEffect } from 'react';
import { X, Headphones } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Props {
  open: boolean;
  pageNumber: number;
  onConfirm: () => void;
  onCancel: () => void;
}

const STORAGE_KEY = (pageNum: number) => `practice-counter-${pageNum}`;

export default function PracticeCounter({ open, pageNumber, onConfirm, onCancel }: Props) {
  const navigate = useNavigate();
  const [count, setCount] = useState(0);
  const TARGET = 18;

  // Load saved progress on open
  useEffect(() => {
    if (open) {
      try {
        const saved = localStorage.getItem(STORAGE_KEY(pageNumber));
        if (saved) {
          const num = parseInt(saved, 10);
          if (num >= 0 && num <= TARGET) {
            setCount(num);
          }
        }
      } catch {
        // Ignore localStorage errors
      }
    }
  }, [open, pageNumber]);

  // Save progress to localStorage whenever it changes
  useEffect(() => {
    if (open && count >= 0) {
      try {
        localStorage.setItem(STORAGE_KEY(pageNumber), count.toString());
      } catch {
        // Ignore localStorage errors
      }
    }
  }, [count, open, pageNumber]);

  // Clear saved progress when confirming
  const handleFinish = () => {
    try {
      localStorage.removeItem(STORAGE_KEY(pageNumber));
    } catch {
      // Ignore localStorage errors
    }
    onConfirm();
  };

  if (!open) return null;

  const handleAddTally = () => {
    if (count < TARGET) {
      setCount(count + 1);
    }
  };

  const handleReset = () => {
    try {
      localStorage.removeItem(STORAGE_KEY(pageNumber));
    } catch {
      // Ignore localStorage errors
    }
    setCount(0);
  };

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center px-4 py-6 overflow-y-auto"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)' }}
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full rounded-3xl overflow-hidden animate-fade-in-up"
        style={{
          backgroundColor: 'var(--c-bg-card)',
          maxWidth: 420,
          border: '1px solid var(--c-border)',
          boxShadow: '0 12px 40px rgba(0,0,0,0.25)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="px-5 py-4 flex items-center justify-between border-b"
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
            className="p-1.5 rounded-lg transition-all active:scale-90"
            style={{ color: 'var(--c-text-muted)' }}
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-6">
          <div className="flex flex-col gap-6">
            {/* Counter display */}
            <div className="text-center">
              <p
                className="text-6xl font-bold"
                style={{
                  color: count === TARGET ? 'var(--c-gold)' : 'var(--c-text)',
                }}
              >
                {count}
              </p>
              <p
                className="text-sm mt-2"
                style={{ color: 'var(--c-text-muted)' }}
              >
                of {TARGET} practices
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
                  width: `${(count / TARGET) * 100}%`,
                  backgroundColor: 'var(--c-gold)',
                }}
              />
            </div>

            {/* Add tally button */}
            <button
              onClick={handleAddTally}
              disabled={count >= TARGET}
              className="py-4 rounded-2xl font-bold text-lg transition-all active:scale-95 disabled:opacity-50"
              style={{
                backgroundColor:
                  count >= TARGET ? 'var(--c-bg-subtle)' : 'var(--c-gold)',
                color:
                  count >= TARGET ? 'var(--c-text-muted)' : '#0d0d0d',
              }}
            >
              Add Tally ({count}/{TARGET})
            </button>

            {/* Finish button (always visible, enabled once at least 1 tally) */}
            <button
              onClick={handleFinish}
              disabled={count === 0}
              className="py-3 rounded-2xl font-bold transition-all active:scale-95 disabled:opacity-50"
              style={{
                backgroundColor: count > 0 ? 'var(--c-green-dark)' : 'var(--c-bg-subtle)',
                color: count > 0 ? '#FAF7F0' : 'var(--c-text-muted)',
              }}
            >
              {count > 0 ? 'Finish & Mark as Ready' : 'Add tallies to finish'}
            </button>

            {/* Reset button (only if started counting) */}
            {count > 0 && (
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

            {/* Listen button */}
            <button
              onClick={() => navigate(`/listen?page=${pageNumber}`)}
              className="py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95 flex items-center justify-center gap-1.5"
              style={{
                backgroundColor: 'var(--c-bg-subtle)',
                color: 'var(--c-text-muted)',
                border: '1px solid var(--c-border)',
              }}
            >
              <Headphones className="w-4 h-4" />
              Listen to this page
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
