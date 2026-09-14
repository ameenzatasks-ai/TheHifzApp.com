/**
 * Dawr Log routes — 30 Juz × 4 quarters progress grid.
 *
 *   GET    /api/dawr                           — student's own grid
 *   GET    /api/dawr/student/:id               — ustadh: student's grid
 *   PATCH  /api/dawr/:juz/:quarter             — ustadh: score a cell
 */
import { Router, Response } from 'express';
import { z } from 'zod';
import db from '../db';
import { authenticate, requireRole, AuthRequest } from '../auth/middleware';

const router = Router();

const QUARTERS = ['1/4', '1/2', '3/4', 'full'] as const;
type Quarter = typeof QUARTERS[number];

const QUARTER_LABELS: Record<Quarter, string> = {
  '1/4':  '1/4',
  '1/2':  '2/4',
  '3/4':  '3/4',
  'full': '4/4',
};

/* Score 1–7 display labels */
const SCORE_LABELS: Record<number, string> = {
  1: 'Repeat',
  2: 'Weak',
  3: 'Needs Work',
  4: 'Average',
  5: 'Good',
  6: 'Very Good',
  7: 'Excellent',
};

/* Score colours for 1–7 */
export const SCORE_COLOURS: Record<number, string> = {
  1: '#C53030',  // red
  2: '#E05C00',  // dark orange
  3: '#D97706',  // amber
  4: '#B8862A',  // gold
  5: '#0D7264',  // teal
  6: '#166534',  // green
  7: '#0F4C3A',  // dark green
};

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

interface DawrCycleRow {
  loggedDate:  string;
  score:       number | null;
  scoreLabel:  string | null;
  scoreColour: string | null;
  comment:     string | null;
  scoredAt:    string | null;
}

async function buildGrid(studentId: number, classId?: number | null) {
  const rows = classId != null
    ? await db.prepare(
        `SELECT juz_number, quarter, logged_date, score, score_label, comment, scored_at
         FROM hifz_dawr_log WHERE student_id = ? AND class_id = ?
         ORDER BY juz_number ASC, quarter ASC, logged_date ASC`,
      ).all(studentId, classId) as any[]
    : await db.prepare(
        `SELECT juz_number, quarter, logged_date, score, score_label, comment, scored_at
         FROM hifz_dawr_log WHERE student_id = ? AND class_id IS NULL
         ORDER BY juz_number ASC, quarter ASC, logged_date ASC`,
      ).all(studentId) as any[];

  // Map keyed by "juz:quarter" → array of cycle rows (one per logged_date)
  const map: Record<string, any[]> = {};
  for (const r of rows) {
    const key = `${r.juz_number}:${r.quarter}`;
    if (!map[key]) map[key] = [];
    map[key].push(r);
  }

  const grid: Array<{
    juz:          number;
    quarter:      Quarter;
    quarterLabel: string;
    cycles:       DawrCycleRow[];
  }> = [];

  for (let juz = 1; juz <= 30; juz++) {
    for (const q of QUARTERS) {
      const cycleRows = map[`${juz}:${q}`] ?? [];
      grid.push({
        juz,
        quarter:      q,
        quarterLabel: QUARTER_LABELS[q],
        cycles: cycleRows.map(c => ({
          loggedDate:  c.logged_date,
          score:       c.score ?? null,
          scoreLabel:  c.score_label ?? null,
          scoreColour: c.score != null ? SCORE_COLOURS[c.score] : null,
          comment:     c.comment ?? null,
          scoredAt:    c.scored_at ?? null,
        })),
      });
    }
  }
  return grid;
}


/* ── Routes ──────────────────────────────────────────────────── */

/* Own grid */
router.get('/', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const classId = req.query.classId ? parseInt(req.query.classId as string, 10) : null;
  res.json({
    grid:        await buildGrid(req.user!.id, classId),
    scoreLabels: SCORE_LABELS,
    scoreColours: SCORE_COLOURS,
  });
});

/* Ustadh: student's grid */
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
    res.json({
      grid:        await buildGrid(studentId, classId),
      scoreLabels: SCORE_LABELS,
      scoreColours: SCORE_COLOURS,
    });
  },
);

/* Ustadh: score a cell
 * Quarter is passed in the request body (not the URL path) to avoid
 * slash-encoding issues with values like "1/4", "1/2", "3/4".
 */
router.patch(
  '/:juz',
  authenticate,
  requireRole('ustadh'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    const juz     = parseInt(req.params.juz, 10);

    if (isNaN(juz) || juz < 1 || juz > 30) {
      res.status(400).json({ error: 'Invalid juz' });
      return;
    }

    const parsed = z.object({
      quarter:    z.enum(['1/4', '1/2', '3/4', 'full']),
      studentId:  z.number().int(),
      classId:    z.number().int().positive().optional(),
      loggedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      score:      z.number().int().min(1).max(7),
      comment:    z.string().max(500).optional(),
    }).safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.errors[0].message });
      return;
    }
    const { quarter: resolvedQuarter, studentId, classId, loggedDate, score, comment } = parsed.data;

    if (!await ustadhTeaches(req.user!.id, studentId)) {
      res.status(403).json({ error: 'Not your student' });
      return;
    }

    // Identify which cycle to score: use provided loggedDate or fall back to most recent
    let ld: string | null = loggedDate ?? null;
    if (!ld) {
      const latest = await db.prepare(`
        SELECT logged_date FROM hifz_dawr_log
        WHERE student_id = ? AND juz_number = ? AND quarter = ?
          AND (class_id = ? OR (class_id IS NULL AND ? IS NULL))
        ORDER BY logged_date DESC LIMIT 1
      `).get(studentId, juz, resolvedQuarter, classId ?? null, classId ?? null) as any;
      ld = latest?.logged_date ?? null;
    }

    if (!ld) {
      res.status(404).json({ error: 'No Dawr submission found for this cell' });
      return;
    }

    await db.prepare(`
      UPDATE hifz_dawr_log
      SET score = ?, score_label = ?, comment = ?, scored_by = ?, scored_at = datetime('now')
      WHERE student_id = ? AND juz_number = ? AND quarter = ? AND logged_date = ?
        AND (class_id = ? OR (class_id IS NULL AND ? IS NULL))
    `).run(
      score, SCORE_LABELS[score], comment ?? null, req.user!.id,
      studentId, juz, resolvedQuarter, ld,
      classId ?? null, classId ?? null,
    );

    res.json({ ok: true, scoreLabel: SCORE_LABELS[score] });
  },
);

/* Ustadh: all students' grids (for multi-student Dawr Log view) */
router.get(
  '/all-students',
  authenticate,
  requireRole('ustadh'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    const ustadhId = req.user!.id;
    const classId = req.query.classId ? parseInt(req.query.classId as string, 10) : null;

    // Get all students enrolled in the specified class (or any class taught by this ustadh)
    const students = classId
      ? await db.prepare(
          `SELECT DISTINCT u.id, u.name, u.avatar_url
           FROM users u
           JOIN enrolments e ON e.student_id = u.id
           JOIN classes c ON c.id = e.class_id
           WHERE c.ustadh_id = ? AND c.id = ?
           ORDER BY u.name`,
        ).all(ustadhId, classId) as Array<{ id: number; name: string; avatar_url: string | null }>
      : await db.prepare(
          `SELECT DISTINCT u.id, u.name, u.avatar_url
           FROM users u
           JOIN enrolments e ON e.student_id = u.id
           JOIN classes c ON c.id = e.class_id
           WHERE c.ustadh_id = ?
           ORDER BY u.name`,
        ).all(ustadhId) as Array<{ id: number; name: string; avatar_url: string | null }>;

    // Promise.all rather than a sequential loop: these are independent reads,
    // and against a remote database the round trips would otherwise add up
    // across a whole class.
    const result = await Promise.all(students.map(async s => ({
      id:        s.id,
      name:      s.name,
      avatarUrl: s.avatar_url,
      grid:      await buildGrid(s.id, classId),
    })));

    res.json({
      students:     result,
      scoreLabels:  SCORE_LABELS,
      scoreColours: SCORE_COLOURS,
    });
  },
);

export default router;
