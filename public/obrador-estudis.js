/* Estudis de costos (com el PiC): abans de licitar, cost unitari previst de cada partida per naturaleses.
   MOA €/ut = hores × preu de mà d'obra ÷ amidament. MAT, LLOG, IND i sense detall: €/ut (es poden escriure fórmules amb els codis de preus, p. ex. =MORTER*0,02).
   Cost total = (cost directe + indirecte) ÷ (1 − estructura). Benefici o risc = venda − cost total. K = preu de venda ÷ cost directe unitari. */

/* ---------- Menú: obres primer ---------- */
(() => {
  const tot = {}; NAV.forEach((g) => g.items.forEach((i) => { tot[i[0]] = i; }));
  const it = (k, l) => { const i = tot[k]; return i ? [k, l || i[1], i[2]] : null; };
  const grups = [[null, ['tauler']], ['Obres', ['obres', 'partides', 'modificats', 'certificacions', 'parts']], ['Compres', ['comandes', 'proformes', 'factures']], ['Control', ['gestio']], ['Licitació', ['oportunitats', 'estudis', 'ofertes']], ['Empresa', ['tercers', 'personal', 'actius', 'qualitat', 'documents']]];
  const usats = new Set(grups.flatMap((g) => g[1])), resta = Object.keys(tot).filter((k) => !usats.has(k));
  const nou = grups.map(([g, ks]) => ({ g, items: ks.map((k) => it(k)).filter(Boolean) }));
  if (resta.length) nou[nou.length - 1].items.push(...resta.map((k) => it(k)));
  NAV.splice(0, NAV.length, ...nou);
})();

/* ---------- Dades i càlculs ---------- */
const EST_ESTATS = ['En curs', 'Presentat', 'Adjudicat', 'Perdut', 'Arxivat'];
Object.assign(TONE, { 'En curs': 'info', Presentat: 'warn', Adjudicat: 'ok', Perdut: 'bad', Arxivat: 'neu' });
const NATS = [['moa', 'MOA'], ['mat', 'MAT'], ['llog', 'LLOG'], ['ind', 'IND'], ['sd', 'Sense detall']];
/* Fórmules: números, codis de preus, + − × ÷ i parèntesis */
function evalua(raw, preus) {
  if (raw == null || raw === '') return 0;
  if (typeof raw === 'number') return raw;
  const s = String(raw).trim(); if (!s) return 0;
  if (s[0] !== '=') return nv(s);
  const tk = [], re = /\s*(\d+(?:[.,]\d+)?|[A-Za-zÀ-ÿ_][\wÀ-ÿ]*|[-+*/()×÷x])/y; let m, i = 1;
  re.lastIndex = 1;
  while (re.lastIndex < s.length && (m = re.exec(s))) { tk.push(m[1]); i = re.lastIndex; }
  if (s.slice(i).trim()) return NaN;
  const pr = {}; (preus || []).forEach((p) => { if (p.codi) pr[String(p.codi).toUpperCase()] = nv(p.preu); });
  let k = 0;
  const atom = () => { const t = tk[k++]; if (t === '(') { const v = expr(); if (tk[k++] !== ')') return NaN; return v; } if (t === '-') return -atom(); if (t === '+') return atom(); if (t == null) return NaN; if (/^\d/.test(t)) return +t.replace(',', '.'); const v = pr[t.toUpperCase()]; return v == null ? NaN : v; };
  const term = () => { let v = atom(); while (['*', '/', '×', '÷', 'x'].includes(tk[k])) { const o = tk[k++], w = atom(); v = o === '/' || o === '÷' ? v / w : v * w; } return v; };
  const expr = () => { let v = term(); while (tk[k] === '+' || tk[k] === '-') { const o = tk[k++], w = term(); v = o === '+' ? v + w : v - w; } return v; };
  const v = expr(); return k === tk.length && isFinite(v) ? v : NaN;
}
const preuDe = (d, codi) => { const p = (d.preus || []).find((x) => String(x.codi).toUpperCase() === String(codi || '').toUpperCase()); return p ? nv(p.preu) : NaN; };
function estPart(d, p) {
  const am = evalua(p.am, d.preus), pv = evalua(p.pv, d.preus), h = evalua(p.h, d.preus), pmo = preuDe(d, p.mo || d.moCodi || 'MOMIG');
  const u = { moa: am ? (h ? h * (isNaN(pmo) ? NaN : pmo) / am : 0) : 0, mat: evalua(p.mat, d.preus), llog: evalua(p.llog, d.preus), ind: evalua(p.ind, d.preus), sd: evalua(p.sd, d.preus) };
  const tot = sum(NATS, ([k]) => u[k]), mal = [am, pv, tot].some((x) => isNaN(x));
  return { am, pv, h, u, tot, venda: am * pv, cost: am * tot, k: tot ? pv / tot : null, mal, sense: !mal && !tot && !!am };
}
function estResum(d) {
  const r = { venda: 0, cd: 0, ci: 0, hores: 0, nat: {}, cc: {}, mal: 0, sense: 0 }; NATS.forEach(([k]) => { r.nat[k] = 0; });
  (d.partides || []).forEach((p) => {
    const c = estPart(d, p); if (c.mal) { r.mal++; return; } if (c.sense) r.sense++;
    const ind = p.tipus === 'Indirecte', g = r.cc[p.cc || 'Sense centre de cost'] || (r.cc[p.cc || 'Sense centre de cost'] = { venda: 0, cost: 0, nat: {} });
    r.venda += c.venda; r.hores += c.h || 0; g.venda += c.venda; g.cost += c.cost;
    NATS.forEach(([k]) => { const v = c.u[k] * c.am; g.nat[k] = (g.nat[k] || 0) + v; if (!ind) r.nat[k] += v; });
    if (ind) r.ci += c.cost; else r.cd += c.cost;
  });
  r.ciEntrat = evalua(d.ci, d.preus) || 0; r.ciTot = r.ci + r.ciEntrat;
  r.estr = (evalua(d.estructura, d.preus) || 0) / 100;
  r.total = r.estr < 1 ? (r.cd + r.ciTot) / (1 - r.estr) : NaN;
  r.ben = r.venda - r.total; r.benPct = r.venda ? r.ben / r.venda : null; r.k = r.cd ? r.venda / r.cd : null;
  return r;
}

/* ---------- Llista ---------- */
M.estudis.camps = [{ k: 'nom', l: 'Estudi', tp: 'text', req: 1, w: 1 }, { k: 'client', l: 'Client', tp: 'text' }, { k: 'responsable', l: 'Responsable', tp: 'text' }, { k: 'entrega', l: "Data d'entrega", tp: 'date' }, { k: 'estat', l: 'Estat', tp: 'sel', o: EST_ESTATS }];
M.estudis.t = 'Estudis de costos';
M.estudis.cols = ['nom', { l: 'Licitació', f: (o) => { const l = S.oportunitats.find((x) => x.id === o.oportunitatId); return l ? esc(l.nom) : '<span class="muted">—</span>'; } }, 'client', 'entrega',
  { l: 'Partides', num: 1, f: (o) => (o.partides || []).length }, { l: 'Venda', num: 1, f: (o) => fmtM(estResum(o).venda) }, { l: 'Cost total', num: 1, f: (o) => fmtM(estResum(o).total) },
  { l: 'Benefici', num: 1, f: (o) => pctHtml(estResum(o).benPct) }, 'estat'];
const nouEstudi = (op) => { const e = cfgEmp(); return { nom: op ? op.nom : 'Estudi nou', oportunitatId: op ? op.id : '', client: op ? op.client || '' : '', estat: 'En curs', responsable: '', entrega: op ? op.presentacio || '' : '', ci: '', estructura: e.estructura ?? 12, moCodi: 'MOMIG', preus: JSON.parse(JSON.stringify(e.preusBase || [])), partides: [], notes: '' }; };
async function creaEstudi(op) { const id = newId('es'); try { await save('estudis', id, nouEstudi(op)); } catch (e) { return; } logA(`Nou estudi de costos${op ? ': ' + op.nom : ''}`); location.hash = 'estudi-' + id; }
const _openEs = openForm;
openForm = function (mk, id, def) {
  if (mk === 'estudis') { if (id) location.hash = 'estudi-' + id; else creaEstudi(null); return; }
  _openEs(mk, id, def);
  if (mk === 'oportunitats' && id && CANWRITE) {
    const e = S.estudis.find((x) => x.oportunitatId === id), cl = document.querySelector('#drawerHost footer [data-act="close"]');
    if (cl) cl.insertAdjacentHTML('beforebegin', `<button class="btn" data-act="esDeLic" data-id="${esc(id)}">${e ? "Obre l'estudi de costos" : 'Crea estudi de costos'}</button>`);
  }
};

/* ---------- Pantalla de l'estudi ---------- */
let ED = null; // {id, d, brut}
const _routeEs = route;
route = function () { const h = decodeURIComponent(location.hash.slice(1)); if (h.startsWith('estudi-')) return { v: 'estudi', id: h.slice(7) }; return _routeEs(); };
const _viewEs = viewHtml;
viewHtml = function (r) {
  if (r.v !== 'estudi') return _viewEs(r);
  if (!LOCAL && !COLS.every((c) => loaded[c])) return '<div class="loading">Carregant…</div>';
  const s = S.estudis.find((x) => x.id === r.id);
  if (!s) return '<div class="empty"><b>No s\'ha trobat l\'estudi</b><div><a class="btn" href="#estudis">Torna a Estudis</a></div></div>';
  if (!ED || ED.id !== r.id || (!ED.brut && ED.v !== s.actualitzat)) ED = { id: r.id, d: JSON.parse(JSON.stringify((({ id, ...x }) => x)(s))), brut: false, v: s.actualitzat };
  return estHtml();
};
const _navEs = navHtml;
navHtml = function (r) { return _navEs(r.v === 'estudi' ? { v: 'estudis' } : r); };
const inpE = (id, k, v, extra = '') => `<input class="ed ${extra.includes('txt') ? 'txt' : ''}" id="${id}" ${k} value="${esc(v ?? '')}" autocomplete="off" ${CANWRITE ? '' : 'disabled'} ${extra.replace('txt', '')}>`;
const vE = (x) => (typeof x === 'number' ? fmtN(x) : x ?? '');
function estHtml() {
  const d = ED.d, r = estResum(d), lic = S.oportunitats.find((x) => x.id === d.oportunitatId), ob = d.obraId && obra(d.obraId);
  const caps = [...new Set(d.partides.map((p) => p.cap || ''))], ccs = [...new Set(d.partides.map((p) => p.cc).filter(Boolean).concat(['BASTIDA', 'PALETERIA', 'RESTAURACIÓ', 'PINTURA', 'INSTAL·LACIONS', 'SEGURETAT I SALUT', 'INDIRECTES']))];
  const camp = (l, h) => `<div class="fld"><label>${l}</label>${h}</div>`, dis = CANWRITE ? '' : 'disabled';
  const fila = (p) => { const i = d.partides.indexOf(p), c = estPart(d, p);
    return `<tr style="cursor:default" data-ep="${i}"><td class="code">${esc(p.codi || '')}</td><td class="t-main" style="font-weight:400"><a href="#" data-act="esDet" data-i="${i}" style="color:inherit">${esc(String(p.desc || '').slice(0, 110))}</a>${p.tipus === 'Indirecte' ? '<span class="l2">Indirecte</span>' : ''}${p.nomInd || p.nomMat || p.nomLlog ? `<span class="l2">${esc([p.nomMat, p.nomLlog, p.nomInd].filter(Boolean).join(' · '))}</span>` : ''}</td><td>${esc(p.ut || '')}</td>
    <td>${inpE('', 'data-ef="am" data-col="e-am" inputmode="decimal"', vE(p.am))}</td><td>${inpE('', 'data-ef="pv" data-col="e-pv" inputmode="decimal"', vE(p.pv))}</td>
    <td style="min-width:90px">${inpE('', 'data-ef="cc" data-col="e-cc" list="es-cc"', p.cc, 'txt')}</td>
    ${['h', 'mat', 'llog', 'ind', 'sd'].map((k) => `<td>${inpE('', `data-ef="${k}" data-col="e-${k}" inputmode="decimal"`, vE(p[k]))}</td>`).join('')}
    <td class="num" data-ec="tot">${c.mal ? '—' : fmtN(c.tot)}</td><td class="num" data-ec="cost">${c.mal ? '—' : fmtM(c.cost)}</td><td class="num" data-ec="k">${c.k == null ? '—' : fmtN(c.k)}</td></tr>`; };
  return `<div class="crumb"><a href="#estudis">Estudis de costos</a>${lic ? ` / ${esc(lic.nom)}` : ''}</div>
  <div class="head"><div><div class="eyebrow">Licitació</div><h1>${esc(d.nom || 'Estudi')}</h1></div>${pill(d.estat)}<span class="sp"></span>${CANWRITE ? `<button class="btn" data-act="esImp">Importa d'Excel</button>${ob ? `<a class="btn" href="#obra-${esc(ob.id)}">Obre l'obra ${esc(ob.codi)}</a>` : `<button class="btn" data-act="esObra">Crea l'obra</button>`}` : ''}</div>
  <section class="panel" style="margin-bottom:14px"><div class="pb"><div class="fgrid" style="grid-template-columns:repeat(auto-fit,minmax(min(100%,160px),1fr))">
   ${camp('Estudi', inpE('es-nom', 'data-ed="nom"', d.nom, 'txt'))}${camp('Licitació', `<select class="ed txt" data-ed="oportunitatId" ${dis}><option value="">— Cap —</option>${S.oportunitats.map((o) => `<option value="${esc(o.id)}" ${o.id === d.oportunitatId ? 'selected' : ''}>${esc(o.nom)}</option>`).join('')}</select>`)}
   ${camp('Client', inpE('es-cli', 'data-ed="client"', d.client, 'txt'))}${camp('Responsable', inpE('es-resp', 'data-ed="responsable"', d.responsable, 'txt'))}
   ${camp("Data d'entrega", `<input class="ed txt" type="date" data-ed="entrega" value="${esc(d.entrega || '')}" ${dis}>`)}${camp('Estat', `<select class="ed txt" data-ed="estat" ${dis}>${EST_ESTATS.map((x) => `<option ${x === d.estat ? 'selected' : ''}>${x}</option>`).join('')}</select>`)}
   ${camp('Cost indirecte (€)', inpE('es-ci', 'data-ed="ci" inputmode="decimal"', vE(d.ci)))}${camp('Estructura (%)', inpE('es-estr', 'data-ed="estructura" inputmode="decimal"', vE(d.estructura)))}
   ${camp('Preu de mà d\'obra (codi)', `<select class="ed txt" data-ed="moCodi" ${dis}>${(d.preus || []).map((p) => `<option ${String(p.codi) === String(d.moCodi) ? 'selected' : ''}>${esc(p.codi)}</option>`).join('') || '<option>MOMIG</option>'}</select>`)}
  </div></div></section>
  <section class="panel" style="margin-bottom:14px"><h2>Resum</h2><div class="econ-g" id="es-res"></div></section>
  <details class="panel" style="margin-bottom:14px" ${d.preus && d.preus.length ? '' : 'open'}><summary style="padding:12px 14px;cursor:pointer;font-weight:600">Preus unitaris de l'estudi (${(d.preus || []).length})</summary><div class="pb">
   <div class="small" style="margin-bottom:6px">Es fan servir a les fórmules (per exemple =MORTER*0,02) i per al preu de la mà d'obra. Comencen amb els preus base de l'empresa.</div>
   <div style="display:grid;grid-template-columns:minmax(0,120px) minmax(0,1fr) 110px auto;gap:6px;align-items:center">${(d.preus || []).map((p, i) => `${inpE('', `data-pp="${i}" data-pk="codi"`, p.codi, 'txt')}${inpE('', `data-pp="${i}" data-pk="desc"`, p.desc, 'txt')}${inpE('', `data-pp="${i}" data-pk="preu" inputmode="decimal"`, vE(p.preu))}${CANWRITE ? `<button class="btn sm" data-act="esPreuTreu" data-i="${i}" aria-label="Treu">×</button>` : '<span></span>'}`).join('')}</div>
   ${CANWRITE ? '<div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap"><button class="btn sm" data-act="esPreu">+ Preu</button><button class="btn sm" data-act="esBase">Afegeix els preus base que falten</button><button class="btn sm" data-act="esFerBase">Desa\'ls com a preus base de l\'empresa</button></div>' : ''}</div></details>
  <section class="panel"><h2>Partides<span class="sp"></span><span class="small">Hores totals; costos en €/ut. Fórmules amb =</span></h2>${d.partides.length ? `<div class="tw" style="border:0"><table class="quad"><thead><tr><th>Codi</th><th>Descripció</th><th>Ut</th><th class="num">Amid.</th><th class="num">Preu venda</th><th>Centre de cost</th><th class="num">Hores</th><th class="num">MAT €/ut</th><th class="num">LLOG €/ut</th><th class="num">IND €/ut</th><th class="num">Sense detall €/ut</th><th class="num">Cost €/ut</th><th class="num">Cost total</th><th class="num">K</th></tr></thead><tbody>
   ${caps.map((c) => `<tr class="cap" data-ecap="${esc(c)}"><td colspan="12">${esc(c || SENSE_CAP)}</td><td class="num" data-ecc></td><td class="num" data-eck></td></tr>` + d.partides.filter((p) => (p.cap || '') === c).map(fila).join('')).join('')}</tbody></table></div>` : '<div class="empty"><b>Encara no hi ha partides</b>Importa el pressupost de la licitació des d\'un Excel (també un PiC) o afegeix-les a mà.</div>'}
   ${CANWRITE ? '<div class="pb"><button class="btn sm" data-act="esPart">+ Partida</button></div>' : ''}</section>
  <datalist id="es-cc">${ccs.map((c) => `<option value="${esc(c)}">`).join('')}</datalist>
  <div class="barra"><span id="es-st" class="small"></span><span class="sp"></span>${CANWRITE ? '<button class="btn danger" data-act="esDel">Elimina</button><button class="btn" data-act="esDesfes">Desfés els canvis</button><button class="btn pri" data-act="esDesa">Desa l\'estudi</button>' : ''}</div>`;
}
function estPinta() {
  if (!ED || !$('#es-st')) return;
  const d = ED.d, r = estResum(d);
  document.querySelectorAll('tr[data-ep]').forEach((tr) => { const p = d.partides[+tr.dataset.ep], c = estPart(d, p);
    tr.querySelectorAll('[data-ef]').forEach((i) => { const k = i.dataset.ef; if (k !== 'cc') i.classList.toggle('mal', isNaN(evalua(p[k], d.preus))); });
    tr.querySelector('[data-ec=tot]').textContent = c.mal ? '—' : fmtN(c.tot); tr.querySelector('[data-ec=cost]').textContent = c.mal ? '—' : fmtM(c.cost); tr.querySelector('[data-ec=k]').textContent = c.k == null ? '—' : fmtN(c.k);
    tr.querySelector('[data-ec=k]').style.color = c.k != null && c.k < 1 ? 'var(--bad)' : ''; });
  document.querySelectorAll('tr[data-ecap]').forEach((tr) => { const ps = d.partides.filter((p) => (p.cap || '') === tr.dataset.ecap).map((p) => estPart(d, p)).filter((c) => !c.mal), cost = sum(ps, (c) => c.cost), v = sum(ps, (c) => c.venda); tr.querySelector('[data-ecc]').textContent = fmtM(cost); tr.querySelector('[data-eck]').textContent = cost ? 'K ' + fmtN(v / cost) : ''; });
  const f = (l, v, b, s) => `<tr style="cursor:default"><td${b ? ' style="font-weight:600"' : ''}>${l}${s ? `<div class="small">${s}</div>` : ''}</td><td class="num"${b ? ' style="font-weight:600"' : ''}>${v}</td></tr>`;
  const ccs = Object.entries(r.cc).sort((a, b) => b[1].cost - a[1].cost);
  $('#es-res').innerHTML = `<table><tbody>${f('Pressupost de venda', fmtM(r.venda), 1)}${NATS.map(([k, l]) => f('&nbsp;&nbsp;Cost ' + l, fmtM(r.nat[k]))).join('')}${f('Cost directe', fmtM(r.cd), 1, `${fmtN(r.hores)} hores · K mitjana ${r.k == null ? '—' : fmtN(r.k)}`)}${f('Cost indirecte', fmtM(r.ciTot), 0, r.ci ? `Entrat ${fmtM(r.ciEntrat)} + partides indirectes ${fmtM(r.ci)}` : '')}${f(`Estructura ${fmtN(r.estr * 100)}%`, fmtM(r.total - r.cd - r.ciTot))}${f('Cost total', fmtM(r.total), 1, '(directe + indirecte) ÷ (1 − estructura)')}${f('Benefici o risc', `<span style="color:${r.ben < 0 ? 'var(--bad)' : 'var(--ok)'}">${fmtM(r.ben)} · ${r.benPct == null ? '—' : fmtN(r.benPct * 100) + '%'}</span>`, 1)}</tbody></table>
  <table><thead><tr><th>Centre de cost</th><th class="num">Cost</th><th class="num">%</th><th class="num">K</th></tr></thead><tbody>${ccs.map(([c, g]) => `<tr style="cursor:default"><td>${esc(c)}<div class="small">${NATS.filter(([k]) => g.nat[k]).map(([k, l]) => `${l} ${fmtM(g.nat[k])}`).join(' · ')}</div></td><td class="num">${fmtM(g.cost)}</td><td class="num">${r.cd + r.ci ? fmtN(g.cost / (r.cd + r.ci) * 100) + '%' : '—'}</td><td class="num">${g.cost ? fmtN(g.venda / g.cost) : '—'}</td></tr>`).join('') || '<tr><td colspan="4" class="muted">Sense partides.</td></tr>'}</tbody></table>`
    + (r.mal || r.sense ? `<div class="small" style="grid-column:1/-1;color:var(--warn);padding-top:6px">${r.mal ? `${r.mal} partides amb valors que no es poden calcular (marcats en vermell). ` : ''}${r.sense ? `${r.sense} partides encara sense cost.` : ''}</div>` : '');
  $('#es-st').textContent = ED.brut ? 'Canvis sense desar' : 'Tot desat';
  const b = document.querySelector('[data-act=esDesa]'); if (b) b.disabled = !ED.brut;
}
const _paintEs = paint;
paint = function () { _paintEs(); estPinta(); };
const brut = () => { ED.brut = true; estPinta(); };
document.addEventListener('input', (e) => {
  const t = e.target; if (!ED || !t.closest || !t.closest('#view')) return;
  if (t.dataset.ef) { ED.d.partides[+t.closest('tr').dataset.ep][t.dataset.ef] = t.value; brut(); }
  else if (t.dataset.ed) { ED.d[t.dataset.ed] = t.value; brut(); }
  else if (t.dataset.pp) { ED.d.preus[+t.dataset.pp][t.dataset.pk] = t.value; brut(); }
});
document.addEventListener('change', (e) => {
  const t = e.target; if (!ED) return;
  if ((t.dataset.ef || t.dataset.ed || t.dataset.pk === 'preu') && t.classList.contains('ed') && !t.classList.contains('txt')) { const v = t.value.trim(); if (v && v[0] !== '=' && !isNaN(nv(v))) t.value = ['am', 'h'].includes(t.dataset.ef) ? N3(nv(v)).replace(/,000$/, ',00') : fmtN(nv(v)); }
  if (t.dataset.pk === 'codi' || t.dataset.ed === 'nom') setTimeout(paint, 0);
  if (t.dataset.dk && ESD != null) { ED.d.partides[ESD][t.dataset.dk] = t.value; brut(); }
});
async function estDesa() {
  const d = ED.d, b = document.querySelector('[data-act=esDesa]');
  if (!String(d.nom || '').trim()) { toast("Falta el nom de l'estudi."); return; }
  const codis = (d.preus || []).map((p) => String(p.codi || '').toUpperCase()).filter(Boolean);
  if (new Set(codis).size < codis.length) { toast('Hi ha codis de preu repetits.'); return; }
  b.disabled = true;
  const net = { ...d, preus: (d.preus || []).filter((p) => String(p.codi || '').trim()) };
  try { await save('estudis', ED.id, net); } catch (e) { b.disabled = false; return; }
  ED.brut = false; ED.d = net; logA(`Estudi de costos desat: ${d.nom}`); toast('Estudi desat.');
  const s = S.estudis.find((x) => x.id === ED.id); if (s) ED.v = s.actualitzat; paint();
}
/* Detall d'una partida */
let ESD = null;
function estDet(i) {
  ESD = i; const p = ED.d.partides[i], dis = CANWRITE ? '' : 'disabled', c = estPart(ED.d, p);
  const f = (k, l, ph = '') => `<div class="fld"><label for="ed-${k}">${l}</label><input id="ed-${k}" data-dk="${k}" value="${esc(p[k] ?? '')}" placeholder="${esc(ph)}" ${dis}></div>`;
  drawer(`Partida ${p.codi || ''}`, `<div class="fgrid">${f('codi', 'Codi')}${f('cap', 'Capítol')}<div class="fld w"><label for="ed-desc">Descripció</label><textarea id="ed-desc" data-dk="desc" ${dis}>${esc(p.desc || '')}</textarea></div>${f('ut', 'Unitat')}
   <div class="fld"><label for="ed-tipus">Tipus de cost</label><select id="ed-tipus" data-dk="tipus" ${dis}>${['Directe', 'Indirecte'].map((x) => `<option ${x === (p.tipus || 'Directe') ? 'selected' : ''}>${x}</option>`).join('')}</select></div>
   ${f('mo', 'Preu de mà d\'obra (codi)', ED.d.moCodi || 'MOMIG')}${f('nomMat', 'Proveïdor de material')}${f('nomLlog', 'Empresa de lloguer')}${f('nomInd', 'Industrial')}<div class="fld w"><label for="ed-notes">Comentaris</label><textarea id="ed-notes" data-dk="notes" ${dis}>${esc(p.notes || '')}</textarea></div></div>
   <div class="calc">${NATS.map(([k, l]) => `<span>${l} €/ut</span><b>${isNaN(c.u[k]) ? '—' : fmtN(c.u[k])}</b>`).join('')}<span style="font-weight:600">Cost €/ut</span><b>${c.mal ? '—' : fmtN(c.tot)}</b><span>Rendiment</span><b>${c.h ? fmtN(c.am / c.h) + ' ' + esc(p.ut || 'ut') + '/h' : '—'}</b></div>`,
  `${CANWRITE ? '<button class="btn danger" data-act="esPartTreu">Treu la partida</button>' : ''}<span class="sp"></span><button class="btn pri" data-act="esDetOk">Fet</button>`);
}
/* Importació */
let EIMP = null;
const PIC = { cc: /^centre cost$/, tipus: /^tip(o|us) de cost$/, h: /^durada total h$/, mat: /^mat €\/ut$/, llog: /^llog €\/ut$/, ind: /^ind €\/ut$/, sd: /^sense detall €\/ut$/, nomMat: /^nom mat$/, nomLlog: /^nom llog$/, nomInd: /^nom ind$/, amVig: /^amid vig$/, pv: /^preuv$/, notes: /^comentaris$/ };
async function estImporta(f) {
  const box = $('#ei-cos'); box.textContent = 'Llegint…';
  let fulls; try { fulls = await ObradorLectura.llibre(f); } catch (e) { box.innerHTML = '<span style="color:var(--bad)">No s\'ha pogut llegir l\'arxiu.</span>'; return; }
  const res = fulls.map((x) => { const c = ObradorLectura.columnes(x.rows), cap = (x.rows[c.ini - 1] || []).map((v) => String(v ?? '').trim().toLowerCase()), pic = {};
    Object.entries(PIC).forEach(([k, re]) => { const j = cap.findIndex((v) => re.test(v)); if (j >= 0) pic[k] = j; });
    if (pic.amVig != null) c.m.am = pic.amVig; if (pic.pv != null) c.m.pv = pic.pv;
    const p = ObradorLectura.partides(x.rows, c.m, c.ini); return { nom: x.nom, rows: x.rows, pic, p }; }).filter((x) => x.p.partides.length).sort((a, b) => (Object.keys(b.pic).length > 3) - (Object.keys(a.pic).length > 3) || /detall|pressupost|presupuesto/i.test(b.nom) - /detall|pressupost|presupuesto/i.test(a.nom) || b.p.partides.length - a.p.partides.length);
  const cu = fulls.find((x) => /costosunit/i.test(x.nom)), preus = [];
  if (cu) cu.rows.forEach((r) => { const c = String(r[0] ?? '').trim(), v = ObradorLectura.nombre(r[1]); if (/^[A-Za-z][\w]{1,20}$/.test(c) && isFinite(v) && !/codi/i.test(c)) preus.push({ codi: c.toUpperCase(), desc: '', preu: v }); });
  if (!res.length) { box.innerHTML = '<span style="color:var(--warn)">No s\'hi ha trobat cap partida.</span>'; return; }
  EIMP = { res, k: 0, preus }; estImpPrev();
}
function estImpPrev() {
  const x = EIMP.res[EIMP.k], esPic = Object.keys(x.pic).length > 3;
  $('#ei-cos').innerHTML = `${EIMP.res.length > 1 ? `<div class="fld"><label for="ei-full">Full</label><select id="ei-full">${EIMP.res.map((r, i) => `<option value="${i}" ${i === EIMP.k ? 'selected' : ''}>${esc(r.nom)} · ${r.p.partides.length} partides</option>`).join('')}</select></div>` : ''}
  <div><b>${x.p.partides.length}</b> partides · <b>${x.p.capitols.length}</b> capítols · venda ${fmtM(sum(x.p.partides, (p) => p.amidament * p.preuVenda))}</div>
  ${esPic ? '<div class="small" style="color:var(--ok)">És un PiC: també s\'importen centre de cost, hores, MAT, LLOG, IND, sense detall i proveïdors (els valors, no les fórmules).</div>' : '<div class="small">Pressupost: s\'importen codi, descripció, unitat, amidament, preu i capítol. Els costos s\'entren a la plataforma.</div>'}
  ${EIMP.preus.length ? `<div class="small">També ${EIMP.preus.length} preus unitaris (full costosunit).</div>` : ''}
  ${ED.d.partides.length ? '<div class="small" style="color:var(--warn)">L\'estudi ja té partides: «Substitueix» les esborra i «Afegeix» les posa al final.</div>' : ''}`;
  document.querySelectorAll('[data-act^="eiFes"]').forEach((b) => { b.disabled = false; });
}
function estImpFes(mode) {
  const x = EIMP.res[EIMP.k], d = ED.d, g = (r, k) => (x.pic[k] == null ? '' : r[x.pic[k]]);
  const nou = x.p.partides.map((p) => { const r = x.rows[p.fila - 1] || [], nm = (k) => { const v = g(r, k); return v === '' || v == null ? '' : typeof v === 'number' ? Math.round(v * 10000) / 10000 : String(v).trim(); };
    return { id: newId('ep'), codi: p.codi, cap: p.capitol, desc: p.descripcio, ut: p.unitat, am: p.amidament, pv: Math.round(p.preuVenda * 10000) / 10000, cc: nm('cc'), tipus: /indirect/i.test(nm('tipus')) ? 'Indirecte' : 'Directe', h: nm('h'), mat: nm('mat'), llog: nm('llog'), ind: nm('ind'), sd: nm('sd'), nomMat: nm('nomMat'), nomLlog: nm('nomLlog'), nomInd: nm('nomInd') || p.industrial || '', notes: nm('notes') }; });
  d.partides = mode === 'subs' ? nou : d.partides.concat(nou);
  EIMP.preus.forEach((p) => { if (!(d.preus || []).some((q) => String(q.codi).toUpperCase() === p.codi)) (d.preus = d.preus || []).push(p); });
  closeDrawer(); ED.brut = true; paint(); toast(`${nou.length} partides importades. Revisa-les i desa l'estudi.`);
}
/* Crear l'obra */
async function estObra() {
  const d = ED.d, r = estResum(d), b = document.querySelector('[data-act=esObraFes]'), codi = $('#eo-codi').value.trim(), nom = $('#eo-nom').value.trim();
  if (!codi || !nom) { toast('Falta el codi o el nom de l\'obra.'); return; }
  if (S.obres.some((o) => String(o.codi) === codi)) { toast('Ja hi ha una obra amb aquest codi.'); return; }
  if (ED.brut) { toast("Desa l'estudi abans."); return; }
  b.disabled = true; const oid = newId('ob');
  try {
    await save('obres', oid, { codi, nom, client: d.client || '', estat: 'Preparació', pressupost: r2(r.venda), capitols: [...new Set(d.partides.map((p) => p.cap).filter(Boolean))], estructura: evalua(d.estructura, d.preus), estudiId: ED.id });
    const ls = d.partides.map((p, i) => { const c = estPart(d, p); return { id: newId('pa'), dades: { obraId: oid, codi: p.codi, capitol: p.cap || '', descripcio: p.desc, unitat: p.ut, amidament: c.am, preuVenda: c.pv, costUnit: c.mal ? 0 : Math.round(c.tot * 10000) / 10000, industrial: p.nomInd || '', ordre: i, pic: { cc: p.cc || '', tipus: p.tipus || 'Directe', h: c.h || 0, moa: c.u.moa, mat: c.u.mat, llog: c.u.llog, ind: c.u.ind, sd: c.u.sd } } }; });
    for (let i = 0; i < ls.length; i += 200) await creaMolts('partides', ls.slice(i, i + 200));
    await save('estudis', ED.id, { ...d, obraId: oid, estat: 'Adjudicat' });
    const lic = S.oportunitats.find((x) => x.id === d.oportunitatId); if (lic && lic.estat !== 'Adjudicada') { const { id, ...q } = lic; await save('oportunitats', id, { ...q, estat: 'Adjudicada' }); }
  } catch (e) { b.disabled = false; toast("No s'ha pogut crear tota l'obra. Revisa-la abans de tornar-ho a provar."); return; }
  logA(`Obra ${codi} creada des de l'estudi ${d.nom}`); closeDrawer(); ED = null; location.hash = 'obra-' + oid;
}
document.addEventListener('click', async (e) => {
  const a = e.target.closest('[data-act]'); if (!a) return; const t = a.dataset.act;
  if (t === 'esDeLic') { const id = a.dataset.id, ex = S.estudis.find((x) => x.oportunitatId === id); closeDrawer(); if (ex) location.hash = 'estudi-' + ex.id; else creaEstudi(S.oportunitats.find((x) => x.id === id)); return; }
  if (t === 'esPreusBase') { const { id, ...p } = cfgEmp(); const l = [...document.querySelectorAll('[data-bp]')].reduce((m, i) => { const k = +i.dataset.bp; (m[k] = m[k] || {})[i.dataset.pk] = i.value; return m; }, []).filter((x) => x && String(x.codi || '').trim()).map((x) => ({ codi: x.codi.trim().toUpperCase(), desc: x.desc || '', preu: nv(x.preu) || 0 })); try { await save('config', 'empresa', { ...p, preusBase: l }); } catch (x) { return; } toast('Preus base desats.'); return; }
  if (t === 'esBaseMes') { BP.push({ codi: '', desc: '', preu: '' }); paint(); return; }
  if (t === 'esBaseTreu') { BP.splice(+a.dataset.i, 1); paint(); return; }
  if (!ED) return;
  if (t === 'esDesa') estDesa();
  else if (t === 'esDesfes') { ED = null; paint(); }
  else if (t === 'esDel') { if (!a.classList.contains('arm')) { a.classList.add('arm'); a.textContent = 'Confirma: elimina'; return; } const n = ED.d.nom; try { await remove('estudis', ED.id); } catch (x) { return; } logA(`Eliminat l'estudi ${n}`); ED = null; location.hash = 'estudis'; }
  else if (t === 'esPreu') { (ED.d.preus = ED.d.preus || []).push({ codi: '', desc: '', preu: '' }); ED.brut = true; paint(); }
  else if (t === 'esPreuTreu') { ED.d.preus.splice(+a.dataset.i, 1); ED.brut = true; paint(); }
  else if (t === 'esBase') { const b = cfgEmp().preusBase || []; let n = 0; b.forEach((p) => { if (!(ED.d.preus || []).some((q) => String(q.codi).toUpperCase() === String(p.codi).toUpperCase())) { (ED.d.preus = ED.d.preus || []).push({ ...p }); n++; } }); ED.brut = ED.brut || n > 0; paint(); toast(n ? `${n} preus afegits.` : 'No en falta cap.'); }
  else if (t === 'esFerBase') { const { id, ...p } = cfgEmp(); try { await save('config', 'empresa', { ...p, preusBase: (ED.d.preus || []).filter((x) => String(x.codi || '').trim()).map((x) => ({ codi: String(x.codi).toUpperCase(), desc: x.desc || '', preu: nv(x.preu) || 0 })) }); } catch (x) { return; } toast("Preus base de l'empresa actualitzats."); }
  else if (t === 'esPart') { const l = ED.d.partides[ED.d.partides.length - 1]; ED.d.partides.push({ id: newId('ep'), codi: '', cap: l ? l.cap : '', desc: 'Partida nova', ut: 'ut', am: 1, pv: 0, tipus: 'Directe' }); ED.brut = true; paint(); estDet(ED.d.partides.length - 1); }
  else if (t === 'esDet') { e.preventDefault(); estDet(+a.dataset.i); }
  else if (t === 'esDetOk') { closeDrawer(); ESD = null; paint(); }
  else if (t === 'esPartTreu') { if (!a.classList.contains('arm')) { a.classList.add('arm'); a.textContent = 'Confirma: treu-la'; return; } ED.d.partides.splice(ESD, 1); ESD = null; ED.brut = true; closeDrawer(); paint(); }
  else if (t === 'esImp') { EIMP = null; drawer("Importa partides a l'estudi", '<div class="fld"><label for="ei-f">Pressupost o PiC en Excel</label><input type="file" id="ei-f" class="imp-in" accept=".xlsx,.xlsm,.xls,.ods,.csv"></div><div class="small">Es llegeix aquí mateix. Del PiC se n\'importen els valors, no les fórmules ni les macros.</div><div id="ei-cos" style="display:flex;flex-direction:column;gap:10px"></div>', `<span class="sp"></span><button class="btn" data-act="close">Cancel·la</button>${ED.d.partides.length ? '<button class="btn" data-act="eiFesAfegeix" disabled>Afegeix</button>' : ''}<button class="btn pri" data-act="eiFesSubs" disabled>${ED.d.partides.length ? 'Substitueix' : 'Importa'}</button>`); }
  else if (t === 'eiFesSubs') estImpFes('subs'); else if (t === 'eiFesAfegeix') estImpFes('afegeix');
  else if (t === 'esObra') { if (ED.brut) { toast("Desa l'estudi abans."); return; } const lic = S.oportunitats.find((x) => x.id === ED.d.oportunitatId); drawer("Crea l'obra des de l'estudi", `<div class="fld"><label for="eo-codi">Codi de l'obra *</label><input id="eo-codi"></div><div class="fld"><label for="eo-nom">Nom de l'obra *</label><input id="eo-nom" value="${esc((lic && lic.nom) || ED.d.nom)}"></div><div class="small">Es crea l'obra amb les ${ED.d.partides.length} partides, el preu de venda i el cost previst (${fmtM(estResum(ED.d).cd)} de cost directe). L'estudi i la licitació passen a adjudicats.</div>`, '<span class="sp"></span><button class="btn" data-act="close">Cancel·la</button><button class="btn pri" data-act="esObraFes">Crea l\'obra</button>'); }
  else if (t === 'esObraFes') estObra();
});
document.addEventListener('change', (e) => { const t = e.target; if (t.id === 'ei-f' && t.files[0]) estImporta(t.files[0]); else if (t.id === 'ei-full') { EIMP.k = +t.value; estImpPrev(); } });
window.addEventListener('beforeunload', (e) => { if (ED && ED.brut) e.preventDefault(); });
window.addEventListener('hashchange', () => { if (ED && !ED.brut && !location.hash.startsWith('#estudi-')) ED = null; });

/* Preus base de l'empresa, a la pàgina d'Estudis */
let BP = null;
const _listEs = listHtml;
listHtml = function (mk, fo) {
  const h = _listEs(mk, fo); if (mk !== 'estudis' || fo) return h;
  if (!BP) BP = JSON.parse(JSON.stringify(cfgEmp().preusBase || []));
  return h + `<details class="panel" style="margin-top:18px"><summary style="padding:12px 14px;cursor:pointer;font-weight:600">Preus base de l'empresa (${(cfgEmp().preusBase || []).length})</summary><div class="pb"><div class="small" style="margin-bottom:6px">Cada estudi nou en fa una còpia que es pot ajustar. Codi (per exemple MOMIG), descripció i preu.</div>
  <div style="display:grid;grid-template-columns:minmax(0,120px) minmax(0,1fr) 110px auto;gap:6px;align-items:center">${BP.map((p, i) => `${inpE('', `data-bp="${i}" data-pk="codi"`, p.codi, 'txt')}${inpE('', `data-bp="${i}" data-pk="desc"`, p.desc, 'txt')}${inpE('', `data-bp="${i}" data-pk="preu" inputmode="decimal"`, vE(p.preu))}${CANWRITE ? `<button class="btn sm" data-act="esBaseTreu" data-i="${i}" aria-label="Treu">×</button>` : '<span></span>'}`).join('')}</div>
  ${CANWRITE ? '<div style="margin-top:8px;display:flex;gap:8px"><button class="btn sm" data-act="esBaseMes">+ Preu</button><button class="btn sm pri" data-act="esPreusBase">Desa els preus base</button></div>' : ''}</div></details>`;
};
document.addEventListener('input', (e) => { const t = e.target; if (t.dataset.bp && BP) BP[+t.dataset.bp][t.dataset.pk] = t.value; });
