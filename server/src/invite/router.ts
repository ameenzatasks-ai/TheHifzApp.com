import { Router, Response } from 'express';
import twilio from 'twilio';
import db from '../db';
import { authenticate as requireAuth, AuthRequest } from '../auth/middleware';
import { isAuthorizedUstadh } from '../classes/access';

const router = Router({ mergeParams: true }); // inherits :classId from parent mount

/**
 * Sends the invitation as a text message. When it cannot be sent, the reason is
 * returned, so the Ustadh sees what to fix rather than a vague "not configured".
 */
async function sendTextMessage(to: string, body: string): Promise<{ sent: boolean; error?: string }> {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER } = process.env;
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM_NUMBER) {
    return { sent: false, error: 'Text messages are not set up on the server yet.' };
  }

  try {
    const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
    await client.messages.create({ body, from: TWILIO_FROM_NUMBER, to });
    return { sent: true };
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'unknown error';
    console.warn('Twilio SMS failed:', reason);
    return { sent: false, error: `The text message could not be sent: ${reason}` };
  }
}

// POST /api/classes/:classId/invite
router.post('/', requireAuth, async (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const classId = Number((req.params as { classId: string }).classId);
  const { phone } = req.body as { phone?: string };

  // Spaces, dashes and brackets are fine to type, but a text message needs the
  // number in full international form: a plus sign, then the country code.
  const to = (phone ?? '').replace(/[\s\-().]/g, '');
  if (!/^\+\d{8,15}$/.test(to)) {
    return res.status(400).json({
      error: 'Enter the number with its country code, starting with +, for example +44 7700 900000.',
    });
  }

  // The main Ustadh and any co-ustadh of this class can invite students
  const cls = await db.prepare(
    'SELECT id, name, join_code FROM classes WHERE id = ?'
  ).get(classId) as { id: number; name: string; join_code: string } | undefined;

  if (!cls) return res.status(404).json({ error: 'Class not found' });
  if (!await isAuthorizedUstadh(classId, user.id)) {
    return res.status(403).json({ error: 'Only the ustadhs of this class can invite students' });
  }

  // Store invitation record (idempotent — ignore duplicates)
  await db.prepare(
    'INSERT OR IGNORE INTO class_invitations (class_id, phone, created_by) VALUES (?, ?, ?)'
  ).run(classId, to, user.id);

  // Build invite message
  const appUrl = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
  const message =
    `As-salamu alaykum! You have been invited to join "${cls.name}" on The Hifz App — a Quran memorisation tracker.\n\n` +
    `1. Install the app: ${appUrl}\n` +
    `2. Create an account with Google\n` +
    `3. Tap the + button on the Classes screen and enter this code: ${cls.join_code}\n\n` +
    `Barakallahu feekum.`;

  const sms = await sendTextMessage(to, message);
  return res.json({ message, smsSent: sms.sent, smsError: sms.error ?? null });
});

export default router;
