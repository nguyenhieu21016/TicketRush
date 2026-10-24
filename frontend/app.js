/**
 * TicketRush - Frontend Application Logic
 * Supports Real Backend Connection (ALB/EC2) & Local Mock Fallback
 */

// Configuration
const CONFIG = {
  API_BASE_URL: window.location.origin.includes('http') ? '' : 'http://localhost:8000',
  TOTAL_TICKETS: 300,
  POLL_INTERVAL: 4000 // Poll Redis ticket count every 4s
};

// State
let state = {
  ticketsLeft: CONFIG.TOTAL_TICKETS,
  isRushActive: true,
  isMockMode: false
};

// DOM Elements
const ticketsLeftEl = document.getElementById('ticketsLeft');
const progressBarFill = document.getElementById('progressBarFill');
const counterStatusPill = document.getElementById('counterStatusPill');
const registrationForm = document.getElementById('registrationForm');
const submitBtn = document.getElementById('submitBtn');
const btnLoader = document.getElementById('btnLoader');
const btnText = submitBtn.querySelector('.btn-text');

const nameInput = document.getElementById('fullName');
const emailInput = document.getElementById('email');
const phoneInput = document.getElementById('phone');

const nameError = document.getElementById('nameError');
const emailError = document.getElementById('emailError');
const phoneError = document.getElementById('phoneError');

// Modal Elements
const successModal = document.getElementById('successModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const confirmModalBtn = document.getElementById('confirmModalBtn');
const modalTicketId = document.getElementById('modalTicketId');
const modalAttendeeName = document.getElementById('modalAttendeeName');
const modalAttendeeEmail = document.getElementById('modalAttendeeEmail');
const toastContainer = document.getElementById('toastContainer');
const systemStatusText = document.getElementById('systemStatusText');

// Init
document.addEventListener('DOMContentLoaded', () => {
  fetchTicketStatus();
  setInterval(fetchTicketStatus, CONFIG.POLL_INTERVAL);
  bindEvents();
});

// Bind Event Listeners
function bindEvents() {
  registrationForm.addEventListener('submit', handleFormSubmit);

  closeModalBtn.addEventListener('click', hideModal);
  confirmModalBtn.addEventListener('click', hideModal);

  // Close modal when clicking outside
  successModal.addEventListener('click', (e) => {
    if (e.target === successModal) hideModal();
  });

  // Clear errors on input
  nameInput.addEventListener('input', () => { nameError.textContent = ''; });
  emailInput.addEventListener('input', () => { emailError.textContent = ''; });
  phoneInput.addEventListener('input', () => { phoneError.textContent = ''; });
}

/**
 * Fetch live ticket status from Backend API (Redis)
 */
async function fetchTicketStatus() {
  try {
    const res = await fetch(`${CONFIG.API_BASE_URL}/api/tickets/status`);
    if (!res.ok) throw new Error('API offline');
    const data = await res.json();
    
    updateTicketDisplay(data.tickets_left !== undefined ? data.tickets_left : data.ticketsLeft);
    if (state.isMockMode) {
      state.isMockMode = false;
      systemStatusText.textContent = 'AWS ALB / Redis Connected';
    }
  } catch (err) {
    // If backend isn't up yet, run in standalone Mock Mode smoothly
    if (!state.isMockMode) {
      state.isMockMode = true;
      systemStatusText.textContent = 'Local Standalone Preview';
      console.info('TicketRush: Backend not reached, running in standalone UI preview mode.');
    }
  }
}

/**
 * Update the UI counter & progress bar
 */
function updateTicketDisplay(count) {
  state.ticketsLeft = Math.max(0, count);
  ticketsLeftEl.textContent = state.ticketsLeft;

  const percentage = Math.max(0, (state.ticketsLeft / CONFIG.TOTAL_TICKETS) * 100);
  progressBarFill.style.width = `${percentage}%`;

  if (state.ticketsLeft <= 0) {
    state.isRushActive = false;
    counterStatusPill.textContent = 'ĐÃ HẾT VÉ';
    counterStatusPill.classList.add('soldout');
    submitBtn.disabled = true;
    btnText.textContent = '❌ HẾT VÉ TRONG ĐỢT NÀY';
    progressBarFill.style.background = '#F43F5E';
  } else if (state.ticketsLeft <= 30) {
    counterStatusPill.textContent = 'SẮP HẾT VÉ';
    counterStatusPill.classList.remove('soldout');
    counterStatusPill.style.color = '#F59E0B';
    counterStatusPill.style.background = 'rgba(245, 158, 11, 0.15)';
  } else {
    counterStatusPill.textContent = 'Đang mở đăng ký';
    counterStatusPill.classList.remove('soldout');
    counterStatusPill.style.color = '#10B981';
    counterStatusPill.style.background = 'rgba(16, 185, 129, 0.15)';
  }
}

/**
 * Validate input fields
 */
function validateForm() {
  let isValid = true;
  const nameVal = nameInput.value.trim();
  const emailVal = emailInput.value.trim();
  const phoneVal = phoneInput.value.trim();

  if (!nameVal || nameVal.length < 2) {
    nameError.textContent = 'Vui lòng nhập họ và tên hợp lệ';
    isValid = false;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailVal || !emailRegex.test(emailVal)) {
    emailError.textContent = 'Vui lòng nhập địa chỉ email hợp lệ';
    isValid = false;
  }

  const phoneRegex = /^[0-9]{9,11}$/;
  if (!phoneVal || !phoneRegex.test(phoneVal.replace(/\D/g, ''))) {
    phoneError.textContent = 'Vui lòng nhập số điện thoại hợp lệ (10 số)';
    isValid = false;
  }

  return isValid;
}

/**
 * Handle form submission
 */
async function handleFormSubmit(e) {
  e.preventDefault();

  if (!state.isRushActive) {
    showToast('Sự kiện đã hết vé! Vui lòng quay lại đợt sau.', 'error');
    return;
  }

  if (!validateForm()) return;

  setLoading(true);

  const payload = {
    full_name: nameInput.value.trim(),
    email: emailInput.value.trim(),
    phone: phoneInput.value.trim()
  };

  try {
    if (state.isMockMode) {
      // Standalone simulation for UI preview
      await new Promise(r => setTimeout(r, 700)); // simulate network delay
      if (state.ticketsLeft <= 0) {
        throw new Error('Hết vé');
      }
      updateTicketDisplay(state.ticketsLeft - 1);
      const mockTicketId = 'TR-' + Math.floor(10000 + Math.random() * 90000);
      showSuccessModal(mockTicketId, payload.full_name, payload.email);
      registrationForm.reset();
    } else {
      // Real API Call (ALB -> EC2 -> Redis & RDS)
      const res = await fetch(`${CONFIG.API_BASE_URL}/api/tickets/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || data.message || 'Đăng ký thất bại hoặc hết vé!');
      }

      showSuccessModal(data.ticket_id || data.ticketId || 'TR-SUCCESS', payload.full_name, payload.email);
      showToast('Đăng ký thành công! Vé QR sẽ sớm được gửi qua email.', 'success');
      registrationForm.reset();
      fetchTicketStatus();
    }
  } catch (err) {
    showToast(err.message || 'Đã có lỗi xảy ra. Vui lòng thử lại!', 'error');
    fetchTicketStatus();
  } finally {
    setLoading(false);
  }
}

function setLoading(isLoading) {
  submitBtn.disabled = isLoading;
  if (isLoading) {
    btnLoader.style.display = 'inline-block';
    btnText.style.display = 'none';
  } else {
    btnLoader.style.display = 'none';
    btnText.style.display = 'inline-block';
  }
}

function showSuccessModal(ticketId, name, email) {
  modalTicketId.textContent = ticketId;
  modalAttendeeName.textContent = name;
  modalAttendeeEmail.textContent = email;
  successModal.classList.add('active');
}

function hideModal() {
  successModal.classList.remove('active');
}

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;

  toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}
