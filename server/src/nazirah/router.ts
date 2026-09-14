/**
 * Nazira log router — weekly status snapshots.
 *
 * Routes:
 *   POST   /api/nazirah/log                              — student saves snapshot
 *   GET    /api/nazirah/logs                             — own logs list
 *   GET    /api/nazirah/logs/:logId                      — own log detail
 *   GET    /api/nazirah/logs/student/:studentId          — ustadh: student's logs
 *   GET    /api/nazirah/logs/:logId/student/:studentId   — ustadh: log detail
 */

import { Router, Response } from 'express';
import { z } from 'zod';
import db from '../db';
import { authenticate, AuthRequest } from '../auth/middleware';
import type { PageStatus } from '../shared/juz-map';
import { sweepRetest } from '../hifz/retest';

const router = Router();

/** Confirms an ustadh teaches the given student (owner or co-ustadh). */
async function ustadhTeaches(ustadhId: number, studentId: number): Promise<boolean> {
  // Check if ustadh owns a class with this student
  const isOwner = !!await db.prepare(`
    SELECT 1 FROM enrolments e
    JOIN classes c ON c.id = e.class_id
    WHERE c.ustadh_id = ? AND e.student_id = ?
    LIMIT 1
  `).get(ustadhId, studentId);
  if (isOwner) return true;

  // Check if ustadh is a co-ustadh in any class with this student
  return !!await db.prepare(`
    SELECT 1 FROM enrolments e
    JOIN class_ustadhs cu ON cu.class_id = e.class_id
    WHERE cu.ustadh_id = ? AND e.student_id = ?
    LIMIT 1
  `).get(ustadhId, studentId);
}

interface LogRow {
  id: number;
  student_id: number;
  log_date: string;
  notes: string | null;
  created_at: string;
}

interface PageRow {
  page_number: number;
  status: PageStatus;
}

function formatLogDetail(log: LogRow, pages: PageRow[]) {
  const grouped: Record<PageStatus, number[]> = {
    GOLD: [], GREEN: [], AMBER: [], RED: [], BLACK: [], YELLOW: [],
  };
  for (const p of pages) grouped[p.status].push(p.page_number);
  return {
    id: log.id,
    logDate: log.log_date,
    notes: log.notes,
    createdAt: log.created_at,
    pageCount: pages.length,
    grouped,
  };
}

// ─── Prepared statements (module-level so they compile once) ───────────────

/** Pages the student changed in the 7-day window ending on logDate (inclusive). */
const stmtGetWeeklyPages = db.prepare(`
  SELECT DISTINCT sh.page_number, sps.status
  FROM status_history sh
  JOIN student_page_status sps
    ON  sps.student_id  = sh.student_id
    AND sps.page_number = sh.page_number
    AND sps.variant     = sh.variant
  WHERE sh.student_id = ?
    AND sh.variant    = 'NEW_MADANI'
    AND date(sh.changed_at) >= date(?, '-6 days')
    AND date(sh.changed_at) <= date(?)
    AND sps.status IS NOT NULL
  ORDER BY sh.page_number ASC
`);

const stmtDeleteLog = db.prepare(`
  DELETE FROM nazirah_logs WHERE student_id = ? AND log_date = ?
`);

const stmtInsertLog = db.prepare(`
  INSERT INTO nazirah_logs (student_id, log_date) VALUES (?, ?)
`);

const stmtInsertPage = db.prepare(`
  INSERT INTO nazirah_log_pages (log_id, page_number, status) VALUES (?, ?, ?)
`);

const stmtGetLogByDate = db.prepare(`
  SELECT * FROM nazirah_logs WHERE student_id = ? AND log_date = ?
`);

const stmtGetLogById = db.prepare(`SELECT * FROM nazirah_logs WHERE id = ?`);

const stmtGetLogPages = db.prepare(`
  SELECT page_number, status FROM nazirah_log_pages WHERE log_id = ? ORDER BY page_number
`);

const stmtGetStudentLogById = db.prepare(`
  SELECT * FROM nazirah_logs WHERE id = ? AND student_id = ?
`);

/** Shape a list-row into the NazirahLogSummary wire format (includes per-color counts). */
function formatLogSummary(r: any) {
  return {
    id:         r.id,
    logDate:    r.log_date,
    createdAt:  r.created_at,
    pageCount:  r.page_count ?? 0,
    colorCounts: {
      BLACK:  r.cnt_black  ?? 0,
      RED:    r.cnt_red    ?? 0,
      AMBER:  r.cnt_amber  ?? 0,
      GREEN:  r.cnt_green  ?? 0,
      GOLD:   r.cnt_gold   ?? 0,
      YELLOW: r.cnt_yellow ?? 0,
    },
  };
}

/** Snapshot the student's current pages under a given date (idempotent). */
const saveSnapshot = db.transaction(async (studentId: number, logDate: string, pages: PageRow[]) => {
  // Delete any existing log for this date (cascade removes its pages)
  await stmtDeleteLog.run(studentId, logDate);
  // Insert fresh log header
  const result = await stmtInsertLog.run(studentId, logDate);
  const logId = result.lastInsertRowid as number;
  // Insert each page. Sequential on purpose: they share one transaction, and
  // issuing them in parallel against it would interleave on a single
  // connection rather than go faster.
  for (const p of pages) {
    await stmtInsertPage.run(logId, p.page_number, p.status);
  }
  return logId;
});

// ── GET /log/preview — preview pages that would be logged for a date ────────
router.get('/log/preview', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const user = req.user!;
  if (user.role !== 'student') {
    res.status(403).json({ error: 'Students only' }); return;
  }

  const date = String(req.query.date ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    res.status(400).json({ error: 'date query param must be YYYY-MM-DD' }); return;
  }

  await sweepRetest(user.id);
  const pages = await stmtGetWeeklyPages.all(user.id, date, date) as PageRow[];

  const colorCounts = { BLACK: 0, RED: 0, AMBER: 0, GREEN: 0, GOLD: 0, YELLOW: 0 };
  for (const p of pages) colorCounts[p.status as keyof typeof colorCounts]++;

  res.json({ pageCount: pages.length, colorCounts });
});

// ── POST /log ───────────────────────────────────────────────────────────────
router.post('/log', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const user = req.user!;
  if (user.role !== 'student') {
    res.status(403).json({ error: 'Students only' }); return;
  }

  const parsed = z
    .object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD') })
    .safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message }); return;
  }

  const logDate = parsed.data.date;

  // Must be within the last 14 days (inclusive today)
  const target = new Date(logDate + 'T00:00:00');
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 14);
  cutoff.setHours(0, 0, 0, 0);

  if (target > todayEnd || target < cutoff) {
    res.status(400).json({ error: 'Date must be within the last 14 days' }); return;
  }

  // Read only pages the student changed in the 7-day window for this log date
  await sweepRetest(user.id);
  const pages = await stmtGetWeeklyPages.all(user.id, logDate, logDate) as PageRow[];

  // Save the snapshot (deletes old log for same date, inserts fresh)
  const logId = await saveSnapshot(user.id, logDate, pages);

  res.status(201).json({
    id: logId,
    logDate,
    pageCount: pages.length,
  });
});

// ── GET /logs — own list ────────────────────────────────────────────────────
router.get('/logs', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const rows = await db.prepare(`
    SELECT nl.id, nl.log_date, nl.created_at,
      COUNT(nlp.id)                                           AS page_count,
      SUM(CASE WHEN nlp.status='BLACK'  THEN 1 ELSE 0 END)  AS cnt_black,
      SUM(CASE WHEN nlp.status='RED'    THEN 1 ELSE 0 END)  AS cnt_red,
      SUM(CASE WHEN nlp.status='AMBER'  THEN 1 ELSE 0 END)  AS cnt_amber,
      SUM(CASE WHEN nlp.status='GREEN'  THEN 1 ELSE 0 END)  AS cnt_green,
      SUM(CASE WHEN nlp.status='GOLD'   THEN 1 ELSE 0 END)  AS cnt_gold,
      SUM(CASE WHEN nlp.status='YELLOW' THEN 1 ELSE 0 END)  AS cnt_yellow
    FROM nazirah_logs nl
    LEFT JOIN nazirah_log_pages nlp ON nlp.log_id = nl.id
    WHERE nl.student_id = ?
    GROUP BY nl.id
    ORDER BY nl.log_date DESC
  `).all(req.user!.id) as any[];

  res.json({ logs: rows.map(formatLogSummary) });
});

// ── GET /logs/:logId — own detail ───────────────────────────────────────────
router.get('/logs/:logId', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const logId = parseInt(req.params.logId, 10);
  const log = await stmtGetStudentLogById.get(logId, req.user!.id) as LogRow | undefined;
  if (!log) { res.status(404).json({ error: 'Log not found' }); return; }

  const pages = await stmtGetLogPages.all(logId) as PageRow[];
  res.json(formatLogDetail(log, pages));
});

// ── GET /logs/student/:studentId — ustadh: list ─────────────────────────────
router.get('/logs/student/:studentId', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const user = req.user!;
  if (user.role !== 'ustadh') { res.status(403).json({ error: 'Ustadh only' }); return; }
  const studentId = parseInt(req.params.studentId, 10);
  if (!await ustadhTeaches(user.id, studentId)) { res.status(403).json({ error: 'Not your student' }); return; }

  const rows = await db.prepare(`
    SELECT nl.id, nl.log_date, nl.created_at,
      COUNT(nlp.id)                                           AS page_count,
      SUM(CASE WHEN nlp.status='BLACK'  THEN 1 ELSE 0 END)  AS cnt_black,
      SUM(CASE WHEN nlp.status='RED'    THEN 1 ELSE 0 END)  AS cnt_red,
      SUM(CASE WHEN nlp.status='AMBER'  THEN 1 ELSE 0 END)  AS cnt_amber,
      SUM(CASE WHEN nlp.status='GREEN'  THEN 1 ELSE 0 END)  AS cnt_green,
      SUM(CASE WHEN nlp.status='GOLD'   THEN 1 ELSE 0 END)  AS cnt_gold,
      SUM(CASE WHEN nlp.status='YELLOW' THEN 1 ELSE 0 END)  AS cnt_yellow
    FROM nazirah_logs nl
    LEFT JOIN nazirah_log_pages nlp ON nlp.log_id = nl.id
    WHERE nl.student_id = ?
    GROUP BY nl.id
    ORDER BY nl.log_date DESC
  `).all(studentId) as any[];

  res.json({ logs: rows.map(formatLogSummary) });
});

// ── GET /logs/:logId/student/:studentId — ustadh: detail ───────────────────
router.get('/logs/:logId/student/:studentId', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const user = req.user!;
  if (user.role !== 'ustadh') { res.status(403).json({ error: 'Ustadh only' }); return; }
  const logId = parseInt(req.params.logId, 10);
  const studentId = parseInt(req.params.studentId, 10);
  if (!await ustadhTeaches(user.id, studentId)) { res.status(403).json({ error: 'Not your student' }); return; }

  const log = await db.prepare('SELECT * FROM nazirah_logs WHERE id = ? AND student_id = ?')
    .get(logId, studentId) as LogRow | undefined;
  if (!log) { res.status(404).json({ error: 'Log not found' }); return; }

  const pages = await stmtGetLogPages.all(logId) as PageRow[];
  res.json(formatLogDetail(log, pages));
});

export default router;
