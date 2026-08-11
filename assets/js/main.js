const header = document.getElementById('siteHeader');
window.addEventListener('scroll', () => {
  header.classList.toggle('scrolled', window.scrollY > 40);
});

// Menu mobile
const burger = document.getElementById('headerBurger');
const mobileMenu = document.getElementById('mobileMenu');
if (burger && mobileMenu) {
  burger.addEventListener('click', () => {
    const open = mobileMenu.classList.toggle('open');
    burger.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  mobileMenu.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => {
      mobileMenu.classList.remove('open');
      burger.setAttribute('aria-expanded', 'false');
    });
  });
}

// Carrossel da hero — Ken Burns + crossfade, 2s por foto
const heroImgs = document.querySelectorAll('.hero-bg-img');
if (heroImgs.length) {
  let heroIdx = 0;
  const showHeroSlide = () => {
    heroImgs.forEach((img, i) => img.classList.toggle('active', i === heroIdx));
    heroIdx = (heroIdx + 1) % heroImgs.length;
  };
  showHeroSlide();
  setInterval(showHeroSlide, 4000);
}

const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightboxImg');
const lightboxClose = document.getElementById('lightboxClose');

document.querySelectorAll('.lb-trigger').forEach(a => {
  a.addEventListener('click', (e) => {
    e.preventDefault();
    lightboxImg.src = a.getAttribute('href');
    lightboxImg.alt = a.querySelector('img').alt;
    lightbox.classList.add('open');
  });
});

function closeLightbox() {
  lightbox.classList.remove('open');
  lightboxImg.src = '';
}

lightboxClose.addEventListener('click', closeLightbox);
lightbox.addEventListener('click', (e) => {
  if (e.target === lightbox) closeLightbox();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeLightbox();
});

// Calendário de disponibilidade, sincronizado do Airbnb
const calGrid = document.getElementById('calGrid');
const calUpdated = document.getElementById('calUpdated');
if (calGrid) {
  fetch('assets/availability.json')
    .then(r => r.json())
    .then(renderCalendar)
    .catch(() => {
      calGrid.innerHTML = '<p class="cal-loading">Não consegui carregar a disponibilidade agora — chame no Instagram que a gente confirma na hora.</p>';
    });
}

function renderCalendar(data) {
  const booked = new Set();
  (data.booked_ranges || []).forEach(r => {
    let d = new Date(r.start + 'T00:00:00');
    const end = new Date(r.end + 'T00:00:00');
    while (d < end) {
      booked.add(d.toISOString().slice(0, 10));
      d.setDate(d.getDate() + 1);
    }
  });

  const monthNames = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const weekdays = ['D','S','T','Q','Q','S','S'];
  const today = new Date();
  today.setHours(0,0,0,0);

  let html = '';
  for (let m = 0; m < 2; m++) {
    const monthDate = new Date(today.getFullYear(), today.getMonth() + m, 1);
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    const firstWeekday = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    html += `<div class="cal-month"><h4>${monthNames[month]} ${year}</h4><div class="cal-weekdays">`;
    weekdays.forEach(w => html += `<span>${w}</span>`);
    html += `</div><div class="cal-days">`;
    for (let i = 0; i < firstWeekday; i++) html += `<span class="cal-day empty"></span>`;
    for (let day = 1; day <= daysInMonth; day++) {
      const dateObj = new Date(year, month, day);
      const key = dateObj.toISOString().slice(0, 10);
      const isPast = dateObj < today;
      const isBooked = booked.has(key);
      const cls = isPast ? 'cal-day past' : (isBooked ? 'cal-day booked' : 'cal-day free');
      html += `<span class="${cls}">${day}</span>`;
    }
    html += `</div></div>`;
  }
  calGrid.innerHTML = html;

  if (data.last_synced) {
    const d = new Date(data.last_synced);
    calUpdated.textContent = `Atualizado em ${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})}`;
  }
}
