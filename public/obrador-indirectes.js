/* Indirectes: quadre mensual de previsió. Dedicacions = cost mensual × %; la resta, imports per mes.
   Els mesos acabats compten com a cost real; el mes en curs i els següents són previsió.
   Les compres indirectes només es preveuen aquí: el seu cost real ve de Compres i Proformes. */
const IND_DED = ["Dedicació cap d'àrea", 'Dedicació cap de grup', "Dedicació cap d'obra", 'Dedicació cap de producció'];
/* Els caps de l'obra (fitxa de l'obra) i la dedicació que els correspon */
const CAPS_OBRA = [['capArea', "Cap d'àrea", "Dedicació cap d'àrea"], ['capGrup', 'Cap de grup', 'Dedicació cap de grup'], ['cap', "Cap d'obra", "Dedicació cap d'obra"], ['capProd', 'Cap de producció', 'Dedicació cap de producció']];
/* Una línia de dedicació per a cada cap amb nom a la fitxa de l'obra */
function qCaps(oid, q) {
  const o = obra(oid) || {};
  CAPS_OBRA.forEach(([k, , tipus]) => {
    const nom = String(o[k] || '').trim(); if (!nom) return;
    const l = q.linies.find((x) => x.tipus === tipus && (x.deObra || normC(x.nom) === normC(nom))) || q.linies.find((x) => x.tipus === tipus && !x.deObra);
    if (l) { l.nom = nom; l.deObra = k; } else q.linies.push({ id: 'cap-' + k, tipus, nom, cost: '', mesos: {}, deObra: k });
  });
  return q;
}
const IND_FIX = [['dietes', 'Dietes'], ['despl', 'Desplaçaments i peatges'], ['fin', 'Càrregues financeres'], ['compres', 'Compres indirectes (previsió)'], ['altres', 'Altres sense factura']];
S.indirectes = [];
COLS.push('indirectes');
const QD = {}; // quadres amb canvis sense desar, per obra
const qDoc = (oid) => S.indirectes.find((x) => x.obraId === oid && x.quadre);
const esDed = (l) => IND_DED.includes(l.tipus);
/* Quadre desat més les imputacions soltes d'abans que encara no s'hi han passat */
function quadre(oid) {
  const d = qDoc(oid), q = { linies: JSON.parse(JSON.stringify((d && d.linies) || [])), migrats: ((d && d.migrats) || []).slice() };
  S.indirectes.filter((x) => x.obraId === oid && !x.quadre && !q.migrats.includes(x.id)).sort((a, b) => String(a.data).localeCompare(String(b.data))).forEach((x) => {
    const m = String(x.data || '').slice(0, 7), pct = esDed(x) && x.unitat === "% de l'import" && !buit(x.quantitat) && !buit(x.preu);
    q.migrats.push(x.id);
    let l;
    if (pct) { l = q.linies.find((y) => y.tipus === x.tipus && normC(y.nom) === normC(x.persona) && +y.cost === +x.preu); if (!l) q.linies.push(l = { id: newId('q'), tipus: x.tipus, nom: x.persona || '', cost: +x.preu, mesos: {} }); l.mesos[m] = r2((+l.mesos[m] || 0) + +x.quantitat); return; }
    const k = { 'Dietes': 'dietes', 'Desplaçaments i peatges': 'despl', 'Càrregues financeres internes': 'fin' }[x.tipus] || 'altres';
    l = q.linies.find((y) => y.tipus === k); if (!l) q.linies.push(l = { id: k, tipus: k, mesos: {} });
    l.mesos[m] = r2((+l.mesos[m] || 0) + (+x.import || 0));
  });
  return qCaps(oid, q);
}
const qCost = (l, m) => (esDed(l) ? r2((+l.cost || 0) * (+l.mesos[m] || 0) / 100) : +l.mesos[m] || 0);
const qMesos = (q) => [...new Set(q.linies.flatMap((l) => Object.keys(l.mesos)))].sort();
function qTotals(q) {
  const ara = today().slice(0, 7), r = { prev: 0, real: 0, compres: 0 };
  q.linies.forEach((l) => Object.keys(l.mesos).forEach((m) => { const c = qCost(l, m); r.prev += c; if (l.tipus === 'compres') r.compres += c; else if (m < ara) r.real += c; }));
  return r;
}
const _finI = fin;
fin = function (oid) {
  const f = _finI(oid), q = qTotals(quadre(oid));
  f.indImp = r2(q.real); f.indQuadre = r2(q.prev);
  f.indirecte += f.indImp; f.cost += f.indImp;
  f.marge = f.certificat ? (f.certificat - f.cost) / f.certificat : null;
  return f;
};
const _econI = econ;
econ = function (id) {
  const e = _econI(id), q = quadre(id);
  e.indPrev = q.linies.some((l) => Object.keys(l.mesos).length) ? r2(qTotals(q).prev) : null;
  e.complet = e.dirPrev != null && e.indPrev != null && e.vigent > 0;
  e.netPrev = e.complet ? e.vigent - e.dirPrev - e.indPrev - e.estPrev : null;
  return e;
};
/* ---------- Pantalla ---------- */
const qEd = (oid) => QD[oid] || quadre(oid);
const qTxt = (v, n) => (typeof v === 'string' ? v : buit(v) ? '' : fmtN(v));
function qVeu(oid) { // còpia amb els textos convertits a números
  const q = JSON.parse(JSON.stringify(qEd(oid))); q.mal = false;
  const num = (t) => { if (typeof t !== 'string') return t; const n = t.trim() === '' ? null : pnum(t); if (n != null && (isNaN(n) || n < 0)) q.mal = true; return n; };
  q.linies.forEach((l) => { if ('cost' in l) l.cost = num(l.cost) || 0; Object.keys(l.mesos).forEach((m) => { const n = num(l.mesos[m]); if (n == null) delete l.mesos[m]; else l.mesos[m] = n || 0; }); });
  return q;
}
const qDeds = (q) => q.linies.filter(esDed).map((l, i) => ({ l, i })).sort((a, b) => IND_DED.indexOf(a.l.tipus) - IND_DED.indexOf(b.l.tipus) || a.i - b.i).map((x) => x.l);
function qCols(q) { return [...qDeds(q),...IND_FIX.map(([k, l]) => ({ ...(q.linies.find((x) => x.tipus === k) || { id: k, tipus: k, mesos: {} }), et: l }))]; }
function quadreHtml(oid) {
  const o = obra(oid), q = qEd(oid), v = qVeu(oid), ara = today().slice(0, 7), dis = CANWRITE ? '' : 'disabled';
  const ok = (m) => /^\d{4}-\d\d$/.test(m), ini = String(o.inici || '').slice(0, 7), fi = String(o.fi || '').slice(0, 7), am = qMesos(q);
  let lim = [ok(ini) ? ini : '', ok(fi) ? fi : ok(ini) || am.length ? ara : '', ...am, ...(q.extra || [])].filter(Boolean).sort();
  if (!lim.length) lim = [ara, mesMes(ara, 11)];
  const ms = mesosEntre(lim[0], lim[lim.length - 1]), cols = qCols(q), ded = qDeds(q);
  const f = fin(oid), e = econ(oid);
  const fila = (l, x, b) => `<tr style="cursor:default"><td${b ? ' style="font-weight:600"' : ''}>${l}</td><td class="num"${b ? ' style="font-weight:600"' : ''}>${x == null ? '—' : fmtM(x)}</td></tr>`;
  const sug = [...new Set([...S.personal.filter((p) => p.estat !== 'Inactiu').map((p) => p.nom), ...S.indirectes.flatMap((x) => (x.linies || []).map((l) => l.nom))].filter(Boolean))];
  return `<section class="panel" style="margin-bottom:16px"><h2>Cost indirecte de l'obra<span class="sp"></span><span class="small">Sense IVA · dades desades</span></h2><div class="econ-g">
  <table><thead><tr><th>Previsió</th><th class="num">Import</th></tr></thead><tbody>${fila('Total del quadre (previst)', e.indPrev, 1)}${fila('Real fins avui', f.indirecte)}${fila('Disponible', e.indPrev == null ? null : e.indPrev - f.indirecte, 1)}</tbody></table>
  <table><thead><tr><th>Real fins avui</th><th class="num">Import</th></tr></thead><tbody>${fila('Quadre, mesos acabats', f.indImp)}${fila('Compres i factures indirectes', f.indCompres)}${fila('Hores de tècnics als parts', f.indMa)}</tbody></table></div>${f.indMa ? '<div class="pb small" style="color:var(--warn)">Hi ha hores de tècnics als parts. Si ja són a la dedicació del quadre, compten dues vegades.</div>' : ''}</section>
  <section class="panel" style="margin-bottom:16px"><h2>Persones i dedicació<span class="sp"></span><span class="small">Els caps surten de la fitxa de l'obra: només cal el cost mensual</span>${CANWRITE ? `<button class="btn sm" data-act="edit" data-mk="obres" data-id="${esc(oid)}">Caps de l'obra</button>` : ''}</h2><div class="pers">${ded.map((l) => (l.deObra && String(o[l.deObra] || '').trim()) ? `<div><div><span class="small">${esc((CAPS_OBRA.find((c) => c[0] === l.deObra) || [])[1] || '')}</span><div style="font-weight:600">${esc(l.nom)}</div></div><label>Cost mensual (€)<input class="ed" id="qc-${esc(l.id)}" data-col="qc" inputmode="decimal" data-ql="${esc(l.id)}" data-qk="cost" value="${esc(qTxt(l.cost))}" ${dis}></label></div>` : `<div><label>Càrrec<select class="ed txt" data-ql="${esc(l.id)}" data-qk="tipus" ${dis}>${IND_DED.map((t) => `<option value="${esc(t)}" ${t === l.tipus ? 'selected' : ''}>${esc(t.replace('Dedicació c', 'C'))}</option>`).join('')}</select></label><label>Nom<input class="ed txt" id="qn-${esc(l.id)}" list="q-noms" autocomplete="off" data-ql="${esc(l.id)}" data-qk="nom" value="${esc(l.nom || '')}" ${dis}></label><label>Cost mensual (€)<input class="ed" id="qc-${esc(l.id)}" data-col="qc" inputmode="decimal" data-ql="${esc(l.id)}" data-qk="cost" value="${esc(qTxt(l.cost))}" ${dis}></label>${CANWRITE ? `<button class="btn sm" data-act="qTreu" data-id="${esc(l.id)}">Treu</button>` : ''}</div>`).join('')}${CANWRITE ? '<div style="justify-content:center;border-style:dashed"><button class="btn" data-act="qPersona">+ Una altra persona</button></div>' : ''}</div><datalist id="q-noms">${sug.map((n) => `<option value="${esc(n)}">`).join('')}</datalist></section>
  <div class="tw"><table class="quad"><thead><tr><th>Mes</th>${cols.map((l) => `<th class="num">${esDed(l) ? `${esc(l.nom || l.tipus.replace('Dedicació c', 'C'))}<br>% dedicació` : esc(l.et) + '<br>€'}</th>`).join('')}<th class="num">Total mes</th></tr></thead><tbody>
  ${CANWRITE ? `<tr style="cursor:default"><td class="small">Omple tots els mesos</td>${cols.map((l) => `<td><input class="ed" data-col="qo" data-qo="${esc(l.id)}" inputmode="decimal" placeholder="${esDed(l) ? '%' : '€'}" aria-label="Omple tots els mesos"></td>`).join('')}<td></td></tr>` : ''}
  ${ms.map((m) => `<tr style="cursor:default" data-qm="${m}"><td class="t-main">${nomMesC(m)}<span class="l2">${m < ara ? 'Real' : 'Previsió'}</span></td>${cols.map((l) => `<td><input class="ed" id="q-${esc(l.id)}-${m}" data-col="q-${esc(l.id)}" data-ql="${esc(l.id)}" data-qm="${m}" inputmode="decimal" autocomplete="off" aria-label="${esc((l.nom || l.et || l.tipus) + ' ' + nomMesC(m))}" value="${esc(qTxt(l.mesos[m]))}" ${dis}></td>`).join('')}<td class="num" data-qt="${m}"></td></tr>`).join('')}
  <tr class="cap"><td>Total</td>${cols.map((l) => `<td class="num" data-qs="${esc(l.id)}"></td>`).join('')}<td class="num" data-qs="*"></td></tr></tbody></table></div>
  ${CANWRITE ? `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px"><button class="btn sm" data-act="qMes" data-m="${mesMes(ms[0], -1)}">+ Mes abans</button><button class="btn sm" data-act="qMes" data-m="${mesMes(ms[ms.length - 1], 1)}">+ Mes després</button></div>` : ''}
  <div class="barra"><span id="q-st" class="small"></span><span class="sp"></span>${CANWRITE ? '<button class="btn" data-act="qDesfes">Desfés els canvis</button><button class="btn pri" data-act="qDesa">Desa el quadre</button>' : ''}</div>`;
}
const qObra = () => { const r = route(); return r.v === 'obra' ? r.id : ''; };
function quadreTot() {
  const oid = qObra(); if (!$('#q-st') || !oid) return;
  const v = qVeu(oid), ms = [...document.querySelectorAll('tr[data-qm]')].map((r) => r.dataset.qm);
  const tot = {}; let g = 0;
  ms.forEach((m) => { let t = 0; v.linies.forEach((l) => { const c = qCost(l, m); t += c; tot[l.id] = (tot[l.id] || 0) + c; }); g += t; document.querySelector(`[data-qt="${m}"]`).textContent = fmtM(t); });
  document.querySelectorAll('[data-qs]').forEach((c) => { c.textContent = fmtM(c.dataset.qs === '*' ? g : tot[c.dataset.qs] || 0); });
  document.querySelectorAll('.ed[data-ql]:not(.txt)').forEach((i) => { const n = i.value.trim() === '' ? 0 : pnum(i.value); i.classList.toggle('mal', isNaN(n) || n < 0); });
  $('#q-st').textContent = QD[oid] ? 'Canvis sense desar' : 'Tot desat';
  const b = document.querySelector('[data-act=qDesa]'); if (b) b.disabled = !QD[oid];
}
function qMou(oid) { return QD[oid] || (QD[oid] = quadre(oid)); }
function qLinia(q, id) { let l = q.linies.find((x) => x.id === id); if (!l) q.linies.push(l = { id, tipus: id, mesos: {} }); return l; }
document.addEventListener('input', (e) => {
  const t = e.target, oid = qObra();
  if (!t.dataset.ql || !oid) return;
  const l = qLinia(qMou(oid), t.dataset.ql);
  if (t.dataset.qk) l[t.dataset.qk] = t.value; else l.mesos[t.dataset.qm] = t.value;
  quadreTot();
});
document.addEventListener('change', (e) => {
  const t = e.target, oid = qObra(); if (!oid) return;
  if (t.dataset.qo) {
    const n = t.value.trim() === '' ? null : pnum(t.value); if (n == null) return;
    if (isNaN(n) || n < 0) { toast('Aquest valor no és correcte.'); return; }
    const l = qLinia(qMou(oid), t.dataset.qo); document.querySelectorAll('tr[data-qm]').forEach((r) => { l.mesos[r.dataset.qm] = n; }); paint();
  } else if (t.dataset.ql && t.dataset.qk && t.dataset.qk !== 'cost') setTimeout(paint, 0);
  else if (t.dataset.ql) { const n = t.value.trim() === '' ? null : pnum(t.value); if (n != null && !isNaN(n)) t.value = fmtN(n); }
});
async function qDesa(oid) {
  const q = qVeu(oid), d = qDoc(oid), b = document.querySelector('[data-act=qDesa]');
  if (q.mal) { toast('Hi ha valors que no són correctes, marcats en vermell.'); return; }
  if (q.linies.some((l) => esDed(l) && !String(l.nom || '').trim())) { toast('Falta el nom d\'alguna persona.'); return; }
  b.disabled = true;
  const { id, ...r } = d || {};
  try { await save('indirectes', id || 'q-' + oid, { ...r, obraId: oid, quadre: true, linies: q.linies, migrats: q.migrats }); } catch (e) { b.disabled = false; return; }
  delete QD[oid]; logA(`Quadre d'indirectes actualitzat a ${obraTxt(oid)}`); toast('Quadre desat.'); paint();
}
document.addEventListener('click', (e) => {
  const a = e.target.closest('[data-act]'), oid = qObra(); if (!a || !oid) return;
  const t = a.dataset.act;
  if (t === 'qPersona') { const q = qMou(oid), id = newId('q'); q.linies.push({ id, tipus: IND_DED.find((x) => !q.linies.some((l) => l.tipus === x)) || IND_DED[1], nom: '', cost: '', mesos: {} }); paint(); const i = document.getElementById('qn-' + id); if (i) i.focus(); }
  else if (t === 'qTreu') { const q = qMou(oid); q.linies = q.linies.filter((l) => l.id !== a.dataset.id); paint(); }
  else if (t === 'qMes') { const q = qMou(oid); q.extra = [...(q.extra || []), a.dataset.m]; paint(); }
  else if (t === 'qDesfes') { delete QD[oid]; paint(); }
  else if (t === 'qDesa') qDesa(oid);
});
