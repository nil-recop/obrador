/* Imputació de factures rebudes al cost real d'execució.
   Cada línia de repartiment va a una partida, a un conjunt de partides, a un capítol o a un industrial.
   Si va a més d'una partida, es reparteix segons el cost previst (amidament × cost unitari); sense cost previst, segons la venda; si tampoc, a parts iguals.
   El que no es reparteix queda sense imputar. */
let FI = null; // repartiment del registre obert: [{tp, v, t}] (t = text de l'import o «50%»)
/* Registres que s'imputen: factures rebudes, parts diaris i parts mensuals. base = cost que es reparteix */
const IMK = { factures: { base: (e) => +e.base.value || 0, actiu: (e) => e.sentit.value === 'Rebuda', camps: ['base'] }, parts: { base: (e) => r2((+e.hores.value || 0) * (+e.preuHora.value || 0) + (+e.dietes.value || 0) + (+e.desplacament.value || 0)), actiu: () => true, camps: ['hores', 'preuHora', 'dietes', 'desplacament'] }, partsMes: { base: (e) => r2((+e.import.value || 0) + (+e.dietes.value || 0) + (+e.desplacament.value || 0)), actiu: () => true, camps: ['import', 'dietes', 'desplacament'] } };
const impFm = () => { const fm = $('#frm'); return fm && IMK[fm.dataset.mk] ? fm : null; };
const impBase = (fm) => IMK[fm.dataset.mk].base(fm.elements);
const impCost = (mk, r) => (mk === 'factures' ? +r.base || 0 : mk === 'parts' ? costPart(r) : pmCost(r));
const IMP_TP = [['p', 'Partida'], ['conj', 'Conjunt de partides'], ['cap', 'Capítol'], ['ind', 'Industrial']];
const impPartides = (oid) => ordItems(oid, [...S.partides.filter((p) => p.obraId === oid).map((p) => ({ mk: 'partides', p })), ...S.modificats.filter((p) => p.obraId === oid && p.codi != null).map((p) => ({ mk: 'modificats', p }))]);
const impVal = (t, base) => { const s = String(t || '').trim(); if (!s) return 0; if (s.endsWith('%')) { const n = nv(s.slice(0, -1)); return isNaN(n) ? NaN : r2(base * n / 100); } return nv(s); };
const impEtq = (x) => `${x.p.codi || ''} · ${String(x.p.descripcio || '').slice(0, 70)}`;
const normI = (s) => String(s || '').trim().toLowerCase();
const indDe = (oid) => [...new Set(impPartides(oid).map((x) => String(x.p.industrial || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ca'));
const impTp = (r) => r.tp || 'p';
/* Partides que cobreix una línia de repartiment */
function impDesti(oid, r) {
  const its = impPartides(oid).map((x) => x.p), tp = impTp(r), v = tp === 'p' ? r.id || r.v : r.v;
  if (tp === 'p') return its.filter((p) => p.id === v);
  if (tp === 'conj') return its.filter((p) => (v || []).includes(p.id));
  if (tp === 'cap') return its.filter((p) => (p.capitol || '') === (v || ''));
  return its.filter((p) => normI(p.industrial) === normI(v) && normI(v));
}
function impReparteix(ps, imp) {
  if (!ps.length) return [];
  const pes = (f) => ps.map((p) => Math.max(0, f(p))), s = (a) => a.reduce((x, y) => x + y, 0);
  let w = pes((p) => (+p.amidament || 0) * (+p.costUnit || 0)); if (!s(w)) w = pes((p) => (+p.amidament || 0) * (+p.preuVenda || 0)); if (!s(w)) w = ps.map(() => 1);
  const t = s(w); let resta = r2(imp);
  return ps.map((p, i) => { const v = i === ps.length - 1 ? resta : r2(imp * w[i] / t); resta = r2(resta - v); return { id: p.id, v }; });
}
/* Imports per partida, de totes les factures; es torna a calcular quan canvien les dades */
let IMPCAU = { k: null, m: new Map() };
function impMapa() {
  const k = [S.factures, S.partides, S.modificats, S.parts, S.partsMes];
  if (IMPCAU.k && k.every((x, i) => x === IMPCAU.k[i])) return IMPCAU.m;
  const m = new Map();
  const regs = [...S.factures.filter((f) => f.sentit === 'Rebuda' && f.estat !== 'Esborrany').map((f) => ['factures', f]), ...S.parts.map((p) => ['parts', p]), ...(S.partsMes || []).map((p) => ['partsMes', p])];
  regs.filter(([, f]) => (f.imputacions || []).length).forEach(([mk, f]) => f.imputacions.forEach((r) => impReparteix(impDesti(f.obraId, r), +r.import || 0).forEach(({ id, v }) => {
    const a = m.get(id) || []; a.push({ mk, f, v }); m.set(id, a);
  })));
  IMPCAU = { k, m }; return m;
}
imputatA = (id) => r2(sum(impMapa().get(id) || [], (x) => x.v));

/* ---------- Partides: industrial ---------- */
(() => {
  for (const mk of ['partides', 'modificats']) {
    const c = M[mk].camps, i = c.findIndex((f) => f.k === 'descripcio');
    c.splice(i + 1, 0, { k: 'industrial', l: 'Industrial', tp: 'text', ph: 'Subcontractista o proveïdor' });
    const cs = M[mk].cols, j = cs.indexOf('descripcio');
    cs.splice(j + 1, 0, 'industrial');
  }
})();
function indLlista() {
  const fm = $('#frm'); if (!fm || !['partides', 'modificats'].includes(fm.dataset.mk)) return;
  let d = $('#ind-l'); if (!d) { d = document.createElement('datalist'); d.id = 'ind-l'; fm.after(d); fm.elements.industrial.setAttribute('list', 'ind-l'); fm.elements.industrial.autocomplete = 'off'; }
  d.innerHTML = [...new Set([...S.tercers.map((t) => t.nom), ...S.partides.map((p) => p.industrial), ...S.modificats.map((p) => p.industrial)].filter(Boolean).map((s) => String(s).trim()))].sort((a, b) => a.localeCompare(b, 'ca')).map((s) => `<option value="${esc(s)}">`).join('');
}

/* ---------- Formulari de la factura ---------- */
function impSel(oid, r, i, dis) {
  const its = impPartides(oid), tp = impTp(r), caps = [...new Set(its.filter((x) => x.mk === 'partides').map((x) => x.p.capitol || ''))];
  const grups = (sel) => caps.map((c) => `<optgroup label="${esc(c || SENSE_CAP)}">${its.filter((x) => x.mk === 'partides' && (x.p.capitol || '') === c).map((x) => `<option value="${esc(x.p.id)}" ${sel(x.p.id) ? 'selected' : ''}>${esc(impEtq(x))}</option>`).join('')}</optgroup>`).join('')
    + (its.some((x) => x.mk === 'modificats') ? `<optgroup label="Contradictòries">${its.filter((x) => x.mk === 'modificats').map((x) => `<option value="${esc(x.p.id)}" ${sel(x.p.id) ? 'selected' : ''}>${esc(impEtq(x))}</option>`).join('')}</optgroup>` : '');
  const st = 'style="width:100%;min-width:0"';
  if (tp === 'p') return `<select class="ed txt" data-impk="v" aria-label="Partida" ${st} ${dis}><option value="">— Tria una partida —</option>${grups((id) => id === (r.v || r.id))}</select>`;
  if (tp === 'conj') return `<select class="ed txt" data-impk="v" multiple size="5" aria-label="Partides del conjunt" ${st} ${dis}>${grups((id) => (r.v || []).includes(id))}</select><div class="small">Ctrl o Maj per triar-ne diverses · ${(r.v || []).length} triades</div>`;
  if (tp === 'cap') return `<select class="ed txt" data-impk="v" aria-label="Capítol" ${st} ${dis}><option value="">— Tria un capítol —</option>${capsObra(oid).map((c) => `<option ${c === r.v ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>`;
  const ind = indDe(oid);
  return ind.length ? `<select class="ed txt" data-impk="v" aria-label="Industrial" ${st} ${dis}><option value="">— Tria un industrial —</option>${ind.map((c) => `<option ${normI(c) === normI(r.v) ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>` : '<div class="small" style="color:var(--warn)">Cap partida d\'aquesta obra té industrial assignat.</div>';
}
function impHtml() {
  const fm = impFm(); if (!fm) return '';
  const e = fm.elements, oid = e.obraId.value, dis = CANWRITE ? '' : 'disabled';
  if (!IMK[fm.dataset.mk].actiu(e) || !oid) return '';
  if (!impPartides(oid).length) return '<div class="small">Aquesta obra encara no té partides per imputar-hi aquest cost.</div>';
  return `<div><b>Imputació a partides</b><div class="small" style="margin:2px 0 6px">Reparteix `+(fm.dataset.mk === 'factures' ? 'la base imposable' : 'el cost del part')+`. Cada línia pot anar a una partida, a un conjunt de partides, a un capítol o a un industrial; si toca diverses partides, es reparteix segons el seu cost previst. Import o percentatge (per exemple 40%).</div>
  ${FI.map((r, i) => `<div style="display:grid;grid-template-columns:minmax(0,150px) minmax(0,1fr) 110px auto;gap:6px;margin-bottom:8px;align-items:start" data-imp="${i}"><select class="ed txt" data-impk="tp" aria-label="Imputa a" ${dis}>${IMP_TP.map(([k, l]) => `<option value="${k}" ${k === impTp(r) ? 'selected' : ''}>${l}</option>`).join('')}</select><div>${impSel(oid, r, i, dis)}<div class="small" data-impn></div></div><input class="ed" data-col="imp" data-impk="t" inputmode="decimal" aria-label="Import imputat" value="${esc(r.t)}" ${dis}>${CANWRITE ? `<button class="btn sm" type="button" data-act="impTreu" data-i="${i}" aria-label="Treu la línia">×</button>` : '<span></span>'}</div>`).join('')}
  ${CANWRITE ? '<button class="btn sm" type="button" data-act="impAfegeix">+ Línia</button> <button class="btn sm" type="button" data-act="impResta">Imputa la resta a l\'última</button>' : ''}<div class="small" id="imp-tot" style="margin-top:6px"></div></div>`;
}
function impPinta() {
  const fm = impFm(); if (!fm) return;
  let box = $('#imp-box');
  if (!box) { const ref = $('#fac-nat') || fm; ref.insertAdjacentHTML('afterend', '<div id="imp-box"></div>'); box = $('#imp-box'); }
  box.innerHTML = impHtml(); impTot();
}
const impBuit = (r) => (Array.isArray(r.v) ? !r.v.length : !r.v);
function impTot() {
  const el = $('#imp-tot'), fm = impFm(); if (!el || !fm) return;
  const base = impBase(fm), oid = fm.elements.obraId.value, v = FI.map((r) => impVal(r.t, base)), s = r2(sum(v.filter((x) => !isNaN(x)), (x) => x)), resta = r2(base - s);
  document.querySelectorAll('[data-imp]').forEach((d, k) => { d.querySelector('[data-impk=t]').classList.toggle('mal', isNaN(v[k])); const n = d.querySelector('[data-impn]'), r = FI[k]; if (n) n.textContent = impTp(r) !== 'p' && !impBuit(r) ? `${impDesti(oid, r).length} partides` : ''; });
  el.innerHTML = `Imputat ${fmtM(s)}${base ? ` (${fmtN(s / base * 100)}%)` : ''} · sense imputar <b style="color:${Math.abs(resta) > 0.005 && (base >= 0 ? resta < 0 : resta > 0) ? 'var(--bad)' : 'inherit'}">${fmtM(resta)}</b>`;
}
const _openImp2 = openForm;
openForm = function (mk, id, def) {
  _openImp2(mk, id, def);
  if (IMK[mk] && $('#frm')) { const f = id && S[mk].find((x) => x.id === id); FI = ((f && f.imputacions) || []).map((r) => ({ tp: impTp(r), v: r.tp ? r.v : r.id, t: fmtN(r.import) })); if (!FI.length) FI.push({ tp: 'p', v: '', t: '' }); impPinta(); }
  if (mk === 'partides' || mk === 'modificats') indLlista();
  if ((mk === 'partides' || mk === 'modificats') && id) {
    const fs = impMapa().get(id) || [], b = $('#drawerHost .body'), p = S[mk].find((x) => x.id === id);
    if (b) b.insertAdjacentHTML('beforeend', `<div><b>Cost real</b><div class="small" style="margin:2px 0 6px">Factures i parts imputats ${fmtM(imputatA(id))} + altres costos ${fmtM(p.costReal)} = <b>${fmtM(costRealDe(p))}</b></div>${fs.length ? `<div class="tw"><table><thead><tr><th>Document</th><th>Empresa o persona</th><th class="num">Imputat</th></tr></thead><tbody>${fs.map(({ mk, f, v }) => `<tr data-act="edit" data-mk="${mk}" data-id="${esc(f.id)}"><td>${esc(mk === 'factures' ? f.num || '' : mk === 'parts' ? 'Part ' + fmtD(f.data) : 'Part mensual ' + (f.mes || ''))}</td><td>${esc(mk === 'factures' ? f.tercer || '' : f.treballador || '')}</td><td class="num">${fmtM(v)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="muted small">Res imputat.</div>'}</div>`);
  }
};
document.addEventListener('change', (e) => { if (e.target.id === 'fld-obraId') indLlista(); });
const _readImp = readForm;
readForm = function () {
  const r = _readImp();
  if (IMK[r.mk] && FI && impFm()) { const base = impBase(impFm()); r.o.imputacions = IMK[r.mk].actiu(impFm().elements) && r.o.obraId ? FI.filter((x) => !impBuit(x)).map((x) => ({ tp: impTp(x), v: x.v, import: impVal(x.t, base) })).filter((x) => x.import) : []; }
  if (r.id && (r.mk === 'partides' || r.mk === 'modificats')) r.o.id = r.id;
  return r;
};
const _saveImp = saveForm;
saveForm = async function () {
  const fm = $('#frm');
  if (fm && IMK[fm.dataset.mk] && FI) {
    const base = impBase(fm), oid = fm.elements.obraId.value, v = FI.filter((x) => !impBuit(x) || String(x.t).trim()).map((x) => ({ r: x, n: impVal(x.t, base) }));
    if (v.some((x) => isNaN(x.n))) { toast('Hi ha imports d\'imputació que no són correctes.'); return; }
    if (v.some((x) => impBuit(x.r) && x.n)) { toast('Hi ha un import sense destí.'); return; }
    if (v.some((x) => !impBuit(x.r) && x.n && !impDesti(oid, x.r).length)) { toast('Hi ha una línia que no correspon a cap partida.'); return; }
    const s = r2(sum(v, (x) => x.n));
    if (base >= 0 ? s > base + 0.005 : s < base - 0.005) { toast('S\'imputa més que l\'import del document.'); return; }
  }
  const r = await _saveImp();
  if (!$('#frm')) FI = null;
  return r;
};
/* Calculadora de la partida amb les factures imputades */
const _calcOImp = calcOther;
calcOther = function (mk, o, id) { return _calcOImp(mk, id ? { ...o, id } : o, id); };
document.addEventListener('input', (e) => {
  const t = e.target;
  if (t.dataset.impk && FI) {
    const r = FI[+t.closest('[data-imp]').dataset.imp];
    if (t.dataset.impk === 'tp') { r.tp = t.value; r.v = t.value === 'conj' ? [] : ''; impPinta(); return; }
    if (t.dataset.impk === 'v') { r.v = t.multiple ? [...t.selectedOptions].map((o) => o.value) : t.value; if (t.multiple) { const n = t.parentElement.querySelector('.small'); if (n) n.textContent = `Ctrl o Maj per triar-ne diverses · ${r.v.length} triades`; } }
    else r.t = t.value;
    impTot();
  } else if (t.closest && t.closest('#frm') && impFm() && FI) { if (['obraId', 'sentit'].includes(t.name)) { if (t.name === 'obraId') FI = [{ tp: 'p', v: '', t: '' }]; impPinta(); } else if (IMK[$('#frm').dataset.mk].camps.includes(t.name)) impTot(); }
});
document.addEventListener('change', (e) => { const t = e.target; if (t.dataset.impk === 't' && FI) { const v = String(t.value).trim(); if (v && !v.endsWith('%') && !isNaN(nv(v))) t.value = fmtN(nv(v)); } });
document.addEventListener('click', (e) => {
  const a = e.target.closest('[data-act]'); if (!a || !FI) return;
  if (a.dataset.act === 'impAfegeix') { FI.push({ tp: 'p', v: '', t: '' }); impPinta(); }
  else if (a.dataset.act === 'impTreu') { FI.splice(+a.dataset.i, 1); if (!FI.length) FI.push({ tp: 'p', v: '', t: '' }); impPinta(); }
  else if (a.dataset.act === 'impResta') { const base = impBase(impFm()), l = FI[FI.length - 1], al = r2(sum(FI.slice(0, -1), (x) => impVal(x.t, base) || 0)); l.t = fmtN(r2(base - al)); impPinta(); }
});
/* A la llista de factures */
const impCol = (mk) => ({ l: 'Imputació', f: (o) => { const n = (o.imputacions || []).length, s = sum(o.imputacions || [], (i) => +i.import), b = impCost(mk, o); return n ? `${n} ${n === 1 ? 'línia' : 'línies'} · ${b ? fmtN(s / b * 100) + '%' : fmtM(s)}` : '<span class="muted">—</span>'; } });
M.factures.cols.splice(M.factures.cols.length - 1, 0, impCol('factures'));
M.parts.cols.splice(M.parts.cols.length - 1, 0, impCol('parts'));
M.partsMes.cols.push(impCol('partsMes'));
