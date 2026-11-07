// ---------- Copy BibTeX ----------
const button = document.querySelector('#copy-citation');
button.addEventListener('click', async () => {
  const text = document.querySelector('#bibtex').textContent;
  const status = document.querySelector('#copy-status');
  try {
    await navigator.clipboard.writeText(text);
    button.textContent = 'Copied!';
    status.textContent = 'BibTeX copied to clipboard.';
  } catch {
    const range = document.createRange();
    range.selectNodeContents(document.querySelector('#bibtex'));
    const selection = window.getSelection();
    selection.removeAllRanges(); selection.addRange(range);
    button.textContent = 'Select & copy';
    status.textContent = 'Citation selected. Press Control C or Command C to copy.';
  }
  window.setTimeout(() => { button.textContent = 'Copy BibTeX'; }, 2500);
});

// ---------- Performance chart ----------
// Same conventions as the paper (Table 1 and Fig. 4c): psnr = mean PSNR (dB); mse = mean per-problem MSE in the
// normalized, clipped frame behind PSNR; t = mean seconds per problem from the evaluation run
// (multi_node_run_FULL_FINAL_2; U-Net = matched (u8,f) corrector from eval_rebuttal), including the 8-walk WoS input
// for every corrector. Every method is averaged over all test problems it covers (4,951 across five families;
// WoS 16,384: 4,949). DiffusionPDE / CoCoGen have teachers only for Laplace/Poisson/Yukawa, so they average those
// 2,956 problems (diffusion_fair/full/B_full_merged.csv); their time = mean 8-walk WoS time on those problems +
// 11.487 s mean sampling (100 steps, batch 1, no compile; diffusion_fair timing benchmark), as in paper Fig. 4.
// The FNO operator predicts from the source term alone (no WoS input).
const METHODS = [
  { key: 'fnoop', name: 'FNO',             note: 'Prior work · neural operator',   short: 'FNO operator', t: 0.017,  psnr: 7.74,  mse: 0.2579,   kind: 'base'  },
  { key: 'wos8',  name: 'Walk-on-Spheres', note: '8 walks per point',              short: '8 walks',      t: 1.689,  psnr: 15.26, mse: 0.08017,  kind: 'wos'   },
  { key: 'coco',  name: 'CoCoGen',         note: 'Prior work · diffusion (Laplace, Poisson, Yukawa only)', short: '', t: 12.910, psnr: 30.07, mse: 0.008804, kind: 'base' },
  { key: 'dpde',  name: 'DiffusionPDE',    note: 'Prior work · diffusion (Laplace, Poisson, Yukawa only)', short: 'DiffusionPDE / CoCoGen', t: 12.910, psnr: 30.42, mse: 0.007464, kind: 'base' },
  { key: 'fno',   name: 'FNO corrector',   note: 'Our framework · FNO backbone',   short: 'FNO',          t: 1.708,  psnr: 31.00, mse: 0.01319,  kind: 'frame' },
  { key: 'unet',  name: 'U-Net corrector', note: 'Our framework · U-Net backbone', short: 'U-Net',        t: 1.755,  psnr: 37.32, mse: 0.006043, kind: 'frame' },
  { key: 'wos16', name: 'Walk-on-Spheres', note: '16,384 walks per point',         short: '',             t: 91.925, psnr: 42.14, mse: 0.003133, kind: 'wos'   },
  { key: 'mc2',   name: 'MC²',             note: 'Our framework · MC² corrector',  short: 'MC²',          t: 1.753,  psnr: 44.90, mse: 0.001938, kind: 'ours'  },
];
// Walk-on-Spheres at increasing walks per point (same run, all problems): [walks, mean seconds, mean PSNR, mean MSE].
// 16-256 run inside one batch of 256 walks, so their times are nearly identical (as in the paper's figure).
const WOS_CURVE = [
  [8, 1.689, 15.26, 0.08017], [16, 1.698, 16.99, 0.071], [32, 1.706, 18.91, 0.06091], [64, 1.715, 21.03, 0.05059],
  [128, 1.724, 23.31, 0.04066], [256, 1.735, 25.74, 0.0316], [512, 3.174, 28.29, 0.0237], [1024, 6.049, 30.94, 0.01713],
  [2048, 11.789, 33.67, 0.01189], [4096, 23.247, 36.46, 0.007912], [8192, 46.144, 39.29, 0.005067],
  [16384, 91.925, 42.14, 0.003133], [32768, 183.482, 44.98, 0.001882], [65536, 366.503, 47.80, 0.001111],
  [131072, 732.825, 50.60, 0.0006562],
];
const COLORS = { ours: '#8c1515', frame: '#c98a8a', wos: '#5f7182', base: '#8d939c' };

const LEG = [[COLORS.ours, 'MC²'], [COLORS.frame, 'Our framework, standard backbones'], [COLORS.base, 'Prior work'], [COLORS.wos, 'Walk-on-Spheres']];

const VIEWS = {
  scatter:  { title: 'Error vs. time per problem', sub: 'Mean MSE against the analytic solution, as in the paper’s Fig. 4(c). Down and to the left is better. Both axes logarithmic.' },
  accuracy: { title: 'Accuracy', sub: 'Mean PSNR (dB) against the analytic solution, as in the paper’s Table 1. Higher is better.' },
  time:     { title: 'Inference time per problem', sub: 'Mean wall-clock from the evaluation run, including the 8-walk WoS input where used. Lower is better.' },
};

const chartEl = document.querySelector('#perf-chart');
const legendEl = document.querySelector('#perf-legend');
let view = 'scatter';

const fmtT = t => t < 0.1 ? `${Math.round(t * 1000)} ms` : t < 10 ? `${t.toFixed(2)} s` : t < 100 ? `${t.toFixed(1)} s` : `${Math.round(t)} s`;
const SUP = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
const fmtE = v => { const e = Math.floor(Math.log10(v)), m = v / 10 ** e;
  return `${m.toFixed(1)} × 10${String(e).split('').map(c => SUP[c]).join('')}`; };
const fmtB = b => b.toLocaleString('en-US');
const svgNS = 'http://www.w3.org/2000/svg';
function el(tag, attrs = {}, parent) {
  const e = document.createElementNS(svgNS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (parent) parent.appendChild(e);
  return e;
}

// Tooltip
const tip = document.createElement('div');
tip.className = 'perf-tip'; tip.setAttribute('role', 'status'); tip.hidden = true;
chartEl.parentElement.style.position = 'relative';
chartEl.parentElement.appendChild(tip);
function showTip(html, x, y) {
  tip.innerHTML = html; tip.hidden = false;
  const box = chartEl.parentElement.getBoundingClientRect();
  const w = tip.offsetWidth, h = tip.offsetHeight;
  let left = x - box.left + 14, top = y - box.top - h - 10;
  if (left + w > box.width - 4) left = x - box.left - w - 14;
  if (top < 0) top = y - box.top + 14;
  tip.style.left = `${Math.max(4, left)}px`; tip.style.top = `${top}px`;
}
const hideTip = () => { tip.hidden = true; };
const tipFor = m => `<b>${m.name}</b><span>${m.note}</span><span>${fmtT(m.t)} · ${m.psnr.toFixed(2)} dB · MSE ${fmtE(m.mse)}</span>`;
function bindTip(node, html) {
  node.setAttribute('tabindex', '0');
  node.addEventListener('mouseenter', e => showTip(html, e.clientX, e.clientY));
  node.addEventListener('mousemove', e => showTip(html, e.clientX, e.clientY));
  node.addEventListener('mouseleave', hideTip);
  node.addEventListener('focus', () => { const r = node.getBoundingClientRect(); showTip(html, r.left + r.width / 2, r.top); });
  node.addEventListener('blur', hideTip);
}

function legend(items) {
  legendEl.innerHTML = items.map(([c, label, shape]) =>
    `<span><i class="lg ${shape || 'dot'}" style="background:${c}"></i>${label}</span>`).join('');
}

// ---- View 1: error vs. time scatter (log-log; lower MSE is better) ----
// Time at which the WoS curve reaches a given MSE (log-log interpolation between budgets).
function wosTimeFor(mse) {
  for (let i = 1; i < WOS_CURVE.length; i++) {
    const [, ta, , ma] = WOS_CURVE[i - 1], [, tb, , mb] = WOS_CURVE[i];
    if (mb <= mse) {
      const f = (Math.log10(mse) - Math.log10(ma)) / (Math.log10(mb) - Math.log10(ma));
      return 10 ** (Math.log10(ta) + f * (Math.log10(tb) - Math.log10(ta)));
    }
  }
  return null;
}
function walksBracket(mse) {
  const i = WOS_CURVE.findIndex(r => r[3] <= mse);
  return i > 0 ? [WOS_CURVE[i - 1][0], WOS_CURVE[i][0]] : null;
}

function drawScatter() {
  const W = chartEl.clientWidth, narrow = W < 560;
  const H = narrow ? 340 : 420;
  const m = { l: narrow ? 50 : 64, r: narrow ? 22 : 28, t: 18, b: 48 };
  const x0 = Math.log10(0.8), x1 = 3, y0 = Math.log10(4e-4), y1 = Math.log10(0.15);  // 0.8-1000 s, MSE 4e-4 to 0.15
  const X = t => m.l + (Math.log10(t) - x0) / (x1 - x0) * (W - m.l - m.r);
  const Y = v => m.t + (1 - (Math.log10(v) - y0) / (y1 - y0)) * (H - m.t - m.b);
  const fs = narrow ? 11 : 12.5;
  const sup = e => `10${String(e).split('').map(c => SUP[c]).join('')}`;
  const get = k => METHODS.find(e => e.key === k);
  const mc2 = get('mc2');
  // 16-256 walks run inside one batch of 256 walks (near-identical times), so the curve skips them (dotted segment)
  const curve = WOS_CURVE.filter(([b]) => b === 8 || b >= 512);
  const tMatch = wosTimeFor(mc2.mse), br = walksBracket(mc2.mse);
  const left = m.l, right = W - m.r, top = m.t, bottom = Y(10 ** y0);
  const svg = el('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: 'img',
    'aria-label': 'Scatter plot of mean MSE against mean time per problem, both on log scales. MC² has the lowest error of any method at about 1.75 s. Walk-on-Spheres needs between 16,384 and 32,768 walks per point to reach the same error. Diffusion points average only the Laplace, Poisson and Yukawa problems. The FNO neural operator is off the chart at 17 ms and MSE 0.26.' });

  // grid, ticks, axis titles
  for (const e of [-3, -2, -1]) {
    el('line', { x1: left, x2: right, y1: Y(10 ** e), y2: Y(10 ** e), class: 'grid' }, svg);
    el('text', { x: left - 8, y: Y(10 ** e) + 4, 'text-anchor': 'end', class: 'tick', 'font-size': fs - 1.5 }, svg).textContent = sup(e);
  }
  for (const t of [1, 10, 100, 1000]) {
    el('line', { x1: X(t), x2: X(t), y1: top, y2: bottom, class: 'grid' }, svg);
    el('text', { x: X(t), y: bottom + 18, 'text-anchor': t === 1000 && narrow ? 'end' : 'middle', class: 'tick', 'font-size': fs - 1.5 }, svg)
      .textContent = `${t.toLocaleString('en-US')} s`;
  }
  el('line', { x1: left, x2: right, y1: bottom, y2: bottom, class: 'baseline' }, svg);
  el('text', { x: (left + right) / 2, y: H - 6, 'text-anchor': 'middle', class: 'axis-title', 'font-size': fs - 1 }, svg).textContent = 'Mean time per problem (log scale)';
  el('text', { x: 0, y: 0, 'text-anchor': 'middle', class: 'axis-title', 'font-size': fs - 1,
    transform: `translate(${narrow ? 12 : 16},${(top + bottom) / 2}) rotate(-90)` }, svg).textContent = 'Mean MSE (log scale)';

  // Shaded region under the WoS curve: lower error than WoS in the same time
  const pt = ([, t, , v]) => `${X(t).toFixed(1)},${Y(v).toFixed(1)}`;
  const first = curve[0], last = curve[curve.length - 1];
  el('path', { class: 'beat-zone', d: 'M' + curve.map(pt).join('L') +
    `L${X(last[1]).toFixed(1)},${bottom}L${X(first[1]).toFixed(1)},${bottom}Z` }, svg);
  el('text', { x: right - 8, y: bottom - 10, 'text-anchor': 'end', class: 'zone-label', 'font-size': fs - 1.5 }, svg).textContent =
    narrow ? 'Shaded: beats WoS at equal time' : 'Shaded: lower error than WoS in the same time';

  // WoS curve: dotted across the skipped 16-256 budgets, solid from 512 on
  el('path', { d: `M${pt(curve[0])}L${pt(curve[1])}`, class: 'wos-line gap' }, svg);
  el('path', { d: 'M' + curve.slice(1).map(pt).join('L'), class: 'wos-line' }, svg);
  const tagged = narrow ? [16384, 131072] : [512, 2048, 16384, 131072];
  for (const [b, t, , v] of curve) {
    if (b === 8) continue;  // drawn with the methods below
    const c = el('circle', { cx: X(t), cy: Y(v), r: b === 16384 ? 5 : 3.2, class: 'pt wos small' }, svg);
    bindTip(c, `<b>Walk-on-Spheres</b><span>${fmtB(b)} walks per point</span><span>${fmtT(t)} · MSE ${fmtE(v)}</span>`);
    if (tagged.includes(b)) {
      const txt = narrow && b >= 1000 ? `${Math.floor(b / 1000)}k` : fmtB(b);
      if (b === 512) el('text', { x: X(t) + 7, y: Y(v) - 7, class: 'walks', 'font-size': fs - 2 }, svg).textContent = `${txt} walks`;
      else el('text', { x: X(t) + 2, y: Y(v) - 11, 'text-anchor': 'middle', class: 'walks', 'font-size': fs - 2 }, svg).textContent = txt;
    }
  }

  // Gap annotation at MC²'s error level
  if (tMatch) {
    const ya = Y(mc2.mse);
    el('line', { x1: X(mc2.t) + 13, x2: X(tMatch) - 7, y1: ya, y2: ya, class: 'gap-arrow' }, svg);
    el('circle', { cx: X(tMatch), cy: ya, r: 4.5, class: 'match' }, svg);
    el('text', { x: (X(mc2.t) + X(tMatch)) / 2, y: ya + 18, 'text-anchor': 'middle', class: 'gap-label', 'font-size': fs - 0.5 }, svg).textContent =
      narrow ? `WoS needs ${Math.floor(br[0] / 1000)}k–${Math.floor(br[1] / 1000)}k walks to match`
             : `WoS needs ${fmtB(br[0])}–${fmtB(br[1])} walks per point to match MC²`;
  }

  // Methods (MC² drawn last so it sits on top)
  const dot = (d, r, cls) => bindTip(el('circle', { cx: X(d.t), cy: Y(d.mse), r, class: cls }, svg), tipFor(d));
  dot(get('wos8'), 5, 'pt wos');
  dot(get('coco'), 5, 'pt base hollow');
  dot(get('dpde'), 5.5, 'pt base');
  dot(get('fno'), 6, 'pt frame');
  dot(get('unet'), 6, 'pt frame');
  dot(mc2, 8.5, 'pt ours');
  const label = (txt, x, y, cls, anchor = 'end', size = fs) => {
    el('text', { x, y, 'text-anchor': anchor, class: `pt-label ${cls}`, 'font-size': size }, svg).textContent = txt;
  };
  label('MC²', X(mc2.t) - 15, Y(mc2.mse) + 5, 'ours', 'end', fs + 3);
  for (const k of ['unet', 'fno']) { const d = get(k); label(d.short, X(d.t) - 12, Y(d.mse) + 4, 'frame'); }
  const w8 = get('wos8'); label('8 walks', X(w8.t) - 11, Y(w8.mse) + 4, 'wos');
  const dp = get('dpde'), cc = get('coco');
  if (narrow) label('Diffusion*', X(dp.t) + 9, Y(dp.mse) + 15, '', 'start', fs - 1);
  else {
    label('CoCoGen*', X(cc.t) + 10, Y(cc.mse) + 1, '', 'start', fs - 1);
    label('DiffusionPDE*', X(dp.t) + 10, Y(dp.mse) + 13, '', 'start', fs - 1);
  }

  // FNO operator sits far off the chart (17 ms, MSE 0.26): note in the top-right corner
  const fo = get('fnoop');
  const g = el('g', { class: 'offchart' }, svg);
  el('text', { x: right - 6, y: top + 14, 'text-anchor': 'end', class: 'pt-label off', 'font-size': fs - 1.5 }, g).textContent =
    narrow ? 'FNO operator: off chart' : `FNO (neural operator, source term only): ${fmtT(fo.t)}, MSE ${fo.mse.toFixed(2)}, off chart ↗`;
  bindTip(g, tipFor(fo));

  chartEl.replaceChildren(svg);
  legend(LEG);
}

// ---- View 2: accuracy bars ----
function drawAccuracy() {
  const rows = METHODS.map(d => {
    const cls = d.kind === 'ours' ? 'ours' : d.kind === 'frame' ? 'frame' : d.key === 'wos16' ? 'high-mc' : d.key === 'wos8' ? 'wos-lo' : '';
    return `<div class="bar-row ${cls}" data-key="${d.key}"><span class="bl">${d.name}<small>${d.note}</small></span>` +
      `<div class="track"><div style="width:${(d.psnr / 60 * 100).toFixed(2)}%"></div></div><b>${d.psnr.toFixed(2)}</b></div>`;
  }).join('');
  chartEl.innerHTML = `<div class="vbars" role="img" aria-label="Mean PSNR in dB for eight methods; values are listed beside each bar.">${rows}` +
    `<div class="axis" aria-hidden="true"><span>0</span><span>20</span><span>40</span><span>60 dB</span></div></div>`;
  chartEl.querySelectorAll('.bar-row').forEach(r => bindTip(r, tipFor(METHODS.find(d => d.key === r.dataset.key))));
  legend(LEG.map(([c, l]) => [c === COLORS.base ? '#c3c7ce' : c === COLORS.frame ? '#ddb3b3' : c, l, 'bar']));
}

// ---- View 3: time per problem (linear axis); each bar runs from zero to its value ----
function drawTime() {
  const max = 100;
  const pos = t => (t / max * 100).toFixed(2);
  const sorted = [...METHODS].sort((a, b) => a.t - b.t);
  const rows = sorted.map(d => {
    const cls = d.kind;
    return `<div class="dot-row ${cls}" data-key="${d.key}"><span class="bl">${d.name}<small>${d.note}</small></span>` +
      `<div class="dot-track"><i class="stem" style="width:${pos(d.t)}%"></i><i class="dot" style="left:${pos(d.t)}%"></i></div>` +
      `<b>${fmtT(d.t)}</b></div>`;
  }).join('');
  const ticks = [0, 25, 50, 75, 100];
  chartEl.innerHTML = `<div class="dots" role="img" aria-label="Mean time per problem for each method, linear scale; values are listed beside each row.">${rows}` +
    `<div class="dot-axis" aria-hidden="true">${ticks.map(t => `<span style="left:${pos(t)}%">${t} s</span>`).join('')}</div></div>`;
  chartEl.querySelectorAll('.dot-row').forEach(r => bindTip(r, tipFor(METHODS.find(d => d.key === r.dataset.key))));
  legend(LEG);
}

function render() {
  hideTip();
  document.querySelector('#perf-title').textContent = VIEWS[view].title;
  document.querySelector('#perf-sub').textContent = VIEWS[view].sub;
  chartEl.dataset.view = view;
  ({ scatter: drawScatter, accuracy: drawAccuracy, time: drawTime })[view]();
}

// Tabs (click + arrow keys)
const tabs = [...document.querySelectorAll('.tabs [role="tab"]')];
function select(tab) {
  tabs.forEach(t => { const on = t === tab; t.setAttribute('aria-selected', on); t.tabIndex = on ? 0 : -1; });
  document.querySelector('#perf-panel').setAttribute('aria-labelledby', tab.id);
  view = tab.dataset.view;
  render();
}
tabs.forEach((t, i) => {
  t.addEventListener('click', () => select(t));
  t.addEventListener('keydown', e => {
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (d) { const n = tabs[(i + d + tabs.length) % tabs.length]; n.focus(); select(n); }
  });
});
select(tabs.find(t => t.dataset.view === view));

let rt;
new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(() => { if (view === 'scatter') drawScatter(); }, 80); }).observe(chartEl);
