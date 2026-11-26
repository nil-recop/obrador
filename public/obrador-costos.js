/* Costos directes i indirectes de l'obra, reals i previstos.
   Compres i factures rebudes: segons el tipus (configurable) i canviable a cada comanda o factura.
   Hores: directes, tret dels tècnics; canviable a cada part. Dietes i desplaçaments dels parts: sempre directes. */
const TC = ['Automàtic', 'Directe', 'Indirecte'];
const TIPUS_DEF = { 'Serveis': 'Indirecte' };
const CAT_TECNIC = ["Cap d'obra", 'Cap de producció', 'Cap de grup', 'Tècnic'];
const normC = (v) => String(v || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’`´]/g, "'").trim();
const ES_TECNIC = new Set(['tecnic', 'tecnica', 'tecnic/a', ...CAT_TECNIC.map(normC)]);
const cfgEmp = () => S.config.find((x) => x.id === 'empresa') || {};
const tipusCompra = (t) => (cfgEmp().tipusCompres || {})[t] || TIPUS_DEF[t] || 'Directe';
const natCompra = (c) => (['Directe', 'Indirecte'].includes(c.tipusCost) ? c.tipusCost : tipusCompra(c.tipus));
function natPart(p) {
  if (['Directe', 'Indirecte'].includes(p.tipusCost)) return p.tipusCost;
  const f = S.personal.find((x) => x.id === p.personaId);
  return ES_TECNIC.has(normC(p.ofici)) || (f && (f.rol === 'Tècnic/a' || (!p.ofici && ES_TECNIC.has(normC(f.categoria))))) ? 'Indirecte' : 'Directe';
}
const horesCost = (p) => (+p.hores || 0) * (+p.preuHora || 0);
const extresCost = (p) => (+p.dietes || 0) + (+p.desplacament || 0);
const dirHores = (p) => (natPart(p) === 'Directe' ? horesCost(p) : 0);
const dirPart = (p) => dirHores(p) + extresCost(p);

/* Factures rebudes: la part facturada d'una comanda compta per les seves factures; la resta, pendent de facturar, per la comanda.
   Comanda tancada amb factures: només compten les factures. Factura sense comanda: compta sencera. Imports: base imposable. */
const comandaDe = (f) => S.comandes.find((c) => c.id === f.comandaId && c.obraId === f.obraId);
const facCost = (f) => f.sentit === 'Rebuda' && f.estat !== 'Esborrany';
const natAuto = (f) => { const c = comandaDe(f); return c ? natCompra(c) : tipusCompra(f.tipusDespesa || 'Material'); };
const natFactura = (f) => (['Directe', 'Indirecte'].includes(f.tipusCost) ? f.tipusCost : natAuto(f));
const facturatCom = (c) => sum(S.factures.filter((f) => facCost(f) && comandaDe(f) === c), (f) => +f.base);
/* Proformes enviades i encara sense factura: provisió. La seva comanda compta només pel que no cobreixen. */
const pfPendent = (p) => p.estat === 'Enviada' && !S.factures.some((f) => f.proformaId === p.id && facCost(f));
const pfBase = (p) => r2(sum(p.linies || [], (l) => r2((+l.q || 0) * (+l.preu || 0))));
const natProf = (p) => { const c = S.comandes.find((x) => x.id === p.comandaId && x.obraId === p.obraId); return ['Directe', 'Indirecte'].includes(p.tipusCost) ? p.tipusCost : c ? natCompra(c) : tipusCompra(p.tipusDespesa || 'Material'); };
function liniesCompra(oid) {
  const l = S.factures.filter((f) => f.obraId === oid && facCost(f)).map((f) => ({ fac: 1, nat: natFactura(f), import: +f.base || 0 }));
  const pfs = (S.proformes || []).filter((p) => p.obraId === oid && pfPendent(p));
  pfs.forEach((p) => l.push({ pf: 1, nat: natProf(p), import: pfBase(p) }));
  S.comandes.filter((c) => c.obraId === oid && !['Esborrany', 'Cancel·lada'].includes(c.estat)).forEach((c) => {
    const fac = facturatCom(c), pp = sum(pfs.filter((p) => p.comandaId === c.id), pfBase), r = fac && c.estat === 'Tancada' ? 0 : Math.max(0, (+c.import || 0) - fac - pp);
    if (r) l.push({ nat: natCompra(c), import: r });
  });
  return l;
}
const _finC = fin;
fin = function (oid) {
  const f = _finC(oid);
  const l = liniesCompra(oid), ps = S.parts.filter((p) => p.obraId === oid);
  f.compres = sum(l, (x) => x.import);
  f.cost = f.compres + f.ma;
  f.marge = f.certificat ? (f.certificat - f.cost) / f.certificat : null;
  f.dirCompres = sum(l.filter((x) => x.nat === 'Directe'), (x) => x.import);
  f.dirFac = sum(l.filter((x) => x.fac && x.nat === 'Directe'), (x) => x.import);
  f.indFac = sum(l.filter((x) => x.fac && x.nat !== 'Directe'), (x) => x.import);
  f.dirMa = sum(ps, dirHores);
  f.extres = sum(ps, extresCost);
  f.directe = f.dirCompres + f.dirMa + f.extres;
  f.indCompres = f.compres - f.dirCompres;
  f.extres = sum(ps, extresCost);
  f.indMa = f.ma - f.dirMa - f.extres;
  f.indirecte = f.indCompres + f.indMa;
  return f;
};

/* Previsió: directe entrat a l'obra o, si és buit, el cost previst de les partides; més el cost dels modificats aprovats */
const _econC = econ;
econ = function (id) {
  const e = _econC(id), o = e.o;
  const part = sum(S.partides.filter((p) => p.obraId === id), (p) => ptc(p).costPrev);
  e.dirOrigen = !buit(o.costDirPrev) ? 'manual' : part > 0 ? 'partides' : '';
  e.modCost = sum(S.modificats.filter((m) => m.obraId === id && ['Aprovat', 'Executat'].includes(m.estat)), (m) => +m.cost);
  e.dirBase = e.dirOrigen === 'manual' ? +o.costDirPrev : part;
  e.dirPrev = e.dirOrigen ? e.dirBase + e.modCost : null;
  e.indPrev = null;
  e.complet = e.dirPrev != null && e.indPrev != null && e.vigent > 0;
  e.netPrev = e.complet ? e.vigent - e.dirPrev - e.indPrev - e.estPrev : null;
  return e;
};

const _ctlC = ctlObra;
ctlObra = function (id) {
  const k = _ctlC(id), e = econ(id);
  k.indFinal = Math.max(e.indPrev || 0, k.f.indirecte);
  k.indPrev = e.indPrev;
  if (k.margeNet != null && k.venda) k.margeNet -= k.indFinal / k.venda;
  return k;
};

(() => {
  const c = M.obres.camps, i = c.findIndex((f) => f.k === 'estructura');
  c.splice(i + 1, 0, { k: 'costDirPrev', l: 'Cost directe previst (€) — buit: partides', tp: 'money', d: 2 });
  const cc = M.comandes.camps, j = cc.findIndex((f) => f.k === 'tipus');
  cc.splice(j + 1, 0, { k: 'tipusCost', l: 'Cost directe o indirecte', tp: 'sel', o: TC });
  M.comandes.cols.splice(M.comandes.cols.indexOf('tipus') + 1, 0, { l: 'Cost', f: (o) => natHtml(natCompra(o), o.tipusCost) });
  const pc = M.parts.camps;
  pc.splice(pc.findIndex((f) => f.k === 'feina'), 0, { k: 'tipusCost', l: "Cost de les hores", tp: 'sel', o: TC });
  M.parts.cols.splice(M.parts.cols.indexOf('hores') + 1, 0, { l: 'Hores com a', f: (o) => natHtml(natPart(o), o.tipusCost) });
  for (const [mk, k] of [['parts', 'ofici'], ['personal', 'categoria']]) { const f = M[mk].camps.find((x) => x.k === k); CAT_TECNIC.concat('Capatàs').forEach((t) => { if (!f.o.includes(t)) f.o.push(t); }); }
})();
function natHtml(n, manual) { const m = ['Directe', 'Indirecte'].includes(manual); return `<span class="pill t-${n === 'Directe' ? 'info' : 'warn'}" title="${m ? 'Triat a mà' : 'Automàtic'}">${n}${m ? ' *' : ''}</span>`; }

const _fieldC = fieldHtml;
fieldHtml = function (f, v) { return _fieldC(f, f.k === 'tipusCost' && !TC.includes(v) ? 'Automàtic' : v); };

/* Fitxa de l'obra: previst i real */
const _panelC = econPanel;
econPanel = function (id) {
  const e = econ(id), f = e.f;
  const M2 = (n) => MF2.format(+n || 0);
  const fil = (l, s, prev, real, fort) => {
    const pc = prev ? real / prev : null, des = prev == null ? null : prev - real, st = fort ? ' style="font-weight:600"' : '';
    return `<tr style="cursor:default"><td${st}>${l}${s ? `<div class="small">${s}</div>` : ''}</td><td class="num"${st}>${prev == null ? '—' : M2(prev)}</td><td class="num"${st}>${M2(real)}</td><td class="num"${st}>${pc == null ? '—' : `<span style="color:${pc > 1 ? 'var(--bad)' : 'inherit'}">${p1(pc)}</span>`}</td><td class="num"${st}>${des == null ? '—' : `<span style="color:${des < 0 ? 'var(--bad)' : 'inherit'}">${M2(des)}</span>`}</td></tr>`;
  };
  const totP = e.dirPrev != null && e.indPrev != null ? e.dirPrev + e.indPrev : null;
  const orig = e.dirOrigen === 'manual' ? 'Previsió entrada a l\'obra' : e.dirOrigen === 'partides' ? 'Previsió segons les partides' : 'Sense previsió';
  const taula = `<section class="panel" style="margin-bottom:16px"><h2>Costos directes i indirectes<span class="sp"></span><span class="small">Imports sense IVA</span></h2><div class="tw" style="border:0"><table><thead><tr><th>Cost</th><th class="num">Previst</th><th class="num">Real fins avui</th><th class="num">Consumit</th><th class="num">Disponible</th></tr></thead><tbody>
   ${fil('Cost directe', `${orig}${e.modCost && e.dirOrigen ? ` · inclou ${fmtM(e.modCost)} de contradictòries` : ''}`, e.dirPrev, f.directe, 1)}
   ${fil('&nbsp;&nbsp;Compres i factures directes', f.dirFac ? `Facturat ${fmtM(f.dirFac)}` : '', null, f.dirCompres)}${fil('&nbsp;&nbsp;Hores directes', '', null, f.dirMa)}${fil('&nbsp;&nbsp;Dietes i desplaçaments (parts)', '', null, f.extres)}
   ${fil('Cost indirecte', e.indPrev == null ? 'Sense previsió' : 'Total del quadre d\'Indirectes', e.indPrev, f.indirecte, 1)}
   ${fil('&nbsp;&nbsp;Compres i factures indirectes', f.indFac ? `Facturat ${fmtM(f.indFac)}` : '', null, f.indCompres)}${fil('&nbsp;&nbsp;Hores de tècnics (parts)', '', null, f.indMa)}${fil('&nbsp;&nbsp;Quadre d\'indirectes', 'Mesos acabats', null, f.indImp)}
   ${fil("Cost d'obra", 'Directe + indirecte', totP, f.cost, 1)}
  </tbody></table></div><div class="pb small" style="border-top:1px solid var(--line)">${e.complet
    ? `<b style="font-size:14px;color:${e.netPrev < 0 ? 'var(--bad)' : 'var(--ok)'}">Resultat previst: ${M2(e.netPrev)} · ${p1(e.netPrev / e.vigent)}</b><br>Contracte vigent ${M2(e.vigent)} − directe ${M2(e.dirPrev)} − indirecte ${M2(e.indPrev)} − estructura ${M2(e.estPrev)}`
    : `Per calcular el resultat previst falta: ${[e.vigent > 0 ? '' : 'el contracte', e.dirPrev == null ? 'el cost directe' : '', e.indPrev == null ? 'el cost indirecte' : ''].filter(Boolean).join(', ')}. El directe s'entra a «Edita l'obra» o surt de les partides; l'indirecte, a l'apartat Indirectes.`}</div></section>`;
  return _panelC(id)
    .replace(`Compres ${fmtM(f.compres)} · mà d'obra ${fmtM(f.ma)}`, `Directe ${fmtM(f.directe)} · indirecte ${fmtM(f.indirecte)}`)
    .replace(/Segons les partides: brut ([^−]*) − estructura ([^.]*)\. /, (m, a, b) => `Segons les partides: brut ${a.trim()} − estructura ${b} − indirectes ${fmtM(ctlObra(id).indFinal)}. `) + taula;
};

const _formC = econForm;
econForm = function () {
  _formC();
  const fm = $('#frm'), box = $('#econ-calc');
  if (!fm || fm.dataset.mk !== 'obres' || !box) return;
  const e = fm.elements, ct = +e.pressupost.value || 0, pct = buit(e.estructura.value) ? estrGeneral() : +e.estructura.value;
  if (buit(e.costDirPrev.value) || !ct) return;
  const r = ct - e.costDirPrev.value - ct * pct / 100;
  box.innerHTML += `<span>Cost directe previst</span><b>−${MF2.format(e.costDirPrev.value)}</b><span style="font-weight:600">Resultat abans d'indirectes i contradictòries</span><b>${MF2.format(r)} · ${p1(r / ct)}</b>`;
};
const _saveC = saveForm;
saveForm = async function () {
  const fm = $('#frm');
  if (fm && fm.dataset.mk === 'obres') for (const k of ['costDirPrev']) if (+fm.elements[k].value < 0) { toast('Els costos previstos no poden ser negatius.'); fm.elements[k].focus(); return; }
  return _saveC();
};

/* Configuració dels tipus de compra */
const _cfgC = estrConfigHtml;
estrConfigHtml = function () {
  const ts = M.comandes.camps.find((f) => f.k === 'tipus').o;
  return _cfgC() + `<section class="panel" style="margin-bottom:16px"><h2>Costos directes i indirectes</h2><div class="pb"><div style="display:flex;gap:14px;flex-wrap:wrap;align-items:flex-end">${ts.map((t, i) => `<label style="display:flex;flex-direction:column;gap:4px;font-size:13px">${esc(t)}<select data-tc="${esc(t)}" id="tc-${i}" ${CANWRITE ? '' : 'disabled'} style="border:1px solid var(--line);background:var(--surface);color:var(--ink);border-radius:5px;padding:7px 10px;font:inherit">${['Directe', 'Indirecte'].map((x) => `<option ${x === tipusCompra(t) ? 'selected' : ''}>${x}</option>`).join('')}</select></label>`).join('')}${CANWRITE ? '<button class="btn sm" data-act="saveTc">Desa</button>' : ''}</div>
  <div class="small" style="margin-top:10px">Valor de cada tipus de compra o despesa; es pot canviar a cada comanda i a cada factura rebuda. Les hores són directes, tret dels tècnics (${CAT_TECNIC.join(', ').toLowerCase()}). Les dietes i els desplaçaments dels parts són sempre directes.</div></div></section>`;
};
document.addEventListener('click', async (ev) => {
  if (!ev.target.closest('[data-act="saveTc"]')) return;
  const m = {};
  document.querySelectorAll('[data-tc]').forEach((s) => { m[s.dataset.tc] = s.value; });
  const { id, ...prev } = cfgEmp();
  try { await save('config', 'empresa', { ...prev, tipusCompres: { ...(prev.tipusCompres || {}), ...m } }); } catch (x) { return; }
  logA('Canviada la configuració de costos directes i indirectes');
  toast('Configuració desada.');
});

/* Factures: comanda, tipus de despesa i naturalesa del cost */
(() => {
  TONE.Tancada = TONE.Tancada || 'neu';
  const ce = M.comandes.camps.find((f) => f.k === 'estat').o;
  ce.splice(ce.indexOf('Rebuda') + 1, 0, 'Tancada');
  M.comandes.cols.splice(M.comandes.cols.indexOf('import') + 1, 0, { l: 'Facturat', num: 1, f: (o) => (facturatCom(o) ? fmtM(facturatCom(o)) : '—') });
  const fc = M.factures.camps, tipus = M.comandes.camps.find((f) => f.k === 'tipus').o;
  fc.splice(fc.findIndex((f) => f.k === 'concepte') + 1, 0, { k: 'comandaId', l: 'Comanda', tp: 'comanda' }, { k: 'tipusDespesa', l: 'Tipus de despesa', tp: 'sel', o: tipus }, { k: 'tipusCost', l: 'Cost directe o indirecte', tp: 'sel', o: TC });
  M.factures.cols.splice(M.factures.cols.indexOf('concepte') + 1, 0, { l: 'Cost', f: (o) => (o.sentit === 'Rebuda' && o.obraId ? natHtml(natFactura(o), o.tipusCost) : '<span class="muted">—</span>') });
})();
const _fieldF = fieldHtml;
fieldHtml = function (f, v) {
  if (f.tp === 'comanda') return `<div class="fld"><label for="fld-${f.k}">${esc(f.l)}</label><select id="fld-${f.k}" name="${f.k}" data-v="${esc(v || '')}" ${CANWRITE ? '' : 'disabled'}><option value="${esc(v || '')}" selected>—</option></select></div>`;
  return _fieldF(f, f.k === 'tipusDespesa' && !v ? 'Material' : v);
};
function facForm(init) {
  const fm = $('#frm');
  if (!fm || fm.dataset.mk !== 'factures') return;
  const e = fm.elements, reb = e.sentit.value === 'Rebuda', sel = e.comandaId;
  const val = init ? sel.dataset.v : sel.value;
  const cs = S.comandes.filter((c) => c.obraId === e.obraId.value && e.obraId.value && (c.id === val || !['Esborrany', 'Cancel·lada'].includes(c.estat)));
  const perdut = init && val && !cs.some((c) => c.id === val);
  sel.innerHTML = '<option value="">— Sense comanda —</option>' + cs.map((c) => `<option value="${esc(c.id)}">${esc([c.num, c.proveidor, fmtM(c.import)].filter(Boolean).join(' · '))}</option>`).join('') + (perdut ? `<option value="${esc(val)}">Comanda eliminada o d'una altra obra</option>` : '');
  sel.value = perdut || cs.some((c) => c.id === val) ? val : '';
  const c = cs.find((x) => x.id === sel.value);
  for (const k of ['comandaId', 'tipusDespesa', 'tipusCost']) e[k].closest('.fld').style.display = reb && (k !== 'tipusDespesa' || !c) ? '' : 'none';
  let box = $('#fac-nat');
  if (!box) { fm.insertAdjacentHTML('afterend', '<div class="small" id="fac-nat" style="margin-top:10px"></div>'); box = $('#fac-nat'); }
  if (!reb) { box.innerHTML = ''; return; }
  if (!e.obraId.value) { box.innerHTML = 'Sense obra no s\'imputa a cap cost d\'obra.'; return; }
  const f = { obraId: e.obraId.value, comandaId: sel.value, tipusDespesa: e.tipusDespesa.value, tipusCost: e.tipusCost.value }, n = natFactura(f);
  const prov = e.tercer.value.trim(), igual = !c && prov && cs.find((x) => normC(x.proveidor) === normC(prov) && x.estat !== 'Tancada');
  box.innerHTML = `Compta com a <b>cost ${n.toLowerCase()}</b> ${f.tipusCost === n ? '(triat a mà)' : c ? `segons la comanda ${esc(c.num || '')}` : 'segons el tipus de despesa'}, per la base imposable.`
    + (e.estat.value === 'Esborrany' ? ' <b>Mentre sigui un esborrany no compta.</b>' : '')
    + (igual ? `<div style="color:var(--warn)">Aquest proveïdor té la comanda ${esc(igual.num || '')} en aquesta obra. Si la factura hi correspon, tria-la; si no, es comptaran totes dues.</div>` : '');
}
const _openF = openForm;
openForm = function (mk, id, def) { _openF(mk, id, def); facForm(true); };
document.addEventListener('input', (e) => { if (e.target.closest && e.target.closest('#frm')) facForm(); });
const _saveF = saveForm;
saveForm = async function () {
  const fm = $('#frm');
  if (fm && fm.dataset.mk === 'factures' && fm.elements.sentit.value !== 'Rebuda') fm.elements.comandaId.value = '';
  if (fm && fm.dataset.mk === 'comandes' && fm.elements.estat.value === 'Tancada') {
    const c = S.comandes.find((x) => x.id === fm.dataset.id);
    if (!c || !facturatCom(c)) { toast('No es pot tancar una comanda sense cap factura rebuda: el cost quedaria a zero.'); return; }
  }
  return _saveF();
};