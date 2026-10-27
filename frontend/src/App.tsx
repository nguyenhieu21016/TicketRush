import React, { useState, useCallback } from 'react';
import Navbar from './components/Navbar';
import HeroSection from './components/HeroSection';
import TicketCard from './components/TicketCard';
import InfraHighlights from './components/InfraHighlights';
import SuccessModal from './components/SuccessModal';
import ToastContainer, { useToasts } from './components/ToastContainer';
import { useTicketStatus } from './hooks/useTicketStatus';
import type { ModalTicketInfo, ToastMessage } from './types';

function App() {
  const { ticketState, fetchTicketStatus, decrementTicket, TOTAL_TICKETS, API_BASE_URL } = useTicketStatus();
  const { toasts, addToast, removeToast } = useToasts();
  const [modalInfo, setModalInfo] = useState<ModalTicketInfo | null>(null);

  const handleShowModal = useCallback((ticketId: string, attendeeName: string, attendeeEmail: string) => {
    setModalInfo({ ticketId, attendeeName, attendeeEmail });
  }, []);

  const handleCloseModal = useCallback(() => {
    setModalInfo(null);
  }, []);

  const handleAddToast = useCallback((toast: Omit<ToastMessage, 'id'>) => {
    addToast(toast);
  }, [addToast]);

  return (
    <>
      {/* Ambient background glow elements */}
      <div className="ambient-glow glow-top"></div>
      <div className="ambient-glow glow-bottom"></div>

      <Navbar systemStatusText={ticketState.systemStatusText} />

      <main className="main-content">
        <div className="container">
          <HeroSection />

          <TicketCard
            ticketsLeft={ticketState.ticketsLeft}
            totalTickets={TOTAL_TICKETS}
            status={ticketState.status}
            isRushActive={ticketState.isRushActive}
            isMockMode={ticketState.isMockMode}
            apiBaseUrl={API_BASE_URL}
            onTicketDecrement={decrementTicket}
            onShowModal={handleShowModal}
            onAddToast={handleAddToast}
            onRefetchStatus={fetchTicketStatus}
          />

          <InfraHighlights />
        </div>
      </main>

      <SuccessModal info={modalInfo} onClose={handleCloseModal} />

      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <footer className="footer">
        <div className="container footer-content">
          <p>© 2026 TicketRush Project • Bài tập lớn Điện toán đám mây AWS</p>
          <p className="footer-team">Nhóm: Phan Huy Anh • Nguyễn Tất Bình • Nguyễn Văn Hiếu • Trần Đức Hoàng</p>
        </div>
      </footer>
    </>
  );
}

export default App;
