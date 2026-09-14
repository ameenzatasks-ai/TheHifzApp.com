/**
 * Hifz tracking router — page-level status, Juz grid, and audit timeline.
 *
 * ALL db.prepare() calls are at module level (compiled once at startup) so
 * they are never called inside a transaction, eliminating the internal-server-
 * error that occurred when better-sqlite3 prepared statements were created mid-
 * transaction.
 */

import { Router, Response } from 'express';
import { z } from 'zod';
import db from '../db';
import { authenticate, AuthRequest } from '../auth/middleware';
import { getJuz, memorisedPages, type PageStatus, type MemorisationOrder } from '../shared/juz-map';
import { sweepRetest } from './retest';

const router = Router();

const VALID_STATUSES = ['BLACK', 'RED', 'AMBER', 'YELLOW', 'GREEN', 'GOLD'] as const;
const statusSchema = z.enum(VALID_STATUSES);

// ── Module-level prepared statements ───────────────────────────────────────

const stmtTeaches = db.prepare(`
  SELECT 1 FROM enrolments e
  JOIN classes c ON c.id = e.class_id
  WHERE c.ustadh_id = ? AND e.student_id = ?
  LIMIT 1
`);

const stmtJuzPages = db.prepare(`
  SELECT page_number, status
  FROM student_page_status
  WHERE student_id = ? AND variant = 'NEW_MADANI'
    AND page_number BETWEEN ? AND ?
`);

const stmtGetPageStatus = db.prepare(`
  SELECT status FROM student_page_status
  WHERE student_id = ? AND variant = 'NEW_MADANI' AND page_number = ?
`);

const stmtUpsertPage = db.prepare(`
  INSERT INTO student_page_status
    (student_id, variant, page_number, status, set_by_user_id)
  VALUES (?, 'NEW_MADANI', ?, ?, ?)
  ON CONFLICT(student_id, variant, page_number)
  DO UPDATE SET status         = excluded.status,
                set_by_user_id = excluded.set_by_user_id,
                updated_at     = datetime('now')
`);

const stmtDeletePage = db.prepare(`
  DELETE FROM student_page_status
  WHERE student_id = ? AND variant = 'NEW_MADANI' AND page_number = ?
`);

const stmtInsertHistory = db.prepare(`
  INSERT INTO status_history
    (student_id, variant, page_number, from_status, to_status, changed_by, note)
  VALUES (?, 'NEW_MADANI', ?, ?, ?, ?, ?)
`);

const stmtAllPages = db.prepare(`
  SELECT page_number, status
  FROM student_page_status
  WHERE student_id = ? AND variant = 'NEW_MADANI'
  ORDER BY page_number ASC
`);

const stmtSummary = db.prepare(`
  SELECT status, COUNT(*) AS c
  FROM student_page_status
  WHERE student_id = ? AND variant = 'NEW_MADANI'
  GROUP BY status
`);

// ── Helpers ────────────────────────────────────────────────────────────────

async function ustadhTeaches(ustadhId: number, studentId: number): Promise<boolean> {
  // Check if ustadh owns a class with this student
  if (await stmtTeaches.get(ustadhId, studentId)) return true;

  // Check if ustadh is a co-ustadh in any class with this student
  return !!await db.prepare(`
    SELECT 1 FROM enrolments e
    JOIN class_ustadhs cu ON cu.class_id = e.class_id
    WHERE cu.ustadh_id = ? AND e.student_id = ?
    LIMIT 1
  `).get(ustadhId, studentId);
}

async function buildJuzGrid(studentId: number, juzNumber: number) {
  const juz = getJuz(juzNumber);
  if (!juz) return null;

  await sweepRetest(studentId);

  const rows = await stmtJuzPages.all(studentId, juz.startPage, juz.endPage) as
    Array<{ page_number: number; status: PageStatus }>;

  const byPage = new Map<number, PageStatus>();
  for (const r of rows) byPage.set(r.page_number, r.status);

  const pages = [];
  for (let p = juz.startPage; p <= juz.endPage; p++) {
    pages.push({ pageNumber: p, status: byPage.get(p) ?? null });
  }

  return { juz: juzNumber, startPage: juz.startPage, endPage: juz.endPage, startSurah: juz.startSurah, pages };
}

/** Transaction that atomically writes the page status + history row. */
const setPageTx = db.transaction(async (
  setterId: number,
  targetStudentId: number,
  pageNumber: number,
  newStatus: PageStatus | null,
  fromStatus: PageStatus | null,
  note: string | null,
) => {
  if (newStatus === null) {
    await stmtDeletePage.run(targetStudentId, pageNumber);
  } else {
    await stmtUpsertPage.run(targetStudentId, pageNumber, newStatus, setterId);
  }
  await stmtInsertHistory.run(targetStudentId, pageNumber, fromStatus, newStatus, setterId, note);
});

async function setPageStatus(
  setterId: number,
  targetStudentId: number,
  pageNumber: number,
  newStatus: PageStatus | null,
  note?: string,
) {
  const existing = await stmtGetPageStatus.get(targetStudentId, pageNumber) as
    { status: PageStatus } | undefined;
  const fromStatus = existing?.status ?? null;

  if (fromStatus === newStatus) return { unchanged: true, status: newStatus };

  await setPageTx(setterId, targetStudentId, pageNumber, newStatus, fromStatus, note ?? null);

  return { unchanged: false, status: newStatus, fromStatus };
}

async function buildSummary(studentId: number) {
  await sweepRetest(studentId);
  const counts = await stmtSummary.all(studentId) as Array<{ status: PageStatus; c: number }>;
  const out: Record<PageStatus, number> & { UNTOUCHED: number } = {
    BLACK: 0, RED: 0, AMBER: 0, YELLOW: 0, GREEN: 0, GOLD: 0, UNTOUCHED: 0,
  };
  for (const row of counts) out[row.status] = row.c;
  out.UNTOUCHED = 604 - counts.reduce((s, r) => s + r.c, 0);
  return out;
}

// ── Routes ─────────────────────────────────────────────────────────────────

router.get('/juz/:juz', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const juzNum = parseInt(req.params.juz, 10);
  if (isNaN(juzNum) || juzNum < 1 || juzNum > 30) {
    res.status(400).json({ error: 'Juz must be 1..30' }); return;
  }
  const grid = await buildJuzGrid(req.user!.id, juzNum);
  if (!grid) { res.status(404).json({ error: 'Juz not found' }); return; }
  res.json(grid);
});

router.get('/juz/:juz/student/:studentId', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const user = req.user!;
  if (user.role !== 'ustadh') { res.status(403).json({ error: 'Ustadh only' }); return; }
  const juzNum = parseInt(req.params.juz, 10);
  const studentId = parseInt(req.params.studentId, 10);
  if (isNaN(juzNum) || juzNum < 1 || juzNum > 30) { res.status(400).json({ error: 'Juz must be 1..30' }); return; }
  if (!await ustadhTeaches(user.id, studentId)) { res.status(403).json({ error: 'Not your student' }); return; }
  const grid = await buildJuzGrid(studentId, juzNum);
  if (!grid) { res.status(404).json({ error: 'Juz not found' }); return; }
  res.json(grid);
});

router.put('/page/:page', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const page = parseInt(req.params.page, 10);
  if (isNaN(page) || page < 1 || page > 604) { res.status(400).json({ error: 'page must be 1..604' }); return; }
  if (req.user!.role !== 'student') {
    res.status(403).json({ error: 'Students only — ustadh must specify a studentId' }); return;
  }
  const parsed = z.object({ status: statusSchema, note: z.string().optional() }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.errors[0].message }); return; }
  res.json(await setPageStatus(req.user!.id, req.user!.id, page, parsed.data.status, parsed.data.note));
});

router.put('/page/:page/student/:studentId', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const user = req.user!;
  if (user.role !== 'ustadh') { res.status(403).json({ error: 'Ustadh only' }); return; }
  const page = parseInt(req.params.page, 10);
  const studentId = parseInt(req.params.studentId, 10);
  if (isNaN(page) || page < 1 || page > 604) { res.status(400).json({ error: 'page must be 1..604' }); return; }
  if (!await ustadhTeaches(user.id, studentId)) { res.status(403).json({ error: 'Not your student' }); return; }
  const parsed = z.object({ status: statusSchema, note: z.string().optional() }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.errors[0].message }); return; }
  res.json(await setPageStatus(user.id, studentId, page, parsed.data.status, parsed.data.note));
});

router.delete('/page/:page', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const page = parseInt(req.params.page, 10);
  if (isNaN(page) || page < 1 || page > 604) { res.status(400).json({ error: 'page must be 1..604' }); return; }
  if (req.user!.role !== 'student') {
    res.status(403).json({ error: 'Students only — ustadh must specify a studentId' }); return;
  }
  res.json(await setPageStatus(req.user!.id, req.user!.id, page, null));
});

router.delete('/page/:page/student/:studentId', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const user = req.user!;
  if (user.role !== 'ustadh') { res.status(403).json({ error: 'Ustadh only' }); return; }
  const page = parseInt(req.params.page, 10);
  const studentId = parseInt(req.params.studentId, 10);
  if (isNaN(page) || page < 1 || page > 604) { res.status(400).json({ error: 'page must be 1..604' }); return; }
  if (!await ustadhTeaches(user.id, studentId)) { res.status(403).json({ error: 'Not your student' }); return; }
  res.json(await setPageStatus(user.id, studentId, page, null));
});

// ── First-time memorisation backfill ───────────────────────────────────────
//
// A student joining the app has usually memorised a good deal already. Rather
// than make them tap hundreds of pages, onboarding asks which page they are on
// and in what order they memorise, and everything before that point is marked
// Memorized in one go.

const stmtCountPages = db.prepare(`
  SELECT COUNT(*) AS c FROM student_page_status
  WHERE student_id = ? AND variant = 'NEW_MADANI'
`);

const BACKFILL_NOTE = 'Set during sign-up from current page and memorisation order';

const backfillTx = db.transaction(async (studentId: number, pages: number[]) => {
  // Sequential on purpose: these share one transaction, so issuing them in
  // parallel would interleave on a single connection rather than go faster.
  for (const page of pages) {
    await stmtUpsertPage.run(studentId, page, 'GOLD', studentId);
    await stmtInsertHistory.run(studentId, page, null, 'GOLD', studentId, BACKFILL_NOTE);
  }
});

router.post('/backfill', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  if (req.user!.role !== 'student') {
    res.status(403).json({ error: 'Students only' }); return;
  }

  const parsed = z.object({
    currentPage: z.number().int().min(1).max(604),
    order: z.enum(['FORWARD', 'BACKWARD', 'LAST_JUZ_FIRST']),
  }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message }); return;
  }

  // Recorded before the skip check below, and separately from the backfill
  // itself: the order decides how the Nazirah tracker is laid out, which stays
  // true whether or not any pages were marked. A student already tracking
  // pages still wants the tracker facing the right way.
  await db.prepare('UPDATE users SET memorisation_order = ? WHERE id = ?')
    .run(parsed.data.order, req.user!.id);

  // Only ever runs on a blank slate. Guarding on this means a repeat call
  // cannot overwrite real progress the student has since recorded.
  const { c } = await stmtCountPages.get(req.user!.id) as { c: number };
  if (c > 0) {
    res.json({ marked: 0, skipped: true, reason: 'Pages already tracked' }); return;
  }

  const pages = memorisedPages(parsed.data.currentPage, parsed.data.order as MemorisationOrder);
  await backfillTx(req.user!.id, pages);
  res.json({ marked: pages.length, skipped: false });
});

// ── Audit log ──────────────────────────────────────────────────────────────

async function fetchAudit(studentId: number, limit: number, beforeId?: number) {
  const rows = await db.prepare(`
    SELECT id, page_number, from_status, to_status, changed_at, changed_by, note
    FROM status_history
    WHERE student_id = ?
      ${beforeId ? 'AND id < ?' : ''}
    ORDER BY id DESC
    LIMIT ?
  `).all(...(beforeId ? [studentId, beforeId, limit] : [studentId, limit])) as Array<{
    id: number; page_number: number; from_status: PageStatus | null;
    to_status: PageStatus | null; changed_at: string; changed_by: number; note: string | null;
  }>;

  const userIds = Array.from(new Set(rows.map(r => r.changed_by)));
  const users = userIds.length
    ? await db.prepare(`SELECT id, name, role FROM users WHERE id IN (${userIds.map(() => '?').join(',')})`).all(...userIds) as Array<{ id: number; name: string; role: string }>
    : [];
  const userMap = new Map(users.map(u => [u.id, u]));

  return rows.map(r => ({
    id: r.id, pageNumber: r.page_number,
    fromStatus: r.from_status, toStatus: r.to_status,
    changedAt: r.changed_at,
    changedByName: userMap.get(r.changed_by)?.name ?? '?',
    changedByRole: userMap.get(r.changed_by)?.role ?? null,
    note: r.note,
  }));
}

router.get('/audit', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const limit = Math.min(parseInt((req.query.limit as string) || '50', 10), 200);
  const before = req.query.before ? parseInt(req.query.before as string, 10) : undefined;
  res.json({ entries: await fetchAudit(req.user!.id, limit, before) });
});

router.get('/audit/student/:studentId', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const user = req.user!;
  if (user.role !== 'ustadh') { res.status(403).json({ error: 'Ustadh only' }); return; }
  const studentId = parseInt(req.params.studentId, 10);
  if (!await ustadhTeaches(user.id, studentId)) { res.status(403).json({ error: 'Not your student' }); return; }
  const limit = Math.min(parseInt((req.query.limit as string) || '50', 10), 200);
  const before = req.query.before ? parseInt(req.query.before as string, 10) : undefined;
  res.json({ entries: await fetchAudit(studentId, limit, before) });
});

// ── All pages (flat, for grouped colour views) ─────────────────────────────

/**
 * The tracker is laid out in the direction the student memorises, so the order
 * travels with the pages rather than being read from whoever is logged in.
 * That way an ustadh opening a student's tracker sees it facing the same way
 * the student does, instead of in their own direction.
 */
const stmtOrderFor = db.prepare('SELECT memorisation_order FROM users WHERE id = ?');

async function memorisationOrderFor(studentId: number): Promise<string> {
  const row = await stmtOrderFor.get(studentId) as { memorisation_order: string | null } | undefined;
  return row?.memorisation_order ?? 'FORWARD';
}

router.get('/pages', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  await sweepRetest(req.user!.id);
  const rows = await stmtAllPages.all(req.user!.id) as Array<{ page_number: number; status: PageStatus }>;
  res.json({
    pages: rows.map(r => ({ pageNumber: r.page_number, status: r.status })),
    memorisationOrder: await memorisationOrderFor(req.user!.id),
  });
});

router.get('/pages/student/:studentId', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const user = req.user!;
  if (user.role !== 'ustadh') { res.status(403).json({ error: 'Ustadh only' }); return; }
  const studentId = parseInt(req.params.studentId, 10);
  if (!await ustadhTeaches(user.id, studentId)) { res.status(403).json({ error: 'Not your student' }); return; }
  await sweepRetest(studentId);
  const rows = await stmtAllPages.all(studentId) as Array<{ page_number: number; status: PageStatus }>;
  res.json({
    pages: rows.map(r => ({ pageNumber: r.page_number, status: r.status })),
    memorisationOrder: await memorisationOrderFor(studentId),
  });
});

// ── Summary ────────────────────────────────────────────────────────────────

router.get('/summary', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  res.json({ studentId: req.user!.id, counts: await buildSummary(req.user!.id) });
});

router.get('/summary/student/:studentId', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const user = req.user!;
  if (user.role !== 'ustadh') { res.status(403).json({ error: 'Ustadh only' }); return; }
  const studentId = parseInt(req.params.studentId, 10);
  if (!await ustadhTeaches(user.id, studentId)) { res.status(403).json({ error: 'Not your student' }); return; }
  res.json({ studentId, counts: await buildSummary(studentId) });
});

export default router;
