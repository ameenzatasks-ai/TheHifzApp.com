import { Router, Response } from 'express';
import { z } from 'zod';
import { customAlphabet } from 'nanoid';
import db from '../db';
import { authenticate, requireRole, AuthRequest } from '../auth/middleware';
import { sweepRetest } from '../hifz/retest';

const nanoid = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 6);

/**
 * A join code no existing class already holds.
 *
 * The await in the loop condition is load-bearing. Without it the condition is
 * a Promise, a Promise is always truthy, and the loop never ends — it spun for
 * ten minutes generating codes until the heap reached 4 GB and Node aborted.
 * A truthiness test on an un-awaited call is silent in a way the compiler
 * cannot see.
 *
 * The guard bounds it regardless: 32^6 codes make a collision vanishingly
 * unlikely, so needing more than a few attempts means something is wrong with
 * the query rather than with luck, and looping forever is never the answer.
 */
const MAX_JOIN_CODE_ATTEMPTS = 10;

async function generateJoinCode(): Promise<string> {
  for (let attempt = 0; attempt < MAX_JOIN_CODE_ATTEMPTS; attempt++) {
    const code = nanoid();
    const taken = await db.prepare('SELECT id FROM classes WHERE join_code = ?').get(code);
    if (!taken) return code;
  }
  throw new Error('Could not allocate an unused join code');
}

async function generateUstadhCode(): Promise<string> {
  for (let attempt = 0; attempt < MAX_JOIN_CODE_ATTEMPTS; attempt++) {
    const code = 'USTADH-' + nanoid();
    const taken = await db.prepare('SELECT id FROM classes WHERE ustadh_code = ?').get(code);
    if (!taken) return code;
  }
  throw new Error('Could not allocate an unused ustadh code');
}

/** Check if user is authorized ustadh for the class (owner or co-ustadh) */
async function isAuthorizedUstadh(classId: number, ustadhId: number): Promise<boolean> {
  const owner = await db.prepare('SELECT id FROM classes WHERE id = ? AND ustadh_id = ?').get(classId, ustadhId);
  if (owner) return true;

  const coUstadh = await db.prepare('SELECT id FROM class_ustadhs WHERE class_id = ? AND ustadh_id = ?').get(classId, ustadhId);
  return !!coUstadh;
}

const router = Router();

// POST /api/classes — Ustadh creates a class
router.post('/', authenticate, requireRole('ustadh'), async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = z.object({ name: z.string().min(1).max(200) }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message });
    return;
  }
  const joinCode = await generateJoinCode();
  const ustadhCode = await generateUstadhCode();
  const result = await db
    .prepare('INSERT INTO classes (name, ustadh_id, join_code, ustadh_code) VALUES (?, ?, ?, ?)')
    .run(parsed.data.name, req.user!.id, joinCode, ustadhCode);
  const cls = await db.prepare('SELECT * FROM classes WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(cls);
});

// GET /api/classes — list my classes
// Ustadh sees: classes they own + classes they've enrolled in (as learner).
// Student sees: classes they're enrolled in.
router.get('/', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const user = req.user!;
  if (user.role === 'ustadh') {
    // Own classes (is_owner = 1)
    const owned = await db.prepare(`
      SELECT c.id, c.name, c.ustadh_id, c.join_code, c.created_at,
             COUNT(e.id) AS student_count,
             NULL         AS ustadh_name,
             NULL         AS joined_at,
             1            AS is_owner
      FROM classes c
      LEFT JOIN enrolments e ON e.class_id = c.id
      WHERE c.ustadh_id = ?
      GROUP BY c.id
    `).all(user.id);

    // Enrolled classes (is_owner = 0) — Ustadh joined as a learner
    const enrolled = await db.prepare(`
      SELECT c.id, c.name, c.ustadh_id, c.join_code, c.created_at,
             0            AS student_count,
             u.name       AS ustadh_name,
             en.joined_at AS joined_at,
             0            AS is_owner
      FROM enrolments en
      JOIN classes c ON c.id = en.class_id
      JOIN users   u ON u.id = c.ustadh_id
      WHERE en.student_id = ?
        AND c.ustadh_id != ?
    `).all(user.id, user.id);

    // Merge and sort by created_at DESC
    const all = [...owned, ...enrolled].sort((a: any, b: any) =>
      b.created_at.localeCompare(a.created_at)
    );
    res.json(all);
  } else {
    const classes = await db.prepare(`
      SELECT c.*, u.name as ustadh_name, u.avatar_url as ustadh_avatar, e.joined_at
      FROM enrolments e
      JOIN classes c ON c.id = e.class_id
      JOIN users u ON u.id = c.ustadh_id
      WHERE e.student_id = ?
      ORDER BY e.joined_at DESC
    `).all(user.id);
    res.json(classes);
  }
});

// GET /api/classes/:id — class details.
// Access is granted by relationship, not by role: the owning Ustadh, or anyone
// (student OR ustadh) enrolled in the class. An Ustadh who joins someone else's
// class is a learner there, so ownership alone must not gate access.
router.get('/:id', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const classId = parseInt(req.params.id, 10);
  const user = req.user!;

  const cls = await db.prepare(`
    SELECT c.*, u.name as ustadh_name, u.avatar_url as ustadh_avatar
    FROM classes c
    JOIN users u ON u.id = c.ustadh_id
    WHERE c.id = ?
  `).get(classId) as any;
  if (!cls) { res.status(404).json({ error: 'Class not found' }); return; }

  const isOwner = cls.ustadh_id === user.id;
  // Must be awaited: !!promise is always true, which would grant every
  // authenticated user access to every class.
  const isEnrolled = !!await db
    .prepare('SELECT id FROM enrolments WHERE class_id = ? AND student_id = ?')
    .get(classId, user.id);

  if (!isOwner && !isEnrolled) { res.status(404).json({ error: 'Class not found' }); return; }

  res.json({ ...cls, is_owner: isOwner });
});

// PATCH /api/classes/:id — Ustadh renames their class
router.patch('/:id', authenticate, requireRole('ustadh'), async (req: AuthRequest, res: Response): Promise<void> => {
  const classId = parseInt(req.params.id, 10);
  const parsed = z.object({ name: z.string().min(1).max(200) }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message });
    return;
  }

  const cls = await db.prepare('SELECT id FROM classes WHERE id = ? AND ustadh_id = ?').get(classId, req.user!.id);
  if (!cls) { res.status(404).json({ error: 'Class not found' }); return; }

  await db.prepare('UPDATE classes SET name = ? WHERE id = ?').run(parsed.data.name, classId);
  const updated = await db.prepare('SELECT * FROM classes WHERE id = ?').get(classId);
  res.json(updated);
});

// DELETE /api/classes/:id — Ustadh deletes their class entirely.
// Cascades: removes dependent enrolments and invitations first so FK constraints
// don't block the parent delete. Student weekly_snapshots / page_reads are
// student-owned and stay intact (a student may belong to other classes).
router.delete('/:id', authenticate, requireRole('ustadh'), async (req: AuthRequest, res: Response): Promise<void> => {
  const classId = parseInt(req.params.id, 10);
  const cls = await db.prepare('SELECT id FROM classes WHERE id = ? AND ustadh_id = ?').get(classId, req.user!.id);
  if (!cls) { res.status(404).json({ error: 'Class not found' }); return; }

  // Ordered deletes inside one transaction: children first so the foreign keys
  // on the parent row are satisfied. Each must be awaited — un-awaited, they
  // would fire in an undefined order and the parent delete could run first.
  const tx = db.transaction(async (id: number) => {
    await db.prepare('DELETE FROM hifz_task_scores  WHERE class_id = ?').run(id);
    await db.prepare('DELETE FROM hifz_dawr_log     WHERE class_id = ?').run(id);
    await db.prepare('DELETE FROM hifz_daily_tasks  WHERE class_id = ?').run(id);
    await db.prepare('DELETE FROM class_invitations WHERE class_id = ?').run(id);
    await db.prepare('DELETE FROM enrolments        WHERE class_id = ?').run(id);
    await db.prepare('DELETE FROM classes           WHERE id = ?').run(id);
  });
  await tx(classId);

  res.json({ message: 'Class deleted' });
});

// POST /api/classes/join — Any authenticated user joins a class by code
router.post('/join', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = z.object({ joinCode: z.string().min(1) }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'joinCode required' }); return; }

  const code = parsed.data.joinCode.toUpperCase();
  const cls = await db.prepare('SELECT * FROM classes WHERE join_code = ?').get(code) as any;
  if (!cls) { res.status(404).json({ error: 'Class not found. Check the join code.' }); return; }

  const existing = await db
    .prepare('SELECT id FROM enrolments WHERE class_id = ? AND student_id = ?')
    .get(cls.id, req.user!.id);
  if (existing) { res.status(409).json({ error: 'Already enrolled in this class' }); return; }

  await db.prepare('INSERT INTO enrolments (class_id, student_id) VALUES (?, ?)').run(cls.id, req.user!.id);
  const ustadh = await db.prepare('SELECT name, avatar_url FROM users WHERE id = ?').get(cls.ustadh_id) as any;
  res.status(201).json({ ...cls, ustadh_name: ustadh?.name, ustadh_avatar: ustadh?.avatar_url });
});

// DELETE /api/classes/:id/leave — Student leaves a class
router.delete('/:id/leave', authenticate, requireRole('student'), async (req: AuthRequest, res: Response): Promise<void> => {
  const classId = parseInt(req.params.id, 10);
  const result = await db
    .prepare('DELETE FROM enrolments WHERE class_id = ? AND student_id = ?')
    .run(classId, req.user!.id);
  if (result.changes === 0) { res.status(404).json({ error: 'Enrolment not found' }); return; }
  res.json({ message: 'Left class successfully' });
});

// GET /api/classes/:id/students — student list with latest snapshot (Ustadh only)
router.get('/:id/students', authenticate, requireRole('ustadh'), async (req: AuthRequest, res: Response): Promise<void> => {
  const classId = parseInt(req.params.id, 10);
  const authorized = await isAuthorizedUstadh(classId, req.user!.id);
  if (!authorized) { res.status(404).json({ error: 'Class not found' }); return; }

  const students = await db
    .prepare(`
      SELECT u.id, u.name, u.email, u.avatar_url, e.joined_at
      FROM enrolments e
      JOIN users u ON u.id = e.student_id
      WHERE e.class_id = ?
      ORDER BY u.name ASC
    `)
    .all(classId) as Array<{ id: number; name: string; email: string; avatar_url: string | null; joined_at: string }>;

  // Each student used to carry a `latest_snapshot` read from weekly_snapshots.
  // That table is dropped by the migrations, so the query could only ever fail
  // — this endpoint had been answering "Internal server error" ever since, and
  // no caller read the field. Removed rather than resurrected.
  res.json(students);
});

// GET /api/classes/:id/students/:studentId/pages
router.get('/:id/students/:studentId/pages', authenticate, requireRole('ustadh'), async (req: AuthRequest, res: Response): Promise<void> => {
  const classId = parseInt(req.params.id, 10);
  const studentId = parseInt(req.params.studentId, 10);

  const authorized = await isAuthorizedUstadh(classId, req.user!.id);
  if (!authorized) { res.status(404).json({ error: 'Class not found' }); return; }

  const enrolment = await db.prepare('SELECT id FROM enrolments WHERE class_id = ? AND student_id = ?').get(classId, studentId);
  if (!enrolment) { res.status(404).json({ error: 'Student not enrolled' }); return; }

  const student = await db.prepare('SELECT id, name, email, avatar_url FROM users WHERE id = ?').get(studentId) as any;
  const rows = await db
    .prepare('SELECT page_number, last_read_at FROM page_reads WHERE student_id = ? AND read_count >= 1 ORDER BY page_number ASC')
    .all(studentId) as Array<{ page_number: number; last_read_at: string }>;

  res.json({
    student,
    listenedPages: rows.map(r => ({ pageNumber: r.page_number, listenedAt: r.last_read_at })),
    total: rows.length,
  });
});

/** Build a 7-color count of pages for one student (out of 604 total). */
async function buildStudentCounts(studentId: number) {
  await sweepRetest(studentId);
  const rows = await db.prepare(`
    SELECT status, COUNT(*) AS c
    FROM student_page_status
    WHERE student_id = ? AND variant = 'NEW_MADANI'
    GROUP BY status
  `).all(studentId) as Array<{ status: string; c: number }>;
  const counts: Record<string, number> = {
    BLACK: 0, RED: 0, AMBER: 0, YELLOW: 0, GREEN: 0, GOLD: 0, UNTOUCHED: 0,
  };
  for (const r of rows) counts[r.status] = r.c;
  const tracked = rows.reduce((sum, r) => sum + r.c, 0);
  counts.UNTOUCHED = 604 - tracked;
  return counts;
}

// GET /api/classes/:id/students/:studentId/summary — Ustadh dashboard tile
router.get('/:id/students/:studentId/summary', authenticate, requireRole('ustadh'), async (req: AuthRequest, res: Response): Promise<void> => {
  const classId = parseInt(req.params.id, 10);
  const studentId = parseInt(req.params.studentId, 10);

  const authorized = await isAuthorizedUstadh(classId, req.user!.id);
  if (!authorized) { res.status(404).json({ error: 'Class not found' }); return; }

  const enrolment = await db.prepare('SELECT id FROM enrolments WHERE class_id = ? AND student_id = ?').get(classId, studentId);
  if (!enrolment) { res.status(404).json({ error: 'Student not enrolled' }); return; }

  const student = await db.prepare('SELECT id, name, email, avatar_url FROM users WHERE id = ?').get(studentId);
  res.json({ student, counts: await buildStudentCounts(studentId) });
});

// GET /api/classes/:id/students-with-summary — Ustadh roster + counts per student
router.get('/:id/students-with-summary', authenticate, requireRole('ustadh'), async (req: AuthRequest, res: Response): Promise<void> => {
  const classId = parseInt(req.params.id, 10);
  const authorized = await isAuthorizedUstadh(classId, req.user!.id);
  if (!authorized) { res.status(404).json({ error: 'Class not found' }); return; }

  const students = await db.prepare(`
    SELECT u.id, u.name, u.email, u.avatar_url, e.joined_at
    FROM enrolments e
    JOIN users u ON u.id = e.student_id
    WHERE e.class_id = ?
    ORDER BY u.name ASC
  `).all(classId) as Array<{ id: number; name: string; email: string; avatar_url: string | null; joined_at: string }>;

  // Counted in parallel: one round trip per student in sequence would be slow
  // against a remote database once a class has any size to it.
  res.json(await Promise.all(
    students.map(async s => ({ ...s, counts: await buildStudentCounts(s.id) })),
  ));
});

// POST /api/classes/join-ustadh — Ustadh joins a class as co-teacher using ustadh code
router.post('/join-ustadh', authenticate, requireRole('ustadh'), async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = z.object({ ustadhCode: z.string().min(1) }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'ustadhCode required' }); return; }

  const code = parsed.data.ustadhCode.toUpperCase();
  const cls = await db.prepare('SELECT * FROM classes WHERE ustadh_code = ?').get(code) as any;
  if (!cls) { res.status(404).json({ error: 'Invalid ustadh code' }); return; }

  // Prevent joining own class twice
  if (cls.ustadh_id === req.user!.id) {
    res.status(409).json({ error: 'Cannot join your own class as co-ustadh' });
    return;
  }

  const existing = await db
    .prepare('SELECT id FROM class_ustadhs WHERE class_id = ? AND ustadh_id = ?')
    .get(cls.id, req.user!.id);
  if (existing) { res.status(409).json({ error: 'Already a co-ustadh in this class' }); return; }

  await db
    .prepare('INSERT INTO class_ustadhs (class_id, ustadh_id, added_by) VALUES (?, ?, ?)')
    .run(cls.id, req.user!.id, cls.ustadh_id);

  const ustadh = await db.prepare('SELECT name, avatar_url FROM users WHERE id = ?').get(cls.ustadh_id) as any;
  res.status(201).json({ ...cls, ustadh_name: ustadh?.name, ustadh_avatar: ustadh?.avatar_url });
});

// GET /api/classes/:id/co-ustadhs — List co-ustadhs for a class
router.get('/:id/co-ustadhs', authenticate, requireRole('ustadh'), async (req: AuthRequest, res: Response): Promise<void> => {
  const classId = parseInt(req.params.id, 10);
  const authorized = await isAuthorizedUstadh(classId, req.user!.id);
  if (!authorized) { res.status(404).json({ error: 'Class not found' }); return; }

  const coUstadhs = await db.prepare(`
    SELECT cu.id, u.id as ustadh_id, u.name, u.email, u.avatar_url, cu.added_at,
           added_by_user.name as added_by_name
    FROM class_ustadhs cu
    JOIN users u ON u.id = cu.ustadh_id
    LEFT JOIN users added_by_user ON added_by_user.id = cu.added_by
    WHERE cu.class_id = ?
    ORDER BY cu.added_at DESC
  `).all(classId);

  res.json(coUstadhs);
});

// DELETE /api/classes/:id/co-ustadhs/:ustadhId — Revoke co-ustadh access
router.delete('/:id/co-ustadhs/:ustadhId', authenticate, requireRole('ustadh'), async (req: AuthRequest, res: Response): Promise<void> => {
  const classId = parseInt(req.params.id, 10);
  const ustadhId = parseInt(req.params.ustadhId, 10);

  // Only owner can revoke access
  const cls = await db.prepare('SELECT id FROM classes WHERE id = ? AND ustadh_id = ?').get(classId, req.user!.id);
  if (!cls) { res.status(404).json({ error: 'Class not found' }); return; }

  const result = await db
    .prepare('DELETE FROM class_ustadhs WHERE class_id = ? AND ustadh_id = ?')
    .run(classId, ustadhId);

  if (result.changes === 0) {
    res.status(404).json({ error: 'Co-ustadh not found' });
    return;
  }

  res.json({ message: 'Co-ustadh access revoked' });
});

export default router;
