import { useEffect, useState } from 'react';
import { ChevronRight, GraduationCap, BookOpen } from 'lucide-react';
import toast from 'react-hot-toast';
import { classesApi } from '../api/classes';
import type { ClassWithMeta } from '../types';
import BottomSheet from './BottomSheet';
import Spinner from './Spinner';

type SheetMode = 'choose' | 'create' | 'join';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Ustadh gets the create/join choice; students go straight to join. */
  isUstadh: boolean;
  /** Called with the new class after a successful create or join. */
  onSuccess: (cls: ClassWithMeta, mode: 'create' | 'join') => void;
}

/**
 * Create-or-join-a-class bottom sheet.
 *
 * Shared by the classes list and the home dashboard so both entry points
 * behave identically — an Ustadh can create a class without first being
 * routed to a separate page.
 */
export default function ClassSheet({ open, onClose, isUstadh, onSuccess }: Props) {
  const [mode, setMode] = useState<SheetMode>('choose');
  const [inputValue, setInputValue] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Reset to the right starting step each time the sheet opens.
  useEffect(() => {
    if (open) {
      setMode(isUstadh ? 'choose' : 'join');
      setInputValue('');
    }
  }, [open, isUstadh]);

  function close() {
    setInputValue('');
    onClose();
  }

  async function handleSubmit() {
    const value = inputValue.trim();
    if (!value) return;
    setSubmitting(true);
    try {
      if (mode === 'create') {
        const created = await classesApi.create(value);
        onSuccess({ ...created, is_owner: true }, 'create');
        toast.success('Class created');
      } else {
        const upperValue = value.toUpperCase();
        // Check if it's an ustadh code (starts with USTADH-) or student join code
        const isUstadhCode = upperValue.startsWith('USTADH-');

        const joined = isUstadhCode && isUstadh
          ? await classesApi.joinAsUstadh(upperValue)
          : await classesApi.join(upperValue);

        onSuccess(joined, 'join');
        toast.success(isUstadhCode ? 'Joined as co-teacher!' : 'Joined class!');
      }
      close();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <BottomSheet open={open} onClose={close}>
      <div className="p-5 flex flex-col gap-4">

        {/* ── Ustadh: choose mode ── */}
        {isUstadh && mode === 'choose' && (
          <>
            <h2 className="font-semibold text-base" style={{ color: 'var(--c-text)' }}>
              What would you like to do?
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {[
                {
                  m: 'create' as SheetMode,
                  icon: GraduationCap,
                  title: 'Create a class',
                  subtitle: 'Start a new class for your students',
                },
                {
                  m: 'join' as SheetMode,
                  icon: BookOpen,
                  title: 'Join a class',
                  subtitle: 'Enrol with a join code',
                },
              ].map(({ m, icon: Icon, title, subtitle }) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className="flex flex-col items-center gap-3 p-4 rounded-2xl text-center transition-all active:scale-95"
                  style={{
                    backgroundColor: 'var(--c-bg-subtle)',
                    border: '1px solid var(--c-border-soft)',
                  }}
                >
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: 'var(--c-gold-bg)' }}
                  >
                    <Icon className="w-6 h-6" style={{ color: 'var(--c-gold)' }} strokeWidth={1.5} />
                  </div>
                  <div>
                    <p className="font-semibold text-sm" style={{ color: 'var(--c-text)' }}>{title}</p>
                    <p className="text-[11px] mt-0.5" style={{ color: 'var(--c-text-muted)' }}>{subtitle}</p>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}

        {/* ── Create or Join form ── */}
        {(mode === 'create' || mode === 'join') && (
          <>
            <div className="flex items-center gap-2">
              {isUstadh && (
                <button
                  onClick={() => { setMode('choose'); setInputValue(''); }}
                  className="p-1.5 -ml-1.5 rounded-lg transition-all active:scale-90"
                  style={{ color: 'var(--c-text-muted)' }}
                  aria-label="Back"
                >
                  <ChevronRight className="w-5 h-5 rotate-180" />
                </button>
              )}
              <h2 className="font-semibold text-base" style={{ color: 'var(--c-text)' }}>
                {mode === 'create' ? 'Create a new class' : 'Join a class'}
              </h2>
            </div>

            <input
              autoFocus
              type="text"
              placeholder={mode === 'create'
                ? 'Class name'
                : isUstadh
                  ? 'Enter join code (e.g. ABC123 or USTADH-XYZ)'
                  : 'Enter join code (e.g. ABC123)'}
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              className="w-full px-4 py-3 rounded-xl text-sm outline-none"
              style={{
                backgroundColor: 'var(--c-bg-subtle)',
                color: 'var(--c-text)',
                border: '1px solid var(--c-border-soft)',
              }}
            />

            <button
              onClick={handleSubmit}
              disabled={submitting || !inputValue.trim()}
              className="w-full py-3.5 rounded-2xl font-semibold text-sm transition-all active:scale-95 disabled:opacity-50"
              style={{ backgroundColor: 'var(--c-gold)', color: '#0d0d0d' }}
            >
              {submitting
                ? <Spinner size={18} color="#0d0d0d" />
                : mode === 'create' ? 'Create Class' : 'Join Class'}
            </button>
          </>
        )}
      </div>
    </BottomSheet>
  );
}
