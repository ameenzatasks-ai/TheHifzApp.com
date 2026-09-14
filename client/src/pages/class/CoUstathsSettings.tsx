import { useEffect, useState } from 'react';
import { Copy, Check, UserX } from 'lucide-react';
import toast from 'react-hot-toast';
import { classesApi, type CoUstadh } from '../../api/classes';
import BottomSheet from '../../components/BottomSheet';
import ConfirmModal from '../../components/ConfirmModal';
import Spinner from '../../components/Spinner';

interface CoUstathsSettingsProps {
  classId: number;
  ustadhCode: string;
  isOwner: boolean;
  open: boolean;
  onClose: () => void;
}

export default function CoUstathsSettings({
  classId,
  ustadhCode,
  isOwner,
  open,
  onClose,
}: CoUstathsSettingsProps) {
  const [coUstadhs, setCoUstadhs] = useState<CoUstadh[]>([]);
  const [loading, setLoading] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [revokeId, setRevokeId] = useState<number | null>(null);
  const [revoking, setRevoking] = useState(false);

  useEffect(() => {
    if (!open) return;
    loadCoUstadhs();
  }, [open, classId]);

  async function loadCoUstadhs() {
    setLoading(true);
    try {
      const data = await classesApi.getCoUstadhs(classId);
      setCoUstadhs(data);
    } catch (err) {
      toast.error('Failed to load co-ustadhs');
    } finally {
      setLoading(false);
    }
  }

  function copyCode() {
    navigator.clipboard.writeText(ustadhCode).then(() => {
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    });
  }

  async function confirmRevoke() {
    if (!revokeId) return;
    setRevoking(true);
    try {
      await classesApi.removeCoUstadh(classId, revokeId);
      setCoUstadhs(prev => prev.filter(c => c.ustadh_id !== revokeId));
      toast.success('Co-ustadh removed');
      setRevokeId(null);
    } catch (err) {
      toast.error('Failed to remove co-ustadh');
    } finally {
      setRevoking(false);
    }
  }

  return (
    <>
      <BottomSheet
        open={open}
        onClose={() => !loading && !revoking && onClose()}
        title="Ustadh Code & Co-Teachers"
      >
        <div className="p-5 flex flex-col gap-6">
          {/* Ustadh Code Section */}
          <div>
            <p className="text-xs font-semibold mb-2" style={{ color: 'var(--c-text-muted)' }}>
              USTADH CODE
            </p>
            <p className="text-[11px] mb-3" style={{ color: 'var(--c-text-faint)' }}>
              Share this code with other ustadhs to add them as co-teachers
            </p>
            <button
              onClick={copyCode}
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-mono font-semibold transition-all active:scale-95"
              style={{ backgroundColor: 'var(--c-gold-bg)', color: 'var(--c-gold)' }}
            >
              {ustadhCode}
              {codeCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>

          {/* Co-Ustadhs List */}
          <div>
            <p className="text-xs font-semibold mb-2" style={{ color: 'var(--c-text-muted)' }}>
              CO-TEACHERS ({coUstadhs.length})
            </p>
            {loading ? (
              <div className="flex justify-center py-4">
                <Spinner size={20} color="var(--c-gold)" />
              </div>
            ) : coUstadhs.length === 0 ? (
              <p className="text-sm py-3" style={{ color: 'var(--c-text-faint)' }}>
                No co-teachers yet. Share the ustadh code above.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {coUstadhs.map(cu => (
                  <div
                    key={cu.id}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg"
                    style={{ backgroundColor: 'var(--c-bg-subtle)' }}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: 'var(--c-text)' }}>
                        Ustadh {cu.name}
                      </p>
                      <p className="text-[11px] truncate mt-0.5" style={{ color: 'var(--c-text-faint)' }}>
                        {cu.email}
                      </p>
                    </div>
                    {isOwner && (
                      <button
                        onClick={() => setRevokeId(cu.ustadh_id)}
                        className="p-1.5 rounded-lg transition-all active:scale-90"
                        style={{ color: 'var(--c-red)' }}
                        aria-label="Remove co-teacher"
                      >
                        <UserX className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </BottomSheet>

      {/* Revoke confirmation */}
      <ConfirmModal
        open={revokeId !== null}
        title="Remove co-teacher?"
        message="This ustadh will no longer have access to this class."
        confirmLabel="Yes, remove"
        cancelLabel="Cancel"
        destructive
        busy={revoking}
        onConfirm={confirmRevoke}
        onCancel={() => setRevokeId(null)}
      />
    </>
  );
}
