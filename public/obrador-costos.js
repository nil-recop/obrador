/* Costos directes i indirectes de l'obra, reals i previstos.
   Compres: segons el tipus (configurable) i canviable a cada comanda.
   Hores: directes, tret dels tècnics; canviable a cada part. Dietes i desplaçaments: sempre indirectes. */
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
const dirPart = (p) => (natPart(p) === 'Directe' ? horesCost(p) : 0);

const _finC = fin;
fin = function (oid) {
  const f = _finC(oid);
  const cs = S.comandes.filter((c) => c.obraId === oid && !['Esborrany', 'Cancel·lada'].includes(c.estat)), ps = S.parts.filter((p) => p.obraId === oid);
  f.dirCompres = sum(cs.filter((c) => natCompra(c) === 'Directe'), (c) => +c.import);
  f.dirMa = sum(ps, dirPart);
  f.directe = f.dirCompres + f.dirMa;
  f.indCompres = f.compres - f.dirCompres;
  f.extres = sum(ps, extresCost);
  f.indMa = f.ma - f.dirMa - f.extres;
  f.indirecte = f.indCompres + f.indMa + f.extres;
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
  e.indPrev = buit(o.costIndPrev) ? null : +o.costIndPrev;
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
  c.splice(i + 1, 0, { k: 'costDirPrev', l: 'Cost directe previst (€) — buit: partides', tp: 'money', d: 2 }, { k: 'costIndPrev', l: 'Cost indirecte previst (€)', tp: 'money', d: 2 });
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
   ${fil('Cost directe', `${orig}${e.modCost && e.dirOrigen ? ` · inclou ${fmtM(e.modCost)} de modificats` : ''}`, e.dirPrev, f.directe, 1)}
   ${fil('&nbsp;&nbsp;Compres directes', '', null, f.dirCompres)}${fil('&nbsp;&nbsp;Hores directes', '', null, f.dirMa)}
   ${fil('Cost indirecte', e.indPrev == null ? 'Sense previsió' : 'Previsió entrada a l\'obra', e.indPrev, f.indirecte, 1)}
   ${fil('&nbsp;&nbsp;Compres indirectes', '', null, f.indCompres)}${fil('&nbsp;&nbsp;Hores indirectes (tècnics)', '', null, f.indMa)}${fil('&nbsp;&nbsp;Dietes i desplaçaments', '', null, f.extres)}
   ${fil("Cost d'obra", 'Directe + indirecte', totP, f.cost, 1)}
  </tbody></table></div><div class="pb small" style="border-top:1px solid var(--line)">${e.complet
    ? `<b style="font-size:14px;color:${e.netPrev < 0 ? 'var(--bad)' : 'var(--ok)'}">Resultat previst: ${M2(e.netPrev)} · ${p1(e.netPrev / e.vigent)}</b><br>Contracte vigent ${M2(e.vigent)} − directe ${M2(e.dirPrev)} − indirecte ${M2(e.indPrev)} − estructura ${M2(e.estPrev)}`
    : `Per calcular el resultat previst falta: ${[e.vigent > 0 ? '' : 'el contracte', e.dirPrev == null ? 'el cost directe' : '', e.indPrev == null ? 'el cost indirecte' : ''].filter(Boolean).join(', ')}. S'entren a «Edita l'obra».`}</div></section>`;
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
  if (buit(e.costDirPrev.value) || buit(e.costIndPrev.value) || !ct) return;
  const r = ct - e.costDirPrev.value - e.costIndPrev.value - ct * pct / 100;
  box.innerHTML += `<span>Cost directe previst</span><b>−${MF2.format(e.costDirPrev.value)}</b><span>Cost indirecte previst</span><b>−${MF2.format(e.costIndPrev.value)}</b><span style="font-weight:600">Resultat previst (sense modificats)</span><b>${MF2.format(r)} · ${p1(r / ct)}</b>`;
};
const _saveC = saveForm;
saveForm = async function () {
  const fm = $('#frm');
  if (fm && fm.dataset.mk === 'obres') for (const k of ['costDirPrev', 'costIndPrev']) if (+fm.elements[k].value < 0) { toast('Els costos previstos no poden ser negatius.'); fm.elements[k].focus(); return; }
  return _saveC();
};

/* Configuració dels tipus de compra */
const _cfgC = estrConfigHtml;
estrConfigHtml = function () {
  const ts = M.comandes.camps.find((f) => f.k === 'tipus').o;
  return _cfgC() + `<section class="panel" style="margin-bottom:16px"><h2>Costos directes i indirectes</h2><div class="pb"><div style="display:flex;gap:14px;flex-wrap:wrap;align-items:flex-end">${ts.map((t, i) => `<label style="display:flex;flex-direction:column;gap:4px;font-size:13px">${esc(t)}<select data-tc="${esc(t)}" id="tc-${i}" ${CANWRITE ? '' : 'disabled'} style="border:1px solid var(--line);background:var(--surface);color:var(--ink);border-radius:5px;padding:7px 10px;font:inherit">${['Directe', 'Indirecte'].map((x) => `<option ${x === tipusCompra(t) ? 'selected' : ''}>${x}</option>`).join('')}</select></label>`).join('')}${CANWRITE ? '<button class="btn sm" data-act="saveTc">Desa</button>' : ''}</div>
  <div class="small" style="margin-top:10px">Valor de cada tipus de compra; es pot canviar a cada comanda. Les hores són directes, tret dels tècnics (${CAT_TECNIC.join(', ').toLowerCase()}). Les dietes i els desplaçaments són sempre indirectes.</div></div></section>`;
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
