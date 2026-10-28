import { useState, useCallback, useEffect } from 'react';
import Navbar from './components/Navbar';
import HeroSection, { CTICKET_EVENTS } from './components/HeroSection';
import EventDetailView from './components/EventDetailView';
import Footer from './components/Footer';
import SuccessModal from './components/SuccessModal';
import MyTicketsModal from './components/MyTicketsModal';
import WaitlistModal from './components/WaitlistModal';
import OrganizerCheckIn from './components/OrganizerCheckIn';
import ToastContainer, { useToasts } from './components/ToastContainer';
import { useTicketStatus } from './hooks/useTicketStatus';
import type { ModalTicketInfo, ToastMessage } from './types';

function App() {
  const { ticketState, fetchTicketStatus, decrementTicket, TOTAL_TICKETS, API_BASE_URL } = useTicketStatus();
  const { toasts, addToast, removeToast } = useToasts();

  const [activeRole, setActiveRole] = useState<'customer' | 'organizer'>('customer');
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [modalInfo, setModalInfo] = useState<ModalTicketInfo | null>(null);
  const [isMyTicketsOpen, setIsMyTicketsOpen] = useState(false);
  const [isWaitlistOpen, setIsWaitlistOpen] = useState(false);

  // Persistent booked tickets list for local session demo
  const [myTickets, setMyTickets] = useState<ModalTicketInfo[]>(() => {
    try {
      const saved = localStorage.getItem('tr_my_tickets');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem('tr_my_tickets', JSON.stringify(myTickets));
  }, [myTickets]);

  const handleShowModal = useCallback(
    (ticketId: string, attendeeName: string, attendeeEmail: string, tierName?: string) => {
      const selectedEvent = CTICKET_EVENTS.find((e) => e.id === selectedEventId) || CTICKET_EVENTS[11];
      const newTicket: ModalTicketInfo = {
        ticketId,
        attendeeName,
        attendeeEmail,
        tierName: tierName || 'Early Bird Pass',
        eventName: selectedEvent.title,
        venue: selectedEvent.venue,
        eventDate: selectedEvent.date,
        status: 'ISSUED',
        createdAt: new Date().toLocaleTimeString('vi-VN'),
      };
      setMyTickets((prev) => [newTicket, ...prev]);
      setModalInfo(newTicket);
    },
    [selectedEventId]
  );

  const handleCloseModal = useCallback(() => {
    setModalInfo(null);
  }, []);

  const handleAddToast = useCallback(
    (toast: Omit<ToastMessage, 'id'>) => {
      addToast(toast);
    },
    [addToast]
  );

  // Cancel/Refund Ticket (US-14)
  const handleCancelTicket = useCallback(
    (ticketId: string) => {
      setMyTickets((prev) =>
        prev.map((t) => (t.ticketId === ticketId ? { ...t, status: 'REFUNDED' } : t))
      );
      addToast({
        message: `Đã hủy vé ${ticketId} thành công! Ghế đã được hoàn trả về hệ thống. (US-14)`,
        type: 'info',
      });
    },
    [addToast]
  );

  // Check-In Ticket at Gate (US-19)
  const handleCheckInSuccess = useCallback((ticketId: string) => {
    setMyTickets((prev) =>
      prev.map((t) => (t.ticketId === ticketId ? { ...t, status: 'CHECKED_IN' } : t))
    );
  }, []);

  const currentEvent = CTICKET_EVENTS.find((e) => e.id === selectedEventId) || CTICKET_EVENTS[11];

  return (
    <div className="ct-app-root">
      {/* 1. Official CTicket Navbar */}
      <Navbar
        systemStatusText={ticketState.systemStatusText}
        activeRole={activeRole}
        onRoleChange={setActiveRole}
        onOpenMyTickets={() => setIsMyTicketsOpen(true)}
        onGoHome={() => setSelectedEventId(null)}
        myTicketCount={myTickets.filter((t) => t.status !== 'REFUNDED').length}
      />

      {/* 2. Main Content Body */}
      <main className="ct-main-content">
        {activeRole === 'organizer' ? (
          <div className="ct-container" style={{ padding: '32px 20px' }}>
            <OrganizerCheckIn
              ticketsList={myTickets}
              onCheckInSuccess={handleCheckInSuccess}
              onAddToast={handleAddToast}
            />
          </div>
        ) : selectedEventId !== null ? (
          /* Event Detail & Booking View (exact layout of cticket_after_click) */
          <EventDetailView
            event={currentEvent}
            ticketsLeft={ticketState.ticketsLeft}
            totalTickets={TOTAL_TICKETS}
            status={ticketState.status}
            isMockMode={ticketState.isMockMode}
            apiBaseUrl={API_BASE_URL}
            onTicketDecrement={decrementTicket}
            onShowModal={handleShowModal}
            onAddToast={handleAddToast}
            onRefetchStatus={fetchTicketStatus}
            onOpenWaitlist={() => setIsWaitlistOpen(true)}
            onBack={() => setSelectedEventId(null)}
          />
        ) : (
          /* Homepage View (exact layout of cticket_homepage) */
          <div className="ct-container">
            <HeroSection
              onSelectEvent={(eventId) => {
                setSelectedEventId(eventId);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            />
          </div>
        )}
      </main>

      {/* 3. Official CTicket Dark 4-Column Footer */}
      <Footer />

      {/* Modals & Overlays */}
      <SuccessModal
        info={modalInfo}
        onClose={handleCloseModal}
        onViewMyTickets={() => {
          setModalInfo(null);
          setIsMyTicketsOpen(true);
        }}
      />

      <MyTicketsModal
        isOpen={isMyTicketsOpen}
        tickets={myTickets}
        onClose={() => setIsMyTicketsOpen(false)}
        onCancelTicket={handleCancelTicket}
      />

      <WaitlistModal
        isOpen={isWaitlistOpen}
        onClose={() => setIsWaitlistOpen(false)}
        onJoinWaitlist={(name, email) => {
          handleAddToast({
            message: `Đã đưa ${name} (${email}) vào hàng đợi FIFO (US-15, US-16)! Bạn sẽ nhận được email ngay khi có vé nhả về.`,
            type: 'success',
          });
        }}
      />

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}

export default App;
