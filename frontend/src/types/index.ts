// TicketRush - TypeScript types

export interface RegistrationPayload {
  full_name: string;
  email: string;
  phone: string;
}

export interface TicketStatusResponse {
  tickets_left?: number;
  ticketsLeft?: number;
}

export interface RegistrationResponse {
  ticket_id?: string;
  ticketId?: string;
  detail?: string;
  message?: string;
}

export type ToastType = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: string;
  message: string;
  type: ToastType;
}

export interface ModalTicketInfo {
  ticketId: string;
  attendeeName: string;
  attendeeEmail: string;
}

export type TicketStatus = 'open' | 'low' | 'soldout';
