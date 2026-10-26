/**
 * HifzHistoryPage — Ustadh view of a specific student's full Hifz history.
 *
 * Two tabs:
 *   Sessions     — accordion of every session date; tap a row to expand tasks + scores
 *   SP & Sabaq Log — date table with SP / Sabaq / Tajwid / Adab scores
 *
 * Route: /classes/:classId/student/:studentId/hifz-history
 * Query: ?tab=sessions|sp   (default: sessions)
 *        ?name=<student name>
 */
import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ChevronRight, ChevronDown, BookOpen } from 'lucide-react';
import toast from 'react-hot-toast';
import { hifzTasksApi, type HifzTask, type TaskScore } from '../../api/hifzTasks';
import { dawrApi, type DawrCell } from '../../api/dawr';
import Spinner from '../../components/Spinner';

/* ── Constants ────────────────────────────────────────────────── */
const SCORE_COLOURS: Record<number, string> = {
  7: '#00B050', 6: '#92D050', 5: '#00B0F0',
  4: '#FFD400', 3: '#FFC000', 2: '#EE0000', 1: '#C00000',
};
const SCORE_TEXT: Record<number, string> = {
  7: '#fff', 6: '#1a0a00', 5: '#fff',
  4: '#1a0a00', 3: '#1a0a00', 2: '#fff', 1: '#fff',
};

const QUARTER_LABELS: Record<string, string> = {
  '1/4': '1/4',
  '1/2': '2/4',
  '3/4': '3/4',
  'full': '4/4',
};

const TASK_DOTS:  Record<string, string> = { dawr: '#FF7A1A', sabaq: '#FFD700', sabaq_para: '#00D4A0' };
const TASK_NAMES: Record<string, string> = {
  dawr:       'Dawr — Full Juz Revision',
  sabaq:      'Sabaq — New Memorisation',
  sabaq_para: 'Sabaq Para — 10-Page Review',
};

const SURAHS: Record<number, string> = {
  1:'Al-Fatiha',2:'Al-Baqarah',3:"Ali 'Imran",4:'An-Nisa',5:"Al-Ma'idah",6:"Al-An'am",
  7:"Al-A'raf",8:'Al-Anfal',9:'At-Tawbah',10:'Yunus',11:'Hud',12:'Yusuf',13:"Ar-Ra'd",
  14:'Ibrahim',15:'Al-Hijr',16:'An-Nahl',17:'Al-Isra',18:'Al-Kahf',19:'Maryam',20:'Ta-Ha',
  21:'Al-Anbiya',22:'Al-Hajj',23:"Al-Mu'minun",24:'An-Nur',25:'Al-Furqan',26:"Ash-Shu'ara",
  27:'An-Naml',28:'Al-Qasas',29:"Al-'Ankabut",30:'Ar-Rum',31:'Luqman',32:'As-Sajdah',
  33:'Al-Ahzab',34:'Saba',35:'Fatir',36:'Ya-Sin',37:'As-Saffat',38:'Sad',39:'Az-Zumar',
  40:'Ghafir',41:'Fussilat',42:'Ash-Shura',43:'Az-Zukhruf',44:'Ad-Dukhan',45:'Al-Jathiyah',
  46:'Al-Ahqaf',47:'Muhammad',48:'Al-Fath',49:'Al-Hujurat',50:'Qaf',51:'Adh-Dhariyat',
  52:'At-Tur',53:'An-Najm',54:'Al-Qamar',55:'Ar-Rahman',56:"Al-Waqi'ah",57:'Al-Hadid',
  58:'Al-Mujadila',59:'Al-Hashr',60:'Al-Mumtahanah',61:'As-Saf',62:"Al-Jumu'ah",
  63:'Al-Munafiqun',64:'At-Taghabun',65:'At-Talaq',66:'At-Tahrim',67:'Al-Mulk',68:'Al-Qalam',
  69:'Al-Haqqah',70:"Al-Ma'arij",71:'Nuh',72:'Al-Jinn',73:'Al-Muzzammil',74:'Al-Muddaththir',
  75:'Al-Qiyamah',76:'Al-Insan',77:'Al-Mursalat',78:"An-Naba'",79:"An-Nazi'at",80:"'Abasa",
  81:'At-Takwir',82:'Al-Infitar',83:'Al-Mutaffifin',84:'Al-Inshiqaq',85:'Al-Buruj',86:'At-Tariq',
  87:"Al-A'la",88:'Al-Ghashiyah',89:'Al-Fajr',90:'Al-Balad',91:'Ash-Shams',92:'Al-Layl',
  93:'Ad-Duha',94:'Ash-Sharh',95:'At-Tin',96:"Al-'Alaq",97:'Al-Qadr',98:'Al-Bayyinah',
  99:'Az-Zalzalah',100:"Al-'Adiyat",101:"Al-Qari'ah",102:'At-Takathur',103:"Al-'Asr",
  104:'Al-Humazah',105:'Al-Fil',106:'Quraysh',107:"Al-Ma'un",108:'Al-Kawthar',109:'Al-Kafirun',
  110:'An-Nasr',111:'Al-Masad',112:'Al-Ikhlas',113:'Al-Falaq',114:'An-Nas',
};

type Tab = 'sessions' | 'sp';

/* ── Helpers ──────────────────────────────────────────────────── */
function formatSessionDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const days   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const dow    = new Date(iso + 'T12:00:00').getDay();
  return `${d} ${months[m-1].toUpperCase()} ${y} — ${days[dow].toUpperCase()}`;
}

function shortDate(iso: string): string {
  const [, m, d] = iso.split('-').map(Number);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${d} ${months[m-1]}`;
}

function taskDetail(t: HifzTask): string {
  if (t.taskType === 'dawr' && t.dawrEntries) {
    return t.dawrEntries.map(e => `Juz ${e.juz} – ${QUARTER_LABELS[e.quarter] ?? e.quarter}`).join(', ');
  }
  if (t.taskType === 'sabaq') {
    const surah = t.sabaqSurah ? (SURAHS[t.sabaqSurah] || `Surah ${t.sabaqSurah}`) : '—';
    return t.sabaqVerse ? `${surah}, verse ${t.sabaqVerse}` : surah;
  }
  if (t.taskType === 'sabaq_para') {
    return t.spStart ? `Pages ${t.spStart}–${Math.min(t.spStart + 9, 604)}` : '—';
  }
  return '';
}

/* ── Small score badge ────────────────────────────────────────── */
function ScoreBadge({ score, label }: { score: number | null | undefined; label?: string }) {
  return (
    <div className="flex items-center gap-1 flex-shrink-0">
      {label && (
        <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--c-text-faint)' }}>
          {label}
        </span>
      )}
      {score ? (
        <span
          className="inline-flex items-center justify-center w-6 h-6 rounded-md text-[11px] font-bold"
          style={{ backgroundColor: SCORE_COLOURS[score] ?? 'var(--c-bg-subtle)', color: SCORE_TEXT[score] ?? '#fff' }}
        >
          {score}
        </span>
      ) : (
        <span className="text-[11px]" style={{ color: 'var(--c-text-faint)' }}>—</span>
      )}
    </div>
  );
}

/* ── Score cell for table ─────────────────────────────────────── */
function ScoreCell({ score }: { score: number | null }) {
  if (score == null) {
    return (
      <td className="text-center py-3 px-1" style={{ color: 'var(--c-text-faint)', fontSize: 11 }}>—</td>
    );
  }
  return (
    <td className="text-center py-3 px-1">
      <span
        className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-sm font-extrabold"
        style={{ backgroundColor: SCORE_COLOURS[score] ?? '#888', color: SCORE_TEXT[score] ?? '#fff' }}
      >
        {score}
      </span>
    </td>
  );
}

/* ══════════════════════════════════════════════════════════════════
   Sessions Tab — accordion list of dates with expandable task detail
═══════════════════════════════════════════════════════════════════ */
function SessionsTab({
  dates,
  byDate,
  scores,
  dawrCells,
}: {
  dates: string[];
  byDate: Record<string, HifzTask[]>;
  scores: TaskScore[];
  dawrCells: DawrCell[];
}) {
  const [expandedDate, setExpandedDate] = useState<string | null>(null);

  if (dates.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 mt-16 px-6 text-center">
        <BookOpen className="w-10 h-10" style={{ color: 'var(--c-text-faint)' }} />
        <p className="text-sm" style={{ color: 'var(--c-text-faint)' }}>No sessions submitted yet.</p>
      </div>
    );
  }

  const scoreMap: Record<string, TaskScore> = {};
  for (const s of scores) scoreMap[s.taskDate] = s;

  return (
    <div className="flex flex-col gap-2">
      {dates.map(date => {
        const isOpen      = expandedDate === date;
        const sessionTasks = byDate[date] || [];
        const sessionScore = scoreMap[date];

        return (
          <div
            key={date}
            className="rounded-2xl overflow-hidden transition-all"
            style={{ backgroundColor: 'var(--c-bg-card)', border: '1px solid var(--c-border)' }}
          >
            {/* ── Collapsed row ── */}
            <button
              className="w-full flex items-center gap-3 px-4 py-3.5 text-left transition-all active:scale-[0.98]"
              onClick={() => setExpandedDate(isOpen ? null : date)}
            >
              {/* Calendar icon */}
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: 'var(--c-gold-bg)' }}
              >
                <span className="text-lg font-bold font-amiri leading-none" style={{ color: 'var(--c-gold)' }}>
                  {date.split('-')[2]}
                </span>
              </div>

              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm" style={{ color: 'var(--c-text)' }}>
                  {formatSessionDate(date)}
                </p>
                {/* Task type pills */}
                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                  {sessionTasks.map(t => (
                    <span
                      key={t.taskType}
                      className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                      style={{ backgroundColor: `${TASK_DOTS[t.taskType]}22`, color: TASK_DOTS[t.taskType] }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: TASK_DOTS[t.taskType] }} />
                      {t.taskType === 'sabaq_para' ? 'SP' : t.taskType === 'dawr' ? 'Dawr' : 'Sabaq'}
                    </span>
                  ))}
                  {!sessionScore && (
                    <span
                      className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
                      style={{ backgroundColor: 'var(--c-red-bg)', color: 'var(--c-red)' }}
                    >
                      Not scored
                    </span>
                  )}
                </div>
              </div>

              {isOpen
                ? <ChevronDown className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--c-text-faint)' }} />
                : <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--c-text-faint)' }} />
              }
            </button>

            {/* ── Expanded detail ── */}
            {isOpen && (
              <div className="px-4 pb-4 flex flex-col gap-2.5" style={{ borderTop: '1px solid var(--c-border)' }}>
                <div className="pt-3 flex flex-col gap-2.5">
                  {sessionTasks.map(task => (
                    <div key={task.id} className="flex items-start gap-2.5">
                      <div
                        className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                        style={{ backgroundColor: TASK_DOTS[task.taskType] || 'var(--c-text-faint)' }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-semibold" style={{ color: 'var(--c-text)' }}>
                          {TASK_NAMES[task.taskType] || task.taskType}
                        </p>

                        {/* Dawr: each juz entry with its per-cell score */}
                        {task.taskType === 'dawr' && task.dawrEntries ? (
                          <div className="mt-1 flex flex-col gap-1">
                            {task.dawrEntries.map((e, i) => {
                              const cell = dawrCells.find(c => c.juz === e.juz && c.quarter === e.quarter);
                              const cycle = cell?.cycles.find(cy => cy.loggedDate === task.taskDate) ?? cell?.cycles[0];
                              return (
                                <div key={i} className="flex items-center justify-between">
                                  <p className="text-[11px]" style={{ color: 'var(--c-text-muted)' }}>
                                    Juz {e.juz} — {QUARTER_LABELS[e.quarter] ?? e.quarter}
                                  </p>
                                  <div className="flex items-center gap-1.5">
                                    {cycle?.scoreLabel && (
                                      <span className="text-[9px]" style={{ color: 'var(--c-text-faint)' }}>
                                        {cycle.scoreLabel}
                                      </span>
                                    )}
                                    <ScoreBadge score={cycle?.score} />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-[11px] mt-0.5" style={{ color: 'var(--c-text-muted)' }}>
                            {taskDetail(task)}
                          </p>
                        )}
                      </div>

                      {/* Score badge for Sabaq / SP */}
                      {task.taskType !== 'dawr' && (
                        <ScoreBadge
                          score={
                            task.taskType === 'sabaq_para'
                              ? sessionScore?.spScore
                              : sessionScore?.sabaqScore
                          }
                        />
                      )}
                    </div>
                  ))}

                  {/* Tajwid + Adab row */}
                  {sessionScore && (sessionScore.tajwidScore || sessionScore.adabScore) && (
                    <div
                      className="flex items-center gap-4 pt-2 flex-wrap"
                      style={{ borderTop: '1px solid var(--c-border)' }}
                    >
                      <ScoreBadge label="Tajwid" score={sessionScore.tajwidScore} />
                      <ScoreBadge label="Adab"   score={sessionScore.adabScore} />
                    </div>
                  )}

                  {/* Comment */}
                  {sessionScore?.comment && (
                    <p className="text-[11px] italic" style={{ color: 'var(--c-text-muted)' }}>
                      "{sessionScore.comment}"
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   SP & Sabaq Log Tab — scored date table
═══════════════════════════════════════════════════════════════════ */
function SpSabaqLogTab({
  dates,
  scores,
  tasks,
}: {
  dates:  string[];
  scores: TaskScore[];
  tasks:  HifzTask[];
}) {
  if (dates.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 mt-16 px-6 text-center">
        <BookOpen className="w-10 h-10" style={{ color: 'var(--c-text-faint)' }} />
        <p className="text-sm" style={{ color: 'var(--c-text-faint)' }}>No sessions submitted yet.</p>
      </div>
    );
  }

  const scoreMap: Record<string, TaskScore> = {};
  for (const s of scores) scoreMap[s.taskDate] = s;

  const linesMap: Record<string, number | null> = {};
  for (const t of tasks) {
    if (t.taskType === 'sabaq' && t.sabaqLines != null) linesMap[t.taskDate] = t.sabaqLines;
  }

  return (
    <div>
      {/* Score legend */}
      <div className="flex items-center gap-2 flex-wrap mb-4">
        {([7,6,5,4,3,2,1] as const).map(n => (
          <div key={n} className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: SCORE_COLOURS[n] }} />
            <span className="text-[9px] font-semibold" style={{ color: 'var(--c-text-muted)' }}>
              {n} {(['Excellent','Very Good','Average','Below Avg','Fail','Bad Fail','Abysmal'] as const)[7 - n]}
            </span>
          </div>
        ))}
      </div>

      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--c-border)' }}>
        <table className="w-full" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--c-bg-subtle)' }}>
              <th className="text-left px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider"
                style={{ color: 'var(--c-text-muted)', borderBottom: '1px solid var(--c-border)' }}>
                Date
              </th>
              <th className="text-center px-1 py-2.5 text-[10px] font-bold"
                style={{ color: '#00D4A0', borderBottom: '1px solid var(--c-border)' }}>SP</th>
              <th className="text-center px-1 py-2.5 text-[10px] font-bold"
                style={{ color: '#FFD700', borderBottom: '1px solid var(--c-border)' }}>Sabaq</th>
              <th className="text-center px-1 py-2.5 text-[10px] font-bold"
                style={{ color: '#FFD700', borderBottom: '1px solid var(--c-border)', opacity: 0.65 }}>Lines</th>
              <th className="text-center px-1 py-2.5 text-[10px] font-bold"
                style={{ color: 'var(--c-text-muted)', borderBottom: '1px solid var(--c-border)' }}>Tajwid</th>
              <th className="text-center px-1 py-2.5 text-[10px] font-bold"
                style={{ color: 'var(--c-text-muted)', borderBottom: '1px solid var(--c-border)' }}>Adab</th>
            </tr>
          </thead>
          <tbody>
            {dates.map((date, idx) => {
              const s = scoreMap[date];
              return (
                <tr
                  key={date}
                  style={{ borderBottom: idx < dates.length - 1 ? '1px solid var(--c-border)' : undefined }}
                >
                  <td className="px-3 py-2.5 text-xs font-semibold" style={{ color: 'var(--c-text)' }}>
                    {shortDate(date)}
                  </td>
                  <ScoreCell score={s?.spScore     ?? null} />
                  <ScoreCell score={s?.sabaqScore  ?? null} />
                  <td className="text-center py-2.5 px-1 text-xs font-semibold" style={{ color: 'var(--c-text-muted)' }}>
                    {linesMap[date] != null ? `${linesMap[date]}` : '—'}
                  </td>
                  <ScoreCell score={s?.tajwidScore ?? null} />
                  <ScoreCell score={s?.adabScore   ?? null} />
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-[10px] mt-3 text-center" style={{ color: 'var(--c-text-faint)' }}>
        Scores are entered by the Ustadh after reviewing each session.
      </p>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   Main page
═══════════════════════════════════════════════════════════════════ */
export default function HifzHistoryPage() {
  const { classId, studentId } = useParams<{ classId: string; studentId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const cId = Number(classId);
  const sId = Number(studentId);
  const studentName = searchParams.get('name') ?? 'Student';
  const initialTab  = (searchParams.get('tab') as Tab | null) ?? 'sessions';

  const [tab,       setTab]       = useState<Tab>(initialTab);
  const [tasks,     setTasks]     = useState<HifzTask[]>([]);
  const [scores,    setScores]    = useState<TaskScore[]>([]);
  const [dawrCells, setDawrCells] = useState<DawrCell[]>([]);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      hifzTasksApi.studentHistory(sId, cId),
      hifzTasksApi.studentScores(sId, cId),
      dawrApi.studentGrid(sId, cId).catch(() => ({ grid: [] as DawrCell[] })),
    ])
      .then(([taskRes, scoreRes, dawrRes]) => {
        setTasks(taskRes.tasks);
        setScores(scoreRes.scores);
        setDawrCells(dawrRes.grid);
      })
      .catch(err => toast.error(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [sId, cId]);

  // Group tasks by date — dedup by type (keep first = most recent, DESC sort)
  const byDate: Record<string, HifzTask[]> = {};
  for (const t of tasks) {
    if (!byDate[t.taskDate]) byDate[t.taskDate] = [];
    if (!byDate[t.taskDate].some(x => x.taskType === t.taskType)) {
      byDate[t.taskDate].push(t);
    }
  }
  const dates = Object.keys(byDate).sort((a, b) => b.localeCompare(a));

  return (
    <div className="h-screen-fit flex flex-col" style={{ backgroundColor: 'var(--c-bg)' }}>

      {/* ── Header ────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-3 px-4 pt-safe pb-3 border-b flex-shrink-0"
        style={{ backgroundColor: 'var(--c-bg-nav)', borderColor: 'var(--c-border)' }}
      >
        <button
          onClick={() => navigate(-1)}
          className="p-1.5 -ml-1.5 rounded-lg transition-all active:scale-90"
          style={{ color: 'var(--c-text-muted)' }}
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="font-semibold text-base truncate" style={{ color: 'var(--c-text)' }}>
            {studentName}
          </h1>
          <p className="text-[10px] uppercase tracking-[0.2em]" style={{ color: 'var(--c-text-muted)' }}>
            Hifz History
          </p>
        </div>
      </div>

      {/* ── Tab toggle ────────────────────────────────────────── */}
      <div
        className="px-4 pt-3 pb-2 flex-shrink-0"
        style={{ backgroundColor: 'var(--c-bg-nav)', borderBottom: '1px solid var(--c-border)' }}
      >
        <div
          className="flex rounded-xl overflow-hidden"
          style={{ backgroundColor: 'var(--c-bg-subtle)', border: '1px solid var(--c-border)' }}
        >
          {([
            { id: 'sessions' as Tab, label: 'Sessions' },
            { id: 'sp'       as Tab, label: 'SP & Sabaq Log' },
          ]).map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="flex-1 py-2.5 text-xs font-bold transition-all"
              style={{
                backgroundColor: tab === t.id ? 'var(--c-green-dark)' : 'transparent',
                color:           tab === t.id ? '#FAF7F0'             : 'var(--c-text-muted)',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Body ──────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 pb-layout scroll-container">
        {loading ? (
          <div className="flex justify-center mt-12">
            <Spinner size={28} color="var(--c-gold)" />
          </div>
        ) : tab === 'sessions' ? (
          <SessionsTab
            dates={dates}
            byDate={byDate}
            scores={scores}
            dawrCells={dawrCells}
          />
        ) : (
          <SpSabaqLogTab
            dates={dates}
            scores={scores}
            tasks={tasks}
          />
        )}
      </div>
    </div>
  );
}
