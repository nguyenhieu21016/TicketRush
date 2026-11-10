/* ========================================================
   TicketRush — Admin Panel JS (Enterprise Architecture)
   ======================================================== */

const API = 'http://127.0.0.1:8000/api';

// ── Auth Storage ─────────────────────────────────────────────
function getToken() { return localStorage.getItem('authToken'); }
function getUser()  {
  try { return JSON.parse(localStorage.getItem('currentUser')); }
  catch { return null; }
}

// ── Client-Side Auth Guard ───────────────────────────────────
(function guardAdmin() {
  const token = getToken();
  const user  = getUser();
  if (!token || !user || user.role !== 'ADMIN') {
    alert('Bạn cần đăng nhập với tài khoản Admin để truy cập trang này.');
    window.location.href = 'index.html';
  }
})();

// ── Enterprise HTTP Client (with 401 Interceptor) ────────────
async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const res = await fetch(`${API}${path}`, {
    ...options,
    headers,
  });

  // Interceptor: xử lý tập trung khi phiên đăng nhập hết hạn hoặc không hợp lệ
  if (res.status === 401) {
    alert('Phiên làm việc đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.');
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentUser');
    window.location.href = 'index.html';
    throw new Error('Unauthorized');
  }

  return res;
}

// ── Helpers ──────────────────────────────────────────────────
function formatDate(str) {
  if (!str) return '—';
  return new Date(str).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
}

function formatMoney(amount, currency = '£') {
  return `${currency}${parseFloat(amount).toFixed(2)}`;
}

function showError(id, msg) {
  const el = document.getElementById(id);
  if (el) { el.textContent = msg; el.style.display = 'block'; }
}
function hideError(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = 'none';
}

// ── Populate admin info ──────────────────────────────────────
const user = getUser();
if (user) {
  document.getElementById('adminName').textContent  = user.full_name || 'Admin';
  document.getElementById('adminEmail').textContent = user.email || '';
}

// ── Logout ───────────────────────────────────────────────────
document.getElementById('logoutBtn').addEventListener('click', () => {
  localStorage.removeItem('authToken');
  localStorage.removeItem('currentUser');
  window.location.href = 'index.html';
});

// ── Tab Navigation ───────────────────────────────────────────
let eventsCache = [];

document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', e => {
    e.preventDefault();
    const tab = item.dataset.tab;

    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));

    item.classList.add('active');
    document.getElementById(`tab-${tab}`).classList.add('active');

    if (tab === 'events')   loadEvents();
    if (tab === 'bookings') loadBookings();
  });
});

// ════════════════════════════════════════════════════════════
// EVENTS TAB
// ════════════════════════════════════════════════════════════
async function loadEvents() {
  const tbody = document.getElementById('eventsTableBody');
  tbody.innerHTML = '<tr><td colspan="8" class="table-loading">Đang tải...</td></tr>';

  try {
    const res = await apiFetch('/events/');
    const data = await res.json();
    eventsCache = data.events || [];
    renderEventsTable(eventsCache);
    populateEventFilter(eventsCache);
  } catch (err) {
    if (err.message !== 'Unauthorized') {
      tbody.innerHTML = '<tr><td colspan="8" class="table-loading">Lỗi tải dữ liệu.</td></tr>';
    }
  }
}

function renderEventsTable(events) {
  const tbody = document.getElementById('eventsTableBody');
  if (!events.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="table-loading">Chưa có sự kiện nào.</td></tr>';
    return;
  }
  tbody.innerHTML = events.map(ev => {
    const sold = ev.total_tickets - ev.available_tickets;
    const pct  = ev.total_tickets ? (sold / ev.total_tickets * 100).toFixed(0) : 0;
    const avClass = ev.available_tickets === 0 ? 'tickets-sold'
                  : ev.available_tickets < 50  ? 'tickets-low' : 'tickets-ok';
    const isCancelled = ev.status === 'CANCELLED';
    const statusBadge = isCancelled
      ? '<span class="badge badge-cancelled">HỦY</span>'
      : '<span class="badge badge-confirmed">ACTIVE</span>';
    const actionBtns = isCancelled
      ? '<span style="color:var(--text-light);font-size:12px">Đã hủy</span>'
      : `<button class="btn-action btn-edit" onclick="openEditEvent(${ev.id})">✏️ Sửa</button>
         <button class="btn-action btn-cancel-ev" onclick="openCancelEvent(${ev.id},'${escHtml(ev.name)}')">🚫 Hủy</button>
         <button class="btn-action btn-delete" onclick="openDeleteEvent(${ev.id},'${escHtml(ev.name)}')">🗑️ Xóa</button>`;
    return `
      <tr ${isCancelled ? 'style="opacity:0.6"' : ''}>
        <td><span style="color:var(--text-muted)">#${ev.id}</span></td>
        <td><strong>${escHtml(ev.name)}</strong><br>
            <small style="color:var(--text-muted)">${escHtml(ev.category)}</small></td>
        <td>${formatDate(ev.event_date)}</td>
        <td>${escHtml(ev.venue)}</td>
        <td>${formatMoney(ev.price, ev.currency)}</td>
        <td class="${avClass}">${ev.available_tickets}/${ev.total_tickets}
            <small>(${pct}% sold)</small></td>
        <td>${statusBadge}</td>
        <td><div class="action-cell">${actionBtns}</div></td>
      </tr>`;
  }).join('');
}

// ── Create / Edit Event Modal ─────────────────────────────────
let editingEventId = null;

document.getElementById('btnNewEvent').addEventListener('click', openCreateEvent);
document.getElementById('closeEventModal').addEventListener('click', closeEventModal);
document.getElementById('cancelEventForm').addEventListener('click', closeEventModal);
document.getElementById('eventForm').addEventListener('submit', submitEventForm);

function openCreateEvent() {
  editingEventId = null;
  document.getElementById('eventModalTitle').textContent = 'Tạo sự kiện mới';
  document.getElementById('submitEventBtn').textContent  = 'Tạo sự kiện';
  document.getElementById('editEventId').value = '';
  document.getElementById('eventForm').reset();
  document.getElementById('f-category').value = 'Music';
  document.getElementById('f-price').value     = '0';
  document.getElementById('f-total-tickets').value = '300';
  hideError('eventFormError');
  document.getElementById('eventModal').classList.add('open');
}

function openEditEvent(id) {
  const ev = eventsCache.find(e => e.id === id);
  if (!ev) return;
  editingEventId = id;
  document.getElementById('eventModalTitle').textContent = 'Sửa sự kiện';
  document.getElementById('submitEventBtn').textContent  = 'Lưu thay đổi';
  document.getElementById('editEventId').value     = id;
  document.getElementById('f-name').value          = ev.name;
  document.getElementById('f-category').value      = ev.category;
  document.getElementById('f-venue').value         = ev.venue;
  document.getElementById('f-description').value   = ev.description || '';
  document.getElementById('f-price').value         = ev.price;
  document.getElementById('f-total-tickets').value = ev.total_tickets;
  document.getElementById('f-image-url').value     = ev.image_url || '';
  const d = new Date(ev.event_date);
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString().slice(0, 16);
  document.getElementById('f-event-date').value = local;
  hideError('eventFormError');
  document.getElementById('eventModal').classList.add('open');
}

function closeEventModal() {
  document.getElementById('eventModal').classList.remove('open');
}

async function submitEventForm(e) {
  e.preventDefault();
  hideError('eventFormError');

  const btn = document.getElementById('submitEventBtn');
  btn.disabled = true;
  btn.textContent = 'Đang lưu...';

  const body = {
    name:          document.getElementById('f-name').value.trim(),
    category:      document.getElementById('f-category').value.trim() || 'Music',
    venue:         document.getElementById('f-venue').value.trim(),
    description:   document.getElementById('f-description').value.trim() || null,
    price:         parseFloat(document.getElementById('f-price').value) || 0,
    total_tickets: parseInt(document.getElementById('f-total-tickets').value),
    image_url:     document.getElementById('f-image-url').value.trim() || null,
    event_date:    document.getElementById('f-event-date').value,
    currency:      '£',
  };

  try {
    const res = editingEventId
      ? await apiFetch(`/admin/events/${editingEventId}`, { method: 'PUT', body: JSON.stringify(body) })
      : await apiFetch('/admin/events', { method: 'POST', body: JSON.stringify(body) });

    if (res.ok) {
      closeEventModal();
      loadEvents();
    } else {
      const err = await res.json();
      showError('eventFormError', err.detail || 'Có lỗi xảy ra.');
    }
  } catch (err) {
    if (err.message !== 'Unauthorized') {
      showError('eventFormError', 'Không thể kết nối server.');
    }
  } finally {
    btn.disabled = false;
    btn.textContent = editingEventId ? 'Lưu thay đổi' : 'Tạo sự kiện';
  }
}

// ── Cancel Event Modal ───────────────────────────────────────
let cancellingEventId = null;

document.getElementById('closeCancelEventModal').addEventListener('click', closeCancelEventModal);
document.getElementById('cancelCancelEvent').addEventListener('click', closeCancelEventModal);
document.getElementById('confirmCancelEvent').addEventListener('click', doCancelEvent);

function openCancelEvent(id, name) {
  cancellingEventId = id;
  document.getElementById('cancelEventModalMsg').textContent =
    `Bạn có chắc muốn HỦY sự kiện "${name}"?`;
  hideError('cancelEventModalError');
  document.getElementById('cancelEventModal').classList.add('open');
}
function closeCancelEventModal() {
  document.getElementById('cancelEventModal').classList.remove('open');
}

async function doCancelEvent() {
  if (!cancellingEventId) return;
  const btn = document.getElementById('confirmCancelEvent');
  btn.disabled = true; btn.textContent = 'Đang hủy...';
  hideError('cancelEventModalError');

  try {
    const res = await apiFetch(`/admin/events/${cancellingEventId}/cancel`, { method: 'PATCH' });
    if (res.ok) {
      const data = await res.json();
      closeCancelEventModal();
      loadEvents();
      alert(`✅ ${data.message}\n📋 Đã hủy ${data.cancelled_bookings} booking.`);
    } else {
      const err = await res.json();
      showError('cancelEventModalError', err.detail || 'Không thể hủy sự kiện.');
    }
  } catch (err) {
    if (err.message !== 'Unauthorized') {
      showError('cancelEventModalError', 'Không thể kết nối server.');
    }
  } finally {
    btn.disabled = false; btn.textContent = 'Hủy sự kiện';
  }
}

// ── Delete Event Modal ────────────────────────────────────────
let deletingEventId = null;

document.getElementById('closeDeleteModal').addEventListener('click', closeDeleteModal);
document.getElementById('cancelDelete').addEventListener('click', closeDeleteModal);
document.getElementById('confirmDelete').addEventListener('click', doDeleteEvent);

function openDeleteEvent(id, name) {
  deletingEventId = id;
  document.getElementById('deleteModalMsg').textContent =
    `Bạn có chắc muốn xóa sự kiện "${name}"? Hành động này không thể hoàn tác.`;
  hideError('deleteModalError');
  document.getElementById('deleteModal').classList.add('open');
}
function closeDeleteModal() {
  document.getElementById('deleteModal').classList.remove('open');
}

async function doDeleteEvent() {
  if (!deletingEventId) return;
  const btn = document.getElementById('confirmDelete');
  btn.disabled = true; btn.textContent = 'Đang xóa...';
  hideError('deleteModalError');

  try {
    const res = await apiFetch(`/admin/events/${deletingEventId}`, { method: 'DELETE' });
    if (res.ok) {
      closeDeleteModal();
      loadEvents();
    } else {
      const err = await res.json();
      showError('deleteModalError', err.detail || 'Không thể xóa.');
    }
  } catch (err) {
    if (err.message !== 'Unauthorized') {
      showError('deleteModalError', 'Không thể kết nối server.');
    }
  } finally {
    btn.disabled = false; btn.textContent = 'Xóa';
  }
}

// ════════════════════════════════════════════════════════════
// BOOKINGS TAB
// ════════════════════════════════════════════════════════════
let bookingsEventMap = {};

function populateEventFilter(events) {
  const sel = document.getElementById('filterEvent');
  sel.innerHTML = '<option value="">Tất cả sự kiện</option>';
  events.forEach(ev => {
    const opt = document.createElement('option');
    opt.value = ev.id;
    opt.textContent = ev.name;
    sel.appendChild(opt);
    bookingsEventMap[ev.id] = ev.name;
  });
}

document.getElementById('filterEvent').addEventListener('change', loadBookings);

async function loadBookings() {
  const tbody = document.getElementById('bookingsTableBody');
  const meta  = document.getElementById('bookingsMeta');
  tbody.innerHTML = '<tr><td colspan="9" class="table-loading">Đang tải...</td></tr>';
  meta.style.display = 'none';

  const eventId = document.getElementById('filterEvent').value;
  const path = eventId ? `/admin/bookings?event_id=${eventId}` : '/admin/bookings';

  try {
    const res = await apiFetch(path);
    if (!res.ok) throw new Error();
    const data = await res.json();

    if (data.event_name) {
      meta.textContent = `📅 Sự kiện: ${data.event_name} — ${data.total} booking`;
      meta.style.display = 'block';
    }

    renderBookingsTable(data.bookings, eventId);
  } catch (err) {
    if (err.message !== 'Unauthorized') {
      tbody.innerHTML = '<tr><td colspan="9" class="table-loading">Lỗi tải dữ liệu.</td></tr>';
    }
  }
}

function renderBookingsTable(bookings, filteredEventId) {
  const tbody = document.getElementById('bookingsTableBody');
  if (!bookings.length) {
    tbody.innerHTML = '<tr><td colspan="9" class="table-loading">Chưa có booking nào.</td></tr>';
    return;
  }
  tbody.innerHTML = bookings.map(b => {
    const badgeClass = b.status === 'CONFIRMED' ? 'badge-confirmed' : 'badge-cancelled';
    const eventName  = bookingsEventMap[b.event_id] || `#${b.event_id}`;
    const exportBtn  = filteredEventId
      ? `<button class="btn-action btn-export" onclick="exportCSV(${b.event_id})">⬇️ CSV</button>`
      : `<button class="btn-action btn-export" onclick="exportCSV(${b.event_id})">⬇️ CSV</button>`;
    return `
      <tr>
        <td><code style="font-size:11px">${escHtml(b.booking_code)}</code></td>
        <td>${escHtml(b.buyer_name)}</td>
        <td><a href="mailto:${escHtml(b.buyer_email)}">${escHtml(b.buyer_email)}</a></td>
        <td>${escHtml(eventName)}</td>
        <td>${b.quantity}</td>
        <td>${formatMoney(b.total_amount, b.currency)}</td>
        <td><span class="badge ${badgeClass}">${b.status}</span></td>
        <td>${formatDate(b.created_at)}</td>
        <td>${exportBtn}</td>
      </tr>`;
  }).join('');
}

// ── Export CSV ────────────────────────────────────────────────
async function exportCSV(eventId) {
  try {
    const res = await apiFetch(`/admin/events/${eventId}/export`);
    if (!res.ok) { alert('Không thể xuất CSV.'); return; }
    const blob = await res.blob();
    const filename = res.headers.get('Content-Disposition')
      ?.match(/filename="(.+)"/)?.[1] || `event_${eventId}_bookings.csv`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    if (err.message !== 'Unauthorized') {
      alert('Lỗi kết nối server.');
    }
  }
}

// ── Escape HTML ───────────────────────────────────────────────
function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Init ──────────────────────────────────────────────────────
loadEvents();
