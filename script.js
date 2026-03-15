/* ===== Configuration ===== */
const CONFIG = {
  creditsPerDollar: 50, // $1 = 50 AI Credits (50% gross margin)
  learnerCaseTypes: [
    { id: 'full',    name: 'Full Cases',            credits: 175,  info: 'Comprehensive patient cases involving five stations — Focused History, Physical Examination, Assessment, Diagnostic Tests, and SOAP Note — designed for complete clinical assessment.' },
    { id: 'pd',      name: 'PD Cases',              credits: 150,  info: 'Focused history and physical examination cases, designed to strengthen your information gathering and physical exam skills.' },
    { id: 'single',  name: 'Single Station Cases',  credits: 75,   info: 'Targeted patient cases involving a single station — such as Focused History, Assessment, Patient Education, Professionalism, or others — designed to help you build specific clinical skills.' },
    { id: 'circuit', name: 'Circuits',              credits: 375,  info: 'Clinical circuits of up to eight single-station cases — each with a different scenario — designed to simulate exam flows, reinforce clinical skills, and assess performance across clinical scenarios.' },
    { id: 'cdss',    name: 'CDSS',                  credits: 1,    info: 'Socratic-style Clinical Decision Support System to help the learner during the simulation.' },
  ],
  educatorCaseTypes: [
    { id: 'full',    name: 'Full Cases',            credits: 30,  info: 'Comprehensive patient cases involving five stations — Focused History, Physical Examination, Assessment, Diagnostic Tests, and SOAP Note — designed for complete clinical assessment.' },
    { id: 'pd',      name: 'PD Cases',              credits: 15,  info: 'Focused history and physical examination cases, designed to strengthen your information gathering and physical exam skills.' },
    { id: 'single',  name: 'Single Station Cases',  credits: 10,  info: 'Targeted patient cases involving a single station — such as Focused History, Assessment, Patient Education, Professionalism, or others — designed to help you build specific clinical skills.' },
  ],
  chartColors: ['color-0', 'color-1', 'color-2', 'color-3', 'color-4'],
};

/* ===== State ===== */
const state = {
  learnerCount: 1000,
  months: 6,
  educatorCount: 10,
  usageScope: 'monthly', // 'monthly' or 'total'
  learnerCases: {
    full:    { cases: 0 },
    pd:      { cases: 0 },
    single:  { cases: 5 },
    circuit: { cases: 0 },
    cdss:    { cases: 0 },
  },
  educatorCases: {
    full:    { cases: 50 },
    pd:      { cases: 0 },
    single:  { cases: 0 },
  },
};

/* ===== Formatting ===== */
const fmtCurrency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const fmtNumber = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 1,
});

const fmtInt = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 0,
});

/* ===== DOM References ===== */
let dom = {};

/* ===== Initialization ===== */
document.documentElement.classList.remove('no-js');

document.addEventListener('DOMContentLoaded', () => {
  cacheDom();
  generateCaseRows('learner');
  generateCaseRows('educator');
  bindEvents();
  recalculate();
  initRevealObserver();
});

function cacheDom() {
  dom = {
    app: document.getElementById('app'),
    learnerCount: document.getElementById('learner-count'),
    learnerCountSlider: document.getElementById('learner-count-slider'),
    months: document.getElementById('months'),
    monthsSlider: document.getElementById('months-slider'),
    educatorCount: document.getElementById('educator-count'),
    educatorCountSlider: document.getElementById('educator-count-slider'),
    learnerCredits: document.getElementById('learner-credits'),
    learnerTotal: document.getElementById('learner-total'),
    educatorCredits: document.getElementById('educator-credits'),
    educatorTotal: document.getElementById('educator-total'),
    summaryLearner: document.getElementById('summary-learner'),
    summaryEducator: document.getElementById('summary-educator'),
    summaryTotal: document.getElementById('summary-total'),
    summaryLearnerCredits: document.getElementById('summary-learner-credits'),
    summaryEducatorCredits: document.getElementById('summary-educator-credits'),
    learnerChart: document.getElementById('learner-chart'),
    educatorChart: document.getElementById('educator-chart'),
    learnerCasesContainer: document.getElementById('learner-cases'),
    educatorCasesContainer: document.getElementById('educator-cases'),
  };
}

/* ===== Generate Case Type Rows ===== */
function generateCaseRows(panel) {
  const caseTypes = panel === 'learner' ? CONFIG.learnerCaseTypes : CONFIG.educatorCaseTypes;
  const casesState = panel === 'learner' ? state.learnerCases : state.educatorCases;
  const container = panel === 'learner' ? dom.learnerCasesContainer : dom.educatorCasesContainer;
  const personLabel = panel === 'learner' ? 'Learner' : 'Educator';

  caseTypes.forEach((ct) => {
    const row = document.createElement('div');
    row.className = 'case-row';
    row.dataset.type = ct.id;
    row.dataset.panel = panel;

    const infoHtml = ct.info
      ? `<span class="info-tip" data-tip="${ct.info}"><span class="info-icon">i</span><span class="info-tooltip">${ct.info}</span></span>`
      : '';

    row.innerHTML = `
      <span class="case-name">${ct.name}${infoHtml}</span>
      <div class="case-input">
        <div class="case-slider-group">
          <input type="range" class="case-cases-slider" value="${casesState[ct.id].cases}" min="0" max="200" step="1"
                 data-panel="${panel}" data-type="${ct.id}" data-field="cases">
          <input type="number" class="case-cases-input" value="${casesState[ct.id].cases}" min="0" step="1"
                 data-panel="${panel}" data-type="${ct.id}" data-field="cases">
        </div>
      </div>
      <span class="case-credits mono" data-credits="${panel}-${ct.id}">0</span>
    `;

    container.appendChild(row);
  });

  // Total row
  const totalRow = document.createElement('div');
  totalRow.className = 'case-row total-row';
  totalRow.innerHTML = `
    <span class="case-name">Total</span>
    <div class="case-input">
      <span class="mono" data-total-cases="${panel}">0</span>
    </div>
    <span class="case-credits mono" data-total-credits="${panel}">0</span>
  `;
  container.appendChild(totalRow);
}

/* ===== Event Binding ===== */
function bindEvents() {
  // Slider-input sync
  linkSliderInput(dom.learnerCountSlider, dom.learnerCount, 'learnerCount');
  linkSliderInput(dom.monthsSlider, dom.months, 'months');
  linkSliderInput(dom.educatorCountSlider, dom.educatorCount, 'educatorCount');

  // Brand link scroll to top
  document.getElementById('brand-link').addEventListener('click', (e) => {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // Usage scope toggle
  const scopeToggle = document.getElementById('usage-scope-toggle');
  scopeToggle.addEventListener('click', (e) => {
    const btn = e.target.closest('.scope-btn');
    if (!btn) return;
    state.usageScope = btn.dataset.scope;
    scopeToggle.querySelectorAll('.scope-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    recalculate();
  });

  // Case type inputs (event delegation) — handles both sliders and number inputs
  document.addEventListener('input', (e) => {
    const isSlider = e.target.matches('.case-cases-slider');
    const isInput = e.target.matches('.case-cases-input');

    if (isSlider || isInput) {
      const { panel, type, field } = e.target.dataset;
      const casesState = panel === 'learner' ? state.learnerCases : state.educatorCases;
      const val = Number(e.target.value) || 0;
      casesState[type][field] = val;

      // Sync the paired slider <-> input
      const container = e.target.closest('.case-slider-group');
      if (container) {
        if (isSlider) {
          const numInput = container.querySelector('input[type="number"]');
          if (numInput) numInput.value = val;
        } else {
          const rangeInput = container.querySelector('input[type="range"]');
          if (rangeInput) rangeInput.value = val;
        }
      }

      recalculate();
    }
  });
}

function linkSliderInput(slider, input, stateKey) {
  slider.addEventListener('input', () => {
    input.value = slider.value;
    state[stateKey] = Number(slider.value);
    recalculate();
  });

  input.addEventListener('input', () => {
    const val = Math.max(Number(input.min), Math.min(Number(input.max), Number(input.value) || 1));
    slider.value = val;
    state[stateKey] = val;
    recalculate();
  });
}

/* ===== Calculation Engine ===== */
function recalculate() {
  const learnerResult = calculatePanel('learner');
  const educatorResult = calculatePanel('educator');

  updatePanelUI('learner', learnerResult);
  updatePanelUI('educator', educatorResult);

  // Summary
  const grandTotal = learnerResult.totalPrice + educatorResult.totalPrice;

  dom.summaryLearner.textContent = fmtCurrency.format(learnerResult.totalPrice);
  dom.summaryEducator.textContent = fmtCurrency.format(educatorResult.totalPrice);
  dom.summaryTotal.textContent = fmtCurrency.format(grandTotal);
  dom.summaryLearnerCredits.textContent = fmtInt.format(learnerResult.creditsPerPerson);
  dom.summaryEducatorCredits.textContent = fmtInt.format(educatorResult.creditsPerPerson);

  // Charts
  renderChart(dom.learnerChart, CONFIG.learnerCaseTypes, learnerResult.perTypeCredits);
  renderChart(dom.educatorChart, CONFIG.educatorCaseTypes, educatorResult.perTypeCredits);
}

function calculatePanel(panel) {
  const caseTypes = panel === 'learner' ? CONFIG.learnerCaseTypes : CONFIG.educatorCaseTypes;
  const casesState = panel === 'learner' ? state.learnerCases : state.educatorCases;
  const personCount = panel === 'learner' ? state.learnerCount : state.educatorCount;
  const months = state.months;
  const monthsMultiplier = state.usageScope === 'total' ? months : 1;

  let totalCases = 0;
  let creditsPerPerson = 0;
  const perTypeCredits = {};

  caseTypes.forEach((ct) => {
    const cases = casesState[ct.id].cases;
    const credits = cases * ct.credits;
    perTypeCredits[ct.id] = credits;
    creditsPerPerson += credits;
    totalCases += cases;
  });

  // Customer price: total credits / 75 = dollar amount
  const pricePerPerson = creditsPerPerson / CONFIG.creditsPerDollar;
  const totalPrice = pricePerPerson * personCount * monthsMultiplier;

  return {
    creditsPerPerson,
    pricePerPerson,
    totalPrice,
    perTypeCredits,
    totalCases,
  };
}

/* ===== UI Update ===== */
function updatePanelUI(panel, result) {
  const caseTypes = panel === 'learner' ? CONFIG.learnerCaseTypes : CONFIG.educatorCaseTypes;
  const casesState = panel === 'learner' ? state.learnerCases : state.educatorCases;

  // Credits per person
  const creditsEl = panel === 'learner' ? dom.learnerCredits : dom.educatorCredits;
  creditsEl.textContent = fmtInt.format(result.creditsPerPerson);

  // Total price
  const totalEl = panel === 'learner' ? dom.learnerTotal : dom.educatorTotal;
  totalEl.textContent = fmtCurrency.format(result.totalPrice);

  // Update case rows — show credits per feature
  caseTypes.forEach((ct) => {
    const credits = result.perTypeCredits[ct.id] || 0;

    const creditsDisplay = document.querySelector(`[data-credits="${panel}-${ct.id}"]`);
    if (creditsDisplay) creditsDisplay.textContent = fmtInt.format(credits);

    const row = document.querySelector(`.case-row[data-type="${ct.id}"][data-panel="${panel}"]`);
    if (row) {
      row.classList.toggle('zero-weight', casesState[ct.id].cases === 0);
    }
  });

  // Total row
  const totalCasesEl = document.querySelector(`[data-total-cases="${panel}"]`);
  if (totalCasesEl) totalCasesEl.textContent = fmtNumber.format(result.totalCases);

  const totalCreditsEl = document.querySelector(`[data-total-credits="${panel}"]`);
  if (totalCreditsEl) totalCreditsEl.textContent = fmtInt.format(result.creditsPerPerson);
}

/* ===== Bar Chart ===== */
function renderChart(container, caseTypes, perTypeCredits) {
  container.innerHTML = '';

  const maxCredits = Math.max(...caseTypes.map(ct => perTypeCredits[ct.id] || 0), 1);

  caseTypes.forEach((ct, i) => {
    const credits = perTypeCredits[ct.id] || 0;
    const pct = (credits / maxCredits) * 100;

    const row = document.createElement('div');
    row.className = 'chart-bar-row';
    row.innerHTML = `
      <span class="chart-label">${ct.name}</span>
      <div class="chart-bar-track">
        <div class="chart-bar-fill ${CONFIG.chartColors[i % CONFIG.chartColors.length]}" style="width: ${pct}%">
          ${pct > 15 ? `<span>${fmtInt.format(credits)}</span>` : ''}
        </div>
      </div>
      <span class="chart-bar-value">${fmtInt.format(credits)} credits</span>
    `;
    container.appendChild(row);
  });
}

/* ===== Reveal Observer ===== */
function initRevealObserver() {
  const reveals = document.querySelectorAll('.reveal');
  if (!reveals.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
  );

  reveals.forEach((el) => observer.observe(el));
}
