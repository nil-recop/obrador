/* Imputació de factures rebudes a partides i contradictòries: el cost real d'execució de cada partida.
   Una factura es reparteix entre diverses partides; el que no s'hi reparteix queda sense imputar. */
let FI = null; // repartiment de la factura oberta: [{id, t}] (t = text de l'import o «50%»)
const impPartides = (oid) => [...S.partides.filter((p) => p.obraId === oid).map((p) => ({ mk: 'partides', p })), ...S.modificats.filter((p) => p.obraId === oid && p.codi != null).map((p) => ({ mk: 'modificats', p }))];
const impVal = (t, base) => { const s = String(t || '').trim(); if (!s) return 0; if (s.endsWith('%')) { const n = nv(s.slice(0, -1)); return isNaN(n) ? NaN : r2(base * n / 100); } return nv(s); };
const impEtq = (x) => `${x.p.codi || ''} · ${String(x.p.descripcio || '').slice(0, 70)}`;
function impHtml() {
  const fm = $('#frm'); if (!fm || fm.dataset.mk !== 'factures') return '';
  const e = fm.elements, oid = e.obraId.value, its = impPartides(oid), dis = CANWRITE ? '' : 'disabled';
  if (e.sentit.value !== 'Rebuda' || !oid) return '';
  if (!its.length) return '<div class="small">Aquesta obra encara no té partides per imputar-hi la factura.</div>';
  const caps = [...new Set(its.filter((x) => x.mk === 'partides').map((x) => x.p.capitol || ''))];
  const opts = (v) => `<option value="">— Tria una partida —</option>` + caps.map((c) => `<optgroup label="${esc(c || SENSE_CAP)}">${its.filter((x) => x.mk === 'partides' && (x.p.capitol || '') === c).map((x) => `<option value="${esc(x.p.id)}" ${x.p.id === v ? 'selected' : ''}>${esc(impEtq(x))}</option>`).join('')}</optgroup>`).join('')
    + (its.some((x) => x.mk === 'modificats') ? `<optgroup label="Contradictòries">${its.filter((x) => x.mk === 'modificats').map((x) => `<option value="${esc(x.p.id)}" ${x.p.id === v ? 'selected' : ''}>${esc(impEtq(x))}</option>`).join('')}</optgroup>` : '');
  return `<div><b>Imputació a partides</b><div class="small" style="margin:2px 0 6px">Reparteix la base imposable entre les partides on s'ha fet servir. Pots escriure un import o un percentatge (per exemple 40%).</div>
  ${FI.map((r, i) => `<div style="display:flex;gap:6px;margin-bottom:6px;align-items:center" data-imp="${i}"><select class="ed txt" data-impk="id" aria-label="Partida" style="flex:1;min-width:0" ${dis}>${opts(r.id)}</select><input class="ed" data-col="imp" data-impk="t" inputmode="decimal" aria-label="Import imputat" value="${esc(r.t)}" style="width:110px;flex:none" ${dis}>${CANWRITE ? `<button class="btn sm" type="button" data-act="impTreu" data-i="${i}" aria-label="Treu la imputació">×</button>` : ''}</div>`).join('')}
  ${CANWRITE ? '<button class="btn sm" type="button" data-act="impAfegeix">+ Partida</button> <button class="btn sm" type="button" data-act="impResta">Imputa la resta a l\'última</button>' : ''}<div class="small" id="imp-tot" style="margin-top:6px"></div></div>`;
}
function impPinta() {
  const fm = $('#frm'); if (!fm || fm.dataset.mk !== 'factures') return;
  let box = $('#imp-box');
  if (!box) { const ref = $('#fac-nat') || fm; ref.insertAdjacentHTML('afterend', '<div id="imp-box"></div>'); box = $('#imp-box'); }
  box.innerHTML = impHtml(); impTot();
}
function impTot() {
  const el = $('#imp-tot'), fm = $('#frm'); if (!el || !fm) return;
  const base = +fm.elements.base.value || 0, v = FI.map((r) => impVal(r.t, base)), s = r2(sum(v.filter((x) => !isNaN(x)), (x) => x)), resta = r2(base - s);
  document.querySelectorAll('[data-imp] [data-impk=t]').forEach((i, k) => i.classList.toggle('mal', isNaN(v[k])));
  el.innerHTML = `Imputat ${fmtM(s)}${base ? ` (${fmtN(s / base * 100)}%)` : ''} · sense imputar <b style="color:${Math.abs(resta) > 0.005 && (base >= 0 ? resta < 0 : resta > 0) ? 'var(--bad)' : 'inherit'}">${fmtM(resta)}</b>`;
}
const _openImp2 = openForm;
openForm = function (mk, id, def) {
  _openImp2(mk, id, def);
  if (mk === 'factures' && $('#frm')) { const f = id && S.factures.find((x) => x.id === id); FI = ((f && f.imputacions) || []).map((r) => ({ id: r.id, t: fmtN(r.import) })); if (!FI.length) FI.push({ id: '', t: '' }); impPinta(); }
  if ((mk === 'partides' || mk === 'modificats') && id) {
    const fs = S.factures.filter((f) => (f.imputacions || []).some((i) => i.id === id)), b = $('#drawerHost .body'), p = S[mk].find((x) => x.id === id);
    if (b) b.insertAdjacentHTML('beforeend', `<div><b>Cost real</b><div class="small" style="margin:2px 0 6px">Factures imputades ${fmtM(imputatA(id))} + altres costos ${fmtM(p.costReal)} = <b>${fmtM(costRealDe(p))}</b></div>${fs.length ? `<div class="tw"><table><thead><tr><th>Factura</th><th>Empresa</th><th class="num">Imputat</th></tr></thead><tbody>${fs.map((f) => `<tr data-act="edit" data-mk="factures" data-id="${esc(f.id)}"><td>${esc(f.num || '')}</td><td>${esc(f.tercer || '')}</td><td class="num">${fmtM(sum(f.imputacions.filter((i) => i.id === id), (i) => +i.import))}</td></tr>`).join('')}</tbody></table></div>` : '<div class="muted small">Cap factura imputada.</div>'}</div>`);
  }
};
const _readImp = readForm;
readForm = function () {
  const r = _readImp();
  if (r.mk === 'factures' && FI) { const base = +r.o.base || 0; r.o.imputacions = r.o.sentit === 'Rebuda' && r.o.obraId ? FI.filter((x) => x.id).map((x) => ({ id: x.id, import: impVal(x.t, base) })).filter((x) => x.import) : []; }
  if (r.id && (r.mk === 'partides' || r.mk === 'modificats')) r.o.id = r.id;
  return r;
};
const _saveImp = saveForm;
saveForm = async function () {
  const fm = $('#frm');
  if (fm && fm.dataset.mk === 'factures' && FI) {
    const base = +fm.elements.base.value || 0, v = FI.filter((x) => x.id || String(x.t).trim()).map((x) => ({ id: x.id, n: impVal(x.t, base) }));
    if (v.some((x) => isNaN(x.n))) { toast('Hi ha imports d\'imputació que no són correctes.'); return; }
    if (v.some((x) => !x.id && x.n)) { toast('Hi ha un import sense partida.'); return; }
    if (new Set(v.filter((x) => x.id).map((x) => x.id)).size < v.filter((x) => x.id).length) { toast('Hi ha una partida repetida.'); return; }
    const s = r2(sum(v, (x) => x.n));
    if (base >= 0 ? s > base + 0.005 : s < base - 0.005) { toast('S\'imputa més que la base de la factura.'); return; }
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
  if (t.dataset.impk && FI) { FI[+t.closest('[data-imp]').dataset.imp][t.dataset.impk] = t.value; impTot(); }
  else if (t.closest && t.closest('#frm') && $('#frm').dataset.mk === 'factures' && FI) { if (['obraId', 'sentit'].includes(t.name)) { if (t.name === 'obraId') FI = [{ id: '', t: '' }]; impPinta(); } else if (t.name === 'base') impTot(); }
});
document.addEventListener('change', (e) => { const t = e.target; if (t.dataset.impk === 't' && FI) { const v = String(t.value).trim(); if (v && !v.endsWith('%') && !isNaN(nv(v))) t.value = fmtN(nv(v)); } });
document.addEventListener('click', (e) => {
  const a = e.target.closest('[data-act]'); if (!a || !FI) return;
  if (a.dataset.act === 'impAfegeix') { FI.push({ id: '', t: '' }); impPinta(); }
  else if (a.dataset.act === 'impTreu') { FI.splice(+a.dataset.i, 1); if (!FI.length) FI.push({ id: '', t: '' }); impPinta(); }
  else if (a.dataset.act === 'impResta') { const base = +$('#frm').elements.base.value || 0, l = FI[FI.length - 1], al = r2(sum(FI.slice(0, -1), (x) => impVal(x.t, base) || 0)); l.t = fmtN(r2(base - al)); impPinta(); }
});
/* A la llista de factures */
M.factures.cols.splice(M.factures.cols.length - 1, 0, { l: 'Partides', f: (o) => { const n = (o.imputacions || []).length, s = sum(o.imputacions || [], (i) => +i.import), b = +o.base || 0; return n ? `${n} · ${b ? fmtN(s / b * 100) + '%' : fmtM(s)}` : '<span class="muted">—</span>'; } });
