import { useState } from 'react';
import { Phone, Send, Copy, Check, MessageSquare } from 'lucide-react';
import toast from 'react-hot-toast';
import BottomSheet from './BottomSheet';
import Spinner from './Spinner';
import { invitesApi } from '../api/invites';

interface Props {
  open: boolean;
  onClose: () => void;
  classId: number;
  className: string;
  joinCode: string;
}

export default function InviteSheet({ open, onClose, classId, className, joinCode }: Props) {
  const [phone, setPhone] = useState('');
  const [sending, setSending] = useState(false);
  const [sentMessage, setSentMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function reset() {
    setPhone('');
    setSentMessage(null);
    setCopied(false);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleSend() {
    if (!phone.trim()) return;
    setSending(true);
    try {
      const result = await invitesApi.send(classId, phone.trim());
      setSentMessage(result.message);
      if (result.smsSent) {
        toast.success('Invitation sent by text message');
      } else {
        toast(result.smsError ?? 'Not sent by text message. Copy the message below instead.', { icon: '📋', duration: 6000 });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send invitation');
    } finally {
      setSending(false);
    }
  }

  async function handleCopy() {
    if (!sentMessage) return;
    try {
      await navigator.clipboard.writeText(sentMessage);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('Copied to clipboard');
    } catch {
      toast.error('Could not copy');
    }
  }

  async function handleShare() {
    if (!sentMessage) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Join ${className} on The Hifz App`,
          text: sentMessage,
        });
      } catch { /* user cancelled */ }
    } else {
      handleCopy();
    }
  }

  return (
    <BottomSheet open={open} onClose={handleClose} title="Invite a Student">
      <div className="p-5 flex flex-col gap-4">
        {!sentMessage ? (
          /* — Input stage — */
          <>
            <p className="text-sm" style={{ color: 'var(--c-text-muted)' }}>
              Enter the student's phone number with its country code, for example +44. We'll text them an invite with the class join code{' '}
              <span className="font-mono font-semibold" style={{ color: 'var(--c-gold)' }}>{joinCode}</span>.
            </p>

            <div
              className="flex items-center gap-3 px-4 rounded-xl"
              style={{
                backgroundColor: 'var(--c-bg-subtle)',
                border: '1px solid var(--c-border-soft)',
              }}
            >
              <Phone className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--c-text-muted)' }} />
              <input
                autoFocus
                type="tel"
                placeholder="+44 7700 900000"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
                className="flex-1 py-3.5 text-sm outline-none bg-transparent"
                style={{ color: 'var(--c-text)' }}
              />
            </div>

            <button
              onClick={handleSend}
              disabled={sending || !phone.trim()}
              className="w-full py-3.5 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
              style={{ backgroundColor: 'var(--c-green-dark)', color: '#FAF7F0' }}
            >
              {sending ? (
                <Spinner size={18} color="#FAF7F0" />
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Prepare Invite
                </>
              )}
            </button>
          </>
        ) : (
          /* — Success stage: show message + copy/share — */
          <>
            <div
              className="flex items-start gap-2 px-3.5 py-3 rounded-xl"
              style={{ backgroundColor: 'rgba(196,154,42,0.08)', border: '1px solid rgba(196,154,42,0.2)' }}
            >
              <MessageSquare className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--c-gold)' }} />
              <p className="text-xs leading-relaxed whitespace-pre-line" style={{ color: 'var(--c-text)' }}>
                {sentMessage}
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleCopy}
                className="flex-1 py-3 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2 transition-all active:scale-95"
                style={{
                  backgroundColor: 'var(--c-bg-subtle)',
                  color: 'var(--c-text)',
                  border: '1px solid var(--c-border-soft)',
                }}
              >
                {copied ? <Check className="w-4 h-4" style={{ color: 'var(--c-gold)' }} /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied!' : 'Copy'}
              </button>

              {'share' in navigator && (
                <button
                  onClick={handleShare}
                  className="flex-1 py-3 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2 transition-all active:scale-95"
                  style={{ backgroundColor: 'var(--c-green-dark)', color: '#FAF7F0' }}
                >
                  <Send className="w-4 h-4" />
                  Share
                </button>
              )}
            </div>

            <button
              onClick={reset}
              className="text-xs text-center py-1 transition-colors"
              style={{ color: 'var(--c-text-muted)' }}
            >
              Invite another person
            </button>
          </>
        )}
      </div>
    </BottomSheet>
  );
}
