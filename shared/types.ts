/**
 * Cross-cutting types shared between client and server.
 * Hifz quarter-status types live in ./juz-map.ts so they can be imported
 * independently (palette tokens, audit timeline, etc.).
 */

import type { MemorisationOrder } from './juz-map';

export type Role = 'ustadh' | 'student';

export interface User {
  id: number;
  /** Set for Google accounts; null for username/password accounts. */
  google_id: string | null;
  name: string;
  /** Set for Google accounts; null for username/password accounts. */
  email: string | null;
  /** Set for username/password accounts; null for Google accounts. */
  username: string | null;
  avatar_url: string | null;
  role: Role | null;
  /**
   * Which direction this student works through the Mus'haf, chosen at sign-up.
   * Null for ustadhs, for students who skipped the question, and for anyone who
   * signed up before it was asked — all of whom read forward.
   */
  memorisation_order: MemorisationOrder | null;
  created_at: string;
}

export interface Class {
  id: number;
  name: string;
  ustadh_id: number;
  join_code: string;
  ustadh_code: string;
  created_at: string;
}

export interface ClassWithMeta extends Class {
  ustadh_name?: string;
  student_count?: number;
  joined_at?: string;
  /** Present for Ustadh listings: true = they own the class, false = enrolled as learner */
  is_owner?: boolean;
}

// Re-export the hifz domain types so consumers can pick a single import root.
export type { PageStatus, QuarterStatus, JuzInfo } from './juz-map';
export { JUZ_MAP, getJuz, juzForPage } from './juz-map';
