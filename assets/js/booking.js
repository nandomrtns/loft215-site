// Widget de disponibilidade estilo Airbnb: card compacto (check-in/checkout/
// hóspedes) que abre um modal com o calendário navegável ao clicar. O botão
// final de reserva só funciona com ?preview=1 na URL (uso interno) até a
// Fase 3 ligar o pagamento de verdade — ver booking-service para o motivo.

const API_BASE = 'https://studio215-booking-production.up.railway.app';
const PREVIEW_MODE = new URLSearchParams(window.location.search).has('preview');
const MONTHS_SHOWN = 2;
const MAX_MONTH_OFFSET = 10; // janela navegável de 12 meses (offset + MONTHS_SHOWN)
const AVAILABILITY_WINDOW_DAYS = 380; // cobre a janela de 12 meses inteira numa fetch só
const MAX_GUESTS = 3;
const MONTH_NAMES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const WEEKDAYS = ['D','S','T','Q','Q','S','S'];
const RESERVATION_ID_KEY = 'studio215_reservation_id';

const bookingWidget = document.getElementById('bookingWidget');
const bookingWidgetTitle = document.getElementById('bookingWidgetTitle');
const bookingWidgetCta = document.getElementById('bookingWidgetCta');
const bookingSummary = document.getElementById('bookingSummary');

const fieldCheckIn = document.getElementById('fieldCheckIn');
const fieldCheckOut = document.getElementById('fieldCheckOut');
const checkInValue = document.getElementById('checkInValue');
const checkOutValue = document.getElementById('checkOutValue');

const guestsField = document.getElementById('guestsField');
const guestsValue = document.getElementById('guestsValue');
const guestsPopover = document.getElementById('guestsPopover');
const guestsCountEl = document.getElementById('guestsCount');
const guestsMinus = document.getElementById('guestsMinus');
const guestsPlus = document.getElementById('guestsPlus');

const calModalBackdrop = document.getElementById('calModalBackdrop');
const calModal = document.getElementById('calModal');
const modalFieldCheckIn = document.getElementById('modalFieldCheckIn');
const modalFieldCheckOut = document.getElementById('modalFieldCheckOut');
const modalCheckInValue = document.getElementById('modalCheckInValue');
const modalCheckOutValue = document.getElementById('modalCheckOutValue');
const calPrevBtn = document.getElementById('calPrev');
const calNextBtn = document.getElementById('calNext');
const calGrid = document.getElementById('calGrid');
const calUpdated = document.getElementById('calUpdated');
const calClear = document.getElementById('calClear');
const calClose = document.getElementById('calClose');

const guestForm = document.getElementById('guestForm');
const bookingNote = document.getElementById('bookingNote');
const bookingError = document.getElementById('bookingError');
const bookingConfirmation = document.getElementById('bookingConfirmation');

let blockedDays = new Set();
let minNights = 2;
let selection = { start: null, end: null };
let guestCount = 1;
let monthOffset = 0;

if (calGrid) {
  initBooking();
  wireStaticEvents();
}

async function initBooking() {
  const restored = await tryRestoreReservation();
  if (restored) return;

  try {
    const res = await fetch(`${API_BASE}/api/availability?to=${addDaysIso(todayIso(), AVAILABILITY_WINDOW_DAYS)}`);
    if (!res.ok) throw new Error('availability request failed');
    const data = await res.json();

    minNights = data.min_nights || 2;
    blockedDays = expandBlockedRanges(data.blocked_ranges || []);
    renderCalendar();

    if (data.last_airbnb_sync && calUpdated) {
      const d = new Date(data.last_airbnb_sync);
      calUpdated.textContent =
        `Atualizado em ${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    }
  } catch (err) {
    calGrid.innerHTML = '<p class="cal-loading">Não consegui carregar a disponibilidade agora — chame no Instagram que a gente confirma na hora.</p>';
  }
}

async function tryRestoreReservation() {
  const savedId = sessionStorage.getItem(RESERVATION_ID_KEY);
  if (!savedId) return false;

  try {
    const res = await fetch(`${API_BASE}/api/reservations/${savedId}`);
    if (!res.ok) {
      sessionStorage.removeItem(RESERVATION_ID_KEY);
      return false;
    }
    const reservation = await res.json();
    if (reservation.status !== 'pending') {
      sessionStorage.removeItem(RESERVATION_ID_KEY);
      return false;
    }
    renderConfirmation(reservation);
    return true;
  } catch (err) {
    return false;
  }
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function addDaysIso(iso, days) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function expandBlockedRanges(ranges) {
  const set = new Set();
  ranges.forEach((r) => {
    const d = new Date(r.start + 'T00:00:00');
    const end = new Date(r.end + 'T00:00:00');
    while (d < end) {
      set.add(d.toISOString().slice(0, 10));
      d.setDate(d.getDate() + 1);
    }
  });
  return set;
}

function nightsBetween(a, b) {
  const d1 = new Date(a + 'T00:00:00');
  const d2 = new Date(b + 'T00:00:00');
  return Math.round((d2 - d1) / 86_400_000);
}

function hasBlockedDayInRange(start, end) {
  const d = new Date(start + 'T00:00:00');
  const endDate = new Date(end + 'T00:00:00');
  d.setDate(d.getDate() + 1);
  while (d < endDate) {
    if (blockedDays.has(d.toISOString().slice(0, 10))) return true;
    d.setDate(d.getDate() + 1);
  }
  return false;
}

function formatDateBR(iso) {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

function formatBRL(cents) {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// ---------- Widget compacto (fechado) ----------

function wireStaticEvents() {
  [fieldCheckIn, fieldCheckOut].forEach((el) => {
    if (!el) return;
    el.addEventListener('click', () => openModal(el.dataset.target));
  });
  if (bookingWidgetCta) bookingWidgetCta.addEventListener('click', () => openModal('checkin'));

  if (guestsField) {
    guestsField.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = !guestsPopover.hidden;
      guestsPopover.hidden = isOpen;
      guestsField.setAttribute('aria-expanded', String(!isOpen));
    });
  }
  document.addEventListener('click', (e) => {
    if (guestsPopover && !guestsPopover.hidden && !guestsPopover.contains(e.target) && e.target !== guestsField) {
      guestsPopover.hidden = true;
      guestsField.setAttribute('aria-expanded', 'false');
    }
  });
  if (guestsMinus) guestsMinus.addEventListener('click', () => setGuestCount(guestCount - 1));
  if (guestsPlus) guestsPlus.addEventListener('click', () => setGuestCount(guestCount + 1));

  if (modalFieldCheckIn) {
    modalFieldCheckIn.addEventListener('click', () => {
      selection = { start: null, end: null };
      hideBookingSteps();
      renderCalendar();
      syncFieldDisplays();
    });
  }
  if (modalFieldCheckOut) {
    modalFieldCheckOut.addEventListener('click', () => {
      if (!selection.start) return;
      selection.end = null;
      hideBookingSteps();
      renderCalendar();
      syncFieldDisplays();
    });
  }

  if (calPrevBtn) {
    calPrevBtn.addEventListener('click', () => {
      if (monthOffset === 0) return;
      monthOffset -= 1;
      renderCalendar();
    });
  }
  if (calNextBtn) {
    calNextBtn.addEventListener('click', () => {
      if (monthOffset >= MAX_MONTH_OFFSET) return;
      monthOffset += 1;
      renderCalendar();
    });
  }

  if (calClear) {
    calClear.addEventListener('click', () => {
      selection = { start: null, end: null };
      hideBookingSteps();
      renderCalendar();
      syncFieldDisplays();
    });
  }
  if (calClose) calClose.addEventListener('click', closeModal);
  if (calModalBackdrop) calModalBackdrop.addEventListener('click', closeModal);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && calModal && !calModal.hidden) closeModal();
  });
}

function setGuestCount(next) {
  guestCount = Math.min(MAX_GUESTS, Math.max(1, next));
  guestsCountEl.textContent = String(guestCount);
  guestsValue.textContent = `${guestCount} hóspede${guestCount > 1 ? 's' : ''}`;
  guestsMinus.disabled = guestCount <= 1;
  guestsPlus.disabled = guestCount >= MAX_GUESTS;
}
setGuestCount(1);

function syncFieldDisplays() {
  if (selection.start) {
    checkInValue.textContent = formatDateBR(selection.start);
    checkInValue.classList.remove('placeholder');
    modalCheckInValue.textContent = formatDateBR(selection.start);
  } else {
    checkInValue.textContent = 'Adicionar data';
    checkInValue.classList.add('placeholder');
    modalCheckInValue.textContent = 'DD/MM/AAAA';
  }

  if (selection.end) {
    checkOutValue.textContent = formatDateBR(selection.end);
    checkOutValue.classList.remove('placeholder');
    modalCheckOutValue.textContent = formatDateBR(selection.end);
  } else {
    checkOutValue.textContent = 'Adicionar data';
    checkOutValue.classList.add('placeholder');
    modalCheckOutValue.textContent = 'DD/MM/AAAA';
  }

  modalFieldCheckIn.classList.toggle('active', !selection.start);
  modalFieldCheckOut.classList.toggle('active', !!selection.start && !selection.end);
}

// ---------- Modal ----------

function openModal(target) {
  if (calModalBackdrop) calModalBackdrop.hidden = false;
  if (calModal) calModal.hidden = false;
  renderCalendar();
  syncFieldDisplays();
}

function closeModal() {
  if (calModalBackdrop) calModalBackdrop.hidden = true;
  if (calModal) calModal.hidden = true;
}

// ---------- Calendário ----------

function renderCalendar() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (calPrevBtn) calPrevBtn.disabled = monthOffset === 0;
  if (calNextBtn) calNextBtn.disabled = monthOffset >= MAX_MONTH_OFFSET;

  let html = '';
  for (let m = 0; m < MONTHS_SHOWN; m++) {
    const monthDate = new Date(today.getFullYear(), today.getMonth() + monthOffset + m, 1);
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    const firstWeekday = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    html += `<div class="cal-month"><h4>${MONTH_NAMES[month]} ${year}</h4><div class="cal-weekdays">`;
    WEEKDAYS.forEach((w) => (html += `<span>${w}</span>`));
    html += '</div><div class="cal-days">';
    for (let i = 0; i < firstWeekday; i++) html += '<span class="cal-day empty"></span>';

    for (let day = 1; day <= daysInMonth; day++) {
      const dateObj = new Date(year, month, day);
      const key = dateObj.toISOString().slice(0, 10);
      const isPast = dateObj < today;
      const isBlocked = blockedDays.has(key);

      let cls = 'cal-day';
      if (isPast) cls += ' past';
      else if (isBlocked) cls += ' booked';
      else {
        cls += ' free selectable';
        if (selection.start === key) cls += ' range-start';
        if (selection.end === key) cls += ' range-end';
        if (selection.start && selection.end && key > selection.start && key < selection.end) cls += ' in-range';
      }

      html += `<span class="${cls}" data-date="${key}">${day}</span>`;
    }
    html += '</div></div>';
  }
  calGrid.innerHTML = html;

  calGrid.querySelectorAll('.cal-day.selectable').forEach((el) => {
    el.addEventListener('click', () => onDayClick(el.dataset.date));
  });
}

function onDayClick(dateKey) {
  clearError();

  const startingFresh = !selection.start || (selection.start && selection.end);
  if (startingFresh || dateKey <= selection.start) {
    selection = { start: dateKey, end: null };
    renderCalendar();
    hideBookingSteps();
    syncFieldDisplays();
    return;
  }

  if (hasBlockedDayInRange(selection.start, dateKey)) {
    showError('Essa faixa passa por uma data já ocupada. Escolha outro período.');
    selection = { start: dateKey, end: null };
    renderCalendar();
    syncFieldDisplays();
    return;
  }

  const nights = nightsBetween(selection.start, dateKey);
  if (nights < minNights) {
    showError(`Estadia mínima de ${minNights} noites.`);
    return;
  }

  selection.end = dateKey;
  renderCalendar();
  syncFieldDisplays();
  loadQuote();
}

async function loadQuote() {
  try {
    const res = await fetch(`${API_BASE}/api/pricing?checkIn=${selection.start}&checkOut=${selection.end}`);
    if (!res.ok) throw new Error('pricing failed');
    const quote = await res.json();
    renderSummary(quote);
    showGuestForm();
  } catch (err) {
    showError('Não consegui calcular o preço agora. Tenta de novo em instantes.');
  }
}

function renderSummary(quote) {
  if (!bookingSummary) return;
  if (bookingWidgetTitle) bookingWidgetTitle.hidden = true;
  bookingSummary.hidden = false;
  bookingSummary.innerHTML = `
    <div class="row"><span>${quote.nights} noite${quote.nights > 1 ? 's' : ''} × ${formatBRL(quote.nightlyRateCents)}</span><span>${formatBRL(quote.nightlyRateCents * quote.nights)}</span></div>
    <div class="row"><span>Taxa de limpeza</span><span>${formatBRL(quote.cleaningFeeCents)}</span></div>
    <div class="row total"><span>Total</span><span>${formatBRL(quote.totalCents)}</span></div>
    <p class="policy-note">${quote.cancellationPolicy.summary}</p>
  `;
  if (bookingWidgetCta) bookingWidgetCta.hidden = true;
}

function showGuestForm() {
  if (!guestForm) return;
  guestForm.hidden = false;

  const submitBtn = guestForm.querySelector('button[type="submit"]');
  if (!PREVIEW_MODE) {
    submitBtn.disabled = true;
    if (bookingNote) {
      bookingNote.hidden = false;
      bookingNote.textContent = 'Reservas diretas abrindo em breve — chame no Instagram por enquanto.';
    }
  } else {
    submitBtn.disabled = false;
    if (bookingNote) bookingNote.hidden = true;
  }
}

function hideBookingSteps() {
  if (bookingWidgetTitle) bookingWidgetTitle.hidden = false;
  if (bookingWidgetCta) bookingWidgetCta.hidden = false;
  if (bookingSummary) bookingSummary.hidden = true;
  if (guestForm) guestForm.hidden = true;
  if (bookingNote) bookingNote.hidden = true;
  clearError();
}

function showError(msg) {
  if (!bookingError) return;
  bookingError.textContent = msg;
  bookingError.hidden = false;
}

function clearError() {
  if (!bookingError) return;
  bookingError.hidden = true;
  bookingError.textContent = '';
}

// Mesmo algoritmo do backend (src/lib/cpf.ts) — checagem client-side é só UX,
// o servidor continua sendo a autoridade real.
function isValidCpfClient(rawValue) {
  const cpf = (rawValue || '').replace(/\D/g, '');
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  const checkDigit = (digits, weightStart) => {
    let sum = 0;
    for (let i = 0; i < digits.length; i++) sum += Number(digits[i]) * (weightStart - i);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  if (checkDigit(cpf.slice(0, 9), 10) !== Number(cpf[9])) return false;
  if (checkDigit(cpf.slice(0, 10), 11) !== Number(cpf[10])) return false;
  return true;
}

function reservationErrorMessage(body) {
  if (body.error === 'indisponivel') return 'Essas datas acabaram de ficar indisponíveis. Escolha outro período.';
  if (body.error === 'estadia_minima') return `Estadia mínima de ${body.minNights} noites.`;
  if (body.error === 'validacao') return 'Confira os dados preenchidos.';
  return 'Não consegui criar a pré-reserva agora. Tenta de novo em instantes.';
}

if (guestForm) {
  guestForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!PREVIEW_MODE) return; // reforço — o botão já vem desabilitado
    clearError();

    const payload = {
      checkIn: selection.start,
      checkOut: selection.end,
      guestName: guestForm.guestName.value.trim(),
      guestEmail: guestForm.guestEmail.value.trim(),
      guestPhone: guestForm.guestPhone.value.trim(),
      guestDocument: guestForm.guestDocument.value.trim(),
      guestCount,
    };

    if (!isValidCpfClient(payload.guestDocument)) {
      showError('CPF inválido — confira os números.');
      return;
    }

    const submitBtn = guestForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;

    try {
      const res = await fetch(`${API_BASE}/api/reservations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await res.json();

      if (!res.ok) {
        showError(reservationErrorMessage(body));
        submitBtn.disabled = false;
        return;
      }

      sessionStorage.setItem(RESERVATION_ID_KEY, body.id);
      renderConfirmation(body);
    } catch (err) {
      showError('Não consegui enviar a pré-reserva agora. Tenta de novo em instantes.');
      submitBtn.disabled = false;
    }
  });
}

function renderConfirmation(reservation) {
  closeModal();
  if (bookingWidget) bookingWidget.hidden = true;
  if (guestForm) guestForm.hidden = true;
  if (bookingNote) bookingNote.hidden = true;
  clearError();

  if (!bookingConfirmation) return;
  const expires = new Date(reservation.expiresAt);

  bookingConfirmation.hidden = false;
  bookingConfirmation.innerHTML = `
    <h3>Pré-reserva feita</h3>
    <p>${formatDateBR(reservation.checkIn)} — ${formatDateBR(reservation.checkOut)}</p>
    <p>Total: ${formatBRL(reservation.totalCents)}</p>
    <p>${reservation.cancellationPolicy.summary}</p>
    <p>Sua pré-reserva fica guardada até ${expires.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}.</p>
  `;
}
