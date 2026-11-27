/* Organització per departaments: Obres, Compres, Control (números i valors predeterminats), Licitació (amb el banc d'ofertes) i Empresa.
   També: caps de l'obra a la fitxa, subcontractistes amb dades fiscals i de contacte, i visor de documents en una pestanya nova. */

/* ---------- Fitxa de l'obra: els quatre caps ---------- */
(() => {
  const c = M.obres.camps, i = c.findIndex((f) => f.k === 'cap');
  const t = (k, l) => ({ k, l, tp: 'text' });
  if (i >= 0) c.splice(i, 1, t('capArea', "Cap d'àrea"), t('capGrup', 'Cap de grup'), t('cap', "Cap d'obra"), t('capProd', 'Cap de producció'));
})();

/* ---------- Subcontractistes: dades fiscals i de contacte ---------- */
(() => {
  const t = (k, l, x) => ({ k, l, tp: 'text', ...(x || {}) });
  Object.assign(M.tercers, {
    t: 'Subcontractistes', s: 'empresa', tit: 'nom',
    camps: [t('nom', 'Raó social', { req: 1, w: 1 }), t('nif', 'NIF / CIF'), t('adreca', 'Adreça fiscal', { w: 1 }), t('cp', 'Codi postal'), t('poblacio', 'Població'), t('provincia', 'Província'),
      t('contacte', 'Persona de contacte'), t('email', 'Correu'), t('telefon', 'Telèfon 1'), t('telefon2', 'Telèfon 2'), { k: 'notes', l: 'Notes', tp: 'area', w: 1 }],
    cols: ['nom', 'nif', 'poblacio', 'contacte', 'telefon', 'telefon2', 'email'],
  });
})();

/* ---------- Menú ---------- */
const DEPT = { obres: 'Obres', partides: 'Obres', modificats: 'Obres', certificacions: 'Obres', parts: 'Obres', comandes: 'Compres', proformes: 'Compres', factures: 'Compres', ofertes: 'Compres', gestio: 'Control', valors: 'Control', oportunitats: 'Licitació', estudis: 'Licitació', banc: 'Licitació', tercers: 'Empresa', personal: 'Empresa', actius: 'Empresa', qualitat: 'Empresa', documents: 'Empresa' };
(() => {
  const tot = {}; NAV.forEach((g) => g.items.forEach((i) => { tot[i[0]] = i; }));
  tot.valors = ['valors', 'Valors predeterminats', 'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6'];
  tot.banc = ['banc', "Banc d'ofertes", 'M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zM4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6'];
  if (tot.tercers) tot.tercers = ['tercers', 'Subcontractistes', tot.tercers[2]];
  const grups = [[null, ['tauler']], ['Obres', ['obres', 'partides', 'modificats', 'certificacions', 'parts']], ['Compres', ['comandes', 'proformes', 'factures', 'ofertes']], ['Control', ['gestio', 'valors']], ['Licitació', ['oportunitats', 'estudis', 'banc']], ['Empresa', ['tercers', 'personal', 'actius', 'qualitat', 'documents']]];
  const usats = new Set(grups.flatMap((g) => g[1])), resta = Object.keys(tot).filter((k) => !usats.has(k));
  const nou = grups.map(([g, ks]) => ({ g, items: ks.map((k) => tot[k]).filter(Boolean) }));
  if (resta.length) nou[nou.length - 1].items.push(...resta.map((k) => tot[k]));
  NAV.splice(0, NAV.length, ...nou);
})();
const _listDep = listPage;
listPage = function (mk) { const h = _listDep(mk); return DEPT[mk] ? h.replace(/<div class="eyebrow">[^<]*<\/div>/, `<div class="eyebrow">${DEPT[mk]}</div>`) : h; };

/* ---------- Rutes ---------- */
const _routeDep = route;
route = function () { const h = decodeURIComponent(location.hash.slice(1)); return h === 'valors' || h === 'banc' ? { v: h } : _routeDep(); };
const _viewDep = viewHtml;
viewHtml = function (r) {
  if (r.v !== 'valors' && r.v !== 'banc') return _viewDep(r);
  if (!LOCAL && !COLS.every((c) => loaded[c])) return '<div class="loading">Carregant dades de l\'empresa…</div>';
  return r.v === 'valors' ? valorsHtml() : bancHtml();
};

/* ---------- Control · Valors predeterminats ---------- */
function valorsHtml() {
  return `<div class="head"><div><div class="eyebrow">Control</div><h1>Valors predeterminats</h1></div></div>
  <div class="small" style="margin:-4px 0 14px">Valors generals de l'empresa. Les obres i els documents els fan servir si no en tenen de propis. Els números de les obres són a <a href="#gestio">Control de gestió</a>.</div>
  ${estrConfigHtml()}${preusBaseHtml()}`;
}

/* ---------- Licitació · Banc d'ofertes ---------- */
S.bancOfertes = [];
COLS.push('bancOfertes');
const BANC = { q: '', any: '', tipus: '', font: '' };
const anyDe = (d) => String(d || '').slice(0, 4);
function bancLinies() {
  const out = [];
  S.ofertes.forEach((d) => {
    if (!Array.isArray(d.linies)) return;
    const o = obra(d.obraId) || {}, any = anyDe(d.data || d.actualitzat);
    (d.prov || []).forEach((p) => d.linies.forEach((l) => {
      const v = cpVal((p.pr || {})[l.id], []);
      if (v.n == null || !isFinite(v.n)) return;
      out.push({ any, font: 'comp', id: d.id, ref: d.num || '', origen: o.codi ? `${o.codi} · ${o.nom || ''}` : 'Obra', activitat: d.nom || '', tipus: d.tipus || '', prov: p.nom || '', nif: p.nif || '', codi: l.codi || '', desc: l.desc || '', ut: l.ut || '', preu: v.n, adj: d.adj === p.id });
    }));
  });
  S.bancOfertes.forEach((b) => (b.linies || []).forEach((l) => {
    const n = typeof l.preu === 'number' ? l.preu : nv(l.preu);
    if (!String(l.desc || '').trim() || !isFinite(n)) return;
    const lic = S.oportunitats.find((x) => x.id === b.oportunitatId);
    out.push({ any: anyDe(b.data || b.actualitzat), font: 'lliure', id: b.id, ref: '', origen: lic ? 'Licitació · ' + (lic.nom || '') : 'Sense obra', activitat: b.activitat || '', tipus: b.tipus || '', prov: b.proveidor || '', nif: b.nif || '', codi: l.codi || '', desc: l.desc || '', ut: l.ut || '', preu: n, adj: false });
  }));
  return out;
}
function bancHtml() {
  const tot = bancLinies(), anys = [...new Set(tot.map((x) => x.any).filter(Boolean))].sort().reverse(), tipus = M.comandes.camps.find((f) => f.k === 'tipus').o;
  const q = BANC.q.trim().toLowerCase();
  const ls = tot.filter((x) => (!BANC.any || x.any === BANC.any) && (!BANC.tipus || x.tipus === BANC.tipus) && (!BANC.font || x.font === BANC.font) && (!q || [x.desc, x.codi, x.prov, x.nif, x.activitat, x.origen].some((v) => String(v).toLowerCase().includes(q))))
    .sort((a, b) => b.any.localeCompare(a.any) || a.desc.localeCompare(b.desc, 'ca') || a.preu - b.preu);
  const max = 400, sel = (id, k, opts, buit) => `<select id="${id}" data-banc="${k}" aria-label="${esc(buit)}"><option value="">${esc(buit)}</option>${opts.map(([v, l]) => `<option value="${esc(v)}" ${BANC[k] === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
  const lliures = S.bancOfertes.slice().sort((a, b) => String(b.data || '').localeCompare(String(a.data || '')));
  return `<div class="head"><div><div class="eyebrow">Licitació</div><h1>Banc d'ofertes</h1></div><span class="sp"></span>${CANWRITE ? '<button class="btn pri" data-act="boNou">+ Oferta sense obra</button>' : ''}</div>
  <div class="small" style="margin:-4px 0 12px">Preus unitaris de totes les ofertes rebudes: els dels comparatius de les obres i els de les ofertes que entres aquí sense obra. Mira l'any de l'oferta per saber si el preu encara és vàlid.</div>
  <div class="tools"><input type="search" id="banc-q" data-banc="q" value="${esc(BANC.q)}" placeholder="Cerca partida, proveïdor, activitat…" aria-label="Cerca al banc d'ofertes">
   ${sel('banc-any', 'any', anys.map((a) => [a, a]), 'Tots els anys')}${sel('banc-tipus', 'tipus', tipus.map((t) => [t, t]), 'Tots els tipus')}${sel('banc-font', 'font', [['comp', 'Comparatius d\'obra'], ['lliure', 'Ofertes sense obra']], 'Totes les ofertes')}
   <span style="flex:1"></span><span class="small">${ls.length} preus</span></div>
  <section class="panel" style="margin-bottom:16px">${ls.length ? `<div class="tw"><table><thead><tr><th>Any</th><th>Partida</th><th>Ut</th><th class="num">Preu unitari</th><th>Proveïdor</th><th>Activitat</th><th>Origen</th></tr></thead><tbody>
   ${ls.slice(0, max).map((x) => `<tr data-act="${x.font === 'comp' ? 'boComp' : 'boObre'}" data-id="${esc(x.id)}"><td class="mono">${esc(x.any || '—')}</td><td class="t-main">${x.codi ? `<span class="code">${esc(x.codi)}</span> ` : ''}<span style="font-weight:400">${esc(String(x.desc).slice(0, 160))}</span></td><td>${esc(x.ut)}</td><td class="num">${fmtM(x.preu)}</td><td>${esc(x.prov)}${x.nif ? `<span class="l2">${esc(x.nif)}</span>` : ''}${x.adj ? ' ' + pill('Adjudicat') : ''}</td><td>${esc(x.activitat)}${x.tipus ? `<span class="l2">${esc(x.tipus)}</span>` : ''}</td><td>${esc(x.origen)}${x.ref ? `<span class="l2">${esc(x.ref)}</span>` : ''}</td></tr>`).join('')}
   </tbody></table></div>${ls.length > max ? `<div class="pb small">Es mostren els ${max} primers. Afina la cerca per veure'n més.</div>` : ''}` : `<div class="empty"><b>${tot.length ? 'Cap preu amb aquests filtres' : 'Encara no hi ha preus'}</b>${tot.length ? '' : 'Quan entris preus als comparatius de les obres, o ofertes sense obra, apareixeran aquí.'}</div>`}</section>
  <section class="panel"><h2>Ofertes sense obra (${lliures.length})</h2>${lliures.length ? `<div class="tw"><table><thead><tr><th>Data</th><th>Proveïdor</th><th>Activitat</th><th>Licitació</th><th class="num">Partides</th><th>Doc.</th></tr></thead><tbody>${lliures.map((b) => { const lic = S.oportunitats.find((x) => x.id === b.oportunitatId); return `<tr data-act="boObre" data-id="${esc(b.id)}"><td>${fmtD(b.data)}</td><td class="t-main">${esc(b.proveidor || '')}</td><td>${esc(b.activitat || '')}</td><td>${esc(lic ? lic.nom : '—')}</td><td class="num">${(b.linies || []).length}</td><td>${(b.docs || []).length ? `<button class="btn sm" data-act="veuDoc" data-id="${esc(b.docs[0])}">Veure</button>` : '<span class="muted">—</span>'}</td></tr>`; }).join('')}</tbody></table></div>` : '<div class="empty" style="padding:16px">Entra aquí les ofertes que rebeu per estudiar una licitació, encara sense obra.</div>'}</section>`;
}
document.addEventListener('input', (e) => { const k = e.target.dataset && e.target.dataset.banc; if (k) { BANC[k] = e.target.value; schedule(); } });

/* Editor d'una oferta sense obra */
let BO = null;
const boNova = () => ({ data: today(), activitat: '', tipus: M.comandes.camps.find((f) => f.k === 'tipus').o[0], oportunitatId: '', proveidor: '', nif: '', contacte: '', tel: '', email: '', notes: '', docs: [], linies: [{ id: newId('bl'), codi: '', desc: '', ut: 'ut', preu: '' }] });
function boObre(id) {
  const r = id && S.bancOfertes.find((x) => x.id === id);
  BO = { id: r ? r.id : newId('bo'), nou: !r, d: r ? JSON.parse(JSON.stringify((({ id: _, ...x }) => x)(r))) : boNova(), msg: '' };
  if (!BO.d.linies) BO.d.linies = [];
  boPinta();
}
function boPinta() {
  const d = BO.d, dis = CANWRITE ? '' : 'disabled', tipus = M.comandes.camps.find((f) => f.k === 'tipus').o;
  const inp = (k, l, w, x = '') => `<div class="fld${w ? ' w' : ''}"><label for="bo-${k}">${l}</label><input id="bo-${k}" data-bo="${k}" value="${esc(d[k] || '')}" autocomplete="off" ${x} ${dis}></div>`;
  const lin = (l, i) => `<tr style="cursor:default" data-bl="${i}"><td style="width:80px"><input class="ed txt" data-blk="codi" value="${esc(l.codi || '')}" aria-label="Codi" ${dis}></td><td><input class="ed txt" data-blk="desc" value="${esc(l.desc || '')}" aria-label="Descripció" ${dis}></td><td style="width:60px"><input class="ed txt" data-blk="ut" value="${esc(l.ut || '')}" aria-label="Unitat" ${dis}></td><td style="width:110px"><input class="ed" data-blk="preu" inputmode="decimal" value="${esc(typeof l.preu === 'number' ? fmtN(l.preu) : l.preu || '')}" aria-label="Preu unitari" ${dis}></td><td style="width:34px">${dis ? '' : `<button class="btn sm" type="button" data-act="boTreuL" data-i="${i}" aria-label="Treu la línia">×</button>`}</td></tr>`;
  const docs = (d.docs || []).map((f, k) => { const x = S.fitxers.find((y) => y.id === f); return x ? `<div style="display:flex;gap:6px;align-items:center"><span style="flex:1;overflow-wrap:anywhere" class="small">${esc(x.nom)}</span><button class="btn sm" type="button" data-act="veuDoc" data-id="${esc(f)}">Veure</button>${dis ? '' : `<button class="btn sm" type="button" data-act="boTreuDoc" data-k="${k}" aria-label="Treu el document">×</button>`}</div>` : ''; }).join('');
  const body = `<div class="fgrid">
   ${inp('data', 'Data de l\'oferta', 0, 'type="date"')}<div class="fld"><label for="bo-tipus">Tipus</label><select id="bo-tipus" data-bo="tipus" ${dis}>${tipus.map((t) => `<option ${t === d.tipus ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></div>
   ${inp('activitat', 'Activitat', 1, 'placeholder="Bastida, estructura, mòduls d\'obra…"')}
   <div class="fld w"><label for="bo-oportunitatId">Licitació (opcional)</label><select id="bo-oportunitatId" data-bo="oportunitatId" ${dis}><option value="">— Cap —</option>${S.oportunitats.map((o) => `<option value="${esc(o.id)}" ${o.id === d.oportunitatId ? 'selected' : ''}>${esc(o.nom || '')}</option>`).join('')}</select></div>
   ${inp('proveidor', 'Empresa *', 1)}${inp('nif', 'NIF / CIF')}${inp('contacte', 'Contacte')}${inp('tel', 'Telèfon')}${inp('email', 'Correu')}
   <div class="fld w"><label for="bo-notes">Notes</label><textarea id="bo-notes" data-bo="notes" rows="2" ${dis}>${esc(d.notes || '')}</textarea></div></div>
   <div><b>Document</b>${docs || '<div class="small">Sense document.</div>'}${CANWRITE && ASSETS ? '<div style="margin-top:6px"><label class="btn sm" for="bo-f">Adjunta i llegeix l\'oferta</label><input type="file" id="bo-f" accept=".pdf,.png,.jpg,.jpeg,.webp,.xlsx,.xls,.doc,.docx" hidden></div>' : ''}<div class="small" id="bo-msg" aria-live="polite">${esc(BO.msg || '')}</div></div>
   <div><b>Preus de l'oferta</b><div class="small">Preu unitari sense IVA.</div><div class="tw"><table><thead><tr><th>Codi</th><th>Descripció</th><th>Ut</th><th class="num">Preu</th><th></th></tr></thead><tbody>${d.linies.map(lin).join('')}</tbody></table></div>${dis ? '' : '<button class="btn sm" type="button" data-act="boNovaL" style="margin-top:6px">+ Línia</button>'}</div>`;
  const foot = CANWRITE ? `${BO.nou ? '' : '<button class="btn danger" data-act="boDel">Elimina</button>'}<span class="sp"></span><button class="btn" data-act="close">Cancel·la</button><button class="btn pri" data-act="boDesa">Desa</button>` : '<span class="sp"></span><button class="btn" data-act="close">Tanca</button>';
  const sc = $('#drawerHost .body') ? $('#drawerHost .body').scrollTop : 0;
  drawer(BO.nou ? 'Nova oferta sense obra' : `Oferta · ${d.proveidor || ''}`, body, foot);
  $('#drawerHost .drawer').classList.add('ampla'); $('#drawerHost .body').scrollTop = sc;
}
document.addEventListener('input', (e) => {
  const t = e.target; if (!BO || !t.closest || !t.closest('#drawerHost')) return;
  if (t.dataset.bo) BO.d[t.dataset.bo] = t.value;
  else if (t.dataset.blk) BO.d.linies[+t.closest('tr').dataset.bl][t.dataset.blk] = t.value;
});
document.addEventListener('change', async (e) => {
  const t = e.target; if (!BO || t.id !== 'bo-f' || !t.files[0]) return;
  const file = t.files[0]; t.value = '';
  const msg = (s) => { BO.msg = s; const m = $('#bo-msg'); if (m) m.textContent = s; };
  msg(`Pujant ${file.name}…`);
  let fid; try { fid = await pujaFitxer(file, null); } catch (x) { msg('No s\'ha pogut pujar el document.'); return; }
  BO.d.docs = [...(BO.d.docs || []), fid]; boPinta();
  if (!LLEGIBLE.includes(fext(file.name))) { msg('Document desat. Aquest format no es llegeix: entra les dades a mà.'); return; }
  msg('Llegint el document…');
  let r; try { r = await cpLlegeix(file); } catch (x) { msg('No s\'ha pogut llegir. Entra les dades a mà.'); return; }
  const posats = []; [['nom', 'proveidor', 'empresa'], ['nif', 'nif', 'NIF'], ['email', 'email', 'correu'], ['tel', 'tel', 'telèfon']].forEach(([k, c, l]) => { if (r[k] && !String(BO.d[c] || '').trim()) { BO.d[c] = r[k]; posats.push(l); } });
  BO.msg = posats.length ? `Llegit: ${posats.join(', ')}. Revisa-ho i entra els preus.` : 'No s\'hi han trobat dades. Entra-les a mà.'; boPinta();
});
async function boDesa() {
  const d = BO.d, b = document.querySelector('[data-act="boDesa"]');
  if (!String(d.proveidor || '').trim()) { toast('Falta l\'empresa.'); $('#bo-proveidor').focus(); return; }
  const ls = d.linies.filter((l) => String(l.desc || '').trim() || String(l.preu ?? '').trim());
  for (const l of ls) { if (!String(l.desc || '').trim()) { toast('Hi ha una línia sense descripció.'); return; } const n = typeof l.preu === 'number' ? l.preu : String(l.preu ?? '').trim() === '' ? NaN : nv(String(l.preu).replace('€', '')); if (!isFinite(n) || n < 0) { toast(`El preu de «${String(l.desc).slice(0, 40)}» no és correcte.`); return; } l.preu = n; }
  b.disabled = true;
  try { await save('bancOfertes', BO.id, { ...d, linies: ls }); } catch (x) { b.disabled = false; return; }
  logA(`${BO.nou ? 'Nova oferta al banc' : 'Oferta del banc actualitzada'}: ${d.proveidor}`); toast('Oferta desada.'); BO = null; closeDrawer();
}
document.addEventListener('click', async (e) => {
  const a = e.target.closest('[data-act]'); if (!a) return; const t = a.dataset.act;
  if (t === 'boNou') boObre(null);
  else if (t === 'boObre') boObre(a.dataset.id);
  else if (t === 'boComp') location.hash = 'comp-' + a.dataset.id;
  else if (!BO) return;
  else if (t === 'boNovaL') { BO.d.linies.push({ id: newId('bl'), codi: '', desc: '', ut: 'ut', preu: '' }); boPinta(); const r = document.querySelectorAll('[data-blk="desc"]'); if (r.length) r[r.length - 1].focus(); }
  else if (t === 'boTreuL') { BO.d.linies.splice(+a.dataset.i, 1); boPinta(); }
  else if (t === 'boTreuDoc') { BO.d.docs.splice(+a.dataset.k, 1); boPinta(); }
  else if (t === 'boDesa') boDesa();
  else if (t === 'boDel') {
    if (!a.classList.contains('arm')) { a.classList.add('arm'); a.textContent = 'Confirma: elimina'; setTimeout(() => { if (a.isConnected) { a.classList.remove('arm'); a.textContent = 'Elimina'; } }, 4000); return; }
    try { await remove('bancOfertes', BO.id); } catch (x) { return; }
    logA(`Oferta del banc eliminada: ${BO.d.proveidor || ''}`); toast('Oferta eliminada.'); BO = null; closeDrawer();
  }
});

/* ---------- Fitxa de l'obra: noms dels caps ---------- */
const _openDep = openForm;
openForm = function (mk, id, def) {
  _openDep(mk, id, def);
  const fm = $('#frm'); if (mk !== 'obres' || !fm) return;
  const noms = [...new Set([...S.personal.filter((p) => p.estat !== 'Inactiu').map((p) => p.nom), ...S.obres.flatMap((o) => CAPS_OBRA.map(([k]) => o[k]))].map((x) => String(x || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ca'));
  const dl = document.createElement('datalist'); dl.id = 'caps-noms'; dl.innerHTML = noms.map((n) => `<option value="${esc(n)}">`).join(''); fm.after(dl);
  // si encara no hi són, els noms que ja hi ha a les dedicacions de l'obra
  const q = id && qDoc(id);
  CAPS_OBRA.forEach(([k, , tipus]) => { const el = fm.elements[k]; if (!el) return; el.setAttribute('list', 'caps-noms'); el.autocomplete = 'off';
    if (!el.value && q) { const l = (q.linies || []).find((x) => x.tipus === tipus && String(x.nom || '').trim()); if (l) el.value = l.nom; } });
};

/* ---------- Visor: el document s'obre en una pestanya nova, en PDF ---------- */
async function imgAPdf(b) {
  const J = await jsPdf(), u = URL.createObjectURL(b);
  try {
    const im = await new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ko; i.src = u; });
    const k = Math.min(1, 14000 / Math.max(im.naturalWidth, im.naturalHeight)), w = im.naturalWidth * k, h = im.naturalHeight * k;
    const c = document.createElement('canvas'); c.width = Math.round(w); c.height = Math.round(h); const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(im, 0, 0, c.width, c.height);
    const doc = new J({ unit: 'pt', format: [w, h], orientation: w > h ? 'l' : 'p', compress: true });
    doc.addImage(c.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, w, h);
    return doc.output('blob');
  } finally { URL.revokeObjectURL(u); }
}
const _visorModal = visor;
visor = function (nom, dona) {
  let w = null; try { w = window.open('', '_blank'); } catch (x) { w = null; }
  if (!w) { toast('El navegador no ha deixat obrir una pestanya nova: el document s\'obre aquí.'); return _visorModal(nom, dona); }
  const D = w.document;
  D.open(); D.write('<!doctype html><html lang="ca"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title></title><style>html,body{margin:0;height:100%;background:#3a3a3a;color:#eee;font:15px system-ui,sans-serif}iframe{border:0;width:100%;height:100%;display:block}.m{padding:40px 16px;text-align:center}a{color:#9cf}.x{overflow:auto;height:100%;box-sizing:border-box;padding:12px}.x table{border-collapse:collapse;background:#fff;color:#111;font-size:13px;margin-bottom:16px}.x td{border:1px solid #ccc;padding:3px 6px;white-space:nowrap}h3{margin:8px 0}</style></head><body><div class="m">Carregant…</div></body></html>'); D.close();
  D.title = nom;
  (async () => {
    let url = null;
    try {
      let b = await dona(); const e = fext(nom); let t = b.type || OKT[e] || '';
      if (e === 'pdf' && t !== 'application/pdf') { b = new Blob([b], { type: 'application/pdf' }); t = 'application/pdf'; }
      if (/^image\//.test(t) && !/svg/.test(t)) { try { b = await imgAPdf(b); t = 'application/pdf'; } catch (x) { /* es mostra la imatge tal qual */ } }
      if (w.closed) return;
      if (t === 'application/pdf' || /^image\/|^video\/|^text\/|json/.test(t)) {
        url = URL.createObjectURL(b);
        const f = D.createElement('iframe'); f.title = nom; f.src = url; D.body.replaceChildren(f);
      } else if (/^(xlsx|xls|ods|csv)$/.test(e)) {
        const X = await ObradorLectura.xlsx(), wb = X.read(await b.arrayBuffer(), { type: 'array' });
        const div = D.createElement('div'); div.className = 'x';
        div.innerHTML = wb.SheetNames.map((n) => `<h3>${esc(n)}</h3>${X.utils.sheet_to_html(wb.Sheets[n], { header: '', footer: '' })}`).join('');
        D.body.replaceChildren(div);
      } else {
        url = URL.createObjectURL(b);
        D.body.innerHTML = '<div class="m">Aquest format no es pot previsualitzar. <a>Descarrega el document</a></div>';
        const a = D.querySelector('a'); a.href = url; a.download = nom;
      }
    } catch (x) { if (!w.closed) D.body.innerHTML = '<div class="m">No s\'ha pogut obrir el document. Comprova la connexió i torna-ho a provar.</div>'; }
    if (url) { const iv = setInterval(() => { if (w.closed) { clearInterval(iv); URL.revokeObjectURL(url); } }, 5000); }
  })();
};
