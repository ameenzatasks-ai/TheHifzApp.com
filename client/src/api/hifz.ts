import { api } from './client';
import type { PageStatus, MemorisationOrder } from '../../../shared/juz-map';

export interface JuzGridPage {
  pageNumber: number;
  status: PageStatus | null;  // null = untouched
}

export interface JuzGridData {
  juz: number;
  startPage: number;
  endPage: number;
  startSurah: number;
  pages: JuzGridPage[];
}

export interface StatusPage {
  pageNumber: number;
  status: PageStatus;
}

export interface AllPagesResponse {
  pages: StatusPage[];
  /**
   * The direction this student memorises in, so the tracker can be laid out to
   * match. It travels with the pages rather than coming from the logged-in
   * user, so an ustadh viewing a student sees the student's direction.
   */
  memorisationOrder: MemorisationOrder;
}

export interface AuditEntry {
  id: number;
  pageNumber: number;
  fromStatus: PageStatus | null;
  toStatus: PageStatus | null;  // null = untouched
  changedAt: string;
  changedByName: string;
  changedByRole: string | null;
  note: string | null;
}

export interface PracticeState {
  pageNumber: number;
  /** Practices needed before the page is Ready for Final Test. */
  target: number;
  /** Practices counted since the page was last reset. */
  count: number;
  /** When each counted practice was logged, oldest first (ISO 8601, UTC). */
  entries: string[];
}

export interface StudentPracticePage {
  pageNumber: number;
  count: number;
  entries: string[];
}

export interface StudentPracticeList {
  target: number;
  pages: StudentPracticePage[];
}

export interface HifzCounts {
  studentId: number;
  counts: Record<PageStatus | 'UNTOUCHED', number>;
}

export const hifzApi = {
  /** Own Juz grid. */
  getJuz: (juz: number) => api.get<JuzGridData>(`/hifz/juz/${juz}`),
  /** Ustadh viewing a student's Juz grid. */
  getStudentJuz: (juz: number, studentId: number) =>
    api.get<JuzGridData>(`/hifz/juz/${juz}/student/${studentId}`),

  /** Self update of a page. */
  setPage: (page: number, status: PageStatus) =>
    api.put<{ unchanged: boolean; status: PageStatus | null; fromStatus?: PageStatus | null }>(
      `/hifz/page/${page}`,
      { status }
    ),
  /** Self untouch (remove status). */
  untouchPage: (page: number) =>
    api.delete<{ unchanged: boolean; status: null; fromStatus?: PageStatus | null }>(`/hifz/page/${page}`),

  /** Ustadh override. */
  setStudentPage: (page: number, studentId: number, status: PageStatus) =>
    api.put<{ unchanged: boolean; status: PageStatus | null; fromStatus?: PageStatus | null }>(
      `/hifz/page/${page}/student/${studentId}`,
      { status }
    ),
  untouchStudentPage: (page: number, studentId: number) =>
    api.delete<{ unchanged: boolean; status: null; fromStatus?: PageStatus | null }>(
      `/hifz/page/${page}/student/${studentId}`
    ),

  /** Audit log. */
  audit: (limit = 50, before?: number) =>
    api.get<{ entries: AuditEntry[] }>(
      `/hifz/audit?limit=${limit}${before ? `&before=${before}` : ''}`
    ),
  studentAudit: (studentId: number, limit = 50, before?: number) =>
    api.get<{ entries: AuditEntry[] }>(
      `/hifz/audit/student/${studentId}?limit=${limit}${before ? `&before=${before}` : ''}`
    ),

  summary: () => api.get<HifzCounts>('/hifz/summary'),
  studentSummary: (studentId: number) => api.get<HifzCounts>(`/hifz/summary/student/${studentId}`),

  /**
   * Sign-up only: mark everything already memorised as Memorized, worked out
   * from the page the student is on and the order they memorise in.
   */
  backfill: (currentPage: number, order: MemorisationOrder) =>
    api.post<{ marked: number; skipped: boolean }>('/hifz/backfill', { currentPage, order }),

  /** Practice count for one of your own pages. */
  practice: (page: number) => api.get<PracticeState>(`/hifz/practice/${page}`),
  practiceTally: (page: number) => api.post<PracticeState>(`/hifz/practice/${page}/tally`),
  practiceReset: (page: number) => api.post<PracticeState>(`/hifz/practice/${page}/reset`),

  /** Ustadh: practice count for one of a student's pages. */
  studentPractice: (studentId: number, page: number) =>
    api.get<PracticeState>(`/hifz/practice/${page}/student/${studentId}`),
  studentPracticeTally: (studentId: number, page: number) =>
    api.post<PracticeState>(`/hifz/practice/${page}/student/${studentId}/tally`),
  studentPracticeReset: (studentId: number, page: number) =>
    api.post<PracticeState>(`/hifz/practice/${page}/student/${studentId}/reset`),
  /** Ustadh: every page a student is practising, with the time of each practice. */
  studentPracticeList: (studentId: number) =>
    api.get<StudentPracticeList>(`/hifz/practice/student/${studentId}`),

  /** All status'd pages for self (excludes untouched). */
  allPages: () => api.get<AllPagesResponse>('/hifz/pages'),
  /** Ustadh: all status'd pages for a student. */
  studentAllPages: (studentId: number) =>
    api.get<AllPagesResponse>(`/hifz/pages/student/${studentId}`),
};
