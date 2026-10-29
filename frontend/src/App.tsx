import { useState, useCallback, useEffect } from 'react';
import Navbar from './components/Navbar';
import HeroSection, { CTICKET_EVENTS, type EventItemData } from './components/HeroSection';
import EventDetailView from './components/EventDetailView';
import Footer from './components/Footer';
import SuccessModal from './components/SuccessModal';
import MyTicketsModal from './components/MyTicketsModal';
import WaitlistModal from './components/WaitlistModal';
import OrganizerCheckIn from './components/OrganizerCheckIn';
import AuthView, { type AuthMode } from './components/AuthView';
import ToastContainer, { useToasts } from './components/ToastContainer';
import { useTicketStatus } from './hooks/useTicketStatus';
import type { AuditLogEntry, ModalTicketInfo, ToastMessage, UserAccount } from './types';

const INITIAL_SAMPLE_TICKETS: ModalTicketInfo[] = [
  {
    ticketId: 'TR-100234',
    eventId: 12,
    attendeeName: 'Nguyễn Văn Hiếu',
    attendeeEmail: 'hieunv@vnu.edu.vn',
    tierName: 'Early Bird Pass (Hội trường chính)',
    eventName: 'AWS Cloud Architecture & High Concurrency Summit 2026',
    venue: 'Hội trường A1, ĐHQG Hà Nội',
    eventDate: 'Hà Nội, 28 tháng 11, 2026',
    status: 'ISSUED',
    refundStatus: 'NONE',
    createdAt: '08:15:10',
  },
  {
    ticketId: 'TR-100235',
    eventId: 12,
    attendeeName: 'Phan Huy Anh',
    attendeeEmail: 'anhph@vnu.edu.vn',
    tierName: 'VIP Front-Row Access (Ưu tiên)',
    eventName: 'AWS Cloud Architecture & High Concurrency Summit 2026',
    venue: 'Hội trường A1, ĐHQG Hà Nội',
    eventDate: 'Hà Nội, 28 tháng 11, 2026',
    status: 'CHECKED_IN',
    refundStatus: 'NONE',
    createdAt: '08:20:45',
  },
  {
    ticketId: 'TR-100236',
    eventId: 12,
    attendeeName: 'Nguyễn Tất Bình',
    attendeeEmail: 'binhnt@vnu.edu.vn',
    tierName: 'Early Bird Pass (Hội trường chính)',
    eventName: 'AWS Cloud Architecture & High Concurrency Summit 2026',
    venue: 'Hội trường A1, ĐHQG Hà Nội',
    eventDate: 'Hà Nội, 28 tháng 11, 2026',
    status: 'PENDING_PAYMENT',
    refundStatus: 'NONE',
    createdAt: '08:42:12',
  },
  {
    ticketId: 'TR-100237',
    eventId: 12,
    attendeeName: 'Trần Đức Hoàng',
    attendeeEmail: 'hoangtd@vnu.edu.vn',
    tierName: 'Early Bird Pass (Hội trường chính)',
    eventName: 'AWS Cloud Architecture & High Concurrency Summit 2026',
    venue: 'Hội trường A1, ĐHQG Hà Nội',
    eventDate: 'Hà Nội, 28 tháng 11, 2026',
    status: 'REFUNDED',
    refundStatus: 'SUCCEEDED',
    createdAt: '08:50:00',
  },
  {
    ticketId: 'TR-200888',
    eventId: 1,
    attendeeName: 'Lê Minh Châu',
    attendeeEmail: 'chaulm@gmail.com',
    tierName: 'SVIP (Hàng 1-3 Premium)',
    eventName: 'MỸ TÂM LIVE CONCERT-SEE THE LIGHT DAY 2',
    venue: 'Khu dân cư Vạn Phúc, TP. Thủ Đức',
    eventDate: 'TP. Hồ Chí Minh, 21 tháng 11, 2026',
    status: 'ISSUED',
    refundStatus: 'NONE',
    createdAt: '09:00:00',
  },
];

const INITIAL_AUDIT_LOGS: AuditLogEntry[] = [
  {
    id: 'AUD-1001',
    timestamp: '08:00:00',
    actor: 'btc-admin@ticketrush.vn',
    role: 'ORGANIZER',
    action: 'CREATE_EVENT',
    target: 'Event #12 (AWS Cloud Architecture Summit 2026)',
    detail: 'Khởi tạo sự kiện PUBLISHED với sức chứa 300 chỗ trên RDS MySQL & ElastiCache Redis.',
    status: 'SUCCESS',
  },
  {
    id: 'AUD-1002',
    timestamp: '08:25:10',
    actor: 'gate-staff@ticketrush.vn',
    role: 'STAFF',
    action: 'CHECK_IN',
    target: 'Ticket TR-100235',
    detail: 'Quét mã QR hợp lệ tại cổng A1 cho khách Phan Huy Anh (anhph@vnu.edu.vn).',
    status: 'SUCCESS',
  },
  {
    id: 'AUD-1003',
    timestamp: '08:50:05',
    actor: 'hoangtd@vnu.edu.vn',
    role: 'CUSTOMER',
    action: 'CANCEL_REFUND',
    target: 'Ticket TR-100237',
    detail: 'Khách hàng hủy vé hợp lệ trước hạn; vé chuyển sang REFUNDED và hoàn 1 chỗ về Redis.',
    status: 'SUCCESS',
  },
];

function App() {
  const { ticketState, fetchTicketStatus, decrementTicket, TOTAL_TICKETS, API_BASE_URL } = useTicketStatus();
  const { toasts, addToast, removeToast } = useToasts();

  const [activeRole, setActiveRole] = useState<'customer' | 'organizer'>('customer');
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [modalInfo, setModalInfo] = useState<ModalTicketInfo | null>(null);
  const [isMyTicketsOpen, setIsMyTicketsOpen] = useState(false);
  const [isWaitlistOpen, setIsWaitlistOpen] = useState(false);
  const [authScreenMode, setAuthScreenMode] = useState<AuthMode | null>(null);

  // Search & location filter state (US-01)
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('Tất cả địa điểm');
  const [eventsList, setEventsList] = useState<EventItemData[]>(CTICKET_EVENTS);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(INITIAL_AUDIT_LOGS);

  const handleAddAuditLog = useCallback(
    (entry: Omit<AuditLogEntry, 'id' | 'timestamp'>) => {
      const newEntry: AuditLogEntry = {
        ...entry,
        id: `AUD-${Math.floor(1000 + Math.random() * 9000)}`,
        timestamp: new Date().toLocaleTimeString('vi-VN'),
      };
      setAuditLogs((prev) => [newEntry, ...prev]);
    },
    []
  );

  const handleSaveEvent = useCallback((evt: EventItemData, isNew: boolean) => {
    setEventsList((prev) => {
      if (isNew) {
        return [...prev, evt];
      }
      return prev.map((item) => (item.id === evt.id ? evt : item));
    });
  }, []);

  // User authentication state persisted in localStorage
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() => {
    try {
      const saved = localStorage.getItem('tr_current_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    try {
      if (currentUser) {
        localStorage.setItem('tr_current_user', JSON.stringify(currentUser));
      } else {
        localStorage.removeItem('tr_current_user');
      }
    } catch {
      // ignore storage error
    }
  }, [currentUser]);

  // Persistent booked tickets list for local session demo
  const [myTickets, setMyTickets] = useState<ModalTicketInfo[]>(() => {
    try {
      const saved = localStorage.getItem('tr_my_tickets');
      if (saved) {
        const parsed = JSON.parse(saved);
        return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_SAMPLE_TICKETS;
      }
      return INITIAL_SAMPLE_TICKETS;
    } catch {
      return INITIAL_SAMPLE_TICKETS;
    }
  });

  useEffect(() => {
    localStorage.setItem('tr_my_tickets', JSON.stringify(myTickets));
  }, [myTickets]);

  const handleShowModal = useCallback(
    (ticketId: string, attendeeName: string, attendeeEmail: string, tierName?: string) => {
      const selectedEvent = eventsList.find((e) => e.id === selectedEventId) || eventsList[11];
      const newTicket: ModalTicketInfo = {
        ticketId,
        eventId: selectedEvent.id,
        attendeeName,
        attendeeEmail,
        tierName: tierName || 'Early Bird Pass',
        eventName: selectedEvent.title,
        venue: selectedEvent.venue,
        eventDate: selectedEvent.date,
        status: 'ISSUED',
        refundStatus: 'NONE',
        createdAt: new Date().toLocaleTimeString('vi-VN'),
      };
      setMyTickets((prev) => [newTicket, ...prev]);
      setModalInfo(newTicket);
    },
    [selectedEventId, eventsList]
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

  const handleAuthSuccess = useCallback(
    (user: UserAccount, mode: 'login' | 'register') => {
      setCurrentUser(user);
      setAuthScreenMode(null);
      addToast({
        message:
          mode === 'register'
            ? `Đăng ký tài khoản thành công! Xin chào ${user.name}.`
            : `Đăng nhập thành công! Chào mừng ${user.name} quay trở lại.`,
        type: 'success',
      });
    },
    [addToast]
  );

  const handleLogout = useCallback(() => {
    setCurrentUser(null);
    setActiveRole('customer');
    addToast({
      message: 'Đã đăng xuất khỏi tài khoản.',
      type: 'info',
    });
  }, [addToast]);

  const currentEvent = eventsList.find((e) => e.id === selectedEventId) || eventsList[11];

  // Dedicated full-screen CTicket Auth View (/auth/login & /auth/register)
  if (authScreenMode !== null) {
    return (
      <div className="ct-app-root">
        <AuthView
          initialMode={authScreenMode}
          onSuccess={handleAuthSuccess}
          onBackHome={() => setAuthScreenMode(null)}
          onAddToast={handleAddToast}
        />
        <ToastContainer toasts={toasts} onRemove={removeToast} />
      </div>
    );
  }

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
        currentUser={currentUser}
        onOpenAuth={(mode) => {
          setAuthScreenMode(mode);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onLogout={handleLogout}
        searchQuery={searchQuery}
        onSearchChange={(q) => {
          setSearchQuery(q);
          if (selectedEventId !== null) setSelectedEventId(null);
          if (activeRole !== 'customer') setActiveRole('customer');
        }}
        selectedLocation={selectedLocation}
        onLocationChange={(loc) => {
          setSelectedLocation(loc);
          if (selectedEventId !== null) setSelectedEventId(null);
          if (activeRole !== 'customer') setActiveRole('customer');
        }}
      />

      {/* 2. Main Content Body */}
      <main className="ct-main-content">
        {activeRole === 'organizer' ? (
          <div className="ct-container" style={{ padding: '32px 20px' }}>
            <OrganizerCheckIn
              eventsList={eventsList}
              onSaveEvent={handleSaveEvent}
              ticketsList={myTickets}
              onCheckInSuccess={handleCheckInSuccess}
              auditLogs={auditLogs}
              onAddAuditLog={handleAddAuditLog}
              onAddToast={handleAddToast}
              currentUser={currentUser}
              onBackToCustomer={() => setActiveRole('customer')}
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
              events={eventsList}
              searchQuery={searchQuery}
              selectedLocation={selectedLocation}
              onResetFilters={() => {
                setSearchQuery('');
                setSelectedLocation('Tất cả địa điểm');
              }}
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
