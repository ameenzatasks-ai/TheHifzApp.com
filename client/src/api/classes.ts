import { api } from './client';
import type { ClassWithMeta } from '../types';
import type { ListenedPage } from './pages';

export interface ClassDetail extends ClassWithMeta {
  students?: Array<{ id: number; name: string; email: string; avatar_url: string | null; joined_at: string }>;
}

export interface StudentPagesResponse {
  student: { id: number; name: string; avatar_url: string | null };
  listenedPages: ListenedPage[];
  total: number;
}

export interface CoUstadh {
  id: number;
  ustadh_id: number;
  name: string;
  email: string;
  avatar_url: string | null;
  added_at: string;
  added_by_name: string | null;
}

export const classesApi = {
  create: (name: string) => api.post<ClassWithMeta>('/classes', { name }),
  list:   () => api.get<ClassWithMeta[]>('/classes'),
  get:    (id: number) => api.get<ClassDetail>(`/classes/${id}`),
  /** Ustadh-only: rename a class. */
  rename: (id: number, name: string) => api.patch<ClassWithMeta>(`/classes/${id}`, { name }),
  /** Ustadh-only: delete a class (cascades enrolments + invitations). */
  remove: (id: number) => api.delete<{ message: string }>(`/classes/${id}`),
  join:   (joinCode: string) => api.post<ClassWithMeta>('/classes/join', { joinCode }),
  leave:  (id: number) => api.delete<{ message: string }>(`/classes/${id}/leave`),
  getStudentPages: (classId: number, studentId: number) =>
    api.get<StudentPagesResponse>(`/classes/${classId}/students/${studentId}/pages`),
  /** Ustadh-only: get all students in a class. */
  getStudents: (classId: number) =>
    api.get<Array<{ id: number; name: string; email: string; avatar_url: string | null; joined_at: string }>>(`/classes/${classId}/students`),
  /** Ustadh: join a class as co-teacher using ustadh code. */
  joinAsUstadh: (ustadhCode: string) => api.post<ClassWithMeta>('/classes/join-ustadh', { ustadhCode }),
  /** Get co-ustadhs for a class. */
  getCoUstadhs: (classId: number) => api.get<CoUstadh[]>(`/classes/${classId}/co-ustadhs`),
  /** Remove a co-ustadh from a class. */
  removeCoUstadh: (classId: number, ustadhId: number) =>
    api.delete<{ message: string }>(`/classes/${classId}/co-ustadhs/${ustadhId}`),
};
