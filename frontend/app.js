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
    
    // Nếu API trả về mảng events
    EVENTS_DATA = (data && data.events) ? data.events : [];
    state.totalEventsCount = data.total || EVENTS_DATA.length;
  } catch (error) {
    console.warn('Chưa kết nối được tới API Backend (http://localhost:8000/api/events/):', error);
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
  ticketTierMultiplier: 1,
  ticketQuantity: 1,
  bookingFee: 2.50
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
  
  // Modals
  bookingModalBackdrop: document.getElementById('bookingModalBackdrop'),
  closeBookingModal: document.getElementById('closeBookingModal'),
  bookingImg: document.getElementById('bookingImg'),
  bookingDate: document.getElementById('bookingDate'),
  bookingEventTitle: document.getElementById('bookingEventTitle'),
  bookingVenue: document.getElementById('bookingVenue'),
  tierPrice: document.getElementById('tierPrice'),
  tierPriceVip: document.getElementById('tierPriceVip'),
  qtyMinus: document.getElementById('qtyMinus'),
  qtyPlus: document.getElementById('qtyPlus'),
  qtyVal: document.getElementById('qtyVal'),
  summarySubtotal: document.getElementById('summarySubtotal'),
  summaryTotal: document.getElementById('summaryTotal'),
  bookingName: document.getElementById('bookingName'),
  bookingEmail: document.getElementById('bookingEmail'),
  btnConfirmBooking: document.getElementById('btnConfirmBooking'),
  
  // Auth
  authModalBackdrop: document.getElementById('authModalBackdrop'),
  closeAuthModal: document.getElementById('closeAuthModal'),
  btnLogIn: document.getElementById('btnLogIn'),
  btnSignUp: document.getElementById('btnSignUp'),
  tabLogIn: document.getElementById('tabLogIn'),
  tabSignUp: document.getElementById('tabSignUp'),
  authSubmitBtn: document.getElementById('authSubmitBtn'),
  authFooterText: document.getElementById('authFooterText'),
  authForm: document.getElementById('authForm'),
  
  // Toast
  toastNotification: document.getElementById('toastNotification'),
  toastMessage: document.getElementById('toastMessage')
};

// Initialize Application
function init() {
  bindEvents();
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

  // Booking Modal
  elements.closeBookingModal.addEventListener('click', closeAllModals);
  elements.bookingModalBackdrop.addEventListener('click', (e) => {
    if (e.target === elements.bookingModalBackdrop) closeAllModals();
  });

  document.querySelectorAll('.ticket-tier').forEach(tier => {
    tier.addEventListener('click', () => {
      document.querySelectorAll('.ticket-tier').forEach(t => t.classList.remove('active'));
      tier.classList.add('active');
      state.ticketTierMultiplier = parseFloat(tier.getAttribute('data-price-mult') || 1);
      updateBookingTotals();
    });
  });

  elements.qtyMinus.addEventListener('click', () => {
    if (state.ticketQuantity > 1) {
      state.ticketQuantity--;
      elements.qtyVal.textContent = state.ticketQuantity;
      updateBookingTotals();
    }
  });

  elements.qtyPlus.addEventListener('click', () => {
    if (state.ticketQuantity < 10) {
      state.ticketQuantity++;
      elements.qtyVal.textContent = state.ticketQuantity;
      updateBookingTotals();
    }
  });

  elements.btnConfirmBooking.addEventListener('click', () => {
    const name = elements.bookingName.value.trim();
    const email = elements.bookingEmail.value.trim();

    if (!name || !email) {
      showToast('Please enter your name and email to receive tickets.');
      elements.bookingName.focus();
      return;
    }

    closeAllModals();
    showToast(`Order confirmed for ${name}! ${state.ticketQuantity}x tickets sent to ${email}.`);
  });

  // Auth Modals
  elements.btnLogIn.addEventListener('click', () => openAuthModal('login'));
  elements.btnSignUp.addEventListener('click', () => openAuthModal('signup'));
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
      const eventData = EVENTS_DATA.find(item => item.id === eventId);
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

        <div class="card-footer">
          <div class="price-block">
            <span class="price-label">From</span>
            <span class="price-amount">${evt.currency}${evt.price}</span>
          </div>

          <button type="button" class="btn-book" data-id="${evt.id}" aria-label="Book tickets for ${evt.title}">
            <span>Book tickets</span>
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
  state.selectedEvent = eventData;
  state.ticketQuantity = 1;
  state.ticketTierMultiplier = 1;
  elements.qtyVal.textContent = '1';

  // Reset active tier
  const tiers = elements.bookingModalBackdrop.querySelectorAll('.ticket-tier');
  tiers.forEach((t, i) => t.classList.toggle('active', i === 0));

  elements.bookingImg.src = eventData.image;
  elements.bookingDate.textContent = `${eventData.month} ${eventData.day} • ${eventData.weekday}`;
  elements.bookingEventTitle.textContent = eventData.title;
  elements.bookingVenue.textContent = eventData.venue;

  // Prices
  elements.tierPrice.textContent = `${eventData.currency}${eventData.price}`;
  elements.tierPriceVip.textContent = `${eventData.currency}${Math.round(eventData.price * 1.6)}`;

  updateBookingTotals();
  elements.bookingModalBackdrop.classList.add('active');
}

// Update calculated order totals
function updateBookingTotals() {
  if (!state.selectedEvent) return;

  const basePrice = state.selectedEvent.price;
  const unitPrice = Math.round(basePrice * state.ticketTierMultiplier);
  const subtotal = unitPrice * state.ticketQuantity;
  const total = subtotal + state.bookingFee;

  elements.summarySubtotal.textContent = `${state.selectedEvent.currency}${subtotal.toFixed(2)}`;
  elements.summaryTotal.textContent = `${state.selectedEvent.currency}${total.toFixed(2)}`;
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
    elements.authSubmitBtn.textContent = 'Log in to TicketRush';
    elements.authFooterText.innerHTML = `Don't have an account? <a href="#" id="switchAuthLink">Sign up free</a>`;
  } else {
    elements.tabSignUp.classList.add('active');
    elements.tabLogIn.classList.remove('active');
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

function handleAuthSubmit() {
  const isLogIn = elements.tabLogIn.classList.contains('active');
  closeAllModals();
  showToast(isLogIn ? 'Welcome back! Signed in successfully.' : 'Welcome to TicketRush! Account created.');
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
