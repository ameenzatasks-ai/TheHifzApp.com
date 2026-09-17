/**
 * NazirahTrack — full JuzGrid view.
 *
 * Accessible two ways:
 *   1. /nazirah?date=YYYY-MM-DD  — from NazirahDatePicker; date pre-loaded
 *   2. /nazirah                  — direct from bottom nav; date defaults today
 *
 * After a successful save the Save button is replaced by a "Logged ✓" badge
 * so the student cannot accidentally double-submit from the same screen state.
 */
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import JuzGrid from '../hifz/JuzGrid';
import SaveNazirahSheet from '../hifz/SaveNazirahSheet';

function formatDisplay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const months = ['Jan','Feb','Mar','Apr','May','Jun',
                  'Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${d} ${months[m - 1]} ${y}`;
}

export default function NazirahTrack() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const isStudent = user?.role === 'student';

  const preselectedDate = searchParams.get('date') ?? undefined;

  const [saveOpen,  setSaveOpen]  = useState(false);
  const [hasSaved,  setHasSaved]  = useState(false);
  const [savedDate, setSavedDate] = useState<string | null>(null);

  function handleSaved(logDate: string) {
    setHasSaved(true);
    setSavedDate(logDate);
  }

  return (
    <div className="h-screen flex flex-col" style={{ backgroundColor: 'var(--c-bg)' }}>
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 pt-safe pb-4 border-b flex-shrink-0"
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
          <h1 className="font-semibold text-base leading-tight" style={{ color: 'var(--c-text)' }}>
            Track your Nazirah
          </h1>
          <p className="text-[10px] uppercase tracking-[0.2em] mt-0.5" style={{ color: 'var(--c-text-muted)' }}>
            ناظره
          </p>
        </div>

        {/* Saved badge — replaces the Save button after a successful log */}
        {hasSaved && savedDate && (
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold"
            style={{ backgroundColor: 'rgba(0,212,160,0.12)', color: '#00D4A0' }}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Logged {formatDisplay(savedDate)}
          </div>
        )}
      </div>

      {/* JuzGrid — onSaveNazira is undefined once saved, so JuzGrid hides its button */}
      <div className="flex-1 min-h-0 pt-4">
        <JuzGrid
          onOpenAudit={() => navigate('/nazirah/audit')}
          onSaveNazira={isStudent && !hasSaved ? () => setSaveOpen(true) : undefined}
        />
      </div>

      {isStudent && (
        <SaveNazirahSheet
          open={saveOpen}
          onClose={() => setSaveOpen(false)}
          onSaved={handleSaved}
          initialDate={preselectedDate}
        />
      )}
    </div>
  );
}
