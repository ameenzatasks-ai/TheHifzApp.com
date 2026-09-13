/**
 * UstadhClassView — what the Ustadh sees inside one of their classes.
 *
 * For each enrolled student:
 *   • Avatar + name
 *   • 7-color quarter-count chip row (gold/green/yellow/amber/red/silver/black)
 *   • Tap → drills into StudentDetail (Ustadh-write JuzGrid + audit)
 */
import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../../api/client';
import type { PageStatus } from '../../../../shared/juz-map';
import { PALETTE } from '../../hifz/palette';
import Spinner from '../../components/Spinner';

interface StudentSummary {
  id: number;
  name: string;
  email: string;
  avatar_url: string | null;
  joined_at: string;
  counts: Record<PageStatus, number>;
}

function StudentAvatar({ student }: { student: { name: string; avatar_url: string | null } }) {
  if (student.avatar_url) {
    return <img src={student.avatar_url} alt={student.name} className="w-10 h-10 rounded-full object-cover flex-shrink-0" />;
  }
  const initial = student.name[0]?.toUpperCase() ?? '?';
  return (
    <div
      className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
      style={{ backgroundColor: 'var(--c-green-dark)', color: 'var(--c-gold)' }}
    >
      {initial}
    </div>
  );
}

/** A row of small color-coded count pills (one per status that has count>0).
 * Shows progress statuses (RED, AMBER, GREEN, BLACK, YELLOW) but not GOLD,
 * since GOLD is just "memorized" and the useful view is test progression.
 */
function SummaryStrip({ counts }: { counts: Record<PageStatus, number> }) {
  const order: PageStatus[] = ['GREEN', 'RED', 'AMBER', 'BLACK', 'YELLOW'];
  const nonZero = order.filter(s => counts[s] > 0);
  if (nonZero.length === 0) {
    return (
      <p className="text-[11px]" style={{ color: 'var(--c-text-faint)' }}>
        No progress yet
      </p>
    );
  }
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {nonZero.map(s => (
        <span
          key={s}
          className="text-[10px] font-bold px-1.5 py-0.5 rounded"
          style={{
            background: PALETTE[s].fill,
            color: PALETTE[s].text,
          }}
          title={PALETTE[s].label}
        >
          {counts[s]}
        </span>
      ))}
    </div>
  );
}

/** Check if a student is "on track" - has minimum required pages in each stage */
function isOnTrack(counts: Record<PageStatus, number>): boolean {
  const greenRequired = 3;
  const orangeRequired = 2; // AMBER
  const blueRequired = 2;   // RED
  return (counts.GREEN ?? 0) >= greenRequired &&
         (counts.AMBER ?? 0) >= orangeRequired &&
         (counts.RED ?? 0) >= blueRequired;
}

export default function UstadhClassView({ classId }: { classId: number }) {
  const navigate = useNavigate();
  const [students, setStudents] = useState<StudentSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await api.get<StudentSummary[]>(`/classes/${classId}/students-with-summary`);
      console.log('[UstadhClassView] API response:', data);
      setStudents(data);
    } catch (err) {
      console.error('[UstadhClassView] API error:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to load students');
    } finally {
      setLoading(false);
    }
  }, [classId]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return <div className="flex justify-center mt-16"><Spinner size={28} color="var(--c-gold)" /></div>;
  }

  return (
    <div className="p-4 max-w-md mx-auto">
      {students.length === 0 ? (
        <p className="text-center text-sm mt-12" style={{ color: 'var(--c-text-faint)' }}>
          No students yet. Tap "Invite" or share the join code.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {students.map(s => {
            const onTrack = isOnTrack(s.counts);
            return (
            <button
              key={s.id}
              onClick={() => navigate(`/classes/${classId}/student/${s.id}`)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-left transition-all active:scale-[0.98]"
              style={{
                backgroundColor: 'var(--c-bg-card)',
                border: onTrack ? '1px solid var(--c-border)' : '2px solid #FF2D2D'
              }}
            >
              <StudentAvatar student={s} />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate mb-1" style={{ color: 'var(--c-text)' }}>
                  {s.name}
                </p>
                <SummaryStrip counts={s.counts} />
              </div>
              <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--c-text-faint)' }} />
            </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
