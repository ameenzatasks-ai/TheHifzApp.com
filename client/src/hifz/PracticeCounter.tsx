/**
 * PracticeCounter — Modal for tracking practice sessions.
 *
 * Flow:
 * 1. User sees: "Have you practiced this page 18 times?"
 * 2. If YES → closes with confirmation
 * 3. If NO → opens tally counter
 * 4. User adds tallies up to 18
 * 5. Once 18 reached → automatically confirms and closes
 */
import { useState } from 'react';
import { X, Check } from 'lucide-react';
import toast from 'react-hot-toast';

interface Props {
  open: boolean;
  pageNumber: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function PracticeCounter({ open, pageNumber, onConfirm, onCancel }: Props) {
  const [count, setCount] = useState(0);
  const [showTally, setShowTally] = useState(false);
  const TARGET = 18;

  if (!open) return null;

  const handleYes = () => {
    onConfirm();
  };

  const handleNo = () => {
    setShowTally(true);
  };

  const handleAddTally = () => {
    const newCount = count + 1;
    setCount(newCount);
    if (newCount === TARGET) {
      toast.success(`Reached ${TARGET} practices!`);
      setTimeout(() => {
        onConfirm();
      }, 500);
    }
  };

  const handleReset = () => {
    setCount(0);
  };

  const handleBack = () => {
    setShowTally(false);
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
              {showTally ? 'Practice Tally' : 'Ready to Progress?'}
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
          {!showTally ? (
            // Initial question
            <div className="flex flex-col gap-4">
              <p className="text-base text-center" style={{ color: 'var(--c-text)' }}>
                Have you practiced this page 18 times?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleYes}
                  className="flex-1 py-3 rounded-xl font-semibold transition-all active:scale-95"
                  style={{ backgroundColor: 'var(--c-gold)', color: '#0d0d0d' }}
                >
                  Yes, I have
                </button>
                <button
                  onClick={handleNo}
                  className="flex-1 py-3 rounded-xl font-semibold transition-all active:scale-95"
                  style={{
                    backgroundColor: 'var(--c-bg-subtle)',
                    color: 'var(--c-text)',
                    border: '1px solid var(--c-border)',
                  }}
                >
                  No, count for me
                </button>
              </div>
            </div>
          ) : (
            // Tally counter
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
                    count === TARGET ? 'var(--c-bg-subtle)' : 'var(--c-gold)',
                  color:
                    count === TARGET ? 'var(--c-text-muted)' : '#0d0d0d',
                }}
              >
                {count === TARGET ? (
                  <>
                    <Check className="w-5 h-5 inline mr-2" />
                    Complete!
                  </>
                ) : (
                  'Add Tally'
                )}
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

              {/* Back button */}
              <button
                onClick={handleBack}
                className="py-2 rounded-xl text-sm font-semibold transition-all active:scale-95"
                style={{
                  backgroundColor: 'var(--c-bg-subtle)',
                  color: 'var(--c-text-muted)',
                  border: '1px solid var(--c-border)',
                }}
              >
                Back
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
