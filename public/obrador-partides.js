/* Partides: capítols propis de cada obra i importació d'un arxiu d'Excel. */
const SENSE_CAP = 'Sense capítol';
function capsObra(id) {
  const l = ((obra(id) || {}).capitols || []).slice();
  [...S.partides, ...S.modificats].filter((p) => p.obraId === id).forEach((p) => { if (p.capitol && !l.includes(p.capitol)) l.push(p.capitol); });
  return l;
}
async function desaCaps(id, l) { const { id: _, ...o } = obra(id); await save('obres', id, { ...o, capitols: l }); }
(() => {
  const i = M.partides.camps.findIndex((f) => f.k === 'capitol');
  M.partides.camps[i] = { k: 'capitol', l: 'Capítol', tp: 'text', ph: "Tria'l o escriu-ne un de nou" };
  M.partides.cols.splice(1, 0, 'capitol');
  M.partides.camps.find((f) => f.k === 'amidament').l = "Amidament contractat · PEC + baixa, si n'hi ha";
  const s = document.createElement('style');
  s.textContent = 'tr.cap td{background:var(--sunk);font-weight:600;cursor:default}tr.cap td:first-child{overflow-wrap:anywhere}.imp-cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px}.imp-cols label,.cap-row{font-size:13px}.imp-cols select{width:100%;margin-top:3px}.imp-cols select,.imp-in,.cap-row input{border:1px solid var(--line);background:var(--surface);color:var(--ink);border-radius:5px;padding:7px 9px;font:inherit;box-sizing:border-box;min-width:0}.cap-row{display:flex;gap:6px;align-items:center}.cap-row input{flex:1}';
  document.head.append(s);
})();

/* Amidaments: punt als milers i coma als decimals */
const fmtAm = (v) => (v == null || v === '' || !isFinite(+v) ? '—' : (+v).toLocaleString('ca-ES', { minimumFractionDigits: 3, maximumFractionDigits: 3, useGrouping: 'always' }));
const etqAm = (oid) => 'Amidament contractat · PEC' + (+(obra(oid) || {}).baixa > 0 ? ' + baixa' : '');
const _cellP = cellVal;
cellVal = function (mk, c, r) { return ['partides', 'modificats'].includes(mk) && c === 'amidament' ? { h: fmtAm(r.amidament), num: 1 } : _cellP(mk, c, r); };

/* Formulari: suggereix els capítols de l'obra triada */
function capLlista() {
  const fm = $('#frm');
  if (!fm || !['partides', 'modificats'].includes(fm.dataset.mk)) return;
  let d = $('#caps-obra');
  if (!d) { d = document.createElement('datalist'); d.id = 'caps-obra'; fm.after(d); fm.elements.capitol.setAttribute('list', 'caps-obra'); fm.elements.capitol.autocomplete = 'off'; }
  const et = document.querySelector('label[for="fld-amidament"]'); if (et && fm.dataset.mk === 'partides' && fm.elements.obraId.value) et.textContent = etqAm(fm.elements.obraId.value);
  d.innerHTML = capsObra(fm.elements.obraId.value).map((c) => `<option value="${esc(c)}">`).join('');
}
const _openP = openForm;
openForm = function (mk, id, def) { _openP(mk, id, def); capLlista(); };
document.addEventListener('change', (e) => { if (e.target.id === 'fld-obraId') capLlista(); });

/* Llista de l'obra agrupada per capítol */
const _listP = listHtml;
listHtml = function (mk, fo) {
  let h = _listP(mk, fo);
  if (mk !== 'partides' && mk !== 'modificats') return h;
  if (mk === 'modificats' && CANWRITE) h = h.replace('<span style="flex:1"></span>', `<span style="flex:1"></span><button class="btn sm" data-act="import" data-mk="modificats" data-obra="${esc(fo || '')}">Importa des d'Excel</button>`);
  if (fo && CANWRITE && mk === 'partides') h = h.replace('<button class="btn sm" data-act="import"', `<button class="btn sm" data-act="caps" data-id="${esc(fo)}">Capítols</button><button class="btn sm" data-act="import"`);
  const i = h.indexOf('<div class="tw">');
  if (!fo || i < 0) return h;
  const q = (mv(mk).q || '').toLowerCase();
  const st = mv(mk).estat, rows = S[mk].filter((p) => p.obraId === fo && (!st || p.estat === st) && (!q || [p.codi, p.descripcio, p.capitol, p.unitat].some((v) => String(v || '').toLowerCase().includes(q))))
    .sort((a, b) => (a.ordre ?? 1e9) - (b.ordre ?? 1e9) || String(a.codi).localeCompare(String(b.codi), 'ca', { numeric: true }));
  const cols = M[mk].cols.filter((c) => c !== 'obraId' && c !== 'capitol');
  const cap = (c) => (typeof c === 'object' ? c : { l: c === 'amidament' && mk === 'partides' ? etqAm(fo) : M[mk].camps.find((f) => f.k === c).l, num: ['money', 'num'].includes(M[mk].camps.find((f) => f.k === c).tp) });
  const gr = [...capsObra(fo), ''].map((c) => ({ c, ps: rows.filter((p) => (p.capitol || '') === c) })).filter((g) => g.ps.length || (g.c && !q && mk === 'partides'));
  const cos = gr.map((g) => { const t = g.ps.map(ptc), v = sum(t, (x) => x.venda);
    return `<tr class="cap"><td colspan="${cols.length}">${esc(g.c || SENSE_CAP)} <span class="small" style="font-weight:400">· ${g.ps.length} ${g.ps.length === 1 ? 'partida' : 'partides'} · venda ${fmtM(v)} · cost previst ${MF2.format(sum(t, (x) => x.costPrev))} · produït ${MF2.format(sum(t, (x) => x.produit))}</span></td></tr>`
      + g.ps.map((r) => `<tr data-act="edit" data-mk="${mk}" data-id="${esc(r.id)}">${cols.map((c, k) => { const x = cellVal(mk, c, r); return `<td class="${x.num ? 'num' : ''} ${k === 0 || c === 'descripcio' ? 't-main' : ''}">${x.h}</td>`; }).join('')}</tr>`).join(''); }).join('');
  return h.slice(0, i) + `<div class="tw"><table><thead><tr>${cols.map((c) => { const x = cap(c); return `<th class="${x.num ? 'num' : ''}">${esc(x.l.replace(/ \(.*\)$/, ''))}</th>`; }).join('')}</tr></thead><tbody>${cos || `<tr><td class="empty" colspan="${cols.length}">Cap resultat.</td></tr>`}</tbody></table></div>`;
};

/* Gestió de capítols */
function obreCaps(id) {
  const l = capsObra(id);
  drawer(`Capítols · ${obraTxt(id)}`, `<div class="muted" style="font-size:13px">Aquests capítols només són d'aquesta obra. Si en canvies el nom, canvia a totes les seves partides.</div><div id="cap-l" style="display:flex;flex-direction:column;gap:6px">${l.map((c) => capRow(c, [...S.partides, ...S.modificats].filter((p) => p.obraId === id && p.capitol === c).length)).join('')}</div><div><button class="btn sm" data-act="capNou" type="button">+ Afegeix un capítol</button></div>`,
    `<span class="sp"></span><button class="btn" data-act="close">Cancel·la</button><button class="btn pri" data-act="capDesa" data-id="${esc(id)}">Desa</button>`);
}
const capRow = (c, n) => `<div class="cap-row"><button class="btn sm" type="button" data-act="capPuja" aria-label="Puja">↑</button><input value="${esc(c)}" data-cap="${esc(c)}" aria-label="Nom del capítol" maxlength="300"><span class="small" style="white-space:nowrap">${n} part.</span>${n ? '' : '<button class="btn sm" type="button" data-act="capTreu" aria-label="Treu el capítol">×</button>'}</div>`;
async function capDesa(id) {
  const fs = [...document.querySelectorAll('#cap-l input')].map((x) => ({ vell: x.dataset.cap, nou: x.value.trim() })).filter((x) => x.nou || x.vell);
  if (fs.some((x) => !x.nou)) { toast('Hi ha un capítol sense nom.'); return; }
  if (new Set(fs.map((x) => x.nou)).size !== fs.length) { toast('Hi ha dos capítols amb el mateix nom.'); return; }
  const b = document.querySelector('[data-act="capDesa"]'); b.disabled = true;
  try {
    const canvis = new Map(fs.filter((x) => x.vell && x.vell !== x.nou).map((x) => [x.vell, x.nou]));
    const af = S.partides.filter((p) => p.obraId === id && canvis.has(p.capitol));
    const am = S.modificats.filter((p) => p.obraId === id && canvis.has(p.capitol));
    for (const p of am) { const { id: pid, ...r } = p; await save('modificats', pid, { ...r, capitol: canvis.get(p.capitol) }); }
    let n = 0;
    for (const p of af) { const { id: pid, ...r } = p; await save('partides', pid, { ...r, capitol: canvis.get(p.capitol) }); b.textContent = `Desant ${++n}/${af.length}`; }
    await desaCaps(id, fs.map((x) => x.nou));
  } catch (e) { b.disabled = false; b.textContent = 'Desa'; return; }
  logA(`Capítols actualitzats a ${obraTxt(id)}`); closeDrawer(); toast('Capítols desats.');
}

/* Importació d'un arxiu */
const IMPC = [['codi', 'Codi'], ['desc', 'Descripció'], ['unitat', 'Unitat'], ['am', 'Amidament'], ['pv', 'Preu unitari'], ['cost', 'Cost unitari'], ['imp', 'Import'], ['cap', 'Capítol (columna)'], ['nat', 'Tipus de fila']];
let IMP = null;
const _openImp = openImport;
openImport = function (oid, mk) {
  IMP = { mk: mk || 'partides', fulls: [], k: 0, m: {}, ini: 0 };
  drawer(mk === 'modificats' ? "Importa contradictòries d'un Excel" : "Importa partides d'un Excel", `<div class="fld"><label for="ix-obra">Obra</label><select id="ix-obra">${obraOpts(oid, '— Tria una obra —')}</select></div>
  <div class="fld"><label for="ix-f">Arxiu d'Excel (.xlsx, .xls, .ods o .csv)</label><input type="file" id="ix-f" class="imp-in" accept=".xlsx,.xlsm,.xls,.ods,.csv"></div>
  <div class="muted" style="font-size:13px">Es llegeix aquí mateix i no es desa res fins que ho confirmis. Pots enganxar files o actualitzar l'execució mensual amb <a href="#" data-enganxa="1">la manera anterior</a>.</div><div id="ix-cos" style="display:flex;flex-direction:column;gap:12px"></div>`,
  `<span class="sp"></span><button class="btn" data-act="close">Cancel·la</button><button class="btn pri" data-act="ixDesa" disabled>Importa</button>`);
};
async function ixLlegeix(f) {
  $('#ix-cos').innerHTML = '<div class="muted">Llegint l\'arxiu…</div>';
  try { IMP.fulls = await ObradorLectura.llibre(f); } catch (e) { $('#ix-cos').innerHTML = '<div style="color:var(--bad)">No s\'ha pogut llegir. Comprova que sigui un full de càlcul sense contrasenya i que hi hagi connexió.</div>'; return; }
  if (!IMP.fulls.length) { $('#ix-cos').textContent = 'L\'arxiu és buit.'; return; }
  IMP.nom = f.name;
  IMP.fulls.forEach((x) => { x.c = ObradorLectura.columnes(x.rows); x.n = ObradorLectura.partides(x.rows, x.c.m, x.c.ini).partides.length; });
  ixFull(IMP.fulls.indexOf(IMP.fulls.slice().sort((a, b) => b.n - a.n)[0]));
}
function ixFull(k) {
  const f = IMP.fulls[k]; IMP.k = k; IMP.m = { ...f.c.m }; IMP.ini = f.c.ini;
  const nc = Math.max(...f.rows.map((r) => r.length)), cap = f.rows[f.c.ini - 1] || [];
  const ex = (j) => { const r = f.rows.slice(f.c.ini).find((x) => String(x[j] ?? '').trim()); return String(cap[j] || (r && r[j]) || '').slice(0, 22); };
  const let_ = (j) => (j > 25 ? String.fromCharCode(64 + Math.floor(j / 26)) : '') + String.fromCharCode(65 + (j % 26));
  $('#ix-cos').innerHTML = `${IMP.fulls.length > 1 ? `<div class="fld"><label for="ix-full">Full</label><select id="ix-full">${IMP.fulls.map((x, i) => `<option value="${i}" ${i === k ? 'selected' : ''}>${esc(x.nom)} · ${x.n} partides</option>`).join('')}</select></div>` : ''}
  <div><b>Columnes</b><div class="imp-cols" style="margin-top:6px">${IMPC.map(([c, l]) => `<label>${l}<select data-ix="${c}"><option value="">—</option>${[...Array(nc).keys()].map((j) => `<option value="${j}" ${IMP.m[c] === j ? 'selected' : ''}>${let_(j)} · ${esc(ex(j))}</option>`).join('')}</select></label>`).join('')}</div></div>
  <div class="fld"><label for="ix-coef">Multiplica el preu de l'Excel per</label><input id="ix-coef" type="number" step="any" min="0" value="1" class="imp-in" style="width:130px"><div class="small">Deixa-hi 1 si el preu ja és el de venda. Si és d'execució material (PEM), posa-hi despeses generals, benefici i baixa: 1,19 × (1 − baixa).</div></div>
  <div id="ix-prev"></div>`;
  ixPrev();
}
function ixCalc() {
  const oid = $('#ix-obra').value, f = IMP.fulls[IMP.k], coef = +$('#ix-coef').value || 0;
  const r = ObradorLectura.partides(f.rows, IMP.m, IMP.ini), ex = S[IMP.mk].filter((p) => p.obraId === oid), usats = new Set(), conta = {};
  r.partides.forEach((p) => { conta[p.codi] = (conta[p.codi] || 0) + 1; });
  r.crear = []; r.upd = [];
  r.partides.forEach((p, i) => {
    const iguals = ex.filter((x) => x.codi === p.codi && !usats.has(x.id));
    let old = iguals.find((x) => (x.capitol || '') === p.capitol);
    if (!old && conta[p.codi] === 1 && iguals.length === 1) old = iguals[0];
    if (old) usats.add(old.id);
    const rec = { codi: p.codi, descripcio: p.descripcio, unitat: normU(p.unitat, p.unitat), amidament: p.amidament, preuVenda: Math.round(p.preuVenda * coef * 10000) / 10000, ordre: i };
    if (p.capitol) rec.capitol = p.capitol;
    if (IMP.m.cost != null) rec.costUnit = p.costUnit;
    if (IMP.mk === 'modificats' && !old) Object.assign(rec, { estat: 'Proposat', data: today(), num: rec.codi, import: r2(rec.amidament * rec.preuVenda), cost: r2(rec.amidament * (rec.costUnit || 0)) });
    (old ? r.upd : r.crear).push({ old, rec: old ? rec : { capitol: '', costUnit: 0, ...rec } });
  });
  r.venda = sum([...r.crear, ...r.upd], (x) => x.rec.amidament * x.rec.preuVenda);
  return r;
}
function ixPrev() {
  const el = $('#ix-prev'); if (!el) return;
  const r = ixCalc(), oid = $('#ix-obra').value, b = document.querySelector('[data-act="ixDesa"]');
  b.disabled = !oid || !r.partides.length; b.textContent = r.partides.length ? `Importa ${r.partides.length} partides` : 'Importa';
  if (!r.partides.length) { el.innerHTML = '<div style="color:var(--warn)">No s\'hi ha trobat cap partida. Revisa les columnes: calen, com a mínim, descripció, amidament i preu.</div>'; return; }
  const coef = +$('#ix-coef').value || 0, calc = sum(r.partides, (p) => p.amidament * p.preuVenda), dif = Math.abs(calc - r.importFull);
  el.innerHTML = `<div><b>${r.crear.length}</b> a crear · <b>${r.upd.length}</b> a actualitzar · <b>${r.capitols.length}</b> capítols</div>
  <div class="small">Import de l'arxiu ${MF2.format(r.importFull)}${coef !== 1 ? ` · venda amb el coeficient ${MF2.format(r.venda)}` : ''}</div>
  ${oid ? '' : '<div style="color:var(--warn)">Tria l\'obra per poder importar.</div>'}
  ${IMP.m.cost == null ? '<div class="small">Sense columna de cost: les partides noves quedaran amb cost previst 0 i el marge sortirà al 100% fins que l\'entris.</div>' : ''}
  ${IMP.m.dubte ? '<div style="color:var(--warn)">No és clar quina columna és el preu i quina l\'amidament: comprova-ho.</div>' : ''}
  ${dif > Math.max(1, Math.abs(r.importFull) * 0.005) ? `<div style="color:var(--warn)">Amidament × preu dona ${MF2.format(calc)}, que no quadra amb la columna d'import. Revisa les columnes.</div>` : ''}
  ${r.partides.some((p) => !p.capitol) ? `<div style="color:var(--warn)">${r.partides.filter((p) => !p.capitol).length} partides sense capítol.</div>` : ''}
  <div class="tw" style="margin-top:8px;max-height:340px;overflow:auto"><table><thead><tr><th>Codi</th><th>Descripció</th><th>Ut</th><th class="num">Amid.</th><th class="num">Preu</th></tr></thead><tbody>${r.partides.slice(0, 60).map((p, i, a) => `${!i || a[i - 1].capitol !== p.capitol ? `<tr class="cap"><td colspan="5">${esc(p.capitol || SENSE_CAP)}</td></tr>` : ''}<tr style="cursor:default"><td class="code">${esc(p.codi)}</td><td>${esc(p.descripcio.slice(0, 90))}</td><td>${esc(p.unitat)}</td><td class="num">${fmtAm(p.amidament)}</td><td class="num">${MF2.format(p.preuVenda * coef)}</td></tr>`).join('')}</tbody></table></div>${r.partides.length > 60 ? `<div class="small">Es mostren les 60 primeres.</div>` : ''}`;
}
async function ixDesa() {
  const oid = $('#ix-obra').value; if (!oid) return;
  const r = ixCalc(), b = document.querySelector('[data-act="ixDesa"]'); b.disabled = true;
  let n = 0; const tot = r.partides.length, pas = (k) => { n += k; b.textContent = `Important ${n}/${tot}`; };
  try {
    const l = capsObra(oid), nous = r.capitols.filter((c) => !l.includes(c));
    if (nous.length) await desaCaps(oid, l.concat(nous));
    for (let i = 0; i < r.crear.length; i += 200) { const t = r.crear.slice(i, i + 200); await creaMolts(IMP.mk, t.map((x) => ({ id: newId(IMP.mk.slice(0, 2)), dades: { ...x.rec, obraId: oid } }))); pas(t.length); }
    for (const x of r.upd) { const { id, ...v } = x.old; await save(IMP.mk, id, { ...v, ...x.rec }); pas(1); }
  } catch (e) { toast(`S'ha aturat després de ${n} de ${tot}. Torna a importar el mateix arxiu: les ja creades s'actualitzaran.`); b.disabled = false; return; }
  logA(`Importades ${n} partides a ${obraTxt(oid)} (${IMP.nom})`); closeDrawer(); toast(`${n} partides importades.`);
}
async function creaMolts(col, l) {
  const ara = new Date().toISOString(), per = (ME && ME.id) || null;
  const cos = l.map((x) => ({ id: x.id, dades: { ...x.dades, actualitzat: ara, actualitzatPer: per } }));
  if (!DB || !DB.crea) { for (const x of l) await save(col, x.id, x.dades); return; }
  try { await DB.crea(col, cos); } catch (e) { handleErr(e); throw e; }
}

document.addEventListener('click', (e) => {
  if (e.target.closest('[data-enganxa]')) { e.preventDefault(); _openImp($('#ix-obra').value); return; }
  const a = e.target.closest('[data-act]'); if (!a) return;
  const t = a.dataset.act, fila = a.closest('.cap-row');
  if (t === 'caps') obreCaps(a.dataset.id);
  else if (t === 'capNou') { $('#cap-l').insertAdjacentHTML('beforeend', capRow('', 0)); $('#cap-l').lastElementChild.querySelector('input').focus(); }
  else if (t === 'capTreu') fila.remove();
  else if (t === 'capPuja') { if (fila.previousElementSibling) fila.previousElementSibling.before(fila); }
  else if (t === 'capDesa') capDesa(a.dataset.id);
  else if (t === 'ixDesa') ixDesa();
});
document.addEventListener('change', (e) => {
  const t = e.target;
  if (t.id === 'ix-f' && t.files[0]) ixLlegeix(t.files[0]);
  else if (t.id === 'ix-full') ixFull(+t.value);
  else if (t.id === 'ix-obra') ixPrev();
  else if (t.dataset.ix) { if (t.value === '') delete IMP.m[t.dataset.ix]; else IMP.m[t.dataset.ix] = +t.value; delete IMP.m.dubte; ixPrev(); }
});
document.addEventListener('input', (e) => { if (e.target.id === 'ix-coef') ixPrev(); });
