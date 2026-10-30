import { Router, Response } from 'express';
import db from '../db';
import { authenticate as requireAuth, AuthRequest } from '../auth/middleware';
import { isAuthorizedUstadh } from '../classes/access';

const router = Router({ mergeParams: true }); // inherits :classId from parent mount

// POST /api/classes/:classId/invite
router.post('/', requireAuth, async (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const classId = Number((req.params as { classId: string }).classId);
  const { phone } = req.body as { phone?: string };

  if (!phone || !/^\+?[\d\s\-().]{7,20}$/.test(phone.trim())) {
    return res.status(400).json({ error: 'A valid phone number is required' });
  }

  // The main Ustadh and any co-ustadh of this class can invite students
  const cls = await db.prepare(
    'SELECT id, name, join_code FROM classes WHERE id = ?'
  ).get(classId) as { id: number; name: string; join_code: string } | undefined;

  if (!cls) return res.status(404).json({ error: 'Class not found' });
  if (!await isAuthorizedUstadh(classId, user.id)) {
    return res.status(403).json({ error: 'Only the ustadhs of this class can invite students' });
  }

  const normalised = phone.trim();

  // Store invitation record (idempotent — ignore duplicates)
  await db.prepare(
    'INSERT OR IGNORE INTO class_invitations (class_id, phone, created_by) VALUES (?, ?, ?)'
  ).run(classId, normalised, user.id);

  // Build invite message
  const appUrl = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
  const message =
    `As-salamu alaykum! You have been invited to join "${cls.name}" on The Nazirah App — a Quran reading tracker.\n\n` +
    `1. Install the app: ${appUrl}\n` +
    `2. Create an account with Google\n` +
    `3. Tap the + button on the Classes screen and enter this code: ${cls.join_code}\n\n` +
    `Barakallahu feekum.`;

  // Attempt SMS via Twilio if configured
  let smsSent = false;
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER } = process.env;
  if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_FROM_NUMBER) {
    try {
      // Dynamic require so the server starts fine without the twilio package installed
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const twilio = require('twilio');
      const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
      client.messages
        .create({ body: message, from: TWILIO_FROM_NUMBER, to: normalised })
        .catch((err: Error) => console.warn('Twilio SMS failed:', err.message));
      smsSent = true;
    } catch {
      console.warn('Twilio not installed — SMS skipped');
    }
  }

  return res.json({ message, smsSent });
});

export default router;
