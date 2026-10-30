import { api } from './client';

export interface InviteResponse {
  message: string;   // the full SMS text (for clipboard copy)
  smsSent: boolean;  // whether Twilio actually sent the SMS
  smsError: string | null;  // why it was not sent, when it was not
}

export const invitesApi = {
  send: (classId: number, phone: string) =>
    api.post<InviteResponse>(`/classes/${classId}/invite`, { phone }),
};
