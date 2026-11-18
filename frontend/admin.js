/* ========================================================
   TicketRush - Dashboard JS
   ======================================================== */

const API = 'http://ticketrush-alb-1438253633.ap-southeast-1.elb.amazonaws.com/api';

// Auth Storage
function getToken() { return localStorage.getItem('authToken'); }
function getUser() {
  try { return JSON.parse(localStorage.getItem('currentUser')); }
  catch { return null; }
}

// Client-Side Auth Guard
(function guardAdmin() {
  const token = getToken();
  const user = getUser();
  if (!token || !user || user.role !== 'ADMIN') {
    window.location.href = 'index.html';
  }
})();

// HTTP Client with 401 Interceptor
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

  if (res.status === 401) {
    alert('Your session has expired or is invalid. Please log in again.');
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentUser');
    window.location.href = 'index.html';
    throw new Error('Unauthorized');
  }

  return res;
}

// Helpers
function formatDate(str) {
  if (!str) return '—';
  return new Date(str).toLocaleString('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function formatMoney(amount, currency = '£') {
  return `${currency}${parseFloat(amount).toFixed(2)}`;
}

function showError(id, msg) {
  const el = document.getElementById(id);
  if (el) {
    el.textContent = msg;
    el.style.display = 'block';
  }
}

function hideError(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = 'none';
}

function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Toast Notification
let toastTimer = null;

function showToast(message) {
  const toast = document.getElementById('toast');
  const toastMsg = document.getElementById('toastMessage');
  if (!toast || !toastMsg) return;

  toastMsg.textContent = message;
  toast.classList.add('active');

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove('active');
  }, 3500);
}

// Populate Admin Header Greeting
const currentUser = getUser();
if (currentUser) {
  const fullName = (currentUser.full_name || 'Admin').trim();
  const initial = fullName.charAt(0).toUpperCase();
  const nameParts = fullName.split(/\s+/);
  const displayName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : nameParts[0];

  const avatarEl = document.getElementById('adminAvatar');
  const nameEl = document.getElementById('adminName');
  if (avatarEl) avatarEl.textContent = initial;
  if (nameEl) nameEl.textContent = displayName;
}

// Logout
document.getElementById('logoutBtn').addEventListener('click', () => {
  localStorage.removeItem('authToken');
  localStorage.removeItem('currentUser');
  window.location.href = 'index.html';
});

// Tab Navigation
let eventsCache = [];

document.querySelectorAll('.nav-item').forEach((item) => {
  item.addEventListener('click', (e) => {
    e.preventDefault();
    const tab = item.dataset.tab;

    document.querySelectorAll('.nav-item').forEach((n) => {
      n.classList.remove('active');
      n.setAttribute('aria-selected', 'false');
    });
    document.querySelectorAll('.admin-tab').forEach((t) => t.classList.remove('active'));

    item.classList.add('active');
    item.setAttribute('aria-selected', 'true');
    document.getElementById(`tab-${tab}`).classList.add('active');

    document.getElementById('eventsActions').style.display = tab === 'events' ? 'block' : 'none';
    document.getElementById('bookingsActions').style.display = tab === 'bookings' ? 'flex' : 'none';

    if (tab === 'events') loadEvents();
    if (tab === 'bookings') loadBookings();
  });
});

// ========================================================
// EVENTS TAB
// ========================================================
async function loadEvents() {
  const tbody = document.getElementById('eventsTableBody');
  tbody.innerHTML = '<tr><td colspan="8" class="table-loading">Loading events...</td></tr>';

  try {
    const res = await apiFetch('/events/');
    const data = await res.json();
    eventsCache = data.events || [];
    const countEl = document.getElementById('eventsCount');
    if (countEl) countEl.textContent = eventsCache.length;
    renderEventsTable(eventsCache);
    populateEventFilter(eventsCache);
  } catch (err) {
    if (err.message !== 'Unauthorized') {
      tbody.innerHTML = '<tr><td colspan="8" class="table-loading">Failed to load events.</td></tr>';
    }
  }
}

function renderEventsTable(events) {
  const tbody = document.getElementById('eventsTableBody');
  if (!events.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="table-loading">No events found.</td></tr>';
    return;
  }

  tbody.innerHTML = events.map((ev) => {
    const sold = ev.total_tickets - ev.available_tickets;
    const pct = ev.total_tickets ? ((sold / ev.total_tickets) * 100).toFixed(0) : 0;
    const avClass = ev.available_tickets === 0
      ? 'tickets-sold'
      : ev.available_tickets < 50
        ? 'tickets-low'
        : 'tickets-ok';
    const isCancelled = ev.status === 'CANCELLED';
    const statusBadge = isCancelled
      ? '<span class="badge badge-cancelled">CANCELLED</span>'
      : '<span class="badge badge-confirmed">ACTIVE</span>';
    const actionBtns = isCancelled
      ? '<span class="muted-cell">Cancelled</span>'
      : `<button type="button" class="btn-action" data-action="edit" data-id="${ev.id}">Edit</button>
         <button type="button" class="btn-action" data-action="cancel" data-id="${ev.id}">Cancel</button>
         <button type="button" class="btn-action btn-delete" data-action="delete" data-id="${ev.id}">Delete</button>`;

    return `
      <tr ${isCancelled ? 'style="opacity: 0.6;"' : ''}>
        <td><span class="muted-cell">#${ev.id}</span></td>
        <td>
          <strong>${escHtml(ev.name)}</strong>
          <span class="event-category-sub">${escHtml(ev.category)}</span>
        </td>
        <td>${formatDate(ev.event_date)}</td>
        <td>${escHtml(ev.venue)}</td>
        <td>${formatMoney(ev.price, ev.currency)}</td>
        <td class="${avClass}">
          ${ev.available_tickets}/${ev.total_tickets}
          <span class="tickets-pct">${pct}% sold</span>
        </td>
        <td>${statusBadge}</td>
        <td><div class="action-cell">${actionBtns}</div></td>
      </tr>`;
  }).join('');
}

document.getElementById('eventsTableBody').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;

  const id = parseInt(btn.dataset.id, 10);
  const ev = eventsCache.find((item) => item.id === id);
  if (!ev) return;

  if (btn.dataset.action === 'edit') openEditEvent(id);
  if (btn.dataset.action === 'cancel') openCancelEvent(id, ev.name);
  if (btn.dataset.action === 'delete') openDeleteEvent(id, ev.name);
});

// Create / Edit Event Modal
let editingEventId = null;

document.getElementById('btnNewEvent').addEventListener('click', openCreateEvent);
document.getElementById('closeEventModal').addEventListener('click', closeEventModal);
document.getElementById('cancelEventForm').addEventListener('click', closeEventModal);
document.getElementById('eventForm').addEventListener('submit', submitEventForm);

function openCreateEvent() {
  editingEventId = null;
  document.getElementById('eventModalTitle').textContent = 'Create new event';
  document.getElementById('submitEventBtn').textContent = 'Create event';
  document.getElementById('editEventId').value = '';
  document.getElementById('eventForm').reset();
  document.getElementById('f-category').value = 'Music';
  document.getElementById('f-price').value = '0';
  document.getElementById('f-total-tickets').value = '300';
  hideError('eventFormError');
  document.getElementById('eventModal').classList.add('open');
}

function openEditEvent(id) {
  const ev = eventsCache.find((e) => e.id === id);
  if (!ev) return;

  editingEventId = id;
  document.getElementById('eventModalTitle').textContent = 'Edit event';
  document.getElementById('submitEventBtn').textContent = 'Save changes';
  document.getElementById('editEventId').value = id;
  document.getElementById('f-name').value = ev.name;
  document.getElementById('f-category').value = ev.category;
  document.getElementById('f-venue').value = ev.venue;
  document.getElementById('f-description').value = ev.description || '';
  document.getElementById('f-price').value = ev.price;
  document.getElementById('f-total-tickets').value = ev.total_tickets;
  document.getElementById('f-image-url').value = ev.image_url || '';

  const d = new Date(ev.event_date);
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
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
  btn.textContent = 'Saving...';

  const body = {
    name: document.getElementById('f-name').value.trim(),
    category: document.getElementById('f-category').value.trim() || 'Music',
    venue: document.getElementById('f-venue').value.trim(),
    description: document.getElementById('f-description').value.trim() || null,
    price: parseFloat(document.getElementById('f-price').value) || 0,
    total_tickets: parseInt(document.getElementById('f-total-tickets').value, 10),
    image_url: document.getElementById('f-image-url').value.trim() || null,
    event_date: document.getElementById('f-event-date').value,
    currency: '£',
  };

  try {
    const isEdit = Boolean(editingEventId);
    const res = isEdit
      ? await apiFetch(`/admin/events/${editingEventId}`, { method: 'PUT', body: JSON.stringify(body) })
      : await apiFetch('/admin/events', { method: 'POST', body: JSON.stringify(body) });

    if (res.ok) {
      closeEventModal();
      loadEvents();
      showToast(isEdit ? 'Event updated successfully.' : 'Event created successfully.');
    } else {
      const err = await res.json();
      showError('eventFormError', err.detail || 'Something went wrong.');
    }
  } catch (err) {
    if (err.message !== 'Unauthorized') {
      showError('eventFormError', 'Unable to connect to the server.');
    }
  } finally {
    btn.disabled = false;
    btn.textContent = editingEventId ? 'Save changes' : 'Create event';
  }
}

// Cancel Event Modal
let cancellingEventId = null;

document.getElementById('closeCancelEventModal').addEventListener('click', closeCancelEventModal);
document.getElementById('cancelCancelEvent').addEventListener('click', closeCancelEventModal);
document.getElementById('confirmCancelEvent').addEventListener('click', doCancelEvent);

function openCancelEvent(id, name) {
  cancellingEventId = id;
  document.getElementById('cancelEventModalMsg').textContent =
    `Are you sure you want to cancel "${name}"?`;
  hideError('cancelEventModalError');
  document.getElementById('cancelEventModal').classList.add('open');
}

function closeCancelEventModal() {
  document.getElementById('cancelEventModal').classList.remove('open');
}

async function doCancelEvent() {
  if (!cancellingEventId) return;
  const btn = document.getElementById('confirmCancelEvent');
  btn.disabled = true;
  btn.textContent = 'Cancelling...';
  hideError('cancelEventModalError');

  try {
    const res = await apiFetch(`/admin/events/${cancellingEventId}/cancel`, { method: 'PATCH' });
    if (res.ok) {
      const data = await res.json();
      closeCancelEventModal();
      loadEvents();
      showToast(`${data.message} (${data.cancelled_bookings} booking(s) cancelled).`);
    } else {
      const err = await res.json();
      showError('cancelEventModalError', err.detail || 'Failed to cancel event.');
    }
  } catch (err) {
    if (err.message !== 'Unauthorized') {
      showError('cancelEventModalError', 'Unable to connect to the server.');
    }
  } finally {
    btn.disabled = false;
    btn.textContent = 'Cancel event';
  }
}

// Delete Event Modal
let deletingEventId = null;

document.getElementById('closeDeleteModal').addEventListener('click', closeDeleteModal);
document.getElementById('cancelDelete').addEventListener('click', closeDeleteModal);
document.getElementById('confirmDelete').addEventListener('click', doDeleteEvent);

function openDeleteEvent(id, name) {
  deletingEventId = id;
  document.getElementById('deleteModalMsg').textContent =
    `Are you sure you want to delete "${name}"? This action cannot be undone.`;
  hideError('deleteModalError');
  document.getElementById('deleteModal').classList.add('open');
}

function closeDeleteModal() {
  document.getElementById('deleteModal').classList.remove('open');
}

async function doDeleteEvent() {
  if (!deletingEventId) return;
  const btn = document.getElementById('confirmDelete');
  btn.disabled = true;
  btn.textContent = 'Deleting...';
  hideError('deleteModalError');

  try {
    const res = await apiFetch(`/admin/events/${deletingEventId}`, { method: 'DELETE' });
    if (res.ok) {
      closeDeleteModal();
      loadEvents();
      showToast('Event deleted.');
    } else {
      const err = await res.json();
      showError('deleteModalError', err.detail || 'Failed to delete event.');
    }
  } catch (err) {
    if (err.message !== 'Unauthorized') {
      showError('deleteModalError', 'Unable to connect to the server.');
    }
  } finally {
    btn.disabled = false;
    btn.textContent = 'Delete';
  }
}

// ========================================================
// BOOKINGS TAB
// ========================================================
let bookingsEventMap = {};

function populateEventFilter(events) {
  const sel = document.getElementById('filterEvent');
  const currentValue = sel.value;
  sel.innerHTML = '<option value="">All events</option>';

  events.forEach((ev) => {
    const opt = document.createElement('option');
    opt.value = ev.id;
    opt.textContent = ev.name;
    sel.appendChild(opt);
    bookingsEventMap[ev.id] = ev.name;
  });

  if (currentValue) sel.value = currentValue;
}

document.getElementById('filterEvent').addEventListener('change', (e) => {
  const btn = document.getElementById('btnExportAllCSV');
  if (btn) {
    btn.textContent = e.target.value ? 'Export event CSV' : 'Export all CSV';
  }
  loadBookings();
});

async function refreshBookingsCount() {
  try {
    const res = await apiFetch('/admin/bookings');
    if (!res.ok) return;
    const data = await res.json();
    const countEl = document.getElementById('bookingsCount');
    if (countEl) countEl.textContent = data.total ?? (data.bookings ? data.bookings.length : 0);
  } catch {
    // Ignore background count errors; explicit tab load handles user feedback.
  }
}

async function loadBookings() {
  const tbody = document.getElementById('bookingsTableBody');
  const meta = document.getElementById('bookingsMeta');
  tbody.innerHTML = '<tr><td colspan="10" class="table-loading">Loading bookings...</td></tr>';
  meta.style.display = 'none';

  const eventId = document.getElementById('filterEvent').value;
  const path = eventId ? `/admin/bookings?event_id=${eventId}` : '/admin/bookings';

  try {
    const res = await apiFetch(path);
    if (!res.ok) throw new Error();
    const data = await res.json();

    if (!eventId) {
      const countEl = document.getElementById('bookingsCount');
      if (countEl) countEl.textContent = data.total ?? data.bookings.length;
    }

    if (data.event_name) {
      meta.textContent = `Event: ${data.event_name} — ${data.total} booking${data.total === 1 ? '' : 's'}`;
      meta.style.display = 'block';
    }

    renderBookingsTable(data.bookings);
  } catch (err) {
    if (err.message !== 'Unauthorized') {
      tbody.innerHTML = '<tr><td colspan="10" class="table-loading">Failed to load bookings.</td></tr>';
    }
  }
}

function renderBookingsTable(bookings) {
  const tbody = document.getElementById('bookingsTableBody');
  if (!bookings.length) {
    tbody.innerHTML = '<tr><td colspan="10" class="table-loading">No bookings found.</td></tr>';
    return;
  }

  tbody.innerHTML = bookings.map((b) => {
    const badgeClass = b.status === 'CONFIRMED' ? 'badge-confirmed' : 'badge-cancelled';
    const eventName = bookingsEventMap[b.event_id] || `#${b.event_id}`;
    const tier = b.ticket_tier || 'STANDARD';
    const tierBadge = `<span class="tier-badge tier-badge-${escHtml(tier.toLowerCase())}">${escHtml(tier)}</span>`;
    const exportBtn = `<button type="button" class="btn-action" data-action="export" data-event-id="${b.event_id}">CSV</button>`;
    const emailBtn = b.status === 'CONFIRMED'
      ? `<button type="button" class="btn-action" data-action="send-qr" data-booking-id="${b.id}">Send QR</button>`
      : '<span class="muted-cell">Unavailable</span>';

    return `
      <tr>
        <td><code class="booking-ref-code">${escHtml(b.booking_code)}</code></td>
        <td>${escHtml(b.buyer_name)}</td>
        <td><a class="booking-email-link" href="mailto:${escHtml(b.buyer_email)}">${escHtml(b.buyer_email)}</a></td>
        <td>${escHtml(eventName)}</td>
        <td>
          <div class="booking-qty-cell">
            <span>${b.quantity}</span>
            ${tierBadge}
          </div>
        </td>
        <td>${formatMoney(b.total_amount, b.currency)}</td>
        <td><span class="badge ${badgeClass}">${escHtml(b.status)}</span></td>
        <td>${formatDate(b.created_at)}</td>
        <td>${exportBtn}</td>
        <td>${emailBtn}</td>
      </tr>`;
  }).join('');
}

document.getElementById('bookingsTableBody').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;

  if (btn.dataset.action === 'export') {
    const eventId = parseInt(btn.dataset.eventId, 10);
    exportCSV(eventId);
  }
  if (btn.dataset.action === 'send-qr') {
    const bookingId = parseInt(btn.dataset.bookingId, 10);
    sendTicketEmail(bookingId, btn);
  }
});

async function sendTicketEmail(bookingId, button) {
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = 'Sending...';

  try {
    const res = await apiFetch(`/admin/bookings/${bookingId}/send-tickets`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok) {
      alert(data.detail || 'Failed to send QR tickets.');
      return;
    }
    showToast(`Sent ${data.tickets_sent} QR ticket(s) to ${data.recipient}.`);
  } catch (err) {
    if (err.message !== 'Unauthorized') {
      alert('Unable to connect to the server while sending QR tickets.');
    }
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

// Export CSV
async function exportCSV(eventId = null) {
  const btn = document.getElementById('btnExportAllCSV');
  const originalText = btn ? btn.textContent : '';
  if (btn && !eventId) {
    btn.disabled = true;
    btn.textContent = 'Exporting...';
  }

  try {
    const path = eventId ? `/admin/bookings/export?event_id=${eventId}` : '/admin/bookings/export';
    const res = await apiFetch(path);
    if (!res.ok) {
      alert('Failed to export CSV.');
      return;
    }
    const blob = await res.blob();
    const filename = res.headers.get('Content-Disposition')
      ?.match(/filename="(.+)"/)?.[1] || (eventId ? `event_${eventId}_attendees.csv` : 'all_bookings_report.csv');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Exported ${filename}.`);
  } catch (err) {
    if (err.message !== 'Unauthorized') {
      alert('Unable to connect to the server.');
    }
  } finally {
    if (btn && !eventId) {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  }
}

const exportAllBtn = document.getElementById('btnExportAllCSV');
if (exportAllBtn) {
  exportAllBtn.addEventListener('click', () => {
    const selectedEventId = document.getElementById('filterEvent').value;
    exportCSV(selectedEventId ? parseInt(selectedEventId, 10) : null);
  });
}

// Close modals on Escape
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  closeEventModal();
  closeCancelEventModal();
  closeDeleteModal();
});

// Init
loadEvents();
refreshBookingsCount();
