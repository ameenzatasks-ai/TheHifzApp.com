/**
 * PageEditor — centered pop-up: "What is this page?"
 *
 * Layout per mockup:
 *   • Header:  Page number + close button
 *   • Body:    6 stacked cards. Each card has
 *                  - a brighter accent stripe on the left edge
 *                  - a circular icon badge
 *                  - bold title + 1-2 line description
 *                The card itself is a dark muted colour from the palette.
 *   • Footer:  "Mark as untouched" (only if a status is currently set)
 */
import { useEffect } from 'react';
import { X, Headphones } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { PageStatus } from '../../../shared/juz-map';
import { PALETTE, ALL_STATUSES } from './palette';

interface Props {
  open: boolean;
  pageNumber: number;
  currentStatus: PageStatus | null;
  onSelect: (status: PageStatus) => void | Promise<void>;
  onUntouch: () => void | Promise<void>;
  onClose: () => void;
  userRole?: 'student' | 'ustadh';
}

function StatusCard({
  status,
  isCurrent,
  onClick,
  disabled,
}: {
  status: PageStatus;
  isCurrent: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  const p = PALETTE[status];
  const Icon = p.icon;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="relative w-full overflow-hidden rounded-2xl text-left transition-all active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
      style={{
        background: disabled ? 'var(--c-bg-subtle)' : p.fill,
        color: disabled ? 'var(--c-text-muted)' : p.text,
        boxShadow: isCurrent
          ? `0 0 0 2px ${p.accent}, 0 4px 14px rgba(0,0,0,0.25)`
          : '0 1px 3px rgba(0,0,0,0.18)',
      }}
    >
      {/* Left accent stripe */}
      <span
        aria-hidden="true"
        className="absolute left-0 top-0 bottom-0"
        style={{ width: 5, background: p.accent }}
      />

      {/* Card content */}
      <div className="flex items-center gap-3.5 pl-5 pr-4 py-3.5">
        {/* Icon badge */}
        <div
          className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: p.iconBg, border: `1.5px solid ${p.accent}` }}
        >
          <Icon className="w-5 h-5" style={{ color: p.iconColor }} strokeWidth={2.25} />
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-bold text-base leading-tight">{p.label}</p>
          <p
            className="text-xs leading-snug mt-0.5"
            style={{ color: p.textSoft }}
          >
            {p.description}
          </p>
        </div>

        {isCurrent && (
          <span
            className="text-[9px] uppercase tracking-[0.15em] font-bold flex-shrink-0"
            style={{ color: p.accent }}
          >
            Current
          </span>
        )}
      </div>
    </button>
  );
}

export default function PageEditor({
  open, pageNumber, currentStatus, onSelect, onUntouch, onClose, userRole,
}: Props) {
  const navigate = useNavigate();

  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center px-4 py-6 overflow-y-auto"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)' }}
      onClick={onClose}
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
              What is this page?
            </p>
            <h2 className="font-bold text-xl mt-0.5" style={{ color: 'var(--c-text)' }}>
              Page {pageNumber}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg transition-all active:scale-90"
            style={{ color: 'var(--c-text-muted)' }}
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 6 status cards */}
        <div className="p-3 flex flex-col gap-2">
          {ALL_STATUSES.map(s => (
            <div key={s} className="flex gap-2 items-stretch">
              <StatusCard
                status={s}
                isCurrent={currentStatus === s}
                onClick={() => onSelect(s)}
                disabled={s === 'RED' && userRole !== 'ustadh'}
              />
              {s === 'BLACK' && (
                <button
                  onClick={() => navigate(`/listen?page=${pageNumber}`)}
                  className="px-3 rounded-xl text-xs font-semibold transition-all active:scale-95 flex items-center justify-center gap-1.5 flex-shrink-0"
                  style={{
                    backgroundColor: 'var(--c-gold)',
                    color: '#0d0d0d',
                  }}
                  title="Listen to this page"
                >
                  <Headphones className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Untouch (only if status set) */}
        {currentStatus !== null && (
          <div className="px-3 pb-3">
            <button
              onClick={onUntouch}
              className="w-full py-2.5 rounded-xl text-xs font-semibold transition-all active:scale-95"
              style={{
                backgroundColor: 'var(--c-bg-subtle)',
                color: 'var(--c-text-muted)',
                border: '1px solid var(--c-border-soft)',
              }}
            >
              Mark as untouched
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
