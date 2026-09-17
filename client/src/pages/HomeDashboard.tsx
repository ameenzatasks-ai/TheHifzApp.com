/**
 * HomeDashboard — The unified landing page after login.
 *
 * Student view:  progress stats + today's task mini-cards + class list.
 * Ustadh view:   class overview stats + awaiting review list + class average.
 *
 * Design reference: The Hifz App prototype Stage 5 "Home dashboard".
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Flame, BookOpen, Grid3x3, Star, Users, Clock, ChevronRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { classesApi } from '../api/classes';
import type { ClassWithMeta } from '../types';
import Spinner from '../components/Spinner';
import ClassSheet from '../components/ClassSheet';

/* ── Stat card ────────────────────────────────────── */
function StatCard({ icon, color, value, unit, label }: {
  icon: React.ReactNode;
  color: string;
  value: string;
  unit?: string;
  label: string;
}) {
  return (
    <div
      className="flex flex-col items-center gap-1 p-3 rounded-xl"
      style={{ backgroundColor: 'var(--c-bg-card)', border: '1px solid var(--c-border)' }}
    >
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center"
        style={{ backgroundColor: `${color}1f`, color }}
      >
        {icon}
      </div>
      <div className="text-lg font-bold" style={{ color: 'var(--c-text)' }}>
        {value}{unit && <span className="text-xs font-semibold" style={{ color: 'var(--c-text-muted)' }}> {unit}</span>}
      </div>
      <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--c-text-muted)' }}>
        {label}
      </div>
    </div>
  );
}

/* ── Task mini-card (student home) ────────────────── */
function TaskMini({ englishTitle, meta, accent, bgColor, icon, status }: {
  englishTitle: string;
  meta: string;
  accent: string;
  bgColor: string;
  icon: React.ReactNode;
  status: 'done' | 'pending';
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl overflow-hidden" style={{ backgroundColor: bgColor }}>
      <div className="w-1.5 self-stretch" style={{ backgroundColor: accent }} />
      <div className="flex items-center gap-3 flex-1 py-3 pr-3">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: accent + '33', border: `1.5px solid ${accent}` }}
        >
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-xs text-white/90">{englishTitle}</div>
          <div className="text-[10px] text-white/50 mt-0.5">{meta}</div>
        </div>
        <span
          className="text-[9px] font-bold uppercase px-2 py-1 rounded-full flex-shrink-0"
          style={{
            backgroundColor: status === 'done' ? 'rgba(0,208,160,0.2)' : 'rgba(255,212,0,0.15)',
            color: status === 'done' ? '#00D4A0' : '#FFD400',
          }}
        >
          {status === 'done' ? '✓ Done' : '⏳ Pending'}
        </span>
      </div>
    </div>
  );
}

/* ── Class row ────────────────────────────────────── */
function ClassRow({ cls, onClick }: { cls: ClassWithMeta; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all active:scale-[0.98]"
      style={{ backgroundColor: 'var(--c-bg-card)', border: '1px solid var(--c-border)' }}
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0"
        style={{ backgroundColor: 'var(--c-bg-subtle)', color: 'var(--c-text)', border: '1px solid var(--c-border-soft)' }}
      >
        {cls.name.slice(0, 2).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold truncate" style={{ color: 'var(--c-text)' }}>{cls.name}</div>
        <div className="text-[11px] mt-0.5" style={{ color: 'var(--c-text-muted)' }}>
          {/* A just-created class has no count yet — fall back to 0. */}
          {cls.student_count ?? 0} student{(cls.student_count ?? 0) !== 1 ? 's' : ''}
        </div>
      </div>
      <span
        className="text-[10px] font-mono font-bold px-2 py-1 rounded-lg flex-shrink-0"
        style={{ backgroundColor: 'var(--c-gold-bg)', color: 'var(--c-gold)' }}
      >
        {cls.join_code}
      </span>
    </button>
  );
}

/* ── Section heading ──────────────────────────────── */
/**
 * The action is a filled pill rather than small text so it reads as a button
 * and clears the ~44px minimum touch target. `flex-shrink-0` keeps it at full
 * size on narrow phones — the rule divider absorbs the remaining width, so the
 * title and the button can never collide.
 */
function SectionHead({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <h3 className="text-sm font-bold flex-shrink-0" style={{ color: 'var(--c-text)' }}>{title}</h3>
      <div className="flex-1 h-px min-w-[8px]" style={{ backgroundColor: 'var(--c-border)' }} />
      {action && onAction && (
        <button
          onClick={onAction}
          className="flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-[13px] font-bold transition-all active:scale-95 flex-shrink-0"
          style={{ backgroundColor: 'var(--c-gold)', color: '#0d0d0d' }}
        >
          {action} <ChevronRight className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

/* ── Main component ───────────────────────────────── */
export default function HomeDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isUstadh = user?.role === 'ustadh';

  const [classes, setClasses] = useState<ClassWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    classesApi.list()
      .then(setClasses)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const firstName = user?.name?.split(' ')[0] || '';
  const greeting = `As-salāmu ʿalaikum, ${firstName}`;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--c-bg)' }}>
        <Spinner size={28} color="var(--c-gold)" />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-layout pt-safe" style={{ backgroundColor: 'var(--c-bg)' }}>
      {/* Header */}
      <div className="px-5 pt-6 pb-4">
        <h1 className="text-xl font-bold" style={{ color: 'var(--c-text)' }}>{greeting}</h1>
      </div>

      <div className="px-4 space-y-6">
        {/* ── Student view ─────────────────────────── */}
        {!isUstadh && (
          <>
            {/* Stats */}
            <div>
              <SectionHead title="Your progress" />
              <div className="grid grid-cols-3 gap-2">
                <StatCard icon={<Flame className="w-[18px] h-[18px]" />} color="#E06A12" value="—" label="Streak" />
                <StatCard icon={<BookOpen className="w-[18px] h-[18px]" />} color="#0E9C78" value="—" unit="pp" label="Memorised" />
                <StatCard icon={<Grid3x3 className="w-[18px] h-[18px]" />} color="#B8862A" value="—" label="Juz done" />
              </div>
            </div>

            {/* Today's tasks */}
            <div>
              <SectionHead title="Today's tasks" action="Log now" onAction={() => navigate('/hifz')} />
              <div className="space-y-2">
                <TaskMini
                  englishTitle="Dawr — Revision"
                  meta="Tap to log today's Dawr"
                  accent="#FF7A1A"
                  bgColor="#9B4800"
                  icon={<Grid3x3 className="w-4 h-4" strokeWidth={2} style={{ color: '#FFD0A8' }} />}
                  status="pending"
                />
                <TaskMini
                  englishTitle="Sabaq — New Memorisation"
                  meta="Tap to log today's Sabaq"
                  accent="#FFD700"
                  bgColor="#7A5A00"
                  icon={<Star className="w-4 h-4" strokeWidth={2} style={{ color: '#FFE880' }} />}
                  status="pending"
                />
                <TaskMini
                  englishTitle="Sabaq Para — Recent Review"
                  meta="Tap to log today's Sabaq Para"
                  accent="#00D4A0"
                  bgColor="#0F6650"
                  icon={<BookOpen className="w-4 h-4" strokeWidth={2} style={{ color: '#5DFFD8' }} />}
                  status="pending"
                />
              </div>
            </div>

            {/* Classes */}
            <div>
              <SectionHead title="Your classes" />
              {classes.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm" style={{ color: 'var(--c-text-muted)' }}>
                    No classes yet. Join one from the Classes tab.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {classes.map(cls => (
                    <ClassRow key={cls.id} cls={cls} onClick={() => navigate(`/classes/${cls.id}`)} />
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* ── Ustadh view ──────────────────────────── */}
        {isUstadh && (
          <>
            {/* Class overview stats */}
            <div>
              <SectionHead title="Class overview" />
              <div className="grid grid-cols-1 gap-2">
                <StatCard icon={<Users className="w-[18px] h-[18px]" />} color="#0F4C3A" value={String(classes.reduce((s, c) => s + (c.student_count || 0), 0))} label="Students" />
              </div>
            </div>

            {/* Classes */}
            <div>
              <SectionHead title=”Your classes” action=”Create or join a class” onAction={() => setSheetOpen(true)} />
              {classes.length === 0 ? (
                /* The header already carries the “Create or join a class” button, so
                   the empty state only explains — it does not repeat it. */
                <div className=”text-center py-8”>
                  <p className=”text-sm” style={{ color: 'var(--c-text-muted)' }}>
                    No classes yet — tap “Create or join a class” to make your first one.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {classes.map(cls => (
                    <ClassRow key={cls.id} cls={cls} onClick={() => navigate(`/classes/${cls.id}`)} />
                  ))}
                </div>
              )}
            </div>

          </>
        )}
      </div>

      <ClassSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        isUstadh={isUstadh}
        onSuccess={cls => setClasses(prev => [cls, ...prev])}
      />
    </div>
  );
}
