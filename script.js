/* ===== Password Lock ===== */
(function initLock() {
  // SHA-256 hash of the password — change by running:
  // echo -n "yourpassword" | shasum -a 256
  const PASS_HASH = 'f50fe6bb20fa12e78d072a698dc70afba1ba93fe22080c48452b9ebbd3a74296';

  if (sessionStorage.getItem('unlocked') === 'true') {
    document.getElementById('lock-screen')?.classList.add('hidden');
    return;
  }

  // Prevent scrolling behind lock screen
  document.documentElement.style.overflow = 'hidden';

  async function sha256(str) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  async function tryUnlock() {
    const input = document.getElementById('lock-input');
    const error = document.getElementById('lock-error');
    const hash = await sha256(input.value);
    if (hash === PASS_HASH) {
      sessionStorage.setItem('unlocked', 'true');
      document.getElementById('lock-screen').classList.add('hidden');
      document.documentElement.style.overflow = '';
    } else {
      error.textContent = 'Incorrect password';
      input.value = '';
      input.focus();
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('lock-btn').addEventListener('click', tryUnlock);
    document.getElementById('lock-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') tryUnlock();
    });
  });
})();

/* ===== Configuration ===== */
const CONFIG = {
  creditsPerDollar: 50, // $1 = 50 AI Credits (50% gross margin)
  chartColors: ['color-0', 'color-1', 'color-2', 'color-3', 'color-4', 'color-0', 'color-1', 'color-2', 'color-3', 'color-4'],
  products: [
    {
      id: 'aics',
      name: 'AI Clinical Simulation',
      learnerTypes: [
        { id: 'aics-full',    name: 'Full Cases',            credits: 175,  info: 'Comprehensive patient cases involving five stations — Focused History, Physical Examination, Assessment, Diagnostic Tests, and SOAP Note — designed for complete clinical assessment.' },
        { id: 'aics-pd',      name: 'Physical Diagnosis Cases',              credits: 150,  info: 'Focused history and physical examination cases, designed to strengthen your information gathering and physical exam skills.' },
        { id: 'aics-single',  name: 'Single Station Cases',  credits: 75,   info: 'Targeted patient cases involving a single station — such as Focused History, Assessment, Patient Education, Professionalism, or others — designed to help you build specific clinical skills.' },
        { id: 'aics-circuit', name: 'Circuits',              credits: 375,  info: 'Clinical circuits of up to eight single-station cases — each with a different scenario — designed to simulate exam flows, reinforce clinical skills, and assess performance across clinical scenarios.' },
        { id: 'aics-cdss',    name: 'Clinical Decision Support System',                  credits: 1,    info: 'Socratic-style Clinical Decision Support System to help the learner during the simulation.' },
      ],
      educatorTypes: [
        { id: 'aics-full',    name: 'Full Cases',            credits: 30,  info: 'Comprehensive patient cases involving five stations — Focused History, Physical Examination, Assessment, Diagnostic Tests, and SOAP Note — designed for complete clinical assessment.' },
        { id: 'aics-pd',      name: 'Physical Diagnosis Cases',              credits: 15,  info: 'Focused history and physical examination cases, designed to strengthen your information gathering and physical exam skills.' },
        { id: 'aics-single',  name: 'Single Station Cases',  credits: 10,  info: 'Targeted patient cases involving a single station — such as Focused History, Assessment, Patient Education, Professionalism, or others — designed to help you build specific clinical skills.' },
      ],
    },
    {
      id: 'ait',
      name: 'AI Tutor',
      learnerTypes: [
        { id: 'ait-tutoring',          name: 'AI Tutoring Hours',  credits: 300 },
      ],
      educatorTypes: [
        { id: 'ait-course-chapter',   name: 'AI Tutors / Course Chapters',  credits: 500 },
      ],
    },
  ],
};

/* ===== State ===== */
const state = {
  learnerCount: 1000,
  months: 6,
  educatorCount: 10,
  usageScope: 'monthly', // 'monthly' or 'total'
  learnerCases: {
    'aics-full': { cases: 0 }, 'aics-pd': { cases: 0 }, 'aics-single': { cases: 5 },
    'aics-circuit': { cases: 0 }, 'aics-cdss': { cases: 0 },
    'ait-tutoring': { cases: 0 },
  },
  educatorCases: {
    'aics-full': { cases: 50 }, 'aics-pd': { cases: 0 }, 'aics-single': { cases: 0 },
    'ait-course-chapter': { cases: 0 },
  },
};

/* ===== Formatting ===== */
const fmtCurrency = new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD',
  minimumFractionDigits: 2, maximumFractionDigits: 2,
});

const fmtNumber = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });
const fmtInt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

/* ===== DOM References ===== */
let dom = {};

/* ===== Initialization ===== */
document.documentElement.classList.remove('no-js');

document.addEventListener('DOMContentLoaded', () => {
  cacheDom();
  generateAllProducts('learner');
  generateAllProducts('educator');
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
    learnerProductsContainer: document.getElementById('learner-products'),
    educatorProductsContainer: document.getElementById('educator-products'),
  };
}

/* ===== Generate Product Sections ===== */
function generateAllProducts(panel) {
  const container = panel === 'learner' ? dom.learnerProductsContainer : dom.educatorProductsContainer;
  const casesState = panel === 'learner' ? state.learnerCases : state.educatorCases;

  CONFIG.products.forEach((product) => {
    const types = panel === 'learner' ? product.learnerTypes : product.educatorTypes;
    if (!types.length) return;

    // Product badge
    const badge = document.createElement('p');
    badge.className = 'panel-product';
    badge.textContent = product.name;
    container.appendChild(badge);

    // Case types table
    const caseTypesDiv = document.createElement('div');
    caseTypesDiv.className = 'case-types';

    // Header row
    const header = document.createElement('div');
    header.className = 'case-header';
    header.innerHTML = `
      <span class="case-col-name">Feature</span>
      <span class="case-col-input">Usage</span>
      <span class="case-col-total">AI Credits</span>
    `;
    caseTypesDiv.appendChild(header);

    // Feature rows
    types.forEach((ct) => {
      const row = document.createElement('div');
      row.className = 'case-row';
      row.dataset.type = ct.id;
      row.dataset.panel = panel;

      const infoHtml = ct.info
        ? `<span class="info-tip"><span class="info-icon">i</span><span class="info-tooltip">${ct.info}</span></span>`
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
      caseTypesDiv.appendChild(row);
    });

    // Total row per product
    const totalRow = document.createElement('div');
    totalRow.className = 'case-row total-row';
    totalRow.innerHTML = `
      <span class="case-name">Total</span>
      <div class="case-input">
        <span class="mono" data-total-cases="${panel}-${product.id}">0</span>
      </div>
      <span class="case-credits mono" data-total-credits="${panel}-${product.id}">0</span>
    `;
    caseTypesDiv.appendChild(totalRow);

    container.appendChild(caseTypesDiv);
  });
}

/* ===== Event Binding ===== */
function bindEvents() {
  linkSliderInput(dom.learnerCountSlider, dom.learnerCount, 'learnerCount');
  linkSliderInput(dom.monthsSlider, dom.months, 'months');
  linkSliderInput(dom.educatorCountSlider, dom.educatorCount, 'educatorCount');

  document.getElementById('brand-link').addEventListener('click', (e) => {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  const scopeToggle = document.getElementById('usage-scope-toggle');
  scopeToggle.addEventListener('click', (e) => {
    const btn = e.target.closest('.scope-btn');
    if (!btn) return;
    state.usageScope = btn.dataset.scope;
    scopeToggle.querySelectorAll('.scope-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    recalculate();
  });

  document.addEventListener('input', (e) => {
    const isSlider = e.target.matches('.case-cases-slider');
    const isInput = e.target.matches('.case-cases-input');
    if (isSlider || isInput) {
      const { panel, type, field } = e.target.dataset;
      const casesState = panel === 'learner' ? state.learnerCases : state.educatorCases;
      const val = Number(e.target.value) || 0;
      casesState[type][field] = val;
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

  const grandTotal = learnerResult.totalPrice + educatorResult.totalPrice;
  dom.summaryLearner.textContent = fmtCurrency.format(learnerResult.totalPrice);
  dom.summaryEducator.textContent = fmtCurrency.format(educatorResult.totalPrice);
  dom.summaryTotal.textContent = fmtCurrency.format(grandTotal);
  dom.summaryLearnerCredits.textContent = fmtInt.format(learnerResult.creditsPerPerson);
  dom.summaryEducatorCredits.textContent = fmtInt.format(educatorResult.creditsPerPerson);

  // Charts — combine all feature types across products
  const allLearnerTypes = CONFIG.products.flatMap(p => p.learnerTypes);
  const allEducatorTypes = CONFIG.products.flatMap(p => p.educatorTypes);
  renderChart(dom.learnerChart, allLearnerTypes, learnerResult.perTypeCredits);
  renderChart(dom.educatorChart, allEducatorTypes, educatorResult.perTypeCredits);
}

function calculatePanel(panel) {
  const casesState = panel === 'learner' ? state.learnerCases : state.educatorCases;
  const personCount = panel === 'learner' ? state.learnerCount : state.educatorCount;
  const monthsMultiplier = state.usageScope === 'total' ? state.months : 1;

  let totalCases = 0;
  let creditsPerPerson = 0;
  const perTypeCredits = {};
  const perProductCases = {};
  const perProductCredits = {};

  CONFIG.products.forEach((product) => {
    const types = panel === 'learner' ? product.learnerTypes : product.educatorTypes;
    let productCases = 0;
    let productCredits = 0;

    types.forEach((ct) => {
      const cases = casesState[ct.id].cases;
      const credits = cases * ct.credits;
      perTypeCredits[ct.id] = credits;
      creditsPerPerson += credits;
      totalCases += cases;
      productCases += cases;
      productCredits += credits;
    });

    perProductCases[product.id] = productCases;
    perProductCredits[product.id] = productCredits;
  });

  const pricePerPerson = creditsPerPerson / CONFIG.creditsPerDollar;
  const totalPrice = pricePerPerson * personCount * monthsMultiplier;

  return { creditsPerPerson, pricePerPerson, totalPrice, perTypeCredits, perProductCases, perProductCredits, totalCases };
}

/* ===== UI Update ===== */
function updatePanelUI(panel, result) {
  const casesState = panel === 'learner' ? state.learnerCases : state.educatorCases;

  const creditsEl = panel === 'learner' ? dom.learnerCredits : dom.educatorCredits;
  creditsEl.textContent = fmtInt.format(result.creditsPerPerson);

  const totalEl = panel === 'learner' ? dom.learnerTotal : dom.educatorTotal;
  totalEl.textContent = fmtCurrency.format(result.totalPrice);

  // Update per-feature credits
  CONFIG.products.forEach((product) => {
    const types = panel === 'learner' ? product.learnerTypes : product.educatorTypes;

    types.forEach((ct) => {
      const credits = result.perTypeCredits[ct.id] || 0;
      const creditsDisplay = document.querySelector(`[data-credits="${panel}-${ct.id}"]`);
      if (creditsDisplay) creditsDisplay.textContent = fmtInt.format(credits);

      const row = document.querySelector(`.case-row[data-type="${ct.id}"][data-panel="${panel}"]`);
      if (row) row.classList.toggle('zero-weight', casesState[ct.id].cases === 0);
    });

    // Per-product totals
    const totalCasesEl = document.querySelector(`[data-total-cases="${panel}-${product.id}"]`);
    if (totalCasesEl) totalCasesEl.textContent = fmtNumber.format(result.perProductCases[product.id]);

    const totalCreditsEl = document.querySelector(`[data-total-credits="${panel}-${product.id}"]`);
    if (totalCreditsEl) totalCreditsEl.textContent = fmtInt.format(result.perProductCredits[product.id]);
  });
}

/* ===== Bar Chart ===== */
function renderChart(container, allTypes, perTypeCredits) {
  container.innerHTML = '';
  const activeTypes = allTypes.filter(ct => (perTypeCredits[ct.id] || 0) > 0);
  if (!activeTypes.length) {
    container.innerHTML = '<p style="color: var(--color-text-dim); font-size: 0.82rem;">Set usage above to see breakdown</p>';
    return;
  }

  const maxCredits = Math.max(...activeTypes.map(ct => perTypeCredits[ct.id] || 0), 1);

  activeTypes.forEach((ct, i) => {
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
