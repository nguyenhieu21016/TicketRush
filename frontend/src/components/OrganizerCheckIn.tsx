import React, { useState } from 'react';
import type { AuditLogEntry, CheckInLog, ModalTicketInfo, UserAccount } from '../types';
import type { EventItemData, EventPublishStatus, EventRegistrationState } from './HeroSection';

interface OrganizerCheckInProps {
  eventsList: EventItemData[];
  onSaveEvent: (evt: EventItemData, isNew: boolean) => void;
  ticketsList: ModalTicketInfo[];
  onCheckInSuccess: (ticketId: string) => void;
  auditLogs: AuditLogEntry[];
  onAddAuditLog: (entry: Omit<AuditLogEntry, 'id' | 'timestamp'>) => void;
  onAddToast: (toast: { message: string; type: 'success' | 'error' | 'info' | 'warning' }) => void;
  currentUser: UserAccount | null;
  onBackToCustomer: () => void;
}

const OWNED_ORGANIZER_NAME = 'TicketRush & AWS Student Community';

const OrganizerCheckIn: React.FC<OrganizerCheckInProps> = ({
  eventsList,
  onSaveEvent,
  ticketsList,
  onCheckInSuccess,
  auditLogs,
  onAddAuditLog,
  onAddToast,
  currentUser,
  onBackToCustomer,
}) => {
  // Active tab in Organizer Portal: US-03, US-04/05, US-19, US-23
  const [activeTab, setActiveTab] = useState<'events' | 'attendees' | 'checkin' | 'audit'>('events');

  // Role simulator for US-07 & US-19 (Organizer vs Staff vs Unauthorized Customer)
  const [simulatedOrgRole, setSimulatedOrgRole] = useState<'organizer' | 'staff' | 'unauthorized_customer'>('organizer');

  const actorLabel = currentUser
    ? `${currentUser.name} (${currentUser.email})`
    : simulatedOrgRole === 'organizer'
    ? 'btc-admin@ticketrush.vn'
    : simulatedOrgRole === 'staff'
    ? 'gate-staff@ticketrush.vn'
    : 'khachhang@gmail.com';

  // ============================================================================
  // TAB 1: US-03 — Create & Update Event State
  // ============================================================================
  const [editingEventId, setEditingEventId] = useState<number | null>(null);
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);

  const [evTitle, setEvTitle] = useState('');
  const [evCategory, setEvCategory] = useState('Hội thảo & Cộng đồng');
  const [evLocationCity, setEvLocationCity] = useState('Hà Nội');
  const [evVenue, setEvVenue] = useState('');
  const [evDate, setEvDate] = useState('');
  const [evPrice, setEvPrice] = useState('Miễn phí (Giới hạn chỗ)');
  const [evCapacity, setEvCapacity] = useState<string>('300');
  const [evRegStart, setEvRegStart] = useState('2026-10-20T08:00');
  const [evRegEnd, setEvRegEnd] = useState('2026-11-27T23:59');
  const [evPublishStatus, setEvPublishStatus] = useState<EventPublishStatus>('PUBLISHED');
  const [evRegState, setEvRegState] = useState<EventRegistrationState>('OPEN');
  const [evDesc, setEvDesc] = useState('');
  const [evCurrentSold, setEvCurrentSold] = useState<number>(0);

  const [evErrors, setEvErrors] = useState<Record<string, string>>({});

  const isEventOwned = (evt: EventItemData) => {
    return (evt.organizer || OWNED_ORGANIZER_NAME) === OWNED_ORGANIZER_NAME;
  };

  const handleOpenCreateEvent = () => {
    if (simulatedOrgRole === 'staff') {
      onAddToast({
        message: 'Từ chối truy cập (403): Vai trò Staff chỉ được phép Soát vé (US-19), không có quyền Tạo sự kiện (US-03 AC4, US-07).',
        type: 'error',
      });
      onAddAuditLog({
        actor: actorLabel,
        role: 'STAFF',
        action: 'ACCESS_DENIED',
        target: 'Create Event Form',
        detail: 'Nhân viên soát vé (Staff) thử mở chức năng Tạo sự kiện của Organizer.',
        status: 'REJECTED',
      });
      return;
    }

    setEditingEventId(null);
    setEvTitle('');
    setEvCategory('Hội thảo & Cộng đồng');
    setEvLocationCity('Hà Nội');
    setEvVenue('');
    setEvDate('Hà Nội, 20 tháng 12, 2026');
    setEvPrice('Miễn phí');
    setEvCapacity('300');
    setEvRegStart('2026-11-01T08:00');
    setEvRegEnd('2026-12-19T23:59');
    setEvPublishStatus('PUBLISHED');
    setEvRegState('OPEN');
    setEvDesc('');
    setEvCurrentSold(0);
    setEvErrors({});
    setIsFormOpen(true);
  };

  const handleOpenEditEvent = (evt: EventItemData) => {
    // US-03 AC4 & US-07 AC3: Check role & ownership
    if (simulatedOrgRole === 'staff') {
      onAddToast({
        message: 'Từ chối truy cập (403): Vai trò Staff không có quyền chỉnh sửa sự kiện (US-03 AC4, US-07).',
        type: 'error',
      });
      onAddAuditLog({
        actor: actorLabel,
        role: 'STAFF',
        action: 'ACCESS_DENIED',
        target: `Event #${evt.id} (${evt.title})`,
        detail: 'Staff thử chỉnh sửa thông tin sự kiện.',
        status: 'REJECTED',
      });
      return;
    }

    if (!isEventOwned(evt)) {
      onAddToast({
        message: `Từ chối truy cập (403): Bạn không sở hữu sự kiện "${evt.title}" của đơn vị "${evt.organizer}" (US-03 AC4, US-07 AC3).`,
        type: 'error',
      });
      onAddAuditLog({
        actor: actorLabel,
        role: 'ORGANIZER',
        action: 'ACCESS_DENIED',
        target: `Event #${evt.id} (${evt.title})`,
        detail: `Organizer thử chỉnh sửa sự kiện thuộc quyền sở hữu của "${evt.organizer}".`,
        status: 'REJECTED',
      });
      return;
    }

    setEditingEventId(evt.id);
    setEvTitle(evt.title);
    setEvCategory(evt.category);
    setEvLocationCity(evt.locationCity || 'Hà Nội');
    setEvVenue(evt.venue);
    setEvDate(evt.date);
    setEvPrice(evt.price);
    setEvCapacity(String(evt.capacity || 300));
    setEvRegStart('2026-10-20T08:00');
    setEvRegEnd('2026-11-27T23:59');
    setEvPublishStatus(evt.publishStatus || 'PUBLISHED');
    setEvRegState(evt.registrationState || 'OPEN');
    setEvDesc(evt.desc || '');
    setEvCurrentSold(evt.soldCount || 0);
    setEvErrors({});
    setIsFormOpen(true);
  };

  const handleSaveEventSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!evTitle.trim() || evTitle.trim().length < 4) {
      newErrors.title = 'Trường Tên sự kiện là bắt buộc (tối thiểu 4 ký tự).';
    }
    if (!evVenue.trim()) {
      newErrors.venue = 'Trường Địa điểm tổ chức không được để trống.';
    }
    if (!evDate.trim()) {
      newErrors.date = 'Trường Thời gian diễn ra không được để trống.';
    }

    // US-03 AC2: Validate capacity > 0
    const parsedCap = Number(evCapacity);
    if (!evCapacity.trim() || Number.isNaN(parsedCap) || !Number.isInteger(parsedCap) || parsedCap <= 0) {
      newErrors.capacity = 'Sức chứa không hợp lệ: Phải là số nguyên dương lớn hơn 0 (US-03 AC2).';
    } else if (editingEventId !== null && parsedCap < evCurrentSold) {
      // US-03 AC3: Reject capacity reduction below active holds + sold tickets
      newErrors.capacity = `Từ chối giảm sức chứa: Sức chứa mới (${parsedCap}) thấp hơn tổng số chỗ đang giữ hợp lệ và đã bán (${evCurrentSold} chỗ) (US-03 AC3).`;
    }

    // US-03 AC2: Validate registration start/end timestamps
    const startTs = Date.parse(evRegStart);
    const endTs = Date.parse(evRegEnd);
    if (!evRegStart || !evRegEnd || Number.isNaN(startTs) || Number.isNaN(endTs)) {
      newErrors.regWindow = 'Vui lòng nhập đầy đủ thời gian mở và đóng đăng ký (US-03 AC2).';
    } else if (endTs <= startTs) {
      newErrors.regWindow = 'Thời gian đăng ký không hợp lệ: Thời điểm đóng đăng ký phải sau thời điểm mở đăng ký (US-03 AC2).';
    }

    if (Object.keys(newErrors).length > 0) {
      setEvErrors(newErrors);
      onAddToast({
        message: 'Dữ liệu sự kiện chưa hợp lệ! Vui lòng kiểm tra các trường báo đỏ (US-03 AC2/AC3).',
        type: 'error',
      });
      if (newErrors.capacity && editingEventId !== null && parsedCap < evCurrentSold) {
        onAddAuditLog({
          actor: actorLabel,
          role: 'ORGANIZER',
          action: 'UPDATE_CAPACITY',
          target: `Event #${editingEventId} (${evTitle})`,
          detail: `Từ chối giảm sức chứa xuống ${parsedCap} (đã bán/giữ ${evCurrentSold} chỗ).`,
          status: 'REJECTED',
        });
      }
      return;
    }

    const formatDt = (iso: string) => {
      const d = new Date(iso);
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };

    const badgeMap: Record<EventRegistrationState, 'Đang mở bán' | 'Đã bán hết vé' | 'Chờ mở bán' | 'Đã đóng'> = {
      OPEN: 'Đang mở bán',
      SOLD_OUT: 'Đã bán hết vé',
      NOT_OPEN_YET: 'Chờ mở bán',
      CLOSED: 'Đã đóng',
    };

    const badgeTypeMap: Record<EventRegistrationState, 'green' | 'black' | 'pink'> = {
      OPEN: 'green',
      SOLD_OUT: 'black',
      NOT_OPEN_YET: 'pink',
      CLOSED: 'black',
    };

    const isNew = editingEventId === null;
    const eventPayload: EventItemData = {
      id: isNew ? Date.now() : editingEventId,
      title: evTitle.trim(),
      category: evCategory,
      categoryColor: { bg: '#EEF2FF', text: '#4F46E5' },
      date: evDate.trim(),
      venue: evVenue.trim(),
      locationCity: evLocationCity,
      price: evPrice.trim() || 'Miễn phí',
      badge: badgeMap[evRegState],
      badgeType: badgeTypeMap[evRegState],
      solidColor: '#E2E8F0',
      desc: evDesc.trim() || `Sự kiện chính thức do ${OWNED_ORGANIZER_NAME} tổ chức.`,
      publishStatus: evPublishStatus,
      registrationState: evRegState,
      registrationWindow: `${formatDt(evRegStart)} - ${formatDt(evRegEnd)}`,
      capacity: parsedCap,
      soldCount: evCurrentSold,
      organizer: OWNED_ORGANIZER_NAME,
    };

    onSaveEvent(eventPayload, isNew);
    onAddAuditLog({
      actor: actorLabel,
      role: 'ORGANIZER',
      action: isNew ? 'CREATE_EVENT' : 'UPDATE_CAPACITY',
      target: `Event #${eventPayload.id} (${eventPayload.title})`,
      detail: `${isNew ? 'Tạo mới' : 'Cập nhật'} sự kiện: Trạng thái=${evPublishStatus}, Cổng=${evRegState}, Sức chứa=${parsedCap} chỗ.`,
      status: 'SUCCESS',
    });

    onAddToast({
      message: isNew
        ? `Đã tạo sự kiện "${eventPayload.title}" ở trạng thái ${evPublishStatus} thành công! (US-03 AC1)`
        : `Đã cập nhật sự kiện "${eventPayload.title}" (Sức chứa: ${parsedCap} chỗ) thành công! (US-03 AC1)`,
      type: 'success',
    });
    setIsFormOpen(false);
  };

  // ============================================================================
  // TAB 2: US-04 & US-05 — Attendee / Booking List & CSV Export
  // ============================================================================
  const [selectedAttendeeEventId, setSelectedAttendeeEventId] = useState<number>(12);
  const [attendeeStatusFilter, setAttendeeStatusFilter] = useState<
    'ALL' | 'ISSUED' | 'PENDING_PAYMENT' | 'CHECKED_IN' | 'REFUNDED'
  >('ALL');
  const [attendeeSearch, setAttendeeSearch] = useState('');

  const selectedAttendeeEvent =
    eventsList.find((e) => e.id === selectedAttendeeEventId) || eventsList[11];
  const isSelectedAttendeeEventOwned = isEventOwned(selectedAttendeeEvent);

  const eventBookings = ticketsList.filter(
    (t) => (t.eventId || 12) === selectedAttendeeEventId
  );

  const filteredBookings = eventBookings.filter((t) => {
    const status = t.status || 'ISSUED';
    const matchStatus = attendeeStatusFilter === 'ALL' || status === attendeeStatusFilter;
    const q = attendeeSearch.trim().toLowerCase();
    const matchSearch =
      !q ||
      t.ticketId.toLowerCase().includes(q) ||
      t.attendeeName.toLowerCase().includes(q) ||
      t.attendeeEmail.toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  const handleExportCsv = () => {
    // US-05 AC2: Check ownership before exporting
    if (!isSelectedAttendeeEventOwned) {
      onAddToast({
        message: 'Từ chối xuất file (403): Bạn không có quyền xuất danh sách của sự kiện thuộc BTC khác (US-05 AC2).',
        type: 'error',
      });
      onAddAuditLog({
        actor: actorLabel,
        role: 'ORGANIZER',
        action: 'ACCESS_DENIED',
        target: `CSV Export Event #${selectedAttendeeEvent.id}`,
        detail: 'Thử xuất file CSV danh sách người đăng ký của sự kiện không thuộc quyền sở hữu.',
        status: 'REJECTED',
      });
      return;
    }

    // US-05 AC1 & AC3: Only allowed fields exported in CSV
    const headers = ['Mã Vé', 'Họ và Tên', 'Email', 'Hạng Vé', 'Trạng Thái Booking', 'Thời Gian Đăng Ký'];
    const rows = filteredBookings.map((b) => [
      b.ticketId,
      `"${b.attendeeName.replace(/"/g, '""')}"`,
      b.attendeeEmail,
      `"${(b.tierName || 'Standard Pass').replace(/"/g, '""')}"`,
      b.status || 'ISSUED',
      b.createdAt || '28/10/2026',
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ticketrush-attendees-event-${selectedAttendeeEventId}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    onAddToast({
      message: `Đã xuất ${filteredBookings.length} bản ghi ra file CSV thành công! (US-05)`,
      type: 'success',
    });
  };

  // ============================================================================
  // TAB 3: US-19 — Single-Use QR Gate Check-In
  // ============================================================================
  const [inputTicketId, setInputTicketId] = useState('');
  const [checkInLogs, setCheckInLogs] = useState<CheckInLog[]>([]);

  const handleCheckIn = (e: React.FormEvent) => {
    e.preventDefault();
    const idToVerify = inputTicketId.trim().toUpperCase();
    if (!idToVerify) return;

    const existingTicket = ticketsList.find((t) => t.ticketId.toUpperCase() === idToVerify);
    const now = new Date().toLocaleTimeString('vi-VN');

    // Case 1: Ticket does not exist (US-19 AC2)
    if (!existingTicket) {
      const newLog: CheckInLog = {
        ticketId: idToVerify,
        attendeeName: 'Không xác định',
        attendeeEmail: 'Không tồn tại trên hệ thống',
        status: 'NOT_FOUND',
        timestamp: now,
        reason: 'Mã vé QR không tồn tại trong cơ sở dữ liệu RDS.',
      };
      setCheckInLogs((prev) => [newLog, ...prev]);
      onAddAuditLog({
        actor: actorLabel,
        role: simulatedOrgRole === 'staff' ? 'STAFF' : 'ORGANIZER',
        action: 'CHECK_IN',
        target: `Ticket ${idToVerify}`,
        detail: 'Từ chối check-in: Mã vé không tồn tại.',
        status: 'REJECTED',
      });
      onAddToast({ message: `Từ chối: Vé ${idToVerify} không tồn tại trên hệ thống RDS! (US-19 AC2)`, type: 'error' });
      setInputTicketId('');
      return;
    }

    // Case 2: Ticket belongs to an event the operator does not own / have permission for (US-19 AC4)
    const ticketEvent = eventsList.find((ev) => ev.id === (existingTicket.eventId || 12));
    if (ticketEvent && !isEventOwned(ticketEvent)) {
      const newLog: CheckInLog = {
        ticketId: idToVerify,
        attendeeName: existingTicket.attendeeName,
        attendeeEmail: existingTicket.attendeeEmail,
        status: 'UNAUTHORIZED_EVENT',
        timestamp: now,
        reason: `Không có quyền soát vé cho sự kiện của "${ticketEvent.organizer}".`,
      };
      setCheckInLogs((prev) => [newLog, ...prev]);
      onAddAuditLog({
        actor: actorLabel,
        role: simulatedOrgRole === 'staff' ? 'STAFF' : 'ORGANIZER',
        action: 'CHECK_IN',
        target: `Ticket ${idToVerify}`,
        detail: `Từ chối check-in: Nhân sự không có quyền trên sự kiện "${ticketEvent.title}".`,
        status: 'REJECTED',
      });
      onAddToast({
        message: `Từ chối (403): Bạn không có quyền check-in vé thuộc sự kiện "${ticketEvent.title}"! (US-19 AC4)`,
        type: 'error',
      });
      setInputTicketId('');
      return;
    }

    // Case 3: Ticket already checked in (US-19 AC2 & AC3)
    if (existingTicket.status === 'CHECKED_IN') {
      const newLog: CheckInLog = {
        ticketId: idToVerify,
        attendeeName: existingTicket.attendeeName,
        attendeeEmail: existingTicket.attendeeEmail,
        status: 'ALREADY_CHECKED_IN',
        timestamp: now,
        reason: 'Vé đã được quét qua cổng trước đó (chỉ sử dụng 1 lần).',
      };
      setCheckInLogs((prev) => [newLog, ...prev]);
      onAddAuditLog({
        actor: actorLabel,
        role: simulatedOrgRole === 'staff' ? 'STAFF' : 'ORGANIZER',
        action: 'CHECK_IN',
        target: `Ticket ${idToVerify}`,
        detail: 'Từ chối check-in lặp: Vé đã được check-in trước đó.',
        status: 'REJECTED',
      });
      onAddToast({
        message: `CẢNH BÁO: Vé ${idToVerify} đã được check-in trước đó! Không cho phép sử dụng lần 2 (US-19 AC2).`,
        type: 'warning',
      });
      setInputTicketId('');
      return;
    }

    // Case 4: Ticket is cancelled or refunded (US-19 AC2 & US-14 AC5)
    if (existingTicket.status === 'REFUNDED') {
      const newLog: CheckInLog = {
        ticketId: idToVerify,
        attendeeName: existingTicket.attendeeName,
        attendeeEmail: existingTicket.attendeeEmail,
        status: 'REFUNDED_OR_CANCELLED',
        timestamp: now,
        reason: 'Vé đã bị hủy/hoàn tiền, mã QR đã bị vô hiệu hóa.',
      };
      setCheckInLogs((prev) => [newLog, ...prev]);
      onAddAuditLog({
        actor: actorLabel,
        role: simulatedOrgRole === 'staff' ? 'STAFF' : 'ORGANIZER',
        action: 'CHECK_IN',
        target: `Ticket ${idToVerify}`,
        detail: 'Từ chối check-in: Vé đã hủy/hoàn tiền (QR vô hiệu).',
        status: 'REJECTED',
      });
      onAddToast({
        message: `TỪ CHỐI: Vé ${idToVerify} đã hủy/hoàn tiền! Mã QR không còn hiệu lực (US-19 AC2, US-14 AC5).`,
        type: 'error',
      });
      setInputTicketId('');
      return;
    }

    // Case 5: Booking is still waiting for payment (US-17 AC2 & US-19 AC2)
    if (existingTicket.status === 'PENDING_PAYMENT') {
      const newLog: CheckInLog = {
        ticketId: idToVerify,
        attendeeName: existingTicket.attendeeName,
        attendeeEmail: existingTicket.attendeeEmail,
        status: 'PENDING_PAYMENT',
        timestamp: now,
        reason: 'Booking đang giữ chỗ chờ thanh toán, chưa phát hành QR hợp lệ.',
      };
      setCheckInLogs((prev) => [newLog, ...prev]);
      onAddAuditLog({
        actor: actorLabel,
        role: simulatedOrgRole === 'staff' ? 'STAFF' : 'ORGANIZER',
        action: 'CHECK_IN',
        target: `Ticket ${idToVerify}`,
        detail: 'Từ chối check-in: Booking chưa hoàn tất thanh toán.',
        status: 'REJECTED',
      });
      onAddToast({
        message: `TỪ CHỐI: Mã đặt chỗ ${idToVerify} chưa thanh toán thành công! (US-17 AC2, US-19 AC2)`,
        type: 'error',
      });
      setInputTicketId('');
      return;
    }

    // Case 6: Valid ISSUED ticket -> Check-in success (US-19 AC1)
    onCheckInSuccess(existingTicket.ticketId);
    const newLog: CheckInLog = {
      ticketId: idToVerify,
      attendeeName: existingTicket.attendeeName,
      attendeeEmail: existingTicket.attendeeEmail,
      status: 'SUCCESS',
      timestamp: now,
      reason: 'Vé hợp lệ, xác nhận qua cổng thành công.',
    };
    setCheckInLogs((prev) => [newLog, ...prev]);
    onAddAuditLog({
      actor: actorLabel,
      role: simulatedOrgRole === 'staff' ? 'STAFF' : 'ORGANIZER',
      action: 'CHECK_IN',
      target: `Ticket ${idToVerify}`,
      detail: `Check-in thành công cho khách tham dự ${existingTicket.attendeeName} (${existingTicket.attendeeEmail}).`,
      status: 'SUCCESS',
    });
    onAddToast({
      message: `XÁC NHẬN: Check-in vé ${idToVerify} thành công! Cho phép khách vào cổng (US-19 AC1).`,
      type: 'success',
    });
    setInputTicketId('');
  };

  // ============================================================================
  // US-07 AC1: Unauthorized Customer Access Guard
  // ============================================================================
  if (simulatedOrgRole === 'unauthorized_customer') {
    return (
      <div className="organizer-checkin-container">
        <div className="org-access-denied-card">
          <div className="org-denied-badge">HTTP 403 FORBIDDEN — US-07 AC1</div>
          <h2>Từ Chối Truy Cập Phân Hệ Ban Tổ Chức</h2>
          <p>
            Tài khoản hiện tại đang ở vai trò <strong>Khách hàng (Customer)</strong>. Theo quy tắc phân quyền <strong>US-07 (Acceptance Criteria 1)</strong>, khách hàng không được phép truy cập các chức năng quản lý sự kiện, xem danh sách người đăng ký của người khác hoặc vận hành cổng soát vé.
          </p>
          <div className="org-denied-actions">
            <button
              type="button"
              className="ct-empty-reset-btn"
              onClick={() => setSimulatedOrgRole('organizer')}
            >
              Chuyển lại quyền Ban Tổ Chức (Organizer)
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={onBackToCustomer}
            >
              Về trang chủ Khách mua vé
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="organizer-checkin-container">
      {/* Top Header & Role Switcher Bar */}
      <div className="org-portal-header">
        <div className="org-portal-title-group">
          <div className="badge-role">TRUNG TÂM QUẢN TRỊ BAN TỔ CHỨC &amp; VẬN HÀNH</div>
          <h2>Hệ Thống Quản Lý Sự Kiện, Người Đăng Ký &amp; Soát Vé (US-03, US-04, US-07, US-19, US-23)</h2>
          <p>
            Đơn vị sở hữu hiện tại: <strong>{OWNED_ORGANIZER_NAME}</strong> | Người thực hiện: <code>{actorLabel}</code>
          </p>
        </div>

        {/* Role & Ownership Permission Tester (US-07) */}
        <div className="org-role-simulator-box">
          <span className="org-role-sim-label">Chế độ kiểm thử phân quyền (US-07):</span>
          <div className="org-role-sim-pills">
            <button
              type="button"
              className={`org-role-pill ${simulatedOrgRole === 'organizer' ? 'active' : ''}`}
              onClick={() => setSimulatedOrgRole('organizer')}
            >
              Organizer (Chủ sự kiện)
            </button>
            <button
              type="button"
              className={`org-role-pill ${simulatedOrgRole === 'staff' ? 'active' : ''}`}
              onClick={() => {
                setSimulatedOrgRole('staff');
                setActiveTab('checkin');
              }}
            >
              Staff (Chỉ soát vé QR - US-19)
            </button>
            <button
              type="button"
              className="org-role-pill danger"
              onClick={() => {
                setSimulatedOrgRole('unauthorized_customer');
                onAddAuditLog({
                  actor: 'khachhang@gmail.com',
                  role: 'CUSTOMER',
                  action: 'ACCESS_DENIED',
                  target: 'Organizer Portal',
                  detail: 'Khách hàng cố truy cập chức năng chỉ dành cho Organizer (US-07 AC1).',
                  status: 'REJECTED',
                });
              }}
            >
              Giả lập Khách truy cập trái phép (403)
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="org-nav-tabs">
        <button
          type="button"
          className={`org-nav-tab ${activeTab === 'events' ? 'active' : ''}`}
          onClick={() => setActiveTab('events')}
        >
          1. Quản lý &amp; Tạo Sự Kiện (US-03)
        </button>
        <button
          type="button"
          className={`org-nav-tab ${activeTab === 'attendees' ? 'active' : ''}`}
          onClick={() => setActiveTab('attendees')}
        >
          2. Danh Sách Người Đăng Ký ({ticketsList.length}) (US-04, US-05)
        </button>
        <button
          type="button"
          className={`org-nav-tab ${activeTab === 'checkin' ? 'active' : ''}`}
          onClick={() => setActiveTab('checkin')}
        >
          3. Cổng Soát Vé QR Một Lần (US-19)
        </button>
        <button
          type="button"
          className={`org-nav-tab ${activeTab === 'audit' ? 'active' : ''}`}
          onClick={() => setActiveTab('audit')}
        >
          4. Nhật Ký Thao Tác — Audit Log ({auditLogs.length}) (US-23)
        </button>
      </div>

      {/* =====================================================================
          TAB 1: US-03 — TẠO VÀ CẬP NHẬT SỰ KIỆN
          ===================================================================== */}
      {activeTab === 'events' && (
        <div className="org-tab-panel">
          <div className="org-panel-toolbar">
            <div>
              <h3>Danh Sách Sự Kiện Trên Hệ Thống (US-03 &amp; US-07)</h3>
              <p className="org-panel-sub">
                Bao gồm cả sự kiện <code>PUBLISHED</code>, bản nháp <code>DRAFT</code> và <code>CANCELLED</code>. Bạn chỉ được phép chỉnh sửa sự kiện thuộc quyền sở hữu của <strong>{OWNED_ORGANIZER_NAME}</strong>.
              </p>
            </div>
            <button
              type="button"
              className="btn-scanner-submit"
              onClick={handleOpenCreateEvent}
            >
              + Tạo Sự Kiện Mới (US-03)
            </button>
          </div>

          {/* Create / Edit Event Form Modal/Drawer */}
          {isFormOpen && (
            <div className="org-event-form-card">
              <div className="org-form-header">
                <h4>
                  {editingEventId === null
                    ? 'Tạo Sự Kiện Mới (US-03 AC1, AC2)'
                    : `Cập Nhật Sự Kiện #${editingEventId} (Đã bán/giữ: ${evCurrentSold} chỗ — US-03 AC1, AC2, AC3)`}
                </h4>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setIsFormOpen(false)}
                >
                  Đóng biểu mẫu
                </button>
              </div>

              <form onSubmit={handleSaveEventSubmit} className="org-event-form-grid" noValidate>
                <div className="org-form-field full-width">
                  <label>Tên sự kiện *</label>
                  <input
                    type="text"
                    className={`ct-input ${evErrors.title ? 'error' : ''}`}
                    placeholder="VD: AWS Cloud Native & Serverless Day 2026"
                    value={evTitle}
                    onChange={(e) => setEvTitle(e.target.value)}
                  />
                  {evErrors.title && <span className="ct-field-error">{evErrors.title}</span>}
                </div>

                <div className="org-form-field">
                  <label>Danh mục sự kiện</label>
                  <select
                    className="ct-input"
                    value={evCategory}
                    onChange={(e) => setEvCategory(e.target.value)}
                  >
                    <option value="Hội thảo & Cộng đồng">Hội thảo &amp; Cộng đồng</option>
                    <option value="Nhạc sống">Nhạc sống</option>
                    <option value="Sân khấu & Nghệ thuật">Sân khấu &amp; Nghệ thuật</option>
                    <option value="Thể thao">Thể thao</option>
                    <option value="Fan Meeting">Fan Meeting</option>
                    <option value="Khoá học">Khoá học</option>
                  </select>
                </div>

                <div className="org-form-field">
                  <label>Tỉnh / Thành phố (Bộ lọc Navbar)</label>
                  <select
                    className="ct-input"
                    value={evLocationCity}
                    onChange={(e) => setEvLocationCity(e.target.value)}
                  >
                    <option value="Hà Nội">Hà Nội</option>
                    <option value="TP. Hồ Chí Minh">TP. Hồ Chí Minh</option>
                    <option value="Đà Nẵng">Đà Nẵng</option>
                  </select>
                </div>

                <div className="org-form-field">
                  <label>Địa điểm tổ chức chi tiết *</label>
                  <input
                    type="text"
                    className={`ct-input ${evErrors.venue ? 'error' : ''}`}
                    placeholder="VD: Hội trường A1, ĐHQG Hà Nội"
                    value={evVenue}
                    onChange={(e) => setEvVenue(e.target.value)}
                  />
                  {evErrors.venue && <span className="ct-field-error">{evErrors.venue}</span>}
                </div>

                <div className="org-form-field">
                  <label>Thời gian diễn ra hiển thị *</label>
                  <input
                    type="text"
                    className={`ct-input ${evErrors.date ? 'error' : ''}`}
                    placeholder="VD: Hà Nội, 28 tháng 11, 2026"
                    value={evDate}
                    onChange={(e) => setEvDate(e.target.value)}
                  />
                  {evErrors.date && <span className="ct-field-error">{evErrors.date}</span>}
                </div>

                <div className="org-form-field">
                  <label>
                    Tổng sức chứa (Capacity) *{' '}
                    {editingEventId !== null && (
                      <span className="org-inline-hint">(Tối thiểu {evCurrentSold} chỗ đã giữ/bán)</span>
                    )}
                  </label>
                  <input
                    type="number"
                    className={`ct-input ${evErrors.capacity ? 'error' : ''}`}
                    value={evCapacity}
                    onChange={(e) => setEvCapacity(e.target.value)}
                  />
                  {evErrors.capacity && <span className="ct-field-error">{evErrors.capacity}</span>}
                </div>

                <div className="org-form-field">
                  <label>Giá vé hiển thị</label>
                  <input
                    type="text"
                    className="ct-input"
                    value={evPrice}
                    onChange={(e) => setEvPrice(e.target.value)}
                  />
                </div>

                <div className="org-form-field">
                  <label>Thời điểm MỞ đăng ký *</label>
                  <input
                    type="datetime-local"
                    className={`ct-input ${evErrors.regWindow ? 'error' : ''}`}
                    value={evRegStart}
                    onChange={(e) => setEvRegStart(e.target.value)}
                  />
                </div>

                <div className="org-form-field">
                  <label>Thời điểm ĐÓNG đăng ký *</label>
                  <input
                    type="datetime-local"
                    className={`ct-input ${evErrors.regWindow ? 'error' : ''}`}
                    value={evRegEnd}
                    onChange={(e) => setEvRegEnd(e.target.value)}
                  />
                </div>

                {evErrors.regWindow && (
                  <div className="org-form-field full-width">
                    <span className="ct-field-error">{evErrors.regWindow}</span>
                  </div>
                )}

                <div className="org-form-field">
                  <label>Trạng thái công bố (US-01 AC1/AC2)</label>
                  <select
                    className="ct-input"
                    value={evPublishStatus}
                    onChange={(e) => setEvPublishStatus(e.target.value as EventPublishStatus)}
                  >
                    <option value="PUBLISHED">PUBLISHED (Công khai trên trang chủ)</option>
                    <option value="DRAFT">DRAFT (Bản nháp — Ẩn khỏi trang công khai)</option>
                    <option value="CANCELLED">CANCELLED (Đã hủy — Ẩn khỏi trang công khai)</option>
                  </select>
                </div>

                <div className="org-form-field">
                  <label>Trạng thái cổng đăng ký (US-02 AC2/AC3)</label>
                  <select
                    className="ct-input"
                    value={evRegState}
                    onChange={(e) => setEvRegState(e.target.value as EventRegistrationState)}
                  >
                    <option value="OPEN">OPEN (Đang mở đăng ký)</option>
                    <option value="NOT_OPEN_YET">NOT_OPEN_YET (Chờ mở bán — Khóa đặt vé)</option>
                    <option value="CLOSED">CLOSED (Đã đóng đăng ký — Khóa đặt vé)</option>
                    <option value="SOLD_OUT">SOLD_OUT (Hết vé — Mở Waitlist)</option>
                  </select>
                </div>

                <div className="org-form-field full-width">
                  <label>Mô tả sự kiện</label>
                  <textarea
                    className="ct-input"
                    rows={3}
                    value={evDesc}
                    onChange={(e) => setEvDesc(e.target.value)}
                    placeholder="Nhập mô tả chi tiết sự kiện..."
                  />
                </div>

                <div className="org-form-actions full-width">
                  <button type="submit" className="btn-scanner-submit">
                    {editingEventId === null ? 'Lưu & Tạo Sự Kiện' : 'Lưu Cập Nhật Sự Kiện'}
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setIsFormOpen(false)}
                  >
                    Hủy bỏ
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Events Management Table */}
          <div className="logs-table-wrapper">
            <table className="logs-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Tên sự kiện</th>
                  <th>Đơn vị sở hữu (US-07)</th>
                  <th>Trạng thái công bố (US-01)</th>
                  <th>Cổng đăng ký (US-02)</th>
                  <th>Đã bán/Giữ / Sức chứa</th>
                  <th>Thao tác (US-03)</th>
                </tr>
              </thead>
              <tbody>
                {eventsList.slice().reverse().map((ev) => {
                  const owned = isEventOwned(ev);
                  const pub = ev.publishStatus || 'PUBLISHED';
                  const reg = ev.registrationState || 'OPEN';
                  return (
                    <tr key={ev.id}>
                      <td><code>#{ev.id}</code></td>
                      <td>
                        <strong>{ev.title}</strong>
                        <div className="org-table-sub">{ev.venue} | {ev.registrationWindow || ev.date}</div>
                      </td>
                      <td>
                        <span className={`org-owner-badge ${owned ? 'owned' : 'external'}`}>
                          {owned ? 'Của tôi (Sở hữu)' : ev.organizer || 'BTC khác'}
                        </span>
                      </td>
                      <td>
                        <span className={`org-pub-pill pub-${pub.toLowerCase()}`}>
                          {pub}
                        </span>
                      </td>
                      <td>
                        <span className="org-reg-pill">{reg}</span>
                      </td>
                      <td>
                        <strong>{ev.soldCount || 0}</strong> / {ev.capacity || 300} chỗ
                      </td>
                      <td>
                        <button
                          type="button"
                          className={`org-action-btn ${owned ? 'primary' : 'locked'}`}
                          onClick={() => handleOpenEditEvent(ev)}
                        >
                          {owned ? 'Sửa / Cấu hình' : 'Sửa (Khác chủ - Test 403)'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 2: US-04 & US-05 — XEM & XUẤT DANH SÁCH NGƯỜI ĐĂNG KÝ
          ===================================================================== */}
      {activeTab === 'attendees' && (
        <div className="org-tab-panel">
          <div className="org-panel-toolbar">
            <div className="org-attendee-selector-group">
              <label htmlFor="org-event-select">Chọn sự kiện cần xem danh sách (US-04):</label>
              <select
                id="org-event-select"
                className="ct-input org-event-select-input"
                value={selectedAttendeeEventId}
                onChange={(e) => setSelectedAttendeeEventId(Number(e.target.value))}
              >
                {eventsList.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    #{ev.id} - {ev.title} ({isEventOwned(ev) ? 'Sở hữu của tôi' : `Thuộc ${ev.organizer} - Test 403`})
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              className="btn-scanner-submit"
              onClick={handleExportCsv}
            >
              Xuất Danh Sách CSV (US-05)
            </button>
          </div>

          {!isSelectedAttendeeEventOwned ? (
            <div className="org-access-denied-card">
              <div className="org-denied-badge">HTTP 403 FORBIDDEN — US-04 AC2 &amp; US-07 AC3</div>
              <h3>Không Có Quyền Xem Danh Sách Người Đăng Ký</h3>
              <p>
                Sự kiện <strong>{selectedAttendeeEvent.title}</strong> thuộc quyền sở hữu của đơn vị <strong>{selectedAttendeeEvent.organizer}</strong>. Theo <strong>US-04 (Acceptance Criteria 2)</strong> và <strong>US-07 (Acceptance Criteria 3)</strong>, hệ thống từ chối trả về danh sách người tham dự của sự kiện không thuộc quyền sở hữu của bạn.
              </p>
            </div>
          ) : (
            <>
              {/* Summary Status Breakdown (US-04 AC3) */}
              <div className="scanner-stats" style={{ marginBottom: '20px' }}>
                <div className="stat-box">
                  <span className="stat-label">Tổng số Booking</span>
                  <span className="stat-value">{eventBookings.length}</span>
                </div>
                <div className="stat-box">
                  <span className="stat-label">Đã xác nhận (ISSUED)</span>
                  <span className="stat-value text-blue">
                    {eventBookings.filter((t) => (t.status || 'ISSUED') === 'ISSUED').length}
                  </span>
                </div>
                <div className="stat-box">
                  <span className="stat-label">Đã qua cổng (CHECKED_IN)</span>
                  <span className="stat-value text-green">
                    {eventBookings.filter((t) => t.status === 'CHECKED_IN').length}
                  </span>
                </div>
                <div className="stat-box">
                  <span className="stat-label">Chờ thanh toán (HOLD)</span>
                  <span className="stat-value">
                    {eventBookings.filter((t) => t.status === 'PENDING_PAYMENT').length}
                  </span>
                </div>
                <div className="stat-box">
                  <span className="stat-label">Đã hủy / Hoàn tiền</span>
                  <span className="stat-value">
                    {eventBookings.filter((t) => t.status === 'REFUNDED').length}
                  </span>
                </div>
              </div>

              {/* Filter & Search Row (US-04 AC3) */}
              <div className="org-filter-bar">
                <div className="org-status-pills">
                  {[
                    { id: 'ALL', label: 'Tất cả trạng thái' },
                    { id: 'ISSUED', label: 'Đã xác nhận (ISSUED)' },
                    { id: 'CHECKED_IN', label: 'Đã Check-in' },
                    { id: 'PENDING_PAYMENT', label: 'Chờ thanh toán (HOLD)' },
                    { id: 'REFUNDED', label: 'Đã hủy / Hoàn tiền' },
                  ].map((st) => (
                    <button
                      key={st.id}
                      type="button"
                      className={`org-role-pill ${attendeeStatusFilter === st.id ? 'active' : ''}`}
                      onClick={() => setAttendeeStatusFilter(st.id as typeof attendeeStatusFilter)}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>

                <input
                  type="text"
                  className="ct-input org-search-small"
                  placeholder="Tìm theo mã vé, tên, email..."
                  value={attendeeSearch}
                  onChange={(e) => setAttendeeSearch(e.target.value)}
                />
              </div>

              <div className="logs-table-wrapper">
                <table className="logs-table">
                  <thead>
                    <tr>
                      <th>Mã Vé / Booking</th>
                      <th>Họ và tên khách</th>
                      <th>Email đăng ký</th>
                      <th>Hạng vé</th>
                      <th>Thời gian</th>
                      <th>Trạng thái phân biệt (US-04 AC3)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBookings.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', padding: '32px' }}>
                          Không có booking nào khớp với bộ lọc hiện tại.
                        </td>
                      </tr>
                    ) : (
                      filteredBookings.map((b) => (
                        <tr key={b.ticketId}>
                          <td><code>{b.ticketId}</code></td>
                          <td><strong>{b.attendeeName}</strong></td>
                          <td>{b.attendeeEmail}</td>
                          <td>{b.tierName || 'Early Bird Pass'}</td>
                          <td>{b.createdAt || '28/10/2026'}</td>
                          <td>
                            {b.status === 'CHECKED_IN' && (
                              <span className="badge-status-success">ĐÃ CHECK-IN VÀO CỔNG</span>
                            )}
                            {(b.status === 'ISSUED' || !b.status) && (
                              <span className="org-status-confirmed">ĐÃ XÁC NHẬN THANH TOÁN (ISSUED)</span>
                            )}
                            {b.status === 'PENDING_PAYMENT' && (
                              <span className="badge-status-warning">ĐANG GIỮ CHỖ CHỜ THANH TOÁN (HOLD)</span>
                            )}
                            {b.status === 'REFUNDED' && (
                              <span className="badge-status-danger">ĐÃ HỦY / HOÀN TIỀN (VÔ HIỆU)</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* =====================================================================
          TAB 3: US-19 — CHECK-IN VÉ QR MỘT LẦN
          ===================================================================== */}
      {activeTab === 'checkin' && (
        <div className="org-tab-panel">
          <div className="checkin-scanner-box">
            <form onSubmit={handleCheckIn} className="scanner-form">
              <label htmlFor="ticket-input">
                Nhập mã vé QR điện tử (US-19 — Ngăn chặn vé sử dụng lại, vé đã hủy hoặc chưa thanh toán)
              </label>
              <div className="scanner-input-row">
                <input
                  id="ticket-input"
                  type="text"
                  placeholder="Quét mã QR hoặc nhập mã vé (VD: TR-100234)..."
                  value={inputTicketId}
                  onChange={(e) => setInputTicketId(e.target.value)}
                  className="scanner-input"
                  autoFocus
                />
                <button type="submit" className="btn-scanner-submit">
                  XÁC THỰC &amp; CHECK-IN
                </button>
              </div>
            </form>

            {/* Quick sample ticket chips to test all US-19 Acceptance Criteria with 1 click */}
            <div className="org-sample-tickets-bar">
              <span className="org-sample-label">Chọn nhanh mã vé để test đủ các kịch bản US-19:</span>
              <div className="org-sample-chips">
                {ticketsList.slice(0, 6).map((t) => (
                  <button
                    key={t.ticketId}
                    type="button"
                    className="org-sample-chip"
                    onClick={() => setInputTicketId(t.ticketId)}
                  >
                    <code>{t.ticketId}</code> ({t.status || 'ISSUED'})
                  </button>
                ))}
                <button
                  type="button"
                  className="org-sample-chip"
                  onClick={() => setInputTicketId('TR-999999')}
                >
                  <code>TR-999999</code> (Không tồn tại)
                </button>
              </div>
            </div>

            <div className="scanner-stats">
              <div className="stat-box">
                <span className="stat-label">Tổng booking ghi nhận</span>
                <span className="stat-value">{ticketsList.length}</span>
              </div>
              <div className="stat-box">
                <span className="stat-label">Đã qua cổng (Check-in)</span>
                <span className="stat-value text-green">
                  {ticketsList.filter((t) => t.status === 'CHECKED_IN').length}
                </span>
              </div>
              <div className="stat-box">
                <span className="stat-label">Vé hợp lệ chưa dùng</span>
                <span className="stat-value text-blue">
                  {ticketsList.filter((t) => (t.status || 'ISSUED') === 'ISSUED').length}
                </span>
              </div>
              <div className="stat-box">
                <span className="stat-label">Vé đã hủy / Chờ TT</span>
                <span className="stat-value">
                  {ticketsList.filter((t) => t.status === 'REFUNDED' || t.status === 'PENDING_PAYMENT').length}
                </span>
              </div>
            </div>
          </div>

          <div className="checkin-logs-section">
            <h3>Kết Quả Đối Soát Vé Tại Cổng (US-19 AC1, AC2, AC4)</h3>
            {checkInLogs.length === 0 ? (
              <div className="empty-logs">
                Chưa có lượt quét nào trong phiên này. Hãy bấm chọn một mã vé mẫu phía trên rồi nhấn "XÁC THỰC &amp; CHECK-IN".
              </div>
            ) : (
              <div className="logs-table-wrapper">
                <table className="logs-table">
                  <thead>
                    <tr>
                      <th>Thời gian</th>
                      <th>Mã Vé</th>
                      <th>Khách tham dự</th>
                      <th>Email</th>
                      <th>Trạng thái đối soát</th>
                      <th>Lý do chi tiết (US-19 AC2)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {checkInLogs.map((log, idx) => (
                      <tr key={idx}>
                        <td>{log.timestamp}</td>
                        <td><code>{log.ticketId}</code></td>
                        <td>{log.attendeeName}</td>
                        <td>{log.attendeeEmail}</td>
                        <td>
                          {log.status === 'SUCCESS' && (
                            <span className="badge-status-success">HỢP LỆ (VÀO CỔNG)</span>
                          )}
                          {log.status === 'ALREADY_CHECKED_IN' && (
                            <span className="badge-status-danger">VÉ ĐÃ DÙNG RỒI</span>
                          )}
                          {log.status === 'REFUNDED_OR_CANCELLED' && (
                            <span className="badge-status-danger">VÉ ĐÃ HỦY / REFUND</span>
                          )}
                          {log.status === 'PENDING_PAYMENT' && (
                            <span className="badge-status-warning">CHƯA THANH TOÁN</span>
                          )}
                          {log.status === 'UNAUTHORIZED_EVENT' && (
                            <span className="badge-status-danger">KHÔNG CÓ QUYỀN (403)</span>
                          )}
                          {log.status === 'NOT_FOUND' && (
                            <span className="badge-status-warning">KHÔNG TỒN TẠI</span>
                          )}
                        </td>
                        <td>{log.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 4: US-23 — GHI NHẬT KÝ THAO TÁC QUAN TRỌNG (IMMUTABLE AUDIT LOG)
          ===================================================================== */}
      {activeTab === 'audit' && (
        <div className="org-tab-panel">
          <div className="org-panel-toolbar">
            <div>
              <h3>Nhật Ký Kiểm Toán Hệ Thống — Immutable Audit Log (US-23)</h3>
              <p className="org-panel-sub">
                Ghi nhận toàn bộ thao tác tạo/cập nhật sức chứa sự kiện, hủy vé/hoàn tiền, check-in và từ chối phân quyền. Nhật ký ở chế độ chỉ đọc (không cho phép sửa/xóa theo <strong>US-23 AC2</strong>) và tuyệt đối không lưu mật khẩu, token hay thông tin thẻ (<strong>US-23 AC3</strong>).
              </p>
            </div>
            <span className="org-immutable-badge">CHỈ ĐỌC (IMMUTABLE LOG)</span>
          </div>

          <div className="logs-table-wrapper">
            <table className="logs-table">
              <thead>
                <tr>
                  <th>Thời điểm</th>
                  <th>Người thực hiện</th>
                  <th>Vai trò</th>
                  <th>Hành động</th>
                  <th>Đối tượng tác động</th>
                  <th>Chi tiết ghi nhận</th>
                  <th>Kết quả</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((entry) => (
                  <tr key={entry.id}>
                    <td>{entry.timestamp}</td>
                    <td><code>{entry.actor}</code></td>
                    <td><span className="org-reg-pill">{entry.role}</span></td>
                    <td><strong>{entry.action}</strong></td>
                    <td><code>{entry.target}</code></td>
                    <td>{entry.detail}</td>
                    <td>
                      {entry.status === 'SUCCESS' ? (
                        <span className="badge-status-success">THÀNH CÔNG</span>
                      ) : (
                        <span className="badge-status-danger">TỪ CHỐI</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrganizerCheckIn;
