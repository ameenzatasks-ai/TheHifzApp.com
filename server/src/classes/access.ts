import db from '../db';

/**
 * Whether this Ustadh may manage the class: the main Ustadh who owns it, or a
 * co-ustadh who joined with the Ustadh Code.
 */
export async function isAuthorizedUstadh(classId: number, ustadhId: number): Promise<boolean> {
  const owner = await db.prepare('SELECT id FROM classes WHERE id = ? AND ustadh_id = ?').get(classId, ustadhId);
  if (owner) return true;

  const coUstadh = await db.prepare('SELECT id FROM class_ustadhs WHERE class_id = ? AND ustadh_id = ?').get(classId, ustadhId);
  return !!coUstadh;
}
