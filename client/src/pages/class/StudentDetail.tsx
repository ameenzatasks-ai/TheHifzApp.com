/**
 * StudentDetail — Ustadh's view of one student.
 *
 * Three tabs:
 *   - Overview  — current page statuses grouped by color + "See previous" button
 *   - Grid      — editable JuzGrid (Ustadh can set pages on behalf of student)
 *   - Scores    — Enter Hifz scores: Dawr Log link + SP/Sabaq/Tajwid/Adab table
 */
import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronRight, Star, BookOpen, RotateCcw, TableProperties } from 'lucide-react';
import toast from 'react-hot-toast';
import { hifzApi, type StatusPage } from '../../api/hifz';
import { classesApi } from '../../api/classes';
import { hifzTasksApi, type HifzTask, type TaskScore } from '../../api/hifzTasks';
import type { PageStatus } from '../../../../shared/juz-map';
import GroupedPages from '../../hifz/GroupedPages';
import JuzGrid from '../../hifz/JuzGrid';
import Spinner from '../../components/Spinner';

/* ── Score colours (1–7) — used for visual feedback on inputs ── */
const SCORE_COLOURS: Record<number, string> = {
  7: '#00B050', 6: '#92D050', 5: '#00B0F0',
  4: '#FFD400', 3: '#FFC000', 2: '#EE0000', 1: '#C00000',
};


interface StudentInfo { id: number; name: string; avatar_url: string | null }
type ViewMode = 'nazira' | 'hifz';

/** Group a flat pages array by status. */
function groupPages(pages: StatusPage[]): Record<PageStatus, number[]> {
  const out: Record<PageStatus, number[]> = {
    GOLD: [], GREEN: [], AMBER: [], RED: [], BLACK: [], YELLOW: [],
  };
  for (const p of pages) out[p.status].push(p.pageNumber);
  return out;
}

/* ══════════════════════════════════════════════════════════════════
   Scores Tab — Matches design image: per-session card view.
   Shows submitted tasks as cards with inline score inputs,
   plus Tajweed, Adab, and Comments fields. Save all at once.
═══════════════════════════════════════════════════════════════════ */

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

const TASK_DOTS: Record<string, string> = { dawr: '#FF7A1A', sabaq: '#FFD700', sabaq_para: '#00D4A0' };
const TASK_NAMES: Record<string, string> = { dawr: 'Dawr — Full Juz Revision', sabaq: 'Sabaq — New Memorisation', sabaq_para: 'Sabaq Para — 10-Page Review' };

function ScoresTab({ classId, studentId, studentName }: { classId: number; studentId: number; studentName: string }) {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<HifzTask[]>([]);
  const [scores, setScores] = useState<TaskScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Per-task score inputs (keyed by task id)
  const [taskScores, setTaskScores] = useState<Record<number, string>>({});
  // Global fields
  const [tajwid, setTajwid] = useState('');
  const [adab, setAdab] = useState('');
  const [comment, setComment] = useState('');

  // Track whether we've already picked a default date so we don't reset on reload.
  const hasPickedDefault = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [taskRes, scoreRes] = await Promise.all([
        hifzTasksApi.studentHistory(studentId, classId),
        hifzTasksApi.studentScores(studentId, classId),
      ]);
      setTasks(taskRes.tasks);
      setScores(scoreRes.scores);

      // On first load only: default to the most recent date and pre-fill scores.
      if (!hasPickedDefault.current) {
        const dates = [...new Set(taskRes.tasks.map(t => t.taskDate))].sort((a, b) => b.localeCompare(a));
        if (dates.length > 0) {
          hasPickedDefault.current = true;
          const latest = dates[0];
          setSelectedDate(latest);
          const existing = scoreRes.scores.find(s => s.taskDate === latest);
          if (existing) {
            setTajwid(existing.tajwidScore?.toString() ?? '');
            setAdab(existing.adabScore?.toString() ?? '');
            setComment(existing.comment ?? '');
            const init: Record<number, string> = {};
            for (const t of taskRes.tasks.filter(tt => tt.taskDate === latest)) {
              if (t.taskType === 'sabaq_para' && existing.spScore) init[t.id] = existing.spScore.toString();
              if (t.taskType === 'sabaq' && existing.sabaqScore)   init[t.id] = existing.sabaqScore.toString();
              // Dawr scores are stored per-cell in hifz_dawr_log — not pre-filled here.
            }
            setTaskScores(init);
          }
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [studentId, classId]); // classId included; selectedDate removed to prevent double-fetch

  useEffect(() => { load(); }, [load]);

  // Group tasks by date — deduplicate by taskType per date (keep first = most recent due to DESC sort)
  const byDate: Record<string, HifzTask[]> = {};
  for (const t of tasks) {
    if (!byDate[t.taskDate]) byDate[t.taskDate] = [];
    const alreadyHasType = byDate[t.taskDate].some(x => x.taskType === t.taskType);
    if (!alreadyHasType) byDate[t.taskDate].push(t);
  }
  const dates = Object.keys(byDate).sort((a, b) => b.localeCompare(a));

  function selectDate(date: string) {
    setSelectedDate(date);
    const existing = scores.find(s => s.taskDate === date);
    setTajwid(existing?.tajwidScore?.toString() ?? '');
    setAdab(existing?.adabScore?.toString() ?? '');
    setComment(existing?.comment ?? '');
    const init: Record<number, string> = {};
    for (const t of (byDate[date] || [])) {
      if (t.taskType === 'sabaq_para' && existing?.spScore) init[t.id] = existing.spScore.toString();
      if (t.taskType === 'sabaq' && existing?.sabaqScore) init[t.id] = existing.sabaqScore.toString();
    }
    setTaskScores(init);
  }

  function formatSessionDate(iso: string) {
    const [y, m, d] = iso.split('-').map(Number);
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const dow = new Date(iso + 'T12:00:00').getDay();
    return `${d} ${months[m-1].toUpperCase()} ${y} — ${days[dow].toUpperCase()}`;
  }

  function taskDetail(t: HifzTask): string {
    if (t.taskType === 'dawr' && t.dawrEntries) {
      return t.dawrEntries.map(e => `Juz ${e.juz} - ${e.quarter}`).join(', ');
    }
    if (t.taskType === 'sabaq') {
      const surah = t.sabaqSurah ? (SURAHS[t.sabaqSurah] || `Surah ${t.sabaqSurah}`) : '—';
      return t.sabaqVerse ? `${surah}, verse ${t.sabaqVerse}` : surah;
    }
    if (t.taskType === 'sabaq_para') {
      return t.spStart ? `Pages ${t.spStart}-${Math.min(t.spStart + 9, 604)}` : '—';
    }
    return '';
  }

  async function handleSave() {
    if (!selectedDate) return;
    setSaving(true);
    try {
      // Find SP and Sabaq scores from task-level inputs
      const dateTasks = byDate[selectedDate] || [];
      let spScore: number | null = null;
      let sabaqScore: number | null = null;
      for (const t of dateTasks) {
        if (t.taskType === 'sabaq_para' || t.taskType === 'sabaq') {
          const val = taskScores[t.id];
          const num = val ? parseInt(val, 10) : null;
          if (num && num >= 1 && num <= 7) {
            if (t.taskType === 'sabaq_para') spScore = num;
            if (t.taskType === 'sabaq') sabaqScore = num;
          }
        }
        // Dawr scoring: per-quarter scores via dawrApi (isolated — failure won't block main save)
        if (t.taskType === 'dawr' && t.dawrEntries) {
          const { dawrApi } = await import('../../api/dawr');
          for (const e of t.dawrEntries) {
            const key = `dawr:${e.juz}:${e.quarter}`;
            const val = taskScores[key as any];
            const num = val ? parseInt(val, 10) : null;
            if (num && num >= 1 && num <= 7) {
              try {
                await dawrApi.score(e.juz, e.quarter, studentId, num, undefined, classId, selectedDate ?? undefined);
              } catch {
                // Non-fatal: dawr cell score failure doesn't block the main score save
              }
            }
          }
        }
      }
      const tajwidNum = tajwid ? parseInt(tajwid, 10) : null;
      const adabNum = adab ? parseInt(adab, 10) : null;

      await hifzTasksApi.scoreStudent(studentId, {
        taskDate: selectedDate,
        classId,
        spScore: spScore,
        sabaqScore: sabaqScore,
        tajwidScore: (tajwidNum && tajwidNum >= 1 && tajwidNum <= 7) ? tajwidNum : null,
        adabScore: (adabNum && adabNum >= 1 && adabNum <= 7) ? adabNum : null,
        comment: comment || undefined,
      });
      toast.success('Scores saved');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center mt-12">
        <Spinner size={28} color="var(--c-gold)" />
      </div>
    );
  }

  const currentTasks = selectedDate ? (byDate[selectedDate] || []) : [];

  return (
    <div className="h-full overflow-y-auto px-4 py-4 pb-layout scroll-container">
      {dates.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-sm" style={{ color: 'var(--c-text-muted)' }}>No tasks submitted yet.</p>
        </div>
      ) : (
        <>
          {/* Date picker (when multiple sessions exist) */}
          {dates.length > 1 && (
            <div className="flex gap-2 overflow-x-auto mb-4 pb-1 scroll-container">
              {dates.map(date => (
                <button
                  key={date}
                  onClick={() => selectDate(date)}
                  className="px-3 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-all flex-shrink-0"
                  style={{
                    backgroundColor: selectedDate === date ? 'var(--c-gold)' : 'var(--c-bg-subtle)',
                    color: selectedDate === date ? '#0d0d0d' : 'var(--c-text-muted)',
                    border: `1px solid ${selectedDate === date ? 'var(--c-gold)' : 'var(--c-border)'}`,
                  }}
                >
                  {(() => { const [,m,d] = date.split('-').map(Number); const mn=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']; return `${d} ${mn[m-1]}`; })()}
                </button>
              ))}
            </div>
          )}

          {/* Session header */}
          {selectedDate && (
            <p className="text-[10px] font-bold uppercase tracking-wider mb-4" style={{ color: 'var(--c-gold)' }}>
              Session: {formatSessionDate(selectedDate)}
            </p>
          )}

          {/* Task cards */}
          <div className="flex flex-col gap-3 mb-4">
            {currentTasks.map(task => {
              // For Dawr: render a score input per quarter entry
              const isDawr = task.taskType === 'dawr' && task.dawrEntries && task.dawrEntries.length > 0;

              return (
                <div
                  key={task.id}
                  className="rounded-xl overflow-hidden"
                  style={{ backgroundColor: 'var(--c-bg-card)', border: '1px solid var(--c-border)' }}
                >
                  {/* Task header */}
                  <div className="flex items-center gap-2.5 px-4 py-3">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: TASK_DOTS[task.taskType] || 'var(--c-text-faint)' }} />
                    <span className="text-sm font-bold" style={{ color: 'var(--c-text)' }}>
                      {TASK_NAMES[task.taskType] || task.taskType}
                    </span>
                  </div>

                  <div className="px-4 pb-3">
                    {isDawr ? (
                      /* Dawr: one score input per quarter */
                      <div className="flex flex-col gap-2">
                        {task.dawrEntries!.map((entry, idx) => {
                          const key = `dawr:${entry.juz}:${entry.quarter}`;
                          const val = taskScores[key as any] ?? '';
                          const num = val ? parseInt(val, 10) : 0;
                          return (
                            <div key={idx}>
                              <p className="text-[11px] mb-1.5 font-medium" style={{ color: 'var(--c-text-muted)' }}>
                                Juz {entry.juz} — {entry.quarter === 'full' ? 'Full' : entry.quarter}
                              </p>
                              <div
                                className="flex items-center justify-between rounded-lg px-3 py-2"
                                style={{
                                  backgroundColor: num >= 1 && SCORE_COLOURS[num] ? `${SCORE_COLOURS[num]}20` : 'var(--c-bg-subtle)',
                                  border: num >= 1 && SCORE_COLOURS[num] ? `1.5px solid ${SCORE_COLOURS[num]}` : '1px solid var(--c-border)',
                                }}
                              >
                                <span className="text-xs font-semibold" style={{ color: 'var(--c-text)' }}>Score</span>
                                <input
                                  type="number" min={1} max={7} placeholder="1-7"
                                  value={val}
                                  onChange={e => setTaskScores(prev => ({ ...prev, [key]: e.target.value }))}
                                  className="w-14 text-right text-sm font-bold outline-none bg-transparent"
                                  style={{ color: num >= 1 && SCORE_COLOURS[num] ? SCORE_COLOURS[num] : 'var(--c-text)', border: 'none' }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      /* Sabaq / SP: single score input */
                      <>
                        <p className="text-xs mb-2" style={{ color: 'var(--c-text-muted)' }}>
                          {taskDetail(task)}
                        </p>
                        <div
                          className="flex items-center justify-between rounded-lg px-3 py-2.5"
                          style={{
                            backgroundColor: taskScores[task.id] && SCORE_COLOURS[parseInt(taskScores[task.id])]
                              ? `${SCORE_COLOURS[parseInt(taskScores[task.id])]}20`
                              : 'var(--c-bg-subtle)',
                            border: taskScores[task.id] && SCORE_COLOURS[parseInt(taskScores[task.id])]
                              ? `1.5px solid ${SCORE_COLOURS[parseInt(taskScores[task.id])]}`
                              : '1px solid var(--c-border)',
                          }}
                        >
                          <span className="text-xs font-semibold" style={{ color: 'var(--c-text)' }}>Score</span>
                          <input
                            type="number" min={1} max={7} placeholder="1-7"
                            value={taskScores[task.id] ?? ''}
                            onChange={e => setTaskScores(prev => ({ ...prev, [task.id]: e.target.value }))}
                            className="w-14 text-right text-sm font-bold outline-none bg-transparent"
                            style={{
                              color: taskScores[task.id] && SCORE_COLOURS[parseInt(taskScores[task.id])]
                                ? SCORE_COLOURS[parseInt(taskScores[task.id])]
                                : 'var(--c-text)',
                              border: 'none',
                            }}
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Tajweed & Adab */}
          <div
            className="rounded-xl px-4 py-3 mb-3 flex flex-col gap-3"
            style={{ backgroundColor: 'var(--c-bg-card)', border: '1px solid var(--c-border)' }}
          >
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--c-gold)', minWidth: 60 }}>Tajweed</span>
              <input
                type="number"
                min={1}
                max={7}
                placeholder="1-7"
                value={tajwid}
                onChange={e => setTajwid(e.target.value)}
                className="w-14 px-2 py-1.5 rounded-lg text-sm font-bold text-center outline-none"
                style={{ backgroundColor: 'var(--c-bg-subtle)', border: '1px solid var(--c-border)', color: 'var(--c-text)' }}
              />
            </div>
            <div className="h-px" style={{ backgroundColor: 'var(--c-border)' }} />
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--c-gold)', minWidth: 60 }}>Adab</span>
              <input
                type="number"
                min={1}
                max={7}
                placeholder="1-7"
                value={adab}
                onChange={e => setAdab(e.target.value)}
                className="w-14 px-2 py-1.5 rounded-lg text-sm font-bold text-center outline-none"
                style={{ backgroundColor: 'var(--c-bg-subtle)', border: '1px solid var(--c-border)', color: 'var(--c-text)' }}
              />
            </div>
          </div>

          {/* Comments */}
          <div
            className="rounded-xl px-4 py-3 mb-4"
            style={{ backgroundColor: 'var(--c-bg-card)', border: '1px solid var(--c-border)' }}
          >
            <span className="text-[10px] font-bold uppercase tracking-wider block mb-2" style={{ color: 'var(--c-gold)' }}>Comments</span>
            <textarea
              placeholder="Enter comments for student..."
              value={comment}
              onChange={e => setComment(e.target.value)}
              rows={2}
              className="w-full text-xs resize-none outline-none bg-transparent"
              style={{ color: 'var(--c-text)' }}
            />
          </div>

          {/* Save button */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-3.5 rounded-2xl text-sm font-bold transition-all active:scale-98 disabled:opacity-50"
            style={{ backgroundColor: 'var(--c-green-dark)', color: '#FAF7F0' }}
          >
            {saving ? 'Saving...' : 'Save Scores'}
          </button>

          {/* ── Quick-nav row: Dawr Log + SP & Sabaq Log ──────── */}
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => navigate(
                `/classes/${classId}/student/${studentId}/dawr?name=${encodeURIComponent(studentName)}`
              )}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold transition-all active:scale-95"
              style={{ backgroundColor: 'var(--c-bg-subtle)', color: 'var(--c-gold)', border: '1px solid var(--c-border)' }}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Dawr Log
            </button>
            <button
              onClick={() => navigate(
                `/classes/${classId}/student/${studentId}/hifz-history?tab=sp&name=${encodeURIComponent(studentName)}`
              )}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold transition-all active:scale-95"
              style={{ backgroundColor: 'var(--c-bg-subtle)', color: 'var(--c-text-muted)', border: '1px solid var(--c-border)' }}
            >
              <TableProperties className="w-3.5 h-3.5" />
              SP & Sabaq Log
            </button>
          </div>

          {/* ── See Previous Sessions — styled like the Nazirah one ── */}
          <button
            onClick={() => navigate(
              `/classes/${classId}/student/${studentId}/hifz-history?tab=sessions&name=${encodeURIComponent(studentName)}`
            )}
            className="mt-3 w-full flex items-center justify-between px-4 py-3.5 rounded-2xl text-left transition-all active:scale-[0.98]"
            style={{ backgroundColor: 'var(--c-bg-card)', border: '1px solid var(--c-border)' }}
          >
            <div>
              <p className="font-semibold text-sm" style={{ color: 'var(--c-text)' }}>
                See previous Hifz sessions
              </p>
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--c-text-muted)' }}>
                View task history and scores
              </p>
            </div>
            <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--c-text-faint)' }} />
          </button>
        </>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   Main StudentDetail Component
═══════════════════════════════════════════════════════════════════ */
export default function StudentDetail() {
  const { classId, studentId } = useParams<{ classId: string; studentId: string }>();
  const navigate = useNavigate();
  const cId = Number(classId);
  const sId = Number(studentId);

  const [student, setStudent] = useState<StudentInfo | null>(null);
  const [pages, setPages] = useState<StatusPage[]>([]);
  const [allStudents, setAllStudents] = useState<StudentInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('nazira');

  const load = useCallback(async () => {
    try {
      // Load student info + all current pages + all students in class
      const [pagesRes, infoRes, classRes] = await Promise.all([
        hifzApi.studentAllPages(sId),
        classesApi.getStudentPages(cId, sId),
        classesApi.get(cId),
      ]);
      setPages(pagesRes.pages);
      setStudent(infoRes.student as StudentInfo);

      // Extract students from class detail
      if (classRes.students) {
        setAllStudents(classRes.students);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load student');
      navigate(-1);
    } finally {
      setLoading(false);
    }
  }, [cId, sId, navigate]);

  useEffect(() => { load(); }, [load]);

  function switchStudent(newStudentId: number) {
    navigate(`/classes/${cId}/student/${newStudentId}`);
  }

  const grouped = groupPages(pages);
  const totalTracked = pages.length;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--c-bg)' }}>
        <Spinner size={32} color="var(--c-gold)" />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col" style={{ backgroundColor: 'var(--c-bg)' }}>
      {/* ── Header ──────────────────────────────────────────── */}
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
          <h1 className="font-semibold text-base" style={{ color: 'var(--c-text)' }}>
            {viewMode === 'hifz' ? 'Hifz tracking' : 'Nazirah tracking'}
          </h1>
        </div>
      </div>

      {/* ── Student tabs (like Google tabs) ────────────────── */}
      {allStudents.length > 0 && (
        <div
          className="flex gap-0 overflow-x-auto flex-shrink-0 border-b"
          style={{ backgroundColor: 'var(--c-bg-nav)', borderColor: 'var(--c-border)' }}
        >
          {allStudents.map(s => (
            <button
              key={s.id}
              onClick={() => switchStudent(s.id)}
              className="px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors flex-shrink-0"
              style={{
                color: sId === s.id ? 'var(--c-gold)' : 'var(--c-text-muted)',
                borderBottom: sId === s.id ? '2px solid var(--c-gold)' : '2px solid transparent',
              }}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}

      {/* ── Nazira / Hifz mode toggle ──────────────────────── */}
      <div className="px-4 pt-3 pb-1 flex-shrink-0" style={{ backgroundColor: 'var(--c-bg-nav)' }}>
        <div className="flex rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--c-bg-subtle)', border: '1px solid var(--c-border)' }}>
          {([
            { key: 'nazira' as ViewMode, label: 'Nazira', icon: <BookOpen className="w-3.5 h-3.5" /> },
            { key: 'hifz' as ViewMode, label: 'Hifz', icon: <Star className="w-3.5 h-3.5" /> },
          ]).map(t => (
            <button
              key={t.key}
              onClick={() => setViewMode(t.key)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold transition-all"
              style={{
                backgroundColor: viewMode === t.key ? 'var(--c-green-dark)' : 'transparent',
                color: viewMode === t.key ? '#FAF7F0' : 'var(--c-text-muted)',
              }}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Hifz sub-tabs (single tab — Enter Scores) ────── */}
      {viewMode === 'hifz' && (
        <div
          className="flex border-b flex-shrink-0"
          style={{ borderColor: 'var(--c-border)', backgroundColor: 'var(--c-bg-nav)' }}
        >
          <button
            className="flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-semibold"
            style={{ color: 'var(--c-gold)', borderBottom: '2px solid var(--c-gold)' }}
          >
            <Star className="w-3.5 h-3.5" />
            Enter Scores
          </button>
        </div>
      )}

      {/* ── Body ────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {/* Nazira — Overview + Grid (always stacked, no tabs) */}
        {viewMode === 'nazira' && (
          <div className="px-4 py-4 pb-layout scroll-container">
            {/* Overview section */}
            <GroupedPages grouped={grouped} totalTracked={totalTracked} />

            {/* See previous logs */}
            <button
              onClick={() => navigate(`/classes/${cId}/student/${sId}/nazirah-logs`)}
              className="mt-4 w-full flex items-center justify-between px-4 py-3.5 rounded-2xl text-left transition-all active:scale-[0.98] mb-6"
              style={{ backgroundColor: 'var(--c-bg-card)', border: '1px solid var(--c-border)' }}
            >
              <div>
                <p className="font-semibold text-sm" style={{ color: 'var(--c-text)' }}>
                  See previous Nazira statuses
                </p>
                <p className="text-[11px] mt-0.5" style={{ color: 'var(--c-text-muted)' }}>
                  View saved weekly snapshots
                </p>
              </div>
              <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--c-text-faint)' }} />
            </button>

            {/* Juz Grid (always shown, no separate tab) */}
            <div className="mt-6">
              <JuzGrid studentId={sId} />
            </div>
          </div>
        )}

        {/* Hifz — Enter Scores */}
        {viewMode === 'hifz' && student && (
          <ScoresTab classId={cId} studentId={sId} studentName={student.name} />
        )}
      </div>
    </div>
  );
}
