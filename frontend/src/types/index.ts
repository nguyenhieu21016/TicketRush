// TicketRush - CTicket Design System & Product Backlog Types

export interface RegistrationPayload {
  full_name: string;
  email: string;
  phone: string;
  ticket_tier?: string;
  event_id?: number;
}

export interface TicketStatusResponse {
  tickets_left?: number;
  ticketsLeft?: number;
  total_tickets?: number;
  status?: string;
}

export interface RegistrationResponse {
  ticket_id?: string;
  ticketId?: string;
  detail?: string;
  message?: string;
}

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastMessage {
  id: string;
  message: string;
  type: ToastType;
}

export interface ModalTicketInfo {
  ticketId: string;
  attendeeName: string;
  attendeeEmail: string;
  phone?: string;
  tierName?: string;
  eventName?: string;
  venue?: string;
  eventDate?: string;
  qrCodeUrl?: string;
  createdAt?: string;
  status?: 'ISSUED' | 'CHECKED_IN' | 'REFUNDED';
}

export type TicketStatus = 'open' | 'low' | 'soldout';

export interface EventItem {
  id: number;
  title: string;
  category: string;
  date: string;
  time: string;
  venue: string;
  address: string;
  totalSeats: number;
  price: string;
  bannerImage: string;
  organizer: string;
  status: 'PUBLISHED' | 'OPEN' | 'SOLD_OUT';
  description: string;
}

export interface TicketTier {
  id: string;
  name: string;
  priceText: string;
  priceValue: number;
  description: string;
  availableCount: number;
  maxPerOrder: number;
  badge?: string;
}

export interface WaitlistEntry {
  email: string;
  fullName: string;
  queueNumber: number;
  createdAt: string;
}

export interface CheckInLog {
  ticketId: string;
  attendeeName: string;
  attendeeEmail: string;
  status: 'SUCCESS' | 'ALREADY_CHECKED_IN' | 'NOT_FOUND';
  timestamp: string;
}
