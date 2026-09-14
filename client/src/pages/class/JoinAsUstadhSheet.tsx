import { useState } from 'react';
import toast from 'react-hot-toast';
import { classesApi } from '../../api/classes';
import BottomSheet from '../../components/BottomSheet';
import Spinner from '../../components/Spinner';
import type { ClassWithMeta } from '../../types';

interface JoinAsUstadhSheetProps {
  open: boolean;
  onClose: () => void;
  onJoined: (cls: ClassWithMeta) => void;
}

export default function JoinAsUstadhSheet({ open, onClose, onJoined }: JoinAsUstadhSheetProps) {
  const [code, setCode] = useState('');
  const [joining, setJoining] = useState(false);

  async function handleJoin() {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      toast.error('Please enter a code');
      return;
    }

    setJoining(true);
    try {
      const cls = await classesApi.joinAsUstadh(trimmed);
      toast.success(`Joined class as co-teacher`);
      setCode('');
      onClose();
      onJoined(cls);
    } catch (err) {
      if (err instanceof Error) {
        if (err.message.includes('already a co-ustadh')) {
          toast.error('You are already a co-teacher in this class');
        } else if (err.message.includes('own class')) {
          toast.error('Cannot join your own class as co-teacher');
        } else if (err.message.includes('Invalid ustadh code')) {
          toast.error('Invalid code. Please check and try again.');
        } else {
          toast.error(err.message);
        }
      } else {
        toast.error('Failed to join class');
      }
    } finally {
      setJoining(false);
    }
  }

  return (
    <BottomSheet
      open={open}
      onClose={() => !joining && onClose()}
      title="Join as Co-Teacher"
    >
      <div className="p-5 flex flex-col gap-4">
        <p className="text-sm" style={{ color: 'var(--c-text-faint)' }}>
          Enter the Ustadh Code to be added as a co-teacher to a class.
        </p>
        <input
          autoFocus
          type="text"
          value={code}
          onChange={e => setCode(e.target.value.toUpperCase())}
          onKeyDown={e => e.key === 'Enter' && handleJoin()}
          placeholder="e.g., USTADH-ABC123"
          maxLength={20}
          className="w-full px-4 py-3 rounded-xl text-sm font-mono font-semibold outline-none text-center"
          style={{
            backgroundColor: 'var(--c-bg-subtle)',
            color: 'var(--c-text)',
            border: '1px solid var(--c-border-soft)',
          }}
        />
        <button
          onClick={handleJoin}
          disabled={joining || !code.trim()}
          className="w-full py-3.5 rounded-2xl font-semibold text-sm transition-all active:scale-95 disabled:opacity-50"
          style={{ backgroundColor: 'var(--c-green-dark)', color: '#FAF7F0' }}
        >
          {joining ? <Spinner size={18} color="#FAF7F0" /> : 'Join'}
        </button>
      </div>
    </BottomSheet>
  );
}
