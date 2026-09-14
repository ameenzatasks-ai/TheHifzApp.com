/**
 * Hifz daily-task routes
 *
 *   POST   /api/hifz-tasks          — student submits one or more tasks
 *   GET    /api/hifz-tasks          — own task history (last 60)
 *   GET    /api/hifz-tasks/date/:date — tasks for a specific date
 *   GET    /api/hifz-tasks/student/:id — ustadh: student's history
 */
import { Router, Response } from 'express';
import { z } from 'zod';
import db from '../db';
import { authenticate, requireRole, AuthRequest } from '../auth/middleware';

const router = Router();

/* ── Helpers ─────────────────────────────────────────────────── */
async function ustadhTeaches(ustadhId: number, studentId: number): Promise<boolean> {
  // Check if ustadh owns a class with this student
  const isOwner = !!await db
    .prepare(
      `SELECT 1 FROM enrolments e
       JOIN classes c ON c.id = e.class_id
       WHERE c.ustadh_id = ? AND e.student_id = ? LIMIT 1`,
    )
    .get(ustadhId, studentId);
  if (isOwner) return true;

  // Check if ustadh is a co-ustadh in any class with this student
  return !!await db
    .prepare(
      `SELECT 1 FROM enrolments e
       JOIN class_ustadhs cu ON cu.class_id = e.class_id
       WHERE cu.ustadh_id = ? AND e.student_id = ? LIMIT 1`,
    )
    .get(ustadhId, studentId);
}

function formatTask(r: any) {
  return {
    id:          r.id,
    taskDate:    r.task_date,
    taskType:    r.task_type,
    sabaqSurah:  r.sabaq_surah  ?? null,
    sabaqVerse:  r.sabaq_verse  ?? null,
    sabaqLines:  r.sabaq_lines  ?? null,
    spStart:     r.sp_start     ?? null,
    dawrEntries: r.dawr_entries ? JSON.parse(r.dawr_entries) : null,
    submittedAt: r.submitted_at,
  };
}

/* ── Prepared statements ─────────────────────────────────────── */
const stmtInsertTask = db.prepare(`
  INSERT INTO hifz_daily_tasks
    (student_id, class_id, task_date, task_type,
     sabaq_surah, sabaq_verse, sabaq_lines, sp_start, dawr_entries)
  VALUES (?,?,?,?,?,?,?,?,?)
`);

const stmtOwnHistory = db.prepare(`
  SELECT * FROM hifz_daily_tasks
  WHERE student_id = ? AND (class_id = ? OR (class_id IS NULL AND ? IS NULL))
  ORDER BY task_date DESC, submitted_at DESC
  LIMIT 60
`);

const stmtByDate = db.prepare(`
  SELECT * FROM hifz_daily_tasks
  WHERE student_id = ? AND task_date = ? AND (class_id = ? OR (class_id IS NULL AND ? IS NULL))
  ORDER BY submitted_at ASC
`);

const stmtStudentHistory = db.prepare(`
  SELECT * FROM hifz_daily_tasks
  WHERE student_id = ? AND (class_id = ? OR (class_id IS NULL AND ? IS NULL))
  ORDER BY task_date DESC, submitted_at DESC
  LIMIT 60
`);

/* ── Dawr log helpers ────────────────────────────────────────── */
// No explicit conflict target: fires on the table UNIQUE(student_id, class_id, ...)
// when class_id IS NOT NULL, and on the partial index uidx_hdl_noclass when IS NULL.
const stmtUpsertDawr = db.prepare(`
  INSERT OR IGNORE INTO hifz_dawr_log (student_id, class_id, juz_number, quarter, logged_date)
  VALUES (?,?,?,?,?)
`);

/* ── Submit tasks ────────────────────────────────────────────── */

const DawrEntrySchema = z.object({
  juz:     z.number().int().min(1).max(30),
  quarter: z.enum(['1/4','1/2','3/4','full']),
});

const TaskSchema = z.discriminatedUnion('taskType', [
  z.object({
    taskType:   z.literal('sabaq'),
    sabaqSurah: z.number().int().min(1).max(114).optional(),
    sabaqVerse: z.number().int().min(1).optional(),
    sabaqLines: z.number().int().min(1).max(500).optional(),
  }),
  z.object({
    taskType: z.literal('sabaq_para'),
    spStart:  z.number().int().min(1).max(595).optional(),
  }),
  z.object({
    taskType:    z.literal('dawr'),
    dawrEntries: z.array(DawrEntrySchema).min(1),
  }),
]);

const SubmitSchema = z.object({
  date:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  classId: z.number().int().positive().optional(),
  tasks:   z.array(TaskSchema).min(1).max(10),
});

router.post(
  '/',
  authenticate,
  requireRole('student'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    const user = req.user!;
    const parsed = SubmitSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.errors[0].message });
      return;
    }
    const { date, classId, tasks } = parsed.data;

    const insertAll = db.transaction(async () => {
      // Remove any pre-existing task of the same type for this student/class/date
      // so re-submissions cleanly replace rather than duplicate.
      const stmtDeleteExisting = db.prepare(`
        DELETE FROM hifz_daily_tasks
        WHERE student_id = ?
          AND task_type  = ?
          AND task_date  = ?
          AND (class_id = ? OR (class_id IS NULL AND ? IS NULL))
      `);
      // Sequential: these share one transaction, so running them in parallel
      // would interleave on a single connection rather than go faster.
      for (const task of tasks) {
        await stmtDeleteExisting.run(user.id, task.taskType, date, classId ?? null, classId ?? null);
      }

      for (const task of tasks) {
        const dawrJson =
          task.taskType === 'dawr'
            ? JSON.stringify(task.dawrEntries)
            : null;
        const sabaqSurah =
          task.taskType === 'sabaq' ? (task.sabaqSurah ?? null) : null;
        const sabaqVerse =
          task.taskType === 'sabaq' ? (task.sabaqVerse ?? null) : null;
        const sabaqLines =
          task.taskType === 'sabaq' ? (task.sabaqLines ?? null) : null;
        const spStart =
          task.taskType === 'sabaq_para' ? (task.spStart ?? null) : null;

        await stmtInsertTask.run(
          user.id, classId ?? null, date, task.taskType,
          sabaqSurah, sabaqVerse, sabaqLines, spStart, dawrJson,
        );

        // Update dawr_log for each Dawr entry
        if (task.taskType === 'dawr') {
          for (const e of task.dawrEntries) {
            await stmtUpsertDawr.run(user.id, classId ?? null, e.juz, e.quarter, date);
          }
        }
      }
    });

    await insertAll();
    res.status(201).json({ submitted: tasks.length });
  },
);

const stmtAllHistory = db.prepare(`
  SELECT * FROM hifz_daily_tasks
  WHERE student_id = ?
  ORDER BY task_date DESC, submitted_at DESC
  LIMIT 120
`);

/* ── Own history ────────────────────────────────────────────────
   ?all=true  → return tasks across all classes (used by the History tab)
   ?classId=N → return tasks scoped to one class
   (no param) → return only null-class tasks (legacy / standalone)
──────────────────────────────────────────────────────────────────*/
router.get('/', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  let rows: any[];
  if (req.query.all === 'true') {
    rows = await stmtAllHistory.all(req.user!.id) as any[];
  } else {
    const classId = req.query.classId ? parseInt(req.query.classId as string, 10) : null;
    rows = await stmtOwnHistory.all(req.user!.id, classId, classId) as any[];
  }
  res.json({ tasks: rows.map(formatTask) });
});

/* ── Tasks for a specific date ──────────────────────────────────*/
router.get('/date/:date', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const classId = req.query.classId ? parseInt(req.query.classId as string, 10) : null;
  const rows = await stmtByDate.all(req.user!.id, req.params.date, classId, classId) as any[];
  res.json({ tasks: rows.map(formatTask) });
});

/* ── Ustadh: student's history ──────────────────────────────────*/
router.get(
  '/student/:studentId',
  authenticate,
  requireRole('ustadh'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    const studentId = parseInt(req.params.studentId, 10);
    if (!await ustadhTeaches(req.user!.id, studentId)) {
      res.status(403).json({ error: 'Not your student' });
      return;
    }
    const classId = req.query.classId ? parseInt(req.query.classId as string, 10) : null;
    const rows = await stmtStudentHistory.all(studentId, classId, classId) as any[];
    res.json({ tasks: rows.map(formatTask) });
  },
);

/* ═══════════════════════════════════════════════════════════════════
   SP / Sabaq / Tajwid / Adab scoring
═══════════════════════════════════════════════════════════════════ */

const stmtMyScores = db.prepare(`
  SELECT task_date, sp_score, sabaq_score, tajwid_score, adab_score,
         comment, scored_at
  FROM hifz_task_scores
  WHERE student_id = ? AND (class_id = ? OR (class_id IS NULL AND ? IS NULL))
  ORDER BY task_date DESC
  LIMIT 60
`);

const stmtAllMyScores = db.prepare(`
  SELECT task_date, sp_score, sabaq_score, tajwid_score, adab_score,
         comment, scored_at
  FROM hifz_task_scores
  WHERE student_id = ?
  ORDER BY task_date DESC
  LIMIT 120
`);

/* GET own scores (student)
   ?all=true  → all classes (History tab)
   ?classId=N → single class */
router.get('/my-scores', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  let rows: any[];
  if (req.query.all === 'true') {
    rows = await stmtAllMyScores.all(req.user!.id) as any[];
  } else {
    const classId = req.query.classId ? parseInt(req.query.classId as string, 10) : null;
    rows = await stmtMyScores.all(req.user!.id, classId, classId) as any[];
  }
  res.json({
    scores: rows.map(r => ({
      taskDate:    r.task_date,
      spScore:     r.sp_score,
      sabaqScore:  r.sabaq_score,
      tajwidScore: r.tajwid_score,
      adabScore:   r.adab_score,
      comment:     r.comment,
      scoredAt:    r.scored_at,
    })),
  });
});

// stmtGetScores removed — use stmtMyScores (identical SQL) for both routes.

// No explicit conflict target: fires on table UNIQUE or partial index uidx_hts_noclass.
const stmtUpsertScore = db.prepare(`
  INSERT INTO hifz_task_scores
    (student_id, class_id, task_date, sp_score, sabaq_score, tajwid_score, adab_score,
     comment, scored_by, scored_at)
  VALUES (?,?,?,?,?,?,?,?,?,datetime('now'))
  ON CONFLICT DO UPDATE SET
    sp_score     = excluded.sp_score,
    sabaq_score  = excluded.sabaq_score,
    tajwid_score = excluded.tajwid_score,
    adab_score   = excluded.adab_score,
    comment      = excluded.comment,
    scored_by    = excluded.scored_by,
    scored_at    = excluded.scored_at
`);

const ScoreSchema = z.object({
  taskDate:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  classId:     z.number().int().positive().optional(),
  spScore:     z.number().int().min(1).max(7).nullable().optional(),
  sabaqScore:  z.number().int().min(1).max(7).nullable().optional(),
  tajwidScore: z.number().int().min(1).max(7).nullable().optional(),
  adabScore:   z.number().int().min(1).max(7).nullable().optional(),
  comment:     z.string().max(500).optional(),
});

/* GET scores for a student */
router.get(
  '/student/:studentId/scores',
  authenticate,
  requireRole('ustadh'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    const studentId = parseInt(req.params.studentId, 10);
    if (!await ustadhTeaches(req.user!.id, studentId)) {
      res.status(403).json({ error: 'Not your student' });
      return;
    }
    const classId = req.query.classId ? parseInt(req.query.classId as string, 10) : null;
    const rows = await stmtMyScores.all(studentId, classId, classId) as any[];
    res.json({
      scores: rows.map(r => ({
        taskDate:    r.task_date,
        spScore:     r.sp_score,
        sabaqScore:  r.sabaq_score,
        tajwidScore: r.tajwid_score,
        adabScore:   r.adab_score,
        comment:     r.comment,
        scoredAt:    r.scored_at,
      })),
    });
  },
);

/* PATCH — ustadh enters/updates scores for a date */
router.patch(
  '/student/:studentId/score',
  authenticate,
  requireRole('ustadh'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    const studentId = parseInt(req.params.studentId, 10);
    if (!await ustadhTeaches(req.user!.id, studentId)) {
      res.status(403).json({ error: 'Not your student' });
      return;
    }
    const parsed = ScoreSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.errors[0].message });
      return;
    }
    const { taskDate, classId, spScore, sabaqScore, tajwidScore, adabScore, comment } = parsed.data;

    await stmtUpsertScore.run(
      studentId, classId ?? null, taskDate,
      spScore ?? null, sabaqScore ?? null, tajwidScore ?? null, adabScore ?? null,
      comment ?? null, req.user!.id,
    );
    res.json({ ok: true });
  },
);

export default router;
