/**
 * DawrLog — 30 Juz × 4 quarters progress grid.
 *
 * Supports multiple cycles: if a student reads the same Juz on a different
 * date, a new cycle row pair (Date + Score) is appended below the first.
 */
import { useState, useEffect, useCallback, Fragment } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Grid3x3 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import { dawrApi, type DawrCell, type DawrGrid, type StudentDawrData } from '../../api/dawr';
import type { Quarter } from '../../api/hifzTasks';
import Spinner from '../../components/Spinner';

/* ── Score color palette (matches design prototype SCORE_COLORS) ── */
const SCORE_COLORS: Record<number, { bg: string; text: string; label: string }> = {
  7: { bg: '#00B050', text: '#FFF', label: 'Excellent' },
  6: { bg: '#92D050', text: '#1A3A00', label: 'Very Good' },
  5: { bg: '#00B0F0', text: '#FFF', label: 'Average' },
  4: { bg: '#FFD400', text: '#3A2E00', label: 'Below Avg' },
  3: { bg: '#FFC000', text: '#3A2E00', label: 'Fail' },
  2: { bg: '#EE0000', text: '#FFF', label: 'Bad Fail' },
  1: { bg: '#C00000', text: '#FFF', label: 'Abysmal' },
};

const QUARTERS: Quarter[] = ['1/4', '1/2', '3/4', 'full'];

function shortDate(iso: string): string {
  const [, m, d] = iso.split('-').map(Number);
  const months = ['Jan','Feb','Mar','Apr','May','Jun',
                  'Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${d} ${months[m-1]}`;
}

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]?.toUpperCase()).join('').slice(0, 2);
}

const AVATAR_COLORS = ['#0F4C3A','#B8862A','#0E9C78','#9A6F1E','#2D5A8C','#6B3FA0'];
function avatarBg(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h + name.charCodeAt(i)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[h];
}

interface Props {
  studentId?:   number;
  studentName?: string;
  classIdProp?: number;
}

export default function DawrLog({ studentId, studentName, classIdProp }: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { classId: classIdParam } = useParams<{ classId?: string }>();
  const classId = classIdProp ?? (classIdParam ? parseInt(classIdParam, 10) : undefined);
  const isUstadh = user?.role === 'ustadh';

  const [singleGrid, setSingleGrid] = useState<DawrCell[]>([]);
  const [allStudents, setAllStudents] = useState<StudentDawrData[]>([]);
  const [loading, setLoading] = useState(true);

  const isMultiStudent = isUstadh && studentId == null;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (isMultiStudent) {
        const data = await dawrApi.allStudents(classId);
        setAllStudents(data.students);
      } else {
        const data: DawrGrid = studentId != null
          ? await dawrApi.studentGrid(studentId, classId)
          : await dawrApi.myGrid(classId);
        setSingleGrid(data.grid);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load Dawr Log');
    } finally {
      setLoading(false);
    }
  }, [studentId, isMultiStudent, classId]);

  useEffect(() => { load(); }, [load]);

  /* Build lookup: "juz:quarter" → DawrCell (with cycles[]) */
  const cellMap: Record<string, DawrCell> = {};
  for (const c of singleGrid) cellMap[`${c.juz}:${c.quarter}`] = c;

  const studentMaps: Record<number, Record<string, DawrCell>> = {};
  for (const s of allStudents) {
    const m: Record<string, DawrCell> = {};
    for (const c of s.grid) m[`${c.juz}:${c.quarter}`] = c;
    studentMaps[s.id] = m;
  }

  const studentCount = isMultiStudent ? allStudents.length : 1;
  const displayName = studentName ?? (isMultiStudent ? '' : user?.name ?? '');

  /* Max cycles across all cells — determines how many row pairs to render */
  const maxCycles = isMultiStudent
    ? 1  // per-student maxCycles computed inside StudentRows
    : Math.max(1, ...singleGrid.map(c => c.cycles.length));

  return (
    <div className="h-screen-fit flex flex-col" style={{ backgroundColor: 'var(--c-bg)' }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-safe pb-3 border-b flex-shrink-0"
        style={{ backgroundColor: 'var(--c-bg-nav)', borderColor: 'var(--c-border)' }}>
        <button onClick={() => navigate(-1)} className="p-1.5 -ml-1.5 rounded-lg transition-all active:scale-90"
          style={{ color: 'var(--c-text-muted)' }}>
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="font-semibold text-base" style={{ color: 'var(--c-text)' }}>
            Dawr Log{studentName ? ` — ${studentName}` : ''}
          </h1>
          <p className="text-[10px] uppercase tracking-[.2em]" style={{ color: 'var(--c-text-muted)' }}>
            30 Juz · 4 Quarters each
          </p>
        </div>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--c-gold-bg)' }}>
          <Grid3x3 className="w-4 h-4" style={{ color: 'var(--c-gold)' }} />
        </div>
      </div>

      {/* Info strip */}
      <div className="px-4 py-2.5 border-b flex items-center justify-between" style={{ borderColor: 'var(--c-border)', backgroundColor: 'var(--c-bg-subtle)' }}>
        <span className="text-[11px] font-semibold" style={{ color: 'var(--c-text-muted)' }}>
          {isMultiStudent
            ? `${studentCount} student${studentCount !== 1 ? 's' : ''} · Hifz Class`
            : `${displayName ? displayName + ' · ' : ''}Your Dawr progress`}
        </span>
      </div>

      {/* Description */}
      <div className="px-4 py-2 border-b" style={{ borderColor: 'var(--c-border)' }}>
        <p className="text-[11px] leading-relaxed" style={{ color: 'var(--c-text-muted)' }}>
          30 Juz × 4 quarters. Each date a Juz is read creates a new cycle row.{' '}
          {isUstadh ? 'Scores are entered via the Enter Scores tab on the student page.' : 'Your Ustadh enters the score /7.'}
        </p>
      </div>

      {/* Score legend */}
      <div className="flex items-center gap-2 flex-wrap px-4 py-2 border-b" style={{ borderColor: 'var(--c-border)' }}>
        {Object.entries(SCORE_COLORS).sort((a, b) => Number(b[0]) - Number(a[0])).map(([s, col]) => (
          <div key={s} className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: col.bg }} />
            <span className="text-[9px] font-semibold" style={{ color: 'var(--c-text-muted)' }}>
              {s} {col.label}
            </span>
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-auto scroll-container">
        {loading ? (
          <div className="flex justify-center mt-12"><Spinner size={28} color="var(--c-gold)" /></div>
        ) : (
          <div style={{ overflowX: 'auto', paddingBottom: 16 }}>
            <table style={{ borderCollapse: 'collapse', minWidth: 'max-content' }}>
              {/* Column headers — alternating green/blue per Juz */}
              <thead>
                <tr>
                  <th style={{
                    minWidth: 110, padding: '6px 8px', position: 'sticky', left: 0, zIndex: 3,
                    backgroundColor: 'var(--c-bg)', borderBottom: '1px solid var(--c-border)',
                    textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'var(--c-text-muted)',
                  }}>
                    Student
                  </th>
                  {Array.from({ length: 30 }, (_, i) => i + 1).map(juz => {
                    const isOdd = juz % 2 === 1;
                    const bg = isOdd ? '#99FFAC' : '#99CEFF';
                    const bd = isOdd ? '#5FCC78' : '#5FA3E5';
                    const tx = isOdd ? '#0B3D17' : '#0B2E4D';
                    return QUARTERS.map((q, qi) => (
                      <th key={`${juz}-${q}`}
                        style={{
                          minWidth: 44, maxWidth: 44, padding: '4px 2px',
                          textAlign: 'center', verticalAlign: 'bottom',
                          backgroundColor: bg, color: tx,
                          borderColor: bd,
                          borderWidth: 1, borderStyle: 'solid',
                          borderLeft: qi === 0 ? `2.5px solid ${bd}` : undefined,
                        }}>
                        <span style={{
                          writingMode: 'vertical-rl', transform: 'rotate(180deg)',
                          display: 'block',
                          fontSize: qi === 0 ? 11 : 10,
                          fontWeight: qi === 0 ? 800 : 600,
                          padding: '4px 0', whiteSpace: 'nowrap',
                        }}>
                          {qi === 0 ? `Juz ${juz}` : `Q${qi + 1}`}
                        </span>
                      </th>
                    ));
                  })}
                </tr>
              </thead>

              <tbody>
                {isMultiStudent ? (
                  allStudents.map(student => (
                    <StudentRows
                      key={student.id}
                      student={student}
                      cellMap={studentMaps[student.id] ?? {}}
                    />
                  ))
                ) : (
                  /* ── Single-student rows: one Date+Score pair per cycle ── */
                  Array.from({ length: maxCycles }, (_, ci) => (
                    <Fragment key={ci}>
                      {/* Date row */}
                      <tr>
                        <td style={{
                          position: 'sticky', left: 0, zIndex: 2,
                          backgroundColor: 'var(--c-bg-card)', padding: '3px 8px',
                          fontSize: 10, fontWeight: 700, color: 'var(--c-text-muted)',
                          whiteSpace: 'nowrap', borderBottom: '1px solid var(--c-border)',
                        }}>
                          Date
                        </td>
                        {Array.from({ length: 30 }, (_, i) => i + 1).map(juz =>
                          QUARTERS.map((q, qi) => {
                            const cycle = cellMap[`${juz}:${q}`]?.cycles[ci];
                            return (
                              <td key={`date-${ci}-${juz}-${q}`}
                                style={{
                                  minWidth: 44, maxWidth: 44, height: 28,
                                  textAlign: 'center', verticalAlign: 'middle',
                                  borderLeft: qi === 0 ? '2.5px solid var(--c-border)' : '1px solid var(--c-border)',
                                  borderBottom: '1px solid var(--c-border)',
                                  backgroundColor: cycle?.loggedDate ? 'rgba(15,76,58,.08)' : 'var(--c-bg-subtle)',
                                  fontSize: 8, fontWeight: 600, color: 'var(--c-text-muted)',
                                }}>
                                {cycle?.loggedDate ? shortDate(cycle.loggedDate) : ''}
                              </td>
                            );
                          })
                        )}
                      </tr>

                      {/* Score row */}
                      <tr>
                        <td style={{
                          position: 'sticky', left: 0, zIndex: 2,
                          backgroundColor: 'var(--c-bg-card)', padding: '3px 8px',
                          fontSize: 10, fontWeight: 700, color: 'var(--c-text-muted)',
                          whiteSpace: 'nowrap',
                          borderBottom: ci < maxCycles - 1 ? '1px solid var(--c-border)' : undefined,
                        }}>
                          Score /7
                        </td>
                        {Array.from({ length: 30 }, (_, i) => i + 1).map(juz =>
                          QUARTERS.map((q, qi) => {
                            const cycle = cellMap[`${juz}:${q}`]?.cycles[ci];
                            const sc = cycle?.score;
                            const col = sc != null ? SCORE_COLORS[sc] : null;
                            return (
                              <td key={`score-${ci}-${juz}-${q}`}
                                onClick={() => {
                                  if (!isUstadh && cycle?.loggedDate && !sc) {
                                    toast('Score pending from Ustadh', { icon: '⏳' });
                                  }
                                }}
                                style={{
                                  minWidth: 44, maxWidth: 44, height: 36,
                                  textAlign: 'center', verticalAlign: 'middle',
                                  borderLeft: qi === 0 ? '2.5px solid var(--c-border)' : '1px solid var(--c-border)',
                                  borderBottom: ci < maxCycles - 1 ? '1px solid var(--c-border)' : undefined,
                                  backgroundColor: col ? col.bg : 'var(--c-bg-card)',
                                  color: col ? col.text : 'var(--c-text-faint)',
                                  cursor: 'default',
                                  fontSize: 15, fontWeight: 800,
                                  transition: 'filter .15s',
                                }}>
                                {sc != null ? sc : ''}
                              </td>
                            );
                          })
                        )}
                      </tr>
                    </Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Score modal removed — Ustadh scores via Enter Scores tab on student page */}
    </div>
  );
}

/* ── Multi-student row block (N cycle pairs per student) ── */
function StudentRows({ student, cellMap }: {
  student:  StudentDawrData;
  cellMap:  Record<string, DawrCell>;
}) {
  const cells = Object.values(cellMap);
  const maxCycles = Math.max(1, ...cells.map(c => c.cycles.length));

  return (
    <>
      {Array.from({ length: maxCycles }, (_, ci) => (
        <Fragment key={ci}>
          {/* Date row — cycle ci */}
          <tr>
            {ci === 0 && (
              <td rowSpan={maxCycles * 2} style={{
                position: 'sticky', left: 0, zIndex: 2,
                backgroundColor: 'var(--c-bg-card)',
                padding: '6px 8px', verticalAlign: 'middle',
                borderBottom: '2px solid var(--c-border)',
                minWidth: 110,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {student.avatarUrl ? (
                    <img src={student.avatarUrl} alt={student.name}
                      style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                  ) : (
                    <div style={{
                      width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                      backgroundColor: avatarBg(student.name), color: '#FFF',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 10, fontWeight: 700,
                    }}>
                      {getInitials(student.name)}
                    </div>
                  )}
                  <div style={{ overflow: 'hidden' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {student.name}
                    </div>
                    <div style={{ fontSize: 9, color: 'var(--c-text-faint)' }}>student</div>
                  </div>
                </div>
              </td>
            )}
            {Array.from({ length: 30 }, (_, i) => i + 1).map(juz =>
              QUARTERS.map((q, qi) => {
                const cycle = cellMap[`${juz}:${q}`]?.cycles[ci];
                return (
                  <td key={`d-${ci}-${juz}-${q}`}
                    style={{
                      minWidth: 44, maxWidth: 44, height: 24,
                      textAlign: 'center', verticalAlign: 'middle',
                      borderLeft: qi === 0 ? '2.5px solid var(--c-border)' : '1px solid var(--c-border)',
                      borderBottom: '1px solid var(--c-border)',
                      backgroundColor: cycle?.loggedDate ? 'rgba(15,76,58,.08)' : 'var(--c-bg-subtle)',
                      fontSize: 8, fontWeight: 600, color: 'var(--c-text-muted)',
                    }}>
                    {cycle?.loggedDate ? (
                      <span style={{ fontSize: 7 }}>{shortDate(cycle.loggedDate)}</span>
                    ) : ''}
                  </td>
                );
              })
            )}
          </tr>

          {/* Score row — cycle ci */}
          <tr>
            {Array.from({ length: 30 }, (_, i) => i + 1).map(juz =>
              QUARTERS.map((q, qi) => {
                const cycle = cellMap[`${juz}:${q}`]?.cycles[ci];
                const sc = cycle?.score;
                const col = sc != null ? SCORE_COLORS[sc] : null;
                return (
                  <td key={`s-${ci}-${juz}-${q}`}
                    style={{
                      minWidth: 44, maxWidth: 44, height: 32,
                      textAlign: 'center', verticalAlign: 'middle',
                      borderLeft: qi === 0 ? '2.5px solid var(--c-border)' : '1px solid var(--c-border)',
                      borderBottom: ci === maxCycles - 1 ? '2px solid var(--c-border)' : '1px solid var(--c-border)',
                      backgroundColor: col ? col.bg : 'var(--c-bg-card)',
                      color: col ? col.text : 'var(--c-text-faint)',
                      cursor: 'default',
                      fontSize: 14, fontWeight: 800,
                    }}>
                    {sc != null ? sc : ''}
                  </td>
                );
              })
            )}
          </tr>
        </Fragment>
      ))}
    </>
  );
}
