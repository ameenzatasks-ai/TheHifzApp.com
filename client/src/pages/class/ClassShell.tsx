import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Copy, Check, UserPlus, MoreVertical, Pencil, Trash2, LogOut, ChevronRight, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { classesApi } from '../../api/classes';
import type { ClassWithMeta } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import InviteSheet from '../../components/InviteSheet';
import ConfirmModal from '../../components/ConfirmModal';
import BottomSheet from '../../components/BottomSheet';
import Spinner from '../../components/Spinner';
import UstadhClassView from './UstadhClassView';
import CoUstathsSettings from './CoUstathsSettings';
import JoinAsUstadhSheet from './JoinAsUstadhSheet';

function CopyCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <button
      onClick={copy}
      className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-semibold transition-all active:scale-95"
      style={{ backgroundColor: 'var(--c-gold-bg)', color: 'var(--c-gold)' }}
    >
      {code}
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
    </button>
  );
}

/* ── Kebab menu (Rename/Delete/Leave/Co-ustadhs) ─────────────────────── */
function ClassMenu({
  isUstadh,
  isOwner,
  onRename,
  onDelete,
  onLeave,
  onManageCoUstadhs,
  onJoinAsUstadh,
}: {
  isUstadh: boolean;
  isOwner: boolean;
  onRename: () => void;
  onDelete: () => void;
  onLeave: () => void;
  onManageCoUstadhs: () => void;
  onJoinAsUstadh: () => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="p-1.5 rounded-lg transition-all active:scale-90"
        style={{ color: 'var(--c-text-muted)' }}
        aria-label="Class options"
      >
        <MoreVertical className="w-5 h-5" />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1 rounded-xl overflow-hidden z-30 shadow-lg"
          style={{
            backgroundColor: 'var(--c-bg-card)',
            border: '1px solid var(--c-border-soft)',
            minWidth: 200,
          }}
        >
          {isUstadh ? (
            <>
              {isOwner && (
                <>
                  <MenuItem icon={Users} label="Manage co-teachers" onClick={() => { setOpen(false); onManageCoUstadhs(); }} />
                  <div style={{ height: 1, backgroundColor: 'var(--c-border)' }} />
                </>
              )}
              {!isOwner && (
                <>
                  <MenuItem icon={Users} label="Join as co-teacher" onClick={() => { setOpen(false); onJoinAsUstadh(); }} />
                  <div style={{ height: 1, backgroundColor: 'var(--c-border)' }} />
                </>
              )}
              <MenuItem icon={Pencil} label="Rename class" onClick={() => { setOpen(false); onRename(); }} />
              <div style={{ height: 1, backgroundColor: 'var(--c-border)' }} />
              <MenuItem icon={Trash2} label="Delete class" destructive onClick={() => { setOpen(false); onDelete(); }} />
            </>
          ) : (
            <MenuItem icon={LogOut} label="Leave class" destructive onClick={() => { setOpen(false); onLeave(); }} />
          )}
        </div>
      )}
    </div>
  );
}

function MenuItem({
  icon: Icon,
  label,
  onClick,
  destructive = false,
}: {
  icon: typeof Pencil;
  label: string;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-left transition-colors"
      style={{ color: destructive ? 'var(--c-red)' : 'var(--c-text)' }}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
}

export default function ClassShell() {
  const { classId } = useParams<{ classId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const id = Number(classId);
  const isUstadh = user?.role === 'ustadh';

  const [cls, setCls] = useState<ClassWithMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [coUstathsOpen, setCoUstathsOpen] = useState(false);
  const [joinAsUstadhOpen, setJoinAsUstadhOpen] = useState(false);

  // Rename / delete / leave modals
  const [renameOpen,  setRenameOpen]  = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [renaming,    setRenaming]    = useState(false);
  const [deleteOpen,  setDeleteOpen]  = useState(false);
  const [deleting,    setDeleting]    = useState(false);
  const [leaveOpen,   setLeaveOpen]   = useState(false);
  const [leaving,     setLeaving]     = useState(false);
  // saveNazirahOpen unused — student uses /nazirah standalone page

  useEffect(() => {
    classesApi.get(id)
      .then(data => setCls(data))
      .catch(() => { toast.error('Class not found'); navigate('/classes', { replace: true }); })
      .finally(() => setLoading(false));
  }, [id, navigate]);

  /* ── Rename ─────────────────────────────────────────── */
  function openRename() {
    setRenameValue(cls?.name ?? '');
    setRenameOpen(true);
  }
  async function submitRename() {
    const next = renameValue.trim();
    if (!next || next === cls?.name) { setRenameOpen(false); return; }
    setRenaming(true);
    try {
      const updated = await classesApi.rename(id, next);
      setCls(prev => prev ? { ...prev, ...updated } : updated);
      toast.success('Class renamed');
      setRenameOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Rename failed');
    } finally {
      setRenaming(false);
    }
  }

  /* ── Delete (Ustadh) ────────────────────────────────── */
  async function confirmDelete() {
    setDeleting(true);
    try {
      await classesApi.remove(id);
      toast.success('Class deleted');
      navigate('/classes', { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
      setDeleting(false);
      setDeleteOpen(false);
    }
  }

  /* ── Leave (Student) ────────────────────────────────── */
  async function confirmLeave() {
    setLeaving(true);
    try {
      await classesApi.leave(id);
      toast.success('You left the class');
      navigate('/classes', { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to leave');
      setLeaving(false);
      setLeaveOpen(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--c-bg)' }}>
        <Spinner size={32} color="var(--c-gold)" />
      </div>
    );
  }

  if (!cls) return null;

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--c-bg)' }}>
      {/* Header */}
      <div
        className="flex items-center gap-2 px-4 pt-safe pb-3 border-b"
        style={{ backgroundColor: 'var(--c-bg-nav)', borderColor: 'var(--c-border)' }}
      >
        <button
          onClick={() => navigate('/classes')}
          className="p-1.5 -ml-1.5 rounded-lg transition-all active:scale-90"
          style={{ color: 'var(--c-text-muted)' }}
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="flex-1 min-w-0">
          <h1 className="font-semibold text-base truncate" style={{ color: 'var(--c-text)' }}>{cls.name}</h1>
        </div>

        {isUstadh && (
          <button
            onClick={() => setInviteOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all active:scale-95"
            style={{ backgroundColor: 'var(--c-gold-bg)', color: 'var(--c-gold)' }}
            aria-label="Invite student"
          >
            <UserPlus className="w-3.5 h-3.5" />
            Invite
          </button>
        )}

        <CopyCode code={cls.join_code} />

        <ClassMenu
          isUstadh={isUstadh}
          isOwner={cls.is_owner ?? false}
          onRename={openRename}
          onDelete={() => setDeleteOpen(true)}
          onLeave={() => setLeaveOpen(true)}
          onManageCoUstadhs={() => setCoUstathsOpen(true)}
          onJoinAsUstadh={() => setJoinAsUstadhOpen(true)}
        />
      </div>

      {/* Body — Ustadh sees student roster; Student sees Nazirah card */}
      {isUstadh ? (
        <div className="pb-layout">
          <UstadhClassView classId={id} />
        </div>
      ) : (
        <div className="p-5 max-w-md mx-auto pb-layout">
          {/* Track your Nazirah — hero card */}
          <button
            onClick={() => navigate('/nazirah/date')}
            className="w-full flex items-center gap-4 px-5 py-5 rounded-2xl text-left transition-all active:scale-[0.98]"
            style={{
              background: 'linear-gradient(135deg, var(--c-green-dark) 0%, #0a3528 100%)',
              boxShadow: '0 4px 24px rgba(15,76,58,0.30)',
            }}
          >
            <div className="flex-1 min-w-0">
              <p className="font-bold text-base" style={{ color: '#FAF7F0' }}>
                Track your Nazirah
              </p>
              <p className="text-[11px] mt-1" style={{ color: 'rgba(250,247,240,0.55)' }}>
                Update your page-by-page Hifz status
              </p>
            </div>
            <ChevronRight className="w-5 h-5 flex-shrink-0" style={{ color: 'rgba(250,247,240,0.4)' }} />
          </button>
        </div>
      )}

      {/* Invite sheet (Ustadh) */}
      {isUstadh && (
        <InviteSheet
          open={inviteOpen}
          onClose={() => setInviteOpen(false)}
          classId={id}
          className={cls.name}
          joinCode={cls.join_code}
        />
      )}

      {/* Rename sheet */}
      <BottomSheet
        open={renameOpen}
        onClose={() => { if (!renaming) setRenameOpen(false); }}
        title="Rename class"
      >
        <div className="p-5 flex flex-col gap-4">
          <input
            autoFocus
            type="text"
            value={renameValue}
            onChange={e => setRenameValue(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submitRename()}
            placeholder="Class name"
            className="w-full px-4 py-3 rounded-xl text-sm outline-none"
            style={{
              backgroundColor: 'var(--c-bg-subtle)',
              color: 'var(--c-text)',
              border: '1px solid var(--c-border-soft)',
            }}
          />
          <button
            onClick={submitRename}
            disabled={renaming || !renameValue.trim()}
            className="w-full py-3.5 rounded-2xl font-semibold text-sm transition-all active:scale-95 disabled:opacity-50"
            style={{ backgroundColor: 'var(--c-green-dark)', color: '#FAF7F0' }}
          >
            {renaming ? <Spinner size={18} color="#FAF7F0" /> : 'Save'}
          </button>
        </div>
      </BottomSheet>

      {/* Ustadh delete confirmation */}
      <ConfirmModal
        open={deleteOpen}
        title="Delete this class?"
        message="All enrolments and invitations for this class will be removed. Students' personal Nazirah logs are kept. This cannot be undone."
        confirmLabel="Yes, delete"
        cancelLabel="Cancel"
        destructive
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteOpen(false)}
      />

      {/* Student leave confirmation */}
      <ConfirmModal
        open={leaveOpen}
        title="Leave this class?"
        message="You will no longer see this class. To re-join, the ustadh must share the join code with you again."
        confirmLabel="Yes, leave"
        cancelLabel="Cancel"
        destructive
        busy={leaving}
        onConfirm={confirmLeave}
        onCancel={() => setLeaveOpen(false)}
      />

      {/* Co-ustadhs settings (owner only) */}
      {cls && (
        <CoUstathsSettings
          classId={id}
          ustadhCode={cls.ustadh_code ?? ''}
          isOwner={cls.is_owner ?? false}
          open={coUstathsOpen}
          onClose={() => setCoUstathsOpen(false)}
        />
      )}

      {/* Join as ustadh sheet */}
      <JoinAsUstadhSheet
        open={joinAsUstadhOpen}
        onClose={() => setJoinAsUstadhOpen(false)}
        onJoined={(joined) => {
          setCls(prev => prev ? { ...prev, ...joined } : joined);
        }}
      />
    </div>
  );
}
