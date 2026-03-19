/* ===== Password Lock ===== */
(function initLock() {
  const PASS_HASH = 'f50fe6bb20fa12e78d072a698dc70afba1ba93fe22080c48452b9ebbd3a74296';
  if (sessionStorage.getItem('unlocked') === 'true') {
    document.getElementById('lock-screen')?.classList.add('hidden');
    return;
  }
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
      input.value = ''; input.focus();
    }
  }
  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('lock-btn').addEventListener('click', tryUnlock);
    document.getElementById('lock-input').addEventListener('keydown', e => { if (e.key === 'Enter') tryUnlock(); });
  });
})();

/* ===== Default State ===== */
const DEFAULTS = {
  cashBalance: 0,
  grossBurn: 0,
  currentMRRb2b: 0,
  currentMRRb2c: 0,
  grossMarginPct: 0,
  monthlySalesBudget: 0,
  b2bDealRevenue: 0,
  newLogosPerMonth: 0,
  salesCycleMo: 0,
  b2bAnnualChurn: 0,
  expansionPct: 0,
  b2bCAC: 0,
  newSubsPerMonth: 0,
  b2cMonthlyPrice: 0,
  b2cMonthlyChurn: 0,
  b2cCAC: 0,
  targetRunwayMonths: 0,
  plannedRaise: 0,
  raiseCloseMonth: 0,
};

const state = { ...DEFAULTS };

/* ===== Formatters ===== */
const fmtCurrency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 });
const fmtCurrencyFull = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtNum = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });
const fmtInt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

function fmtCompact(v) {
  const abs = Math.abs(v);
  const sign = v < 0 ? '-' : '';
  if (abs >= 1000000) return sign + '$' + (abs / 1000000).toFixed(1) + 'M';
  if (abs >= 1000)    return sign + '$' + (abs / 1000).toFixed(0) + 'k';
  return sign + '$' + abs.toFixed(0);
}

/* ===== Init ===== */
document.documentElement.classList.remove('no-js');

document.addEventListener('DOMContentLoaded', () => {
  bindEvents();
  recalculate();
  initRevealObserver();
  document.getElementById('brand-link').addEventListener('click', e => {
    e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' });
  });
});

/* ===== Event Binding ===== */
function bindEvents() {
  // Financial position: direct number inputs (no sliders)
  const fpBindings = [
    ['cash-balance',       'cashBalance'],
    ['gross-burn',         'grossBurn'],
    ['current-mrr-b2b',   'currentMRRb2b'],
    ['current-mrr-b2c',   'currentMRRb2c'],
    ['gross-margin-pct',  'grossMarginPct'],
    ['monthly-sales-budget', 'monthlySalesBudget'],
  ];
  fpBindings.forEach(([id, key]) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', () => {
      const val = Math.max(0, Number(el.value) || 0);
      state[key] = val;
      recalculate();
    });
  });

  // Slider + number pairs
  const sliderBindings = [
    ['b2b-deal-slider',      'b2b-deal-revenue',   'b2bDealRevenue'],
    ['logos-slider',         'new-logos',           'newLogosPerMonth'],
    ['sales-cycle-slider',   'sales-cycle',         'salesCycleMo'],
    ['b2b-churn-slider',     'b2b-churn',           'b2bAnnualChurn'],
    ['expansion-slider',     'expansion-pct',       'expansionPct'],
    ['b2b-cac-slider',       'b2b-cac',             'b2bCAC'],
    ['subs-slider',          'new-subs',            'newSubsPerMonth'],
    ['b2c-price-slider',     'b2c-price',           'b2cMonthlyPrice'],
    ['b2c-churn-slider',     'b2c-churn',           'b2cMonthlyChurn'],
    ['b2c-cac-slider',       'b2c-cac',             'b2cCAC'],
    ['target-runway-slider', 'target-runway',        'targetRunwayMonths'],
    ['raise-slider',         'planned-raise',        'plannedRaise'],
    ['raise-month-slider',   'raise-close-month',    'raiseCloseMonth'],
  ];
  sliderBindings.forEach(([sliderId, inputId, key]) => {
    const slider = document.getElementById(sliderId);
    const input  = document.getElementById(inputId);
    if (!slider || !input) return;
    slider.addEventListener('input', () => {
      input.value = slider.value;
      state[key] = Number(slider.value);
      recalculate();
    });
    input.addEventListener('input', () => {
      const raw = Number(input.value);
      const val = isNaN(raw) ? 0 : Math.max(Number(input.min || 0), raw);
      slider.value = val;
      state[key] = val;
      recalculate();
    });
  });

  // Reset button
  document.getElementById('reset-btn').addEventListener('click', () => {
    Object.assign(state, DEFAULTS);
    // Re-sync all inputs to default values
    sliderBindings.forEach(([sliderId, inputId, key]) => {
      const slider = document.getElementById(sliderId);
      const input  = document.getElementById(inputId);
      if (slider) slider.value = DEFAULTS[key];
      if (input)  input.value  = DEFAULTS[key];
    });
    fpBindings.forEach(([id, key]) => {
      const el = document.getElementById(id);
      if (el) el.value = DEFAULTS[key];
    });
    recalculate();
  });

  // Toggle monthly table — bind ONCE here, never inside recalculate()
  document.getElementById('toggle-table-btn').addEventListener('click', () => {
    const wrap = document.getElementById('monthly-table-wrap');
    const btn  = document.getElementById('toggle-table-btn');
    const nowHidden = wrap.classList.toggle('hidden');
    btn.textContent = nowHidden ? 'Show Table' : 'Hide Table';
    if (!nowHidden) {
      const proj = projectCashFlow();
      renderMonthlyTable(proj);
    }
  });
}

/* ===================================================================
   CORE PROJECTION ENGINE
   Returns 37 data points (month 0–36) with:
   - cashBase        : projected cash WITHOUT planned raise
   - cashWithRaise   : projected cash WITH planned raise
   - worstCash       : zero-revenue burn (WITH raise, shows full downside)
   - b2bMRR, b2cMRR, totalMRR
   - netBurn         : grossBurn - totalMRR (positive = burning cash)
   - churnLoss       : MRR lost to churn
   - expansionGain   : MRR added via expansion
   - newMRR          : MRR added from new logos/subs
   - b2bLogoCount    : active B2B logos
   - b2cSubCount     : active B2C subscribers
   - totalCustomers  : logos + subs
   - arpu            : total MRR / totalCustomers
=================================================================== */
function projectCashFlow() {
  const results = [];
  let cashBase      = state.cashBalance;
  let cashWithRaise = state.cashBalance;
  let worstCash     = state.cashBalance;
  let b2bMRR = state.currentMRRb2b;
  let b2cMRR = state.currentMRRb2c;

  // Derive initial logo/sub counts from starting MRR
  let b2bLogos = state.b2bDealRevenue > 0 ? state.currentMRRb2b / state.b2bDealRevenue : 0;
  let b2cSubs  = state.b2cMonthlyPrice  > 0 ? state.currentMRRb2c / state.b2cMonthlyPrice  : 0;

  const totalMRR0 = b2bMRR + b2cMRR;
  const totalCust0 = Math.round(b2bLogos + b2cSubs);
  results.push({
    m: 0, cashBase, cashWithRaise, worstCash,
    b2bMRR, b2cMRR, totalMRR: totalMRR0,
    netBurn: state.grossBurn - totalMRR0,
    churnLoss: 0, expansionGain: 0, newMRR: 0,
    b2bLogoCount: Math.round(b2bLogos), b2cSubCount: Math.round(b2cSubs),
    totalCustomers: totalCust0,
    arpu: totalCust0 > 0 ? totalMRR0 / totalCust0 : 0,
  });

  for (let m = 1; m <= 36; m++) {
    const afterSalesCycle = m > state.salesCycleMo;

    // B2B MRR
    const b2bChurnLoss = b2bMRR * (state.b2bAnnualChurn / 100 / 12);
    const b2bExpansion = b2bMRR * (state.expansionPct   / 100 / 12);
    const b2bNewMRR    = afterSalesCycle ? state.newLogosPerMonth * state.b2bDealRevenue : 0;
    b2bMRR = Math.max(0, b2bMRR - b2bChurnLoss + b2bNewMRR + b2bExpansion);

    // B2C MRR
    const b2cChurnLoss = b2cMRR * (state.b2cMonthlyChurn / 100);
    const b2cNewMRR    = state.newSubsPerMonth * state.b2cMonthlyPrice;
    b2cMRR = Math.max(0, b2cMRR - b2cChurnLoss + b2cNewMRR);

    // Customer counts
    const b2bChurnLogos = b2bLogos * (state.b2bAnnualChurn / 100 / 12);
    b2bLogos = Math.max(0, b2bLogos - b2bChurnLogos + (afterSalesCycle ? state.newLogosPerMonth : 0));
    const b2cChurnSubs  = b2cSubs  * (state.b2cMonthlyChurn / 100);
    b2cSubs  = Math.max(0, b2cSubs  - b2cChurnSubs  + state.newSubsPerMonth);

    const totalMRR  = b2bMRR + b2cMRR;
    const netBurn   = state.grossBurn - totalMRR;
    const raise     = m === state.raiseCloseMonth ? state.plannedRaise : 0;

    // Separate cash tracks
    cashBase      -= netBurn;              // no raise
    cashWithRaise  = cashWithRaise - netBurn + raise;
    worstCash      = worstCash - state.grossBurn + raise; // worst: revenue=0, raise applies

    const totalCust = Math.round(b2bLogos) + Math.round(b2cSubs);
    results.push({
      m, cashBase, cashWithRaise, worstCash,
      b2bMRR, b2cMRR, totalMRR, netBurn,
      churnLoss: b2bChurnLoss + b2cChurnLoss,
      expansionGain: b2bExpansion,
      newMRR: b2bNewMRR + b2cNewMRR,
      b2bLogoCount: Math.round(b2bLogos),
      b2cSubCount: Math.round(b2cSubs),
      totalCustomers: totalCust,
      arpu: totalCust > 0 ? totalMRR / totalCust : 0,
    });
  }
  return results;
}

/* ===================================================================
   DERIVED METRICS
=================================================================== */
function getDerivedMetrics(projection) {
  const p0      = projection[0];
  const totalMRR0 = p0.totalMRR;
  const m12     = projection[Math.min(12, projection.length - 1)];

  // Current runway (no-raise path)
  const currentNetBurn = Math.max(1, state.grossBurn - totalMRR0);
  const currentRunway  = state.cashBalance / currentNetBurn;

  // Zero crossing — using cashWithRaise (realistic)
  const zeroIdx   = projection.findIndex(p => p.cashWithRaise <= 0);
  const zeroMonth = zeroIdx > 0 ? zeroIdx : null;

  // Zero crossing without raise — for raise-timing warning
  const zeroBaseIdx   = projection.findIndex(p => p.cashBase <= 0);
  const zeroBaseMonth = zeroBaseIdx > 0 ? zeroBaseIdx : null;

  // Break-even (MRR >= grossBurn)
  const beIdx      = projection.findIndex(p => p.totalMRR >= state.grossBurn);
  const breakEvenMonth = beIdx > 0 ? beIdx : null;

  // ARR and growth rate at month 12
  const arrM12       = m12.totalMRR * 12;
  const mrrGrowthPct = totalMRR0 > 0
    ? ((m12.totalMRR - totalMRR0) / totalMRR0) * 100
    : m12.totalMRR > 0 ? 999 : 0; // 999 = very high growth (avoid div/0 display)

  // Raise needed for target runway (using cashWithRaise path)
  const tgt = Math.min(state.targetRunwayMonths, 36);
  const projRevenue = projection.slice(1, tgt + 1).reduce((s, p) => s + p.totalMRR, 0);
  const raiseNeeded = Math.max(0,
    state.grossBurn * tgt - state.cashBalance - projRevenue - state.plannedRaise
  );

  // B2B LTV : CAC
  const b2bMonthlyChurn = state.b2bAnnualChurn / 100 / 12;
  const b2bLifetime     = b2bMonthlyChurn > 0 ? 1 / b2bMonthlyChurn : 120;
  const b2bLTV          = state.b2bDealRevenue * b2bLifetime * (state.grossMarginPct / 100);
  const b2bLTVCAC       = state.b2bCAC > 0 ? b2bLTV / state.b2bCAC : null;

  // B2C LTV : CAC
  const b2cMonthlyChurn = state.b2cMonthlyChurn / 100;
  const b2cLifetime     = b2cMonthlyChurn > 0 ? 1 / b2cMonthlyChurn : 120;
  const b2cLTV          = state.b2cMonthlyPrice * b2cLifetime * (state.grossMarginPct / 100);
  const b2cLTVCAC       = state.b2cCAC > 0 ? b2cLTV / state.b2cCAC : null;

  // NRR: 12-month cohort simulation (B2B)
  // Each month: cohort grows by expansion fraction, shrinks by churn fraction
  let nrrCohort = 1;
  for (let i = 0; i < 12; i++) {
    nrrCohort *= (1 - b2bMonthlyChurn + state.expansionPct / 100 / 12);
  }
  const nrr = nrrCohort * 100;

  // CAC Payback = CAC / (MRR per customer × gross margin %)
  const b2bCACPayback = (state.b2bCAC > 0 && state.b2bDealRevenue > 0)
    ? state.b2bCAC / (state.b2bDealRevenue * state.grossMarginPct / 100)
    : null;
  const b2cCACPayback = (state.b2cCAC > 0 && state.b2cMonthlyPrice > 0)
    ? state.b2cCAC / (state.b2cMonthlyPrice * state.grossMarginPct / 100)
    : null;

  // Magic Number = Net New ARR (year 1) / Annual S&M spend (year 0)
  // Measures how efficiently S&M spend converts to recurring revenue
  const netNewARR       = (m12.totalMRR - totalMRR0) * 12;
  const annualSalesBudget = state.monthlySalesBudget * 12;
  const magicNumber     = annualSalesBudget > 0 ? netNewARR / annualSalesBudget : null;

  // Quick Ratio at month 12: (new MRR + expansion) / churned MRR
  const m12d       = projection[Math.min(12, projection.length - 1)];
  const quickRatio = m12d.churnLoss > 0
    ? (m12d.newMRR + m12d.expansionGain) / m12d.churnLoss
    : (m12d.newMRR > 0 ? 99 : null);

  // ARPU and total customers at month 12
  const arpuM12       = m12.arpu;
  const customersM12  = m12.totalCustomers;

  // Rule of 40: YoY MRR growth % + gross margin %
  const r40GrowthPct = Math.min(mrrGrowthPct, 300); // cap for display
  const rule40       = r40GrowthPct + state.grossMarginPct;

  // Raise timing warning
  const raiseAfterZero = state.plannedRaise > 0
    && zeroBaseMonth !== null
    && state.raiseCloseMonth > zeroBaseMonth;

  // Steady-state B2C MRR (geometric series limit)
  const b2cSteadyState = b2cMonthlyChurn > 0
    ? (state.newSubsPerMonth * state.b2cMonthlyPrice) / b2cMonthlyChurn
    : null;

  // Logos needed to break-even (at current deal revenue)
  const logosToBreakEven = state.b2bDealRevenue > 0
    ? Math.ceil(state.grossBurn / state.b2bDealRevenue)
    : null;

  // Default Alive / Dead verdict
  let verdict;
  if (breakEvenMonth !== null && (zeroMonth === null || breakEvenMonth < zeroMonth)) {
    const buffer = zeroMonth ? zeroMonth - breakEvenMonth : 36 - breakEvenMonth;
    verdict = {
      alive: true,
      text: `✓ Default Alive — MRR reaches break-even at Month ${breakEvenMonth}` +
        (zeroMonth
          ? `, ${buffer} month${buffer !== 1 ? 's' : ''} before cash runs out (Month ${zeroMonth}).`
          : `. Cash holds for 36+ months.`) +
        ` Current runway: ${currentRunway.toFixed(1)} months.`,
    };
  } else if (breakEvenMonth === null) {
    verdict = {
      alive: false,
      text: `✗ Default Dead — MRR never reaches $${(state.grossBurn/1000).toFixed(0)}k break-even in 36 months at current velocity. Raise needed: ${raiseNeeded > 0 ? fmtCurrency.format(raiseNeeded) : 'recalculate'}.`,
    };
  } else {
    verdict = {
      alive: false,
      text: `✗ Default Dead — Cash runs out at Month ${zeroMonth}, but break-even isn't until Month ${breakEvenMonth}. Need ${fmtCurrency.format(raiseNeeded)} more or ${Math.ceil(state.grossBurn / Math.max(1, state.b2bDealRevenue))} total logos at current pricing.`,
    };
  }

  return {
    currentRunway, currentNetBurn, breakEvenMonth, zeroMonth, zeroBaseMonth,
    arrM12, mrrGrowthPct: r40GrowthPct, raiseNeeded,
    b2bLTVCAC, b2cLTVCAC, nrr,
    b2bCACPayback, b2cCACPayback, magicNumber, quickRatio,
    arpuM12, customersM12, rule40, r40GrowthPct,
    raiseAfterZero, b2cSteadyState, logosToBreakEven, verdict,
  };
}

/* ===================================================================
   UPDATE UI
=================================================================== */
function updateInlineStats(metrics) {
  // B2C steady state
  const ss = document.getElementById('b2c-steady-state');
  if (ss) ss.textContent = metrics.b2cSteadyState ? fmtCurrency.format(metrics.b2cSteadyState) + '/mo' : '—';

  // B2C lifetime
  const lt = document.getElementById('b2c-lifetime');
  const b2cMonthlyChurn = state.b2cMonthlyChurn / 100;
  const lifetime = b2cMonthlyChurn > 0 ? (1 / b2cMonthlyChurn).toFixed(1) : '∞';
  if (lt) lt.textContent = lifetime + ' months';

  // Raise block stats
  const bmTarget = document.getElementById('breakeven-mrr-target');
  if (bmTarget) bmTarget.textContent = fmtCurrency.format(state.grossBurn) + '/mo';

  const l2be = document.getElementById('logos-to-breakeven');
  if (l2be) l2be.textContent = metrics.logosToBreakEven ? `${metrics.logosToBreakEven} logos` : '—';

  // Sensitivity labels
  const el = (id, text) => { const e = document.getElementById(id); if (e) e.textContent = text; };
  el('sens-burn-label',      fmtCompact(state.grossBurn));
  el('sens-cycle-label',     state.salesCycleMo);
  el('sens-churn-label',     state.b2bAnnualChurn);
  el('sens-expansion-label', state.expansionPct);

  // Raise timing warning
  const warn = document.getElementById('raise-warning');
  if (warn) {
    if (metrics.raiseAfterZero && metrics.zeroBaseMonth) {
      warn.classList.remove('hidden');
      const rm = document.getElementById('raise-month-label');
      const zm = document.getElementById('zero-month-label');
      if (rm) rm.textContent = state.raiseCloseMonth;
      if (zm) zm.textContent = metrics.zeroBaseMonth;
    } else {
      warn.classList.add('hidden');
    }
  }

  // Raise legend item visibility
  const raiseLegend = document.getElementById('raise-legend-item');
  if (raiseLegend) raiseLegend.style.opacity = state.plannedRaise > 0 ? '1' : '0.3';
}

function updateVerdict(metrics) {
  const banner = document.getElementById('verdict-banner');
  const text   = document.getElementById('verdict-text');
  if (!banner || !text) return;
  banner.className = 'verdict-banner ' + (metrics.verdict.alive ? 'verdict-alive' : 'verdict-dead');
  text.textContent = metrics.verdict.text;
}

function updateKPIs(metrics) {
  const set = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
  const cls = (id, c)   => { const e = document.getElementById(id); if (e) e.className = c; };

  // Runway
  const runwayVal = metrics.currentRunway > 36 ? '36+' : fmtNum.format(metrics.currentRunway);
  set('kpi-runway-val', runwayVal + ' mo');
  cls('kpi-runway', 'kpi-card ' + kpiColor(metrics.currentRunway, 18, 6));

  // Net Burn
  set('kpi-netburn-val', fmtCompact(metrics.currentNetBurn));
  const burnColor = metrics.currentNetBurn <= 0 ? 'kpi-healthy'
    : metrics.currentNetBurn < state.grossBurn / 2 ? 'kpi-warning' : 'kpi-danger';
  cls('kpi-netburn', 'kpi-card ' + burnColor);

  // ARR
  set('kpi-arr-val', fmtCompact(metrics.arrM12));
  const milestone = metrics.arrM12 >= 10000000 ? '🎯 $10M ARR'
    : metrics.arrM12 >= 3000000  ? '🎯 $3M ARR'
    : metrics.arrM12 >= 1000000  ? '🎯 $1M ARR'
    : metrics.arrM12 >= 500000   ? 'On path to $1M ARR'
    : 'Pre-$500k ARR';
  set('kpi-arr-sub', milestone);
  cls('kpi-arr', 'kpi-card ' + (metrics.arrM12 >= 1000000 ? 'kpi-healthy' : metrics.arrM12 >= 500000 ? 'kpi-warning' : ''));

  // Break-even
  const beVal = metrics.breakEvenMonth !== null ? `Month ${metrics.breakEvenMonth}` : '> 36 mo';
  set('kpi-breakeven-val', beVal);
  cls('kpi-breakeven', 'kpi-card ' + kpiColor(
    metrics.breakEvenMonth !== null ? (36 - metrics.breakEvenMonth) : 0, 24, 12
  ));

  // Raise Needed
  set('kpi-raise-val', metrics.raiseNeeded > 0 ? fmtCurrency.format(metrics.raiseNeeded) : '$0');
  set('kpi-raise-sub', metrics.raiseNeeded > 0 ? `needed for ${state.targetRunwayMonths}-mo runway` : `${state.targetRunwayMonths}-mo runway funded`);
  cls('kpi-raise', 'kpi-card accent ' + (metrics.raiseNeeded === 0 ? 'kpi-healthy' : ''));

  // B2B LTV:CAC
  if (metrics.b2bLTVCAC !== null) {
    set('kpi-b2b-ltvcac-val', metrics.b2bLTVCAC.toFixed(1) + ' : 1');
    cls('kpi-b2b-ltvcac', 'kpi-card ' + kpiColor(metrics.b2bLTVCAC, 3, 1));
  } else { set('kpi-b2b-ltvcac-val', '—'); }

  // B2C LTV:CAC
  if (metrics.b2cLTVCAC !== null) {
    set('kpi-b2c-ltvcac-val', metrics.b2cLTVCAC.toFixed(1) + ' : 1');
    cls('kpi-b2c-ltvcac', 'kpi-card ' + kpiColor(metrics.b2cLTVCAC, 3, 1));
  } else { set('kpi-b2c-ltvcac-val', '—'); }

  // NRR
  set('kpi-nrr-val', fmtNum.format(metrics.nrr) + '%');
  cls('kpi-nrr', 'kpi-card ' + (metrics.nrr >= 100 ? 'kpi-healthy' : metrics.nrr >= 80 ? 'kpi-warning' : 'kpi-danger'));

  // B2B CAC Payback
  if (metrics.b2bCACPayback !== null) {
    set('kpi-cac-payback-b2b-val', fmtNum.format(metrics.b2bCACPayback) + ' mo');
    cls('kpi-cac-payback-b2b', 'kpi-card ' + kpiColor(24 - metrics.b2bCACPayback, 12, 0));
  } else { set('kpi-cac-payback-b2b-val', '—'); }

  // Magic Number
  if (metrics.magicNumber !== null) {
    set('kpi-magic-val', metrics.magicNumber.toFixed(2));
    cls('kpi-magic', 'kpi-card ' + kpiColor(metrics.magicNumber, 0.75, 0.25));
  } else { set('kpi-magic-val', '—'); }

  // Badges
  set('rule40-val', fmtNum.format(metrics.rule40));
  set('rule40-detail', `${fmtNum.format(metrics.r40GrowthPct)}% growth + ${state.grossMarginPct}% margin`);
  const r40Badge = document.getElementById('rule40-badge');
  if (r40Badge) r40Badge.className = 'metric-badge ' + (metrics.rule40 >= 40 ? 'badge-healthy' : metrics.rule40 >= 20 ? 'badge-warning' : 'badge-danger');

  if (metrics.quickRatio !== null) {
    set('quick-ratio-val', metrics.quickRatio >= 99 ? '∞' : fmtNum.format(metrics.quickRatio));
    const qBadge = document.getElementById('quick-ratio-badge');
    if (qBadge) qBadge.className = 'metric-badge ' + kpiColor(metrics.quickRatio, 4, 1);
  } else { set('quick-ratio-val', '—'); }

  set('arpu-val', metrics.arpuM12 > 0 ? fmtCurrency.format(metrics.arpuM12) + '/mo' : '—');
  set('customers-val', fmtInt.format(metrics.customersM12));
  const m12data = projectCashFlow()[12]; // safe re-use
  set('customers-detail', `${fmtInt.format(m12data.b2bLogoCount)} logos + ${fmtInt.format(m12data.b2cSubCount)} subs`);

  if (metrics.b2cCACPayback !== null) {
    set('b2c-payback-val', fmtNum.format(metrics.b2cCACPayback) + ' mo');
    const b2cBadge = document.getElementById('b2c-payback-badge');
    if (b2cBadge) b2cBadge.className = 'metric-badge ' + kpiColor(12 - metrics.b2cCACPayback, 6, 0);
  } else { set('b2c-payback-val', '—'); }
}

// Color helper: green if val >= greenThreshold, yellow if val >= yellowThreshold, red otherwise
function kpiColor(val, greenThreshold, yellowThreshold) {
  if (val >= greenThreshold)  return 'kpi-healthy';
  if (val >= yellowThreshold) return 'kpi-warning';
  return 'kpi-danger';
}

/* ===================================================================
   CASH PROJECTION CHART (SVG)
=================================================================== */
function renderCashChart(projection) {
  const container = document.getElementById('cash-chart-container');
  if (!container) return;
  const W = Math.max(300, container.clientWidth);
  const H = 300;
  const PL = 84, PR = 24, PT = 20, PB = 44;
  const cW = W - PL - PR, cH = H - PT - PB;

  const worstVals  = projection.map(p => p.worstCash);
  const baseVals   = projection.map(p => p.cashBase);
  const raiseVals  = projection.map(p => p.cashWithRaise);
  const allVals    = [...worstVals, ...baseVals, ...raiseVals, 0];
  const rawMax     = Math.max(...allVals);
  const rawMin     = Math.min(...allVals);
  const pad        = (rawMax - rawMin) * 0.08 || 50000;
  const maxVal     = rawMax + pad;
  const minVal     = rawMin - pad;
  const range      = maxVal - minVal;

  const xS = i => PL + (i / (projection.length - 1)) * cW;
  const yS = v => PT + (1 - (v - minVal) / range) * cH;
  const NS = 'http://www.w3.org/2000/svg';

  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', H);
  svg.style.display = 'block';
  svg.style.fontFamily = 'JetBrains Mono, monospace';

  const mk = (tag, attrs) => {
    const el = document.createElementNS(NS, tag);
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    return el;
  };

  // Background
  svg.appendChild(mk('rect', { x: PL, y: PT, width: cW, height: cH, fill: 'rgba(22,22,26,0.5)', rx: '4' }));

  // Grid lines + Y labels
  const steps = 5;
  const yVals = Array.from({ length: steps + 1 }, (_, i) => minVal + range * i / steps);
  // Deduplicate labels
  const seenLabels = new Set();
  yVals.forEach(v => {
    const y = yS(v);
    svg.appendChild(mk('line', { x1: PL, y1: y, x2: W - PR, y2: y, stroke: '#2a2a2e', 'stroke-width': '1' }));
    const lbl = fmtCompact(v);
    if (!seenLabels.has(lbl)) {
      seenLabels.add(lbl);
      const t = mk('text', { x: PL - 6, y: y + 4, 'text-anchor': 'end', fill: '#5c5c6e', 'font-size': '10' });
      t.textContent = lbl;
      svg.appendChild(t);
    }
  });

  // Zero line
  const zy = yS(0);
  svg.appendChild(mk('line', { x1: PL, y1: zy, x2: W - PR, y2: zy, stroke: '#5c5c6e', 'stroke-dasharray': '5,3', 'stroke-width': '1.5' }));
  const zt = mk('text', { x: PL - 6, y: zy - 3, 'text-anchor': 'end', fill: '#5c5c6e', 'font-size': '9' });
  zt.textContent = '$0';
  svg.appendChild(zt);

  // X-axis labels
  for (let m = 0; m <= 36; m += 6) {
    const x = xS(m);
    svg.appendChild(mk('line', { x1: x, y1: PT + cH, x2: x, y2: PT + cH + 4, stroke: '#3a3a3e' }));
    const t = mk('text', { x, y: H - 8, 'text-anchor': 'middle', fill: '#5c5c6e', 'font-size': '10' });
    t.textContent = `M${m}`;
    svg.appendChild(t);
  }

  const buildPath = vals =>
    vals.map((v, i) => `${i === 0 ? 'M' : 'L'} ${xS(i).toFixed(1)} ${yS(v).toFixed(1)}`).join(' ');

  // Worst case
  svg.appendChild(mk('path', { d: buildPath(worstVals), fill: 'none', stroke: '#e17055', 'stroke-width': '1.5', 'stroke-dasharray': '6,3', opacity: '0.55' }));

  // Base projected (no raise)
  svg.appendChild(mk('path', { d: buildPath(baseVals), fill: 'none', stroke: '#4A5FE0', 'stroke-width': '2', opacity: '0.45', 'stroke-dasharray': state.plannedRaise > 0 ? '6,3' : 'none' }));

  // Projected with raise (main line)
  const raisePath = mk('path', { d: buildPath(raiseVals), fill: 'none', stroke: '#4A5FE0', 'stroke-width': '2.5' });
  svg.appendChild(raisePath);

  // Raise event marker
  if (state.plannedRaise > 0) {
    const rx = xS(state.raiseCloseMonth);
    svg.appendChild(mk('line', { x1: rx, y1: PT, x2: rx, y2: PT + cH, stroke: '#00b894', 'stroke-dasharray': '4,3', 'stroke-width': '1.5', opacity: '0.7' }));
    const rl = mk('text', { x: rx + 4, y: PT + 14, fill: '#00b894', 'font-size': '10' });
    rl.textContent = `+${fmtCompact(state.plannedRaise)} raise`;
    svg.appendChild(rl);
  }

  // Break-even dot
  const bei = projection.findIndex(p => p.totalMRR >= state.grossBurn);
  if (bei > 0) {
    svg.appendChild(mk('circle', { cx: xS(bei), cy: yS(raiseVals[bei]), r: '5', fill: '#00b894' }));
    const bel = mk('text', { x: xS(bei) + 7, y: yS(raiseVals[bei]) - 5, fill: '#00b894', 'font-size': '10' });
    bel.textContent = `Break-even`;
    svg.appendChild(bel);
  }

  // Zero crossing (raise path)
  const zi = projection.findIndex(p => p.cashWithRaise <= 0);
  if (zi > 0) {
    svg.appendChild(mk('circle', { cx: xS(zi), cy: yS(0), r: '5', fill: '#e17055' }));
    const zl = mk('text', { x: xS(zi) + 7, y: yS(0) - 5, fill: '#e17055', 'font-size': '10' });
    zl.textContent = `Cash out`;
    svg.appendChild(zl);
  }

  // Target runway vertical line
  if (state.targetRunwayMonths <= 36) {
    const tx = xS(state.targetRunwayMonths);
    svg.appendChild(mk('line', { x1: tx, y1: PT, x2: tx, y2: PT + cH, stroke: '#fdcb6e', 'stroke-dasharray': '3,3', 'stroke-width': '1', opacity: '0.6' }));
    const tl = mk('text', { x: tx + 3, y: PT + 28, fill: '#fdcb6e', 'font-size': '9' });
    tl.textContent = `Target`;
    svg.appendChild(tl);
  }

  container.innerHTML = '';
  container.appendChild(svg);
}

/* ===================================================================
   MRR GROWTH CHART
=================================================================== */
function renderMRRChart(projection) {
  const container = document.getElementById('mrr-chart-container');
  if (!container) return;

  const checkMonths = [1, 3, 6, 9, 12, 18, 24, 30, 36].filter(m => m < projection.length);
  const lastP = projection[projection.length - 1];

  if (lastP.totalMRR === 0) {
    container.innerHTML = '<p class="chart-empty">Set B2B or B2C inputs above to see MRR growth</p>';
    return;
  }

  container.innerHTML = '';
  const maxMRR = Math.max(...checkMonths.map(m => projection[m].totalMRR), state.grossBurn);

  checkMonths.forEach(m => {
    const p       = projection[m];
    const b2bPct  = (p.b2bMRR  / maxMRR) * 100;
    const b2cPct  = (p.b2cMRR  / maxMRR) * 100;
    const burnPct = (state.grossBurn / maxMRR) * 100;
    const isAboveBurn = p.totalMRR >= state.grossBurn;

    const row = document.createElement('div');
    row.className = 'chart-bar-row';
    row.innerHTML = `
      <span class="chart-label" style="width:44px;text-align:right">M${m}</span>
      <div class="chart-bar-track" style="position:relative">
        <div style="position:absolute;inset:0;display:flex;gap:1px">
          <div class="chart-bar-fill color-0" style="width:${b2bPct.toFixed(1)}%">
            ${b2bPct > 14 ? `<span>${fmtCompact(p.b2bMRR)}</span>` : ''}
          </div>
          <div class="chart-bar-fill color-2" style="width:${b2cPct.toFixed(1)}%">
            ${b2cPct > 10 ? `<span>${fmtCompact(p.b2cMRR)}</span>` : ''}
          </div>
        </div>
        <div style="position:absolute;top:0;bottom:0;left:${burnPct.toFixed(1)}%;width:2px;background:#fdcb6e;opacity:0.85;pointer-events:none"></div>
      </div>
      <span class="chart-bar-value" style="${isAboveBurn ? 'color:var(--color-success)' : ''}">${fmtCompact(p.totalMRR)}/mo</span>
    `;
    container.appendChild(row);
  });

  const legend = document.createElement('div');
  legend.className = 'mrr-legend';
  legend.innerHTML = `
    <span class="legend-item"><span class="legend-dot" style="background:#4A5FE0"></span>B2B MRR</span>
    <span class="legend-item"><span class="legend-dot" style="background:#00b894"></span>B2C MRR</span>
    <span class="legend-item"><span class="legend-dot" style="background:#fdcb6e"></span>Gross Burn (${fmtCompact(state.grossBurn)}/mo)</span>
  `;
  container.appendChild(legend);
}

/* ===================================================================
   CUSTOMER GROWTH CHART
=================================================================== */
function renderCustomerChart(projection) {
  const container = document.getElementById('customer-chart-container');
  if (!container) return;

  const checkMonths = [3, 6, 9, 12, 18, 24, 30, 36].filter(m => m < projection.length);
  const maxCust = Math.max(...checkMonths.map(m => projection[m].totalCustomers), 1);

  if (maxCust <= 0) {
    container.innerHTML = '<p class="chart-empty">Set new logos or subscribers above</p>';
    return;
  }

  container.innerHTML = '';
  checkMonths.forEach(m => {
    const p       = projection[m];
    const b2bPct  = (p.b2bLogoCount / maxCust) * 100;
    const b2cPct  = (p.b2cSubCount  / maxCust) * 100;

    const row = document.createElement('div');
    row.className = 'chart-bar-row';
    row.innerHTML = `
      <span class="chart-label" style="width:44px;text-align:right">M${m}</span>
      <div class="chart-bar-track" style="position:relative">
        <div style="position:absolute;inset:0;display:flex;gap:1px">
          <div class="chart-bar-fill color-0" style="width:${b2bPct.toFixed(1)}%">
            ${b2bPct > 16 ? `<span>${p.b2bLogoCount}</span>` : ''}
          </div>
          <div class="chart-bar-fill color-2" style="width:${b2cPct.toFixed(1)}%">
            ${b2cPct > 12 ? `<span>${p.b2cSubCount}</span>` : ''}
          </div>
        </div>
      </div>
      <span class="chart-bar-value">${fmtInt.format(p.totalCustomers)}</span>
    `;
    container.appendChild(row);
  });

  const legend = document.createElement('div');
  legend.className = 'mrr-legend';
  legend.innerHTML = `
    <span class="legend-item"><span class="legend-dot" style="background:#4A5FE0"></span>B2B Logos</span>
    <span class="legend-item"><span class="legend-dot" style="background:#00b894"></span>B2C Subscribers</span>
  `;
  container.appendChild(legend);
}

/* ===================================================================
   SENSITIVITY TABLE
=================================================================== */
function renderSensitivityTable() {
  const container = document.getElementById('sensitivity-container');
  if (!container) return;

  const logoOptions = [1, 2, 3, 5, 10];
  const dealOptions = [2000, 5000, 10000, 20000, 50000];
  const burn = state.grossBurn;

  let html = `<div class="sensitivity-table-wrap"><table class="sensitivity-table">
    <thead><tr>
      <th>Logos/mo \\ Deal Revenue</th>
      ${dealOptions.map(d => `<th>${fmtCompact(d)}/mo</th>`).join('')}
    </tr></thead><tbody>`;

  logoOptions.forEach(logos => {
    html += `<tr><td class="sens-row-label">${logos} logo${logos > 1 ? 's' : ''}/mo</td>`;
    dealOptions.forEach(deal => {
      let mrrSim = 0;
      let beMonth = null;
      for (let m = 1; m <= 36; m++) {
        if (m > state.salesCycleMo) mrrSim += logos * deal;
        // Apply churn AND expansion consistently with main projection
        mrrSim *= (1 - state.b2bAnnualChurn / 100 / 12 + state.expansionPct / 100 / 12);
        if (mrrSim >= burn && beMonth === null) { beMonth = m; break; }
      }
      const cls = beMonth === null  ? 'sens-never'
                : beMonth <= 12     ? 'sens-good'
                : beMonth <= 24     ? 'sens-ok'
                :                     'sens-late';
      html += `<td class="${cls}">${beMonth !== null ? `M${beMonth}` : '—'}</td>`;
    });
    html += '</tr>';
  });

  html += '</tbody></table></div>';
  container.innerHTML = html;
}

/* ===================================================================
   MONTHLY PROJECTION TABLE
=================================================================== */
function renderMonthlyTable(projection) {
  const wrap = document.getElementById('monthly-table-wrap');
  if (!wrap || wrap.classList.contains('hidden')) return;

  let html = `<div class="monthly-scroll"><table class="monthly-table">
    <thead><tr>
      <th>Mo</th>
      <th>Cash (w/ Raise)</th>
      <th>B2B MRR</th>
      <th>B2C MRR</th>
      <th>Total MRR</th>
      <th>Net Burn</th>
      <th>New MRR</th>
      <th>Churn</th>
      <th>B2B Logos</th>
      <th>B2C Subs</th>
      <th>ARPU</th>
      <th>Runway</th>
    </tr></thead><tbody>`;

  projection.forEach(p => {
    const runwayMo = p.netBurn > 0 ? (p.cashWithRaise / p.netBurn) : Infinity;
    const runwayStr = runwayMo === Infinity ? '∞' : fmtNum.format(runwayMo) + ' mo';
    const cashCls = p.cashWithRaise < 0 ? 'color:#e17055'
      : p.cashWithRaise < state.grossBurn * 2 ? 'color:#fdcb6e' : '';
    const burnCls = p.netBurn > 0 ? 'color:#fdcb6e' : p.netBurn < 0 ? 'color:#00b894' : '';

    html += `<tr>
      <td class="mono" style="text-align:center;font-weight:600">${p.m}</td>
      <td class="mono" style="${cashCls}">${fmtCurrency.format(p.cashWithRaise)}</td>
      <td class="mono">${fmtCurrency.format(p.b2bMRR)}</td>
      <td class="mono">${fmtCurrency.format(p.b2cMRR)}</td>
      <td class="mono;font-weight:500">${fmtCurrency.format(p.totalMRR)}</td>
      <td class="mono" style="${burnCls}">${fmtCurrency.format(p.netBurn)}</td>
      <td class="mono" style="color:var(--color-success)">${p.newMRR > 0 ? '+' + fmtCurrency.format(p.newMRR) : '—'}</td>
      <td class="mono" style="color:#e17055">${p.churnLoss > 0 ? '-' + fmtCurrency.format(p.churnLoss) : '—'}</td>
      <td class="mono" style="text-align:center">${p.b2bLogoCount}</td>
      <td class="mono" style="text-align:center">${p.b2cSubCount}</td>
      <td class="mono">${p.arpu > 0 ? fmtCurrency.format(p.arpu) : '—'}</td>
      <td class="mono">${runwayStr}</td>
    </tr>`;
  });

  html += '</tbody></table></div>';
  wrap.innerHTML = html;
}

/* ===================================================================
   MAIN RECALCULATE
=================================================================== */
function recalculate() {
  const projection = projectCashFlow();
  const metrics    = getDerivedMetrics(projection);

  updateInlineStats(metrics);
  updateVerdict(metrics);
  updateKPIs(metrics);
  renderCashChart(projection);
  renderMRRChart(projection);
  renderCustomerChart(projection);
  renderSensitivityTable();

  // Monthly table: re-render if currently visible
  const wrap = document.getElementById('monthly-table-wrap');
  if (wrap && !wrap.classList.contains('hidden')) {
    renderMonthlyTable(projection);
  }
}

/* ===== Reveal Observer ===== */
function initRevealObserver() {
  const reveals = document.querySelectorAll('.reveal');
  if (!reveals.length) return;
  const observer = new IntersectionObserver(
    entries => entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('visible'); observer.unobserve(e.target); }
    }),
    { threshold: 0.06, rootMargin: '0px 0px -40px 0px' }
  );
  reveals.forEach(el => observer.observe(el));
}
