import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Copy, Check, Users, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { classesApi } from '../api/classes';
import type { ClassWithMeta } from '../types';
import ClassSheet from '../components/ClassSheet';
import Spinner from '../components/Spinner';

/* ── Avatar initials ─────────────────────────────────────── */
function Initials({ name, size = 40 }: { name: string; size?: number }) {
  const letters = name
    .split(' ')
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('');
  return (
    <div
      className="flex items-center justify-center rounded-full font-bold flex-shrink-0"
      style={{ width: size, height: size, backgroundColor: 'var(--c-green-dark)', color: 'var(--c-gold)', fontSize: size * 0.38 }}
    >
      {letters}
    </div>
  );
}

/* ── Copy-join-code button ───────────────────────────────── */
function CopyCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  function copy(e: React.MouseEvent) {
    e.stopPropagation();
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <button
      onClick={copy}
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-semibold transition-all active:scale-95"
      style={{ backgroundColor: 'var(--c-gold-bg)', color: 'var(--c-gold)' }}
    >
      {code}
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
    </button>
  );
}

/* ── Main component ──────────────────────────────────────── */
export default function ClassesList() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isUstadh = user?.role === 'ustadh';

  const [classes, setClasses] = useState<ClassWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await classesApi.list();
      setClasses(data);
    } catch {
      toast.error('Failed to load classes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="min-h-screen pb-layout pt-safe" style={{ backgroundColor: 'var(--c-bg)' }}>
      <div className="p-5 max-w-md mx-auto">
        {/* Greeting */}
        <h1 className="text-xl font-bold" style={{ color: 'var(--c-text)' }}>
          As-salāmu ʿalaikum, {user?.name?.split(' ')[0] || ''}
        </h1>

        {loading ? (
          <div className="flex justify-center mt-20">
            <Spinner size={32} color="var(--c-gold)" />
          </div>
        ) : classes.length === 0 ? (
          <div className="flex flex-col items-center gap-3 mt-24 text-center">
            <Users className="w-10 h-10" style={{ color: 'var(--c-text-faint)' }} />
            <p className="text-sm" style={{ color: 'var(--c-text-muted)' }}>
              {isUstadh
                ? 'No classes yet. Create your first class or join one.'
                : "You haven't joined any classes yet."}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {classes.map(cls => {
              // For Ustadh: is_owner=true → they own it; is_owner=false → enrolled
              const ownsClass = isUstadh && cls.is_owner !== false;
              return (
                <div
                  key={cls.id}
                  onClick={() => navigate(isUstadh ? `/classes/${cls.id}` : `/classes/${cls.id}/hifz`)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => e.key === 'Enter' && navigate(isUstadh ? `/classes/${cls.id}` : `/classes/${cls.id}/hifz`)}
                  className="flex items-center gap-3 px-4 py-3.5 rounded-2xl cursor-pointer transition-all active:scale-[0.98]"
                  style={{ backgroundColor: 'var(--c-bg-card)', border: '1px solid var(--c-border)' }}
                >
                  <Initials name={cls.name} size={44} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm truncate" style={{ color: 'var(--c-text)' }}>
                        {cls.name}
                      </p>
                      {/* For Ustadh: show whether they own or are enrolled */}
                      {isUstadh && (
                        <span
                          className="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wide flex-shrink-0"
                          style={{
                            backgroundColor: ownsClass ? 'var(--c-gold-bg)' : 'var(--c-bg-subtle)',
                            color: ownsClass ? 'var(--c-gold)' : 'var(--c-text-muted)',
                          }}
                        >
                          {ownsClass ? 'Owner' : 'Member'}
                        </span>
                      )}
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--c-text-muted)' }}>
                      {ownsClass
                        ? `${cls.student_count ?? 0} student${cls.student_count === 1 ? '' : 's'}`
                        : `Ustadh: ${cls.ustadh_name ?? '—'}`}
                    </p>
                  </div>

                  {ownsClass ? (
                    <CopyCode code={cls.join_code} />
                  ) : (
                    <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--c-text-faint)' }} />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* FAB */}
      <button
        onClick={() => setSheetOpen(true)}
        className="fixed flex items-center justify-center w-14 h-14 rounded-full shadow-lg transition-all active:scale-95 z-20"
        style={{
          bottom: `calc(56px + env(safe-area-inset-bottom) + 20px)`,
          right: 20,
          backgroundColor: 'var(--c-gold)',
        }}
        aria-label={isUstadh ? 'Create or join class' : 'Join class'}
      >
        <Plus className="w-6 h-6" style={{ color: '#0d0d0d' }} />
      </button>

      {/* Bottom sheet */}
      <ClassSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        isUstadh={isUstadh}
        onSuccess={cls => setClasses(prev => [cls, ...prev])}
      />
    </div>
  );
}
