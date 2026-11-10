/**
 * TicketRush — Interactive Event Application
 * Vanilla JavaScript (ES6+)
 */

// Event Dataset — ban đầu để rỗng để lấy từ API backend
let EVENTS_DATA = [];

// Gọi API lấy danh sách sự kiện từ Backend FastAPI

async function fetchEventsFromAPI() {
  try {
    const response = await fetch('http://localhost:8000/api/events/');

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    // Convert API data into frontend format
    EVENTS_DATA = (data.events || []).map(event => {
      const eventDate = new Date(event.event_date);

      return {
        id: event.id,
        title: event.name,
        description: event.description,
        category: event.category,
        venue: event.venue,
        image: event.image_url,

        totalTickets: Number(event.total_tickets),
        availableTickets: Number(event.available_tickets),

        dateRank: eventDate.getTime(),
        month: eventDate.toLocaleDateString('en-US', {
          month: 'short'
        }).toUpperCase(),
        day: String(eventDate.getDate()).padStart(2, '0'),
        weekday: eventDate.toLocaleDateString('en-US', {
          weekday: 'short'
        }).toUpperCase(),

        price: Number(event.price),
        currency: event.currency
      };
    });

    state.totalEventsCount = data.total || EVENTS_DATA.length;

  } catch (error) {
    console.error('Failed to fetch events:', error);
    EVENTS_DATA = [];
    state.totalEventsCount = 0;
  }

  render();
}


// App State
const state = {
  searchQuery: '',
  sortOrder: 'soonest', // 'soonest', 'price-low', 'price-high', 'name'
  currentPage: 1,
  pageSize: 6,
  totalEventsCount: 48, // Visual match for the 48 total in London
  selectedEvent: null,
  // ticketTierMultiplier: 1,
  ticketQuantity: 1,
  // bookingFee: 2.50
  currentUser: JSON.parse(localStorage.getItem('currentUser') || 'null'),
  authToken: localStorage.getItem('authToken') || null
};

// DOM Elements
const elements = {
  eventsGrid: document.getElementById('eventsGrid'),
  emptyState: document.getElementById('emptyState'),
  searchInput: document.getElementById('searchInput'),
  searchClearBtn: document.getElementById('searchClearBtn'),
  shortcutBadge: document.getElementById('shortcutBadge'),
  resetSearchBtn: document.getElementById('resetSearchBtn'),
  sortDropdown: document.getElementById('sortDropdown'),
  sortDropdownTrigger: document.getElementById('sortDropdownTrigger'),
  sortDropdownMenu: document.getElementById('sortDropdownMenu'),
  currentSortText: document.getElementById('currentSortText'),
  eventsCountBadge: document.getElementById('eventsCountBadge'),
  resultsSummary: document.getElementById('resultsSummary'),
  prevPageBtn: document.getElementById('prevPageBtn'),
  nextPageBtn: document.getElementById('nextPageBtn'),
  pageNumbers: document.getElementById('pageNumbers'),
  bookingStockInfo: document.getElementById('bookingStockInfo'),
  eventsView: document.getElementById('eventsView'),
  purchasedTicketsView: document.getElementById('purchasedTicketsView'),
  purchasedTicketsList: document.getElementById('purchasedTicketsList'),
  ticketsStatus: document.getElementById('ticketsStatus'),
  backToEvents: document.getElementById('backToEvents'),

  // Modals
  bookingModalBackdrop: document.getElementById('bookingModalBackdrop'),
  closeBookingModal: document.getElementById('closeBookingModal'),
  bookingImg: document.getElementById('bookingImg'),
  bookingDate: document.getElementById('bookingDate'),
  bookingEventTitle: document.getElementById('bookingEventTitle'),
  bookingVenue: document.getElementById('bookingVenue'),
  qtyMinus: document.getElementById('qtyMinus'),
  qtyPlus: document.getElementById('qtyPlus'),
  qtyVal: document.getElementById('qtyVal'),
  summarySubtotal: document.getElementById('summarySubtotal'),
  summaryTotal: document.getElementById('summaryTotal'),
  bookingCustomerInfo: document.getElementById('bookingCustomerInfo'),
  bookingUserAvatar: document.getElementById('bookingUserAvatar'),
  bookingUserName: document.getElementById('bookingUserName'),
  bookingUserEmail: document.getElementById('bookingUserEmail'),
  btnConfirmBooking: document.getElementById('btnConfirmBooking'),

  // Auth
  authActions: document.getElementById('authActions'),
  authModalBackdrop: document.getElementById('authModalBackdrop'),
  closeAuthModal: document.getElementById('closeAuthModal'),
  btnLogIn: document.getElementById('btnLogIn'),
  btnSignUp: document.getElementById('btnSignUp'),
  tabLogIn: document.getElementById('tabLogIn'),
  tabSignUp: document.getElementById('tabSignUp'),
  authSubmitBtn: document.getElementById('authSubmitBtn'),
  authFooterText: document.getElementById('authFooterText'),
  authForm: document.getElementById('authForm'),
  fullNameGroup: document.getElementById('fullNameGroup'),
  authFullName: document.getElementById('authFullName'),
  authEmail: document.getElementById('authEmail'),
  authPassword: document.getElementById('authPassword'),

  // Toast
  toastNotification: document.getElementById('toastNotification'),
  toastMessage: document.getElementById('toastMessage')
};

// Initialize Application
function init() {
  bindEvents();
  renderAuthUI();
  render(); // vẽ ban đầu (rỗng)
  fetchEventsFromAPI(); // gọi API lấy dữ liệu thật
}

// Event Bindings
function bindEvents() {
  // Search
  elements.searchInput.addEventListener('input', handleSearchInput);
  elements.searchClearBtn.addEventListener('click', handleSearchClear);
  elements.resetSearchBtn.addEventListener('click', handleSearchClear);

  // Global Keyboard Shortcuts (⌘K / Ctrl+K, Escape)
  window.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      elements.searchInput.focus();
    } else if (e.key === 'Escape') {
      closeAllModals();
      closeDropdown();
      if (document.activeElement === elements.searchInput) {
        elements.searchInput.blur();
      }
    }
  });

  // Sort Dropdown
  elements.sortDropdownTrigger.addEventListener('click', (e) => {
    e.stopPropagation();
    elements.sortDropdown.classList.toggle('open');
  });

  elements.sortDropdownMenu.querySelectorAll('.dropdown-item').forEach(item => {
    item.addEventListener('click', () => {
      const sortType = item.getAttribute('data-sort');
      setSortOrder(sortType, item.textContent.trim());
    });
  });

  document.addEventListener('click', () => {
    closeDropdown();
  });

  // Pagination
  elements.prevPageBtn.addEventListener('click', () => {
    if (state.currentPage > 1) {
      setPage(state.currentPage - 1);
    }
  });

  elements.nextPageBtn.addEventListener('click', () => {
    const totalPages = Math.ceil(getFilteredEvents().length / state.pageSize) || 1;
    if (state.currentPage < totalPages) {
      setPage(state.currentPage + 1);
    }
  });

  elements.backToEvents.addEventListener('click', showEventsView);

  // Booking Modal
  elements.closeBookingModal.addEventListener('click', closeAllModals);
  elements.bookingModalBackdrop.addEventListener('click', (e) => {
    if (e.target === elements.bookingModalBackdrop) closeAllModals();
  });

  elements.qtyMinus.addEventListener('click', () => {
    if (state.ticketQuantity > 1) {
      state.ticketQuantity--;
      elements.qtyVal.textContent = state.ticketQuantity;
      updateBookingTotals();
    }
  });

  elements.qtyPlus.addEventListener('click', () => {
    const maxQuantity = Math.min(
      10,
      state.selectedEvent.availableTickets
    );

    if (state.ticketQuantity < maxQuantity) {
      state.ticketQuantity++;
      elements.qtyVal.textContent = state.ticketQuantity;
      updateBookingTotals();
    }
  });


  elements.btnConfirmBooking.addEventListener('click', async () => {
    // 1. Kiểm tra đăng nhập
    if (!state.currentUser || !state.authToken) {
      closeAllModals();
      openAuthModal('login');
      showToast('Please log in to book tickets.');
      return;
    }

    if (!state.selectedEvent) {
      showToast('Please select an event first.');
      return;
    }

    const button = elements.btnConfirmBooking;

    // Prevent duplicate submissions
    button.disabled = true;
    button.textContent = 'Processing...';

    try {
      // 2. Prepare booking request (Lấy thẳng tên và email từ tài khoản đang đăng nhập)
      const bookingData = {
        event_id: state.selectedEvent.id,
        buyer_name: state.currentUser.full_name,
        buyer_email: state.currentUser.email,
        quantity: state.ticketQuantity
      };

      // 3. Send request to Backend kèm Bearer Token
      const response = await fetch(
        'http://localhost:8000/api/bookings/',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${state.authToken}`
          },
          body: JSON.stringify(bookingData)
        }
      );

      const result = await response.json();

      // 4. Handle API errors
      if (!response.ok) {
        const detail = Array.isArray(result.detail)
          ? result.detail.map(error => error.msg).join(', ')
          : result.detail;

        throw new Error(detail || `HTTP ${response.status}`);
      }

      // 5. Booking successful
      console.log('Booking response:', result);

      closeAllModals();

      showToast(
        `Booking confirmed! Code: ${result.booking_code}`
      );

      // Refresh events from Backend
      await fetchEventsFromAPI();

    } catch (error) {
      console.error('Booking failed:', error);
      showToast(error.message || 'Unable to complete booking.');
    } finally {
      button.disabled = false;
      button.textContent = 'Proceed to Checkout';
    }
  });


  // Auth Modals
  elements.closeAuthModal.addEventListener('click', closeAllModals);
  elements.authModalBackdrop.addEventListener('click', (e) => {
    if (e.target === elements.authModalBackdrop) closeAllModals();
  });

  elements.tabLogIn.addEventListener('click', () => setAuthTab('login'));
  elements.tabSignUp.addEventListener('click', () => setAuthTab('signup'));
  elements.authForm.addEventListener('submit', handleAuthSubmit);
}

// Dropdown Helper
function closeDropdown() {
  elements.sortDropdown.classList.remove('open');
}

// Search Handler
function handleSearchInput(e) {
  state.searchQuery = e.target.value.trim().toLowerCase();
  state.currentPage = 1;

  if (state.searchQuery.length > 0) {
    elements.searchClearBtn.style.display = 'block';
    elements.shortcutBadge.style.opacity = '0';
  } else {
    elements.searchClearBtn.style.display = 'none';
    elements.shortcutBadge.style.opacity = '1';
  }

  render();
}

function handleSearchClear() {
  elements.searchInput.value = '';
  state.searchQuery = '';
  state.currentPage = 1;
  elements.searchClearBtn.style.display = 'none';
  elements.shortcutBadge.style.opacity = '1';
  elements.searchInput.focus();
  render();
}

// Sort Handler
function setSortOrder(sortKey, sortLabel) {
  state.sortOrder = sortKey;
  elements.currentSortText.textContent = sortLabel;

  elements.sortDropdownMenu.querySelectorAll('.dropdown-item').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-sort') === sortKey);
  });

  closeDropdown();
  render();
}

// Filter and Sort Data Pipeline
function getFilteredEvents() {
  let list = [...EVENTS_DATA];

  // Filter by query
  if (state.searchQuery) {
    list = list.filter(evt =>
      evt.title.toLowerCase().includes(state.searchQuery) ||
      evt.venue.toLowerCase().includes(state.searchQuery) ||
      evt.category.toLowerCase().includes(state.searchQuery)
    );
  }

  // Sort
  if (state.sortOrder === 'soonest') {
    list.sort((a, b) => a.dateRank - b.dateRank);
  } else if (state.sortOrder === 'price-low') {
    list.sort((a, b) => a.price - b.price);
  } else if (state.sortOrder === 'price-high') {
    list.sort((a, b) => b.price - a.price);
  } else if (state.sortOrder === 'name') {
    list.sort((a, b) => a.title.localeCompare(b.title));
  }

  return list;
}

// Set active page
function setPage(pageNum) {
  state.currentPage = pageNum;
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Render DOM
function render() {
  const filtered = getFilteredEvents();
  const totalFiltered = filtered.length;

  // Header Counter Badge
  elements.eventsCountBadge.textContent = state.searchQuery ? totalFiltered : state.totalEventsCount;

  // Empty state handling
  if (totalFiltered === 0) {
    elements.eventsGrid.innerHTML = '';
    elements.emptyState.style.display = 'block';
    elements.resultsSummary.textContent = 'Showing 0 events';
    updatePaginationUI(0, 0);
    return;
  }

  elements.emptyState.style.display = 'none';

  // Pagination slice
  const startIndex = (state.currentPage - 1) * state.pageSize;
  const pageItems = filtered.slice(startIndex, startIndex + state.pageSize);

  // Render Cards
  elements.eventsGrid.innerHTML = pageItems.map(evt => createEventCardHTML(evt)).join('');

  // Re-attach book button listeners
  elements.eventsGrid.querySelectorAll('.btn-book').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const eventId = e.currentTarget.getAttribute('data-id');
      const eventData = EVENTS_DATA.find(item => item.id === Number(eventId));
      if (eventData) {
        openBookingModal(eventData);
      }
    });
  });

  // Update Result text
  const startNum = startIndex + 1;
  const endNum = Math.min(startIndex + pageItems.length, totalFiltered);
  const totalLondonCount = state.searchQuery ? totalFiltered : state.totalEventsCount;
  elements.resultsSummary.textContent = `Showing ${startNum}–${endNum} of ${totalLondonCount} events in London`;

  // Update Pagination Controls
  const totalPages = Math.ceil(totalFiltered / state.pageSize) || 1;
  updatePaginationUI(state.currentPage, totalPages);
}

// Generate Event Card HTML (Pixel-perfect match to screenshot)
function createEventCardHTML(evt) {
  return `
    <article class="event-card" data-id="${evt.id}">
      <div class="card-image-wrap">
        <img 
          src="${evt.image}" 
          alt="${evt.title}" 
          class="card-image"
          loading="lazy"
        />
      </div>

      <div class="card-body">
        <div class="event-date-block">
          <span class="date-month">${evt.month}</span>
          <span class="date-day">${evt.day}</span>
          <span class="date-weekday">${evt.weekday}</span>
        </div>

        <h3 class="event-title">${evt.title}</h3>

        <div class="event-stock ${evt.availableTickets === 0 ? 'sold-out' : ''}">
          ${evt.availableTickets > 0 ? `${evt.availableTickets} tickets left` : 'Sold out'}
        </div>

        <div class="card-footer">
          <div class="price-block">
            <span class="price-label">From</span>
            <span class="price-amount">${evt.currency}${evt.price}</span>
          </div>

          <button type="button" class="btn-book" data-id="${evt.id}" aria-label="Book tickets for ${evt.title}" ${evt.availableTickets <= 0 ? 'disabled' : ''}>
            <span>${evt.availableTickets <= 0 ? 'Sold out' : 'Book tickets'}</span>
            <svg class="arrow-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="7" y1="17" x2="17" y2="7"></line>
              <polyline points="7 7 17 7 17 17"></polyline>
            </svg>
          </button>
        </div>
      </div>
    </article>
  `;
}

// Update Pagination Numbers
function updatePaginationUI(currentPage, totalPages) {
  elements.prevPageBtn.disabled = currentPage <= 1;
  elements.nextPageBtn.disabled = currentPage >= totalPages;

  // Build page buttons matching `< 1 2 3 … 8 >`
  let html = '';
  if (totalPages <= 4) {
    for (let p = 1; p <= totalPages; p++) {
      html += `<button type="button" class="page-btn ${p === currentPage ? 'active' : ''}" data-page="${p}">${p}</button>`;
    }
  } else {
    // Exact screenshot styling: 1, 2, 3, …, 8
    html += `<button type="button" class="page-btn ${1 === currentPage ? 'active' : ''}" data-page="1">1</button>`;
    html += `<button type="button" class="page-btn ${2 === currentPage ? 'active' : ''}" data-page="2">2</button>`;
    html += `<button type="button" class="page-btn ${3 === currentPage ? 'active' : ''}" data-page="3">3</button>`;
    html += `<span class="page-ellipsis">…</span>`;
    html += `<button type="button" class="page-btn ${8 === currentPage ? 'active' : ''}" data-page="8">8</button>`;
  }

  elements.pageNumbers.innerHTML = html;

  elements.pageNumbers.querySelectorAll('.page-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const page = parseInt(btn.getAttribute('data-page'), 10);
      setPage(page);
    });
  });
}

// Open Booking Modal
function openBookingModal(eventData) {
  // 1. Kiểm tra đăng nhập trước khi cho mở modal đặt vé
  if (!state.currentUser || !state.authToken) {
    openAuthModal('login');
    showToast('Please log in or sign up to book tickets.');
    return;
  }

  // Check stock first
  if (eventData.availableTickets <= 0) {
    showToast('Sorry, this event is sold out.');
    return;
  }

  state.selectedEvent = eventData;
  state.ticketQuantity = 1;

  elements.qtyVal.textContent = '1';

  elements.bookingImg.src = eventData.image || '';
  elements.bookingDate.textContent =
    `${eventData.month} ${eventData.day} • ${eventData.weekday}`;

  elements.bookingEventTitle.textContent = eventData.title;
  elements.bookingVenue.textContent = eventData.venue;

  elements.bookingStockInfo.textContent =
    `${eventData.availableTickets} tickets available`;

  // Cập nhật thông tin người đặt vé từ tài khoản đã đăng nhập
  if (elements.bookingUserName) {
    elements.bookingUserName.textContent = state.currentUser.full_name;
  }
  if (elements.bookingUserEmail) {
    elements.bookingUserEmail.textContent = state.currentUser.email;
  }
  if (elements.bookingUserAvatar) {
    elements.bookingUserAvatar.textContent = (state.currentUser.full_name || 'U').charAt(0).toUpperCase();
  }

  updateBookingTotals();

  elements.bookingModalBackdrop.classList.add('active');
}

// Update calculated order totals
function updateBookingTotals() {
  if (!state.selectedEvent) return;

  const unitPrice = Number(state.selectedEvent.price);
  const quantity = state.ticketQuantity;

  const subtotal = unitPrice * quantity;
  const total = subtotal;

  elements.summarySubtotal.textContent =
    `${state.selectedEvent.currency}${subtotal.toFixed(2)}`;

  elements.summaryTotal.textContent =
    `${state.selectedEvent.currency}${total.toFixed(2)}`;
}

// Render Auth buttons / User Profile in Header
function renderAuthUI() {
  if (!elements.authActions) return;

  if (state.currentUser && state.authToken) {
    const initial = (state.currentUser.full_name || 'U').charAt(0).toUpperCase();
    const nameParts = (state.currentUser.full_name || 'User').trim().split(/\s+/);
    const displayName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : nameParts[0];

    elements.authActions.innerHTML = `
      <div class="user-greeting">
        <span class="user-avatar">${initial}</span>
        <span>Hi, <strong>${displayName}</strong></span>
      </div>
      <button type="button" class="btn btn-outline" id="btnMyTickets">My tickets</button>
      ${state.currentUser.role === 'ADMIN' ? '<a href="admin.html" class="btn btn-outline" id="btnAdmin">⚙️ Admin</a>' : ''}
      <button class="btn btn-outline btn-logout" id="btnLogout">Log out</button>
    `;

    document.getElementById('btnMyTickets').addEventListener('click', showPurchasedTickets);
    document.getElementById('btnLogout').addEventListener('click', handleLogout);
  } else {
    elements.authActions.innerHTML = `
      <button class="btn btn-ghost" id="btnLogIn">Log in</button>
      <button class="btn btn-primary" id="btnSignUp">Sign up</button>
    `;

    document.getElementById('btnLogIn').addEventListener('click', () => openAuthModal('login'));
    document.getElementById('btnSignUp').addEventListener('click', () => openAuthModal('signup'));
  }
}

function handleLogout() {
  state.currentUser = null;
  state.authToken = null;
  localStorage.removeItem('currentUser');
  localStorage.removeItem('authToken');
  showEventsView();
  renderAuthUI();
  showToast('You have been logged out.');
}

function showEventsView() {
  elements.eventsView.hidden = false;
  elements.purchasedTicketsView.hidden = true;
}

async function showPurchasedTickets() {
  if (!state.currentUser || !state.authToken) {
    openAuthModal('login');
    showToast('Please log in to view your tickets.');
    return;
  }

  elements.eventsView.hidden = true;
  elements.purchasedTicketsView.hidden = false;
  elements.ticketsStatus.textContent = 'Loading your tickets...';
  elements.purchasedTicketsList.innerHTML = '';

  try {
    const response = await fetch('http://localhost:8000/api/bookings/me', {
      headers: { 'Authorization': `Bearer ${state.authToken}` }
    });
    const result = await response.json();

    if (!response.ok) {
      if (response.status === 401) {
        handleLogout();
        openAuthModal('login');
        return;
      }
      throw new Error(result.detail || `HTTP ${response.status}`);
    }

    renderPurchasedTickets(result.bookings || []);
  } catch (error) {
    console.error('Failed to fetch purchased tickets:', error);
    elements.ticketsStatus.textContent = error.message || 'Unable to load your tickets.';
  }
}

function renderPurchasedTickets(bookings) {
  if (bookings.length === 0) {
    elements.ticketsStatus.textContent = 'You have not purchased any tickets yet.';
    return;
  }

  elements.ticketsStatus.textContent = `${bookings.length} booking${bookings.length === 1 ? '' : 's'}`;
  elements.purchasedTicketsList.innerHTML = bookings.map(booking => {
    const tickets = (booking.tickets || []).map(ticket => `
      <li class="ticket-code-item">
        <code>${escapeHTML(ticket.ticket_code)}</code>
        <span class="ticket-status">${escapeHTML(ticket.status)}</span>
      </li>
    `).join('');
    const eventDate = new Date(booking.event_date).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short'
    });

    return `
      <article class="purchased-ticket-card">
        <div class="purchased-ticket-heading">
          <div>
            <p class="booking-reference">Booking ${escapeHTML(booking.booking_code)}</p>
            <h2>${escapeHTML(booking.event_name)}</h2>
            <p class="purchased-event-meta">${escapeHTML(booking.event_venue)} · ${escapeHTML(eventDate)}</p>
          </div>
          <span class="booking-status">${escapeHTML(booking.status)}</span>
        </div>
        <div class="purchased-ticket-summary">
          <span>${booking.quantity} ticket${booking.quantity === 1 ? '' : 's'}</span>
          <strong>${escapeHTML(booking.currency)}${Number(booking.total_amount).toFixed(2)}</strong>
        </div>
        <ul class="ticket-code-list">${tickets}</ul>
      </article>
    `;
  }).join('');
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

// Auth Modal
function openAuthModal(mode) {
  setAuthTab(mode);
  elements.authModalBackdrop.classList.add('active');
}

function setAuthTab(mode) {
  if (mode === 'login') {
    elements.tabLogIn.classList.add('active');
    elements.tabSignUp.classList.remove('active');
    if (elements.fullNameGroup) elements.fullNameGroup.style.display = 'none';
    if (elements.authFullName) elements.authFullName.removeAttribute('required');
    elements.authSubmitBtn.textContent = 'Log in to TicketRush';
    elements.authFooterText.innerHTML = `Don't have an account? <a href="#" id="switchAuthLink">Sign up free</a>`;
  } else {
    elements.tabSignUp.classList.add('active');
    elements.tabLogIn.classList.remove('active');
    if (elements.fullNameGroup) elements.fullNameGroup.style.display = 'block';
    if (elements.authFullName) elements.authFullName.setAttribute('required', 'true');
    elements.authSubmitBtn.textContent = 'Create free account';
    elements.authFooterText.innerHTML = `Already have an account? <a href="#" id="switchAuthLink">Log in</a>`;
  }

  const switchLink = document.getElementById('switchAuthLink');
  if (switchLink) {
    switchLink.addEventListener('click', (e) => {
      e.preventDefault();
      setAuthTab(mode === 'login' ? 'signup' : 'login');
    });
  }
}

async function handleAuthSubmit(e) {
  if (e) e.preventDefault();

  const isLogIn = elements.tabLogIn.classList.contains('active');
  const email = elements.authEmail.value.trim();
  const password = elements.authPassword.value;
  const fullName = elements.authFullName ? elements.authFullName.value.trim() : '';

  if (!email || !password || (!isLogIn && !fullName)) {
    showToast('Please fill in all required fields.');
    return;
  }

  const submitBtn = elements.authSubmitBtn;
  submitBtn.disabled = true;
  submitBtn.textContent = 'Processing...';

  try {
    if (!isLogIn) {
      // 1. Sign Up (Register)
      const regRes = await fetch('http://localhost:8000/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: fullName,
          email: email,
          password: password
        })
      });

      const regData = await regRes.json();
      if (!regRes.ok) {
        throw new Error(regData.detail || 'Registration failed.');
      }
    }

    // 2. Log In
    const loginRes = await fetch('http://localhost:8000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email,
        password: password
      })
    });

    const loginData = await loginRes.json();
    if (!loginRes.ok) {
      throw new Error(loginData.detail || 'Login failed.');
    }

    // Lưu token & user vào state + localStorage
    state.authToken = loginData.access_token;
    state.currentUser = loginData.user;
    localStorage.setItem('authToken', state.authToken);
    localStorage.setItem('currentUser', JSON.stringify(state.currentUser));

    renderAuthUI();
    closeAllModals();
    showToast(isLogIn ? `Welcome back, ${state.currentUser.full_name}!` : `Account created! Welcome, ${state.currentUser.full_name}!`);

    // Reset form
    elements.authForm.reset();

  } catch (error) {
    console.error('Auth error:', error);
    showToast(error.message || 'Authentication failed.');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = isLogIn ? 'Log in to TicketRush' : 'Create free account';
  }
}

// Modal Dismiss
function closeAllModals() {
  elements.bookingModalBackdrop.classList.remove('active');
  elements.authModalBackdrop.classList.remove('active');
}

// Toast System
let toastTimer = null;
function showToast(message) {
  elements.toastMessage.textContent = message;
  elements.toastNotification.classList.add('active');

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    elements.toastNotification.classList.remove('active');
  }, 3500);
}

// Start
document.addEventListener('DOMContentLoaded', init);
