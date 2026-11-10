/**
 * StudentPractice — the pages a student is practising, and how far each one is
 * from Ready for Final Test (the orange status).
 *
 * Each row shows the practices counted so far against the target. Opening a row
 * lists the time of every practice in that count.
 */
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { hifzApi, type StudentPracticeList } from '../../api/hifz';
import Spinner from '../../components/Spinner';

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export default function StudentPractice({ studentId }: { studentId: number }) {
  const [data, setData] = useState<StudentPracticeList | null>(null);
  const [failed, setFailed] = useState(false);
  const [openPage, setOpenPage] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    hifzApi.studentPracticeList(studentId)
      .then(res => { if (!cancelled) setData(res); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [studentId]);

  if (failed) {
    return <p className="text-sm mb-6" style={{ color: 'var(--c-text-faint)' }}>Could not load practice.</p>;
  }
  if (!data) {
    return (
      <div className="flex justify-center py-4 mb-6">
        <Spinner size={20} color="var(--c-gold)" />
      </div>
    );
  }

  return (
    <section className="mb-6">
      <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--c-text-muted)' }}>
        Practice in progress
      </p>

      {data.pages.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--c-text-faint)' }}>No practice counted yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {data.pages.map(page => {
            const isOpen = openPage === page.pageNumber;
            const left = Math.max(0, data.target - page.count);
            return (
              <div
                key={page.pageNumber}
                className="rounded-2xl overflow-hidden"
                style={{ backgroundColor: 'var(--c-bg-card)', border: '1px solid var(--c-border)' }}
              >
                <button
                  onClick={() => setOpenPage(isOpen ? null : page.pageNumber)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm" style={{ color: 'var(--c-text)' }}>
                      Page {page.pageNumber}
                    </p>
                    <p className="text-[11px] mt-0.5" style={{ color: 'var(--c-text-muted)' }}>
                      {page.count} of {data.target} practices · {left === 0 ? 'all counted' : `${left} to go`}
                    </p>
                    <div className="w-full h-1.5 rounded-full overflow-hidden mt-2" style={{ backgroundColor: 'var(--c-bg-subtle)' }}>
                      <div
                        className="h-full"
                        style={{ width: `${(page.count / data.target) * 100}%`, backgroundColor: 'var(--c-gold)' }}
                      />
                    </div>
                  </div>
                  {isOpen
                    ? <ChevronUp className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--c-text-faint)' }} />
                    : <ChevronDown className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--c-text-faint)' }} />}
                </button>

                {isOpen && (
                  <ol className="px-4 pb-3 flex flex-col gap-1 list-decimal list-inside">
                    {page.entries.map((iso, i) => (
                      <li key={`${iso}-${i}`} className="text-xs" style={{ color: 'var(--c-text-muted)' }}>
                        {formatWhen(iso)}
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
