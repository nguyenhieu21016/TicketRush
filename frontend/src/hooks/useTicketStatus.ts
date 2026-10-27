import { useState, useEffect, useRef, useCallback } from 'react';
import type { TicketStatus } from '../types';

const CONFIG = {
  API_BASE_URL: '',
  TOTAL_TICKETS: 300,
  POLL_INTERVAL: 4000,
};

interface TicketState {
  ticketsLeft: number;
  isMockMode: boolean;
  isRushActive: boolean;
  status: TicketStatus;
  systemStatusText: string;
}

export function useTicketStatus() {
  const [ticketState, setTicketState] = useState<TicketState>({
    ticketsLeft: CONFIG.TOTAL_TICKETS,
    isMockMode: false,
    isRushActive: true,
    status: 'open',
    systemStatusText: 'AWS Multi-AZ Active',
  });

  const isMockModeRef = useRef(false);

  const computeStatus = (count: number): TicketStatus => {
    if (count <= 0) return 'soldout';
    if (count <= 30) return 'low';
    return 'open';
  };

  const fetchTicketStatus = useCallback(async () => {
    try {
      const res = await fetch(`${CONFIG.API_BASE_URL}/api/tickets/status`);
      if (!res.ok) throw new Error('API offline');
      const data = await res.json();
      const count = data.tickets_left !== undefined ? data.tickets_left : data.ticketsLeft;

      if (isMockModeRef.current) {
        isMockModeRef.current = false;
      }

      setTicketState(prev => ({
        ...prev,
        ticketsLeft: Math.max(0, count),
        isMockMode: false,
        isRushActive: count > 0,
        status: computeStatus(count),
        systemStatusText: isMockModeRef.current ? 'AWS ALB / Redis Connected' : prev.systemStatusText,
      }));
    } catch {
      if (!isMockModeRef.current) {
        isMockModeRef.current = true;
        setTicketState(prev => ({
          ...prev,
          isMockMode: true,
          systemStatusText: 'Local Standalone Preview',
        }));
        console.info('TicketRush: Backend not reached, running in standalone UI preview mode.');
      }
    }
  }, []);

  // Allow components to optimistically update ticket count
  const decrementTicket = useCallback(() => {
    setTicketState(prev => {
      const newCount = Math.max(0, prev.ticketsLeft - 1);
      return {
        ...prev,
        ticketsLeft: newCount,
        isRushActive: newCount > 0,
        status: computeStatus(newCount),
      };
    });
  }, []);

  useEffect(() => {
    fetchTicketStatus();
    const interval = setInterval(fetchTicketStatus, CONFIG.POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchTicketStatus]);

  return {
    ticketState,
    fetchTicketStatus,
    decrementTicket,
    TOTAL_TICKETS: CONFIG.TOTAL_TICKETS,
    API_BASE_URL: CONFIG.API_BASE_URL,
  };
}
