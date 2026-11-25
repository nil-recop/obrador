/* Visor de documents i documents de compra amb lectura de dades. Els documents no s'aproven. */
CARP_OBRA.push('09 Compres i factures');
CARP_EMP.push('Compres i factures');
(() => {
  const s = document.createElement('style');
  s.textContent = `.visor{position:fixed;inset:0;z-index:60;background:#2b2b2b;display:flex;flex-direction:column}.visor header{display:flex;gap:6px;align-items:center;padding:8px 12px;padding-top:max(8px,env(safe-area-inset-top,0px));background:var(--surface);color:var(--ink);flex-wrap:wrap}.visor header b{flex:1;min-width:140px;overflow-wrap:anywhere;font-size:14px}.visor main{flex:1;overflow:auto;padding:12px;min-height:0}.visor main>div{margin:0 auto 12px;background:#fff;position:relative}.visor canvas{width:100%;height:100%;display:block}.visor img,.visor video{display:block;margin:0 auto;max-width:100%}.visor pre{background:var(--surface);color:var(--ink);padding:14px;margin:0;white-space:pre-wrap;overflow-wrap:anywhere}.visor .msg{background:none!important;color:#fff;text-align:center;padding:40px 12px}
.lot{border:1px solid var(--line);border-radius:6px;padding:12px;display:flex;flex-direction:column;gap:10px}.lot h4{margin:0;font-size:14px;overflow-wrap:anywhere;display:flex;gap:8px;align-items:center}.lot h4 span{flex:1;min-width:0}.lot-av{font-size:12.5px;color:var(--warn);margin:0;padding-left:18px}.drawer.ampla{width:min(760px,100%)}`;
  document.head.append(s);
})();

/* ---------- Visor ---------- */
const VC = new Map();
async function baixaDoc(asset) {
  if (VC.has(asset)) return VC.get(asset);
  const b = await ASSETS_LLEGIR(asset);
  VC.set(asset, b); if (VC.size > 6) VC.delete(VC.keys().next().value);
  return b;
}
const ASSETS_LLEGIR = (id) => window.ObradorBaixa(id);
let visorNet = null;
function tancaVisor() { const v = $('#visor'); if (v) v.remove(); if (visorNet) { visorNet(); visorNet = null; } }
async function visor(nom, dona) {
  tancaVisor();
  const v = document.createElement('div'); v.id = 'visor'; v.className = 'visor'; v.setAttribute('role', 'dialog'); v.setAttribute('aria-modal', 'true'); v.setAttribute('aria-label', nom);
  v.innerHTML = '<header><b></b><button class="btn sm" data-vz="-1" aria-label="Allunya">−</button><button class="btn sm" data-vz="1" aria-label="Apropa">+</button><a class="btn sm" data-vd="1" hidden>Descarrega</a><button class="btn sm pri" data-vt="1">Tanca</button></header><main><div class="msg">Carregant…</div></main>';
  v.querySelector('b').textContent = nom; document.body.append(v); v.querySelector('[data-vt]').focus();
  const main = v.querySelector('main'), viu = () => v.isConnected; let url = null, doc = null, ob = null;
  visorNet = () => { if (url) setTimeout(() => URL.revokeObjectURL(url), 5000); if (ob) ob.disconnect(); if (doc) doc.destroy(); };
  try {
    const b = await dona(); if (!viu()) return;
    url = URL.createObjectURL(b);
    const d = v.querySelector('[data-vd]'); d.href = url; d.download = nom; d.hidden = false;
    const t = b.type;
    if (/^image\//.test(t)) { main.innerHTML = '<img alt="">'; const im = main.firstChild; im.src = url; let z = 1; v.zoom = (k) => { z = Math.min(6, Math.max(0.25, z * (k > 0 ? 1.3 : 1 / 1.3))); im.style.maxWidth = 'none'; im.style.width = z * 100 + '%'; }; }
    else if (/^video\//.test(t)) { main.innerHTML = '<video controls></video>'; main.firstChild.src = url; }
    else if (t === 'application/pdf') {
      doc = await ObradorLectura.obrePdf(b); if (!viu()) { doc.destroy(); doc = null; return; }
      const d0 = doc, p1_ = await doc.getPage(1), mida = p1_.getViewport({ scale: 1 });
      let amp = Math.min(main.clientWidth - 24, 1100);
      main.innerHTML = '';
      const pinta = async (el) => {
        const w = el.clientWidth; if (el.fet === w) return; el.fet = w;
        const p = await d0.getPage(+el.dataset.p), v1 = p.getViewport({ scale: 1 }); el.style.aspectRatio = v1.width + '/' + v1.height;
        const dens = Math.min(window.devicePixelRatio || 1, 2), esc_ = Math.min(w * dens / v1.width, Math.sqrt(16e6 / (v1.width * v1.height)));
        const vp = p.getViewport({ scale: esc_ }), c = document.createElement('canvas'); c.width = vp.width; c.height = vp.height;
        try { await p.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise; if (el.fet === w) el.replaceChildren(c); } catch (x) { el.fet = 0; }
      };
      ob = new IntersectionObserver((es) => es.forEach((x) => { if (x.isIntersecting) pinta(x.target); else if (x.target.firstChild) { x.target.replaceChildren(); x.target.fet = 0; } }), { root: main, rootMargin: '600px' });
      for (let i = 1; i <= doc.numPages; i++) { const el = document.createElement('div'); el.dataset.p = i; el.style.width = amp + 'px'; el.style.aspectRatio = mida.width + '/' + mida.height; main.append(el); ob.observe(el); }
      v.zoom = (k) => { const y = main.scrollTop / main.scrollHeight; amp = Math.min(5000, Math.max(200, amp * (k > 0 ? 1.3 : 1 / 1.3))); [...main.children].forEach((el) => { el.style.width = amp + 'px'; el.fet = 0; ob.unobserve(el); ob.observe(el); }); main.scrollTop = y * main.scrollHeight; };
    } else if (/^text\/|json/.test(t)) { const pre = document.createElement('pre'); pre.textContent = (await b.text()).slice(0, 500000); main.replaceChildren(pre); }
    else main.innerHTML = '<div class="msg">Aquest format no es pot veure aquí. Descarrega\'l per obrir-lo.</div>';
    if (!v.zoom) v.querySelectorAll('[data-vz]').forEach((x) => { x.hidden = true; });
  } catch (e) { if (viu()) main.innerHTML = '<div class="msg">No s\'ha pogut obrir el document. Comprova la connexió i torna-ho a provar.</div>'; }
}
function veuDoc(id, i) {
  const f = S.fitxers.find((x) => x.id === id), v = f && (i == null ? curVer(f) : f.versions[i]);
  if (!v || !v.asset) { toast('Aquest document no té cap fitxer.'); return; }
  visor(v.nom || f.nom, async () => { const b = await baixaDoc(v.asset); return v.tipus && b.type !== v.tipus ? new Blob([b], { type: v.tipus }) : b; });
}
document.addEventListener('click', (e) => {
  const z = e.target.closest('[data-vz]');
  if (z) { const v = $('#visor'); if (v.zoom) v.zoom(+z.dataset.vz); return; }
  if (e.target.closest('[data-vt]')) { tancaVisor(); return; }
  const a = e.target.closest('[data-act="veuDoc"]');
  if (a) { e.preventDefault(); veuDoc(a.dataset.id, a.dataset.i == null ? null : +a.dataset.i); }
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && $('#visor')) { e.stopImmediatePropagation(); tancaVisor(); } }, true);
window.addEventListener('hashchange', tancaVisor);

/* ---------- Desa un fitxer ---------- */
async function pujaFitxer(file, obraId) {
  const type = OKT[fext(file.name)];
  if (!ASSETS) throw new Error('permis');
  const r = await ASSETS.upload(file, { type }), id = newId('f');
  await save('fitxers', id, { nom: file.name, owner: obraId || 'empresa', carpeta: obraId ? '09 Compres i factures' : 'Compres i factures', etiquetes: '', versions: [{ asset: r.id, nom: file.name, mida: r.sizeBytes, tipus: r.contentType, data: new Date().toISOString(), per: (ME && ME.id) || null }] });
  return id;
}
const LLEGIBLE = ['pdf', 'png', 'jpg', 'jpeg', 'webp'];
function fitxerOk(f) {
  if (!LLEGIBLE.includes(fext(f.name))) { toast(`«${f.name}»: cal un PDF o una imatge JPG, PNG o WebP.`); return false; }
  if (f.size > 20 * 1048576) { toast(`«${f.name}» supera el límit de 20 MB.`); return false; }
  return true;
}
/* Empreses conegudes: subcontractistes i documents anteriors */
function coneguts() {
  const l = S.tercers.map((t) => ({ nif: t.nif, nom: t.nom }));
  S.factures.filter((f) => f.sentit === 'Rebuda').forEach((f) => l.push({ nif: f.nif, nom: f.tercer }));
  S.comandes.forEach((c) => l.push({ nif: c.nif, nom: c.proveidor }));
  return l.filter((x) => x.nom);
}
async function llegeixDoc(file, avisa) {
  const b = file.type ? file : new Blob([file], { type: OKT[fext(file.name)] });
  const { linies, escanejat } = await ObradorLectura.linies(b, avisa);
  const e = cfgEmp(), r = ObradorLectura.interpreta(linies, { nif: e.nif, nom: e.nom }, coneguts());
  if (escanejat) r.avisos.unshift('Llegit d\'una imatge: revisa totes les dades');
  if (!linies.length) r.avisos = ['No s\'hi ha pogut llegir cap text'];
  return r;
}

/* ---------- Camps i formularis ---------- */
(() => {
  const c = M.comandes.camps, f = M.factures.camps;
  c.splice(c.findIndex((x) => x.k === 'proveidor') + 1, 0, { k: 'nif', l: 'Número fiscal (NIF)', tp: 'text' }, { k: 'docNum', l: 'Núm. del document', tp: 'text' });
  c.push({ k: 'fitxerId', l: 'Document', tp: 'fitxer' });
  f.splice(f.findIndex((x) => x.k === 'tercer') + 1, 0, { k: 'nif', l: 'Número fiscal (NIF)', tp: 'text' });
  f.push({ k: 'fitxerId', l: 'Document', tp: 'fitxer' });
  const clip = { l: 'Doc.', f: (o) => (o.fitxerId && S.fitxers.some((x) => x.id === o.fitxerId) ? `<button class="btn sm" data-act="veuDoc" data-id="${esc(o.fitxerId)}">Veure</button>` : '<span class="muted">—</span>') };
  M.comandes.cols.push(clip); M.factures.cols.push(clip);
})();
let FP = null;
const _fieldD = fieldHtml;
fieldHtml = function (f, v) {
  if (f.tp !== 'fitxer') return _fieldD(f, v);
  return `<div class="fld w"><label for="fld-fitxerId-f">Document</label><input type="hidden" name="fitxerId" value="${esc(v || '')}"><div id="doc-box" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"></div><div id="doc-msg" class="small" aria-live="polite"></div></div>`;
};
function docBox() {
  const b = $('#doc-box'), fm = $('#frm'); if (!b || !fm) return;
  const d = S.fitxers.find((x) => x.id === fm.elements.fitxerId.value);
  b.innerHTML = (FP ? `<span class="small">${esc(FP.name)} (es desarà amb el registre)</span><button type="button" class="btn sm" data-fp="veu">Veure</button>` : d ? `<span class="small" style="overflow-wrap:anywhere">${esc(d.nom)}</span><button type="button" class="btn sm" data-act="veuDoc" data-id="${esc(d.id)}">Veure</button>` : '<span class="small">Sense document.</span>')
    + (CANWRITE && ASSETS ? `<label class="btn sm" for="fld-fitxerId-f">${FP || d ? 'Canvia' : 'Adjunta i llegeix'}</label><input type="file" id="fld-fitxerId-f" accept=".pdf,.png,.jpg,.jpeg,.webp" hidden>` : '');
}
const _openD = openForm;
openForm = function (mk, id, def) { FP = null; _openD(mk, id, def); docBox(); };
async function adjunta(file) {
  if (!fitxerOk(file)) return;
  FP = file; docBox();
  const fm = $('#frm'), m = $('#doc-msg'), fac = fm.dataset.mk === 'factures';
  if (fac && fm.elements.sentit.value === 'Emesa') { m.textContent = ''; return; }
  m.textContent = 'Llegint el document…';
  let r;
  try { r = await llegeixDoc(file, (t) => { m.textContent = t; }); } catch (e) { m.textContent = 'No s\'ha pogut llegir. Es desarà igualment; entra les dades a mà.'; return; }
  if (!fm.isConnected || FP !== file) return;
  const e = fm.elements, nou = !fm.dataset.id, posats = [];
  const posa = (k, v, n) => { const el = e[k]; if (!el || v == null || v === '') return; if (String(el.value) === String(v)) return; if (nou || !el.value || (k === 'base' || k === 'import') && !+el.value) { el.value = v; posats.push(n); } };
  posa(fac ? 'base' : 'import', r.base, 'base imposable'); posa(fac ? 'tercer' : 'proveidor', r.nom, 'nom fiscal'); posa('nif', r.nif, 'NIF'); posa('data', r.data, 'data');
  posa(fac ? 'num' : 'docNum', r.num, 'número');
  if (fac && nou && r.iva) e.iva.value = r.iva;
  m.innerHTML = `${posats.length ? `Omplert: ${posats.join(', ')}.` : 'No s\'ha canviat cap camp.'}${r.avisos.length ? `<ul class="lot-av">${r.avisos.map((a) => `<li>${esc(a)}</li>`).join('')}</ul>` : ''}`;
  fm.dispatchEvent(new Event('input', { bubbles: true }));
  if (typeof facForm === 'function') facForm();
  if ($('#calc')) calcF();
}
const _saveD = saveForm;
let desant = false;
saveForm = async function () {
  const fm = $('#frm');
  if (!FP || !fm || !fm.elements.fitxerId) return _saveD();
  if (desant) return;
  const { mk, o } = readForm();
  if (M[mk].camps.some((f) => f.req && (o[f.k] == null || o[f.k] === ''))) return _saveD();
  desant = true;
  try { toast('Pujant el document…'); fm.elements.fitxerId.value = await pujaFitxer(FP, o.obraId); FP = null; } catch (e) { toast('No s\'ha pogut pujar el document. No s\'ha desat res.'); return; } finally { desant = false; }
  return _saveD();
};

/* ---------- Diversos documents de compra alhora ---------- */
let LOT = [];
function obreLot(oid) {
  LOT = [];
  drawer('Documents de compra', `<div class="fld"><label for="lot-obra">Obra</label><select id="lot-obra">${obraOpts(oid || '', '— Sense obra (empresa) —')}</select></div>
  <div class="drop" data-dropl="1">Arrossega aquí factures, albarans o comandes (PDF o foto), o <label for="lot-f" style="text-decoration:underline;cursor:pointer">tria'ls</label>.<input type="file" id="lot-f" multiple accept=".pdf,.png,.jpg,.jpeg,.webp" hidden></div>
  ${cfgEmp().nif ? '' : '<div class="small" style="color:var(--warn)">Entra el NIF de la teva empresa a Control de gestió perquè no es confongui amb el del proveïdor.</div>'}
  <div id="lot-l" style="display:flex;flex-direction:column;gap:12px"></div>`, '<span class="sp"></span><button class="btn" data-act="close">Tanca</button><button class="btn pri" data-act="lotDesa" disabled>Desa</button>');
  $('#drawerHost .drawer').classList.add('ampla');
}
const CLASSES = ['Factura', 'Albarà', 'Comanda', 'Pressupost', 'Altres'];
function lotCard(x) {
  const inp = (k, l, t, extra = '') => `<div class="fld"><label for="l${x.k}-${k}">${l}</label><input id="l${x.k}-${k}" data-l="${k}" type="${t}" value="${esc(x.d[k] ?? '')}" ${extra}></div>`;
  const sel = (k, l, o) => `<div class="fld"><label for="l${x.k}-${k}">${l}</label><select id="l${x.k}-${k}" data-l="${k}">${o}</select></div>`;
  const op = (l, v) => l.map((q) => `<option ${q === v ? 'selected' : ''}>${esc(q)}</option>`).join('');
  const cap = `<h4><span>${esc(x.f.name)}</span><button class="btn sm" type="button" data-lot="veu">Veure</button>${x.desat ? '' : '<button class="btn sm" type="button" data-lot="treu">Treu</button>'}</h4>`;
  if (x.desat) return `${cap}<div style="color:var(--ok)">Desat com a ${esc(x.desat)}.</div>`;
  if (x.msg) return `${cap}<div class="small" aria-live="polite">${esc(x.msg)}</div>`;
  const cs = S.comandes.filter((c) => x.d.obraId && c.obraId === x.d.obraId && !['Esborrany', 'Cancel·lada'].includes(c.estat));
  return `${cap}${x.err ? `<div style="color:var(--bad)">${esc(x.err)}</div>` : ''}${x.avisos.length ? `<ul class="lot-av">${x.avisos.map((a) => `<li>${esc(a)}</li>`).join('')}</ul>` : '<div class="small" style="color:var(--ok)">Base comprovada amb el total del document.</div>'}<div class="fgrid">
  ${sel('classe', 'Document', op(CLASSES, x.d.classe))}${sel('obraId', 'Obra', obraOpts(x.d.obraId, '— Sense obra —'))}
  ${inp('nom', 'Nom fiscal *', 'text')}${inp('nif', 'Número fiscal (NIF)', 'text')}
  ${inp('base', 'Base imposable *', 'number', 'step="0.01"')}${inp('data', 'Data de la compra *', 'date')}
  ${inp('num', 'Núm. del document', 'text')}${sel('tipus', 'Tipus', op(M.comandes.camps.find((f) => f.k === 'tipus').o, x.d.tipus))}
  ${x.d.classe === 'Factura' ? sel('iva', 'IVA', op(M.factures.camps.find((f) => f.k === 'iva').o, x.d.iva)) + sel('comandaId', 'Comanda', '<option value="">— Sense comanda —</option>' + cs.map((c) => `<option value="${esc(c.id)}" ${c.id === x.d.comandaId ? 'selected' : ''}>${esc([c.num, c.proveidor, fmtM(c.import)].join(' · '))}</option>`).join('')) : ''}
  </div><div class="small">Es desarà com a ${x.d.classe === 'Factura' ? 'factura rebuda (Facturació)' : x.d.classe === 'Pressupost' ? 'compra en esborrany, que no compta com a cost (Compres)' : 'compra rebuda (Compres)'}.</div>`;
}
function lotPinta(x) {
  if (!$('#lot-l')) return;
  let el = document.querySelector(`[data-lotk="${x.k}"]`);
  if (!el) { el = document.createElement('div'); el.className = 'lot'; el.dataset.lotk = x.k; $('#lot-l').append(el); }
  el.innerHTML = lotCard(x);
  const n = LOT.filter((q) => !q.desat && !q.msg).length, b = document.querySelector('[data-act="lotDesa"]');
  b.disabled = !n || LOT.some((q) => q.msg); b.textContent = n ? `Desa ${n} document${n > 1 ? 's' : ''}` : 'Desa';
}
function lotComanda(x) {
  if (x.d.classe !== 'Factura') return;
  const nn = ObradorLectura.nifNet(x.d.nif), cs = S.comandes.filter((c) => x.d.obraId && c.obraId === x.d.obraId && !['Esborrany', 'Cancel·lada', 'Tancada'].includes(c.estat) && ((nn && ObradorLectura.nifNet(c.nif) === nn) || (x.d.nom && normC(c.proveidor) === normC(x.d.nom))));
  x.d.comandaId = cs.length === 1 ? cs[0].id : '';
  x.avisos = x.avisos.filter((a) => !a.startsWith('Aquest proveïdor té'));
  if (cs.length > 1) x.avisos.push(`Aquest proveïdor té ${cs.length} comandes en aquesta obra: tria la que correspongui`);
}
let cua = Promise.resolve();
function lotAfegeix(fs) {
  [...fs].filter(fitxerOk).forEach((f) => {
    const x = { k: newId('l'), f, d: { obraId: $('#lot-obra').value, classe: 'Factura', tipus: 'Material', iva: '21%' }, avisos: [], msg: 'Esperant…' };
    LOT.push(x); lotPinta(x);
    cua = cua.then(async () => {
      if (!LOT.includes(x)) return;
      x.msg = 'Llegint…'; lotPinta(x);
      try {
        const r = await llegeixDoc(f, (t) => { x.msg = t; lotPinta(x); });
        Object.assign(x.d, { classe: r.classe, nom: r.nom, nif: r.nif, base: r.base, data: r.data, num: r.num, iva: r.iva }); x.avisos = r.avisos;
        const ant = [...S.comandes].reverse().find((c) => r.nif && ObradorLectura.nifNet(c.nif) === r.nif) || [...S.factures].reverse().find((c) => r.nif && ObradorLectura.nifNet(c.nif) === r.nif);
        if (ant) x.d.tipus = ant.tipus || ant.tipusDespesa || 'Material';
        lotComanda(x);
        if (lotRepetit(x)) x.avisos.push('Sembla que aquest document ja està entrat');
      } catch (e) { x.avisos = ['No s\'ha pogut llegir: entra les dades a mà']; }
      x.msg = ''; lotPinta(x);
    });
  });
}
const lotRepetit = (x) => { const n = ObradorLectura.nifNet(x.d.nif), nd = normC(x.d.num); if (!nd) return false; const ig = (a, nom) => (n && ObradorLectura.nifNet(a) === n) || normC(nom) === normC(x.d.nom); return S.factures.some((f) => f.sentit === 'Rebuda' && normC(f.num) === nd && ig(f.nif, f.tercer)) || S.comandes.some((c) => normC(c.docNum) === nd && ig(c.nif, c.proveidor)); };
async function lotDesa() {
  const b = document.querySelector('[data-act="lotDesa"]'); if (b.disabled) return; b.disabled = true;
  let n = 0, mal = 0;
  for (const x of LOT.filter((q) => !q.desat)) {
    const d = x.d, base = d.base === '' || d.base == null ? NaN : +d.base;
    x.err = !d.nom ? 'Falta el nom fiscal.' : !isFinite(base) ? 'Falta la base imposable.' : !d.data ? 'Falta la data.' : '';
    if (!x.err && lotRepetit(x) && !x.repOk) { x.err = 'Ja hi ha un document d\'aquest proveïdor amb aquest número. Si el vols desar igualment, torna a prémer Desa.'; x.repOk = true; }
    if (x.err) { mal++; lotPinta(x); continue; }
    try {
      x.fitxerId = x.fitxerId || await pujaFitxer(x.f, d.obraId);
      if (d.classe === 'Factura') {
        await save('factures', newId('fa'), { num: d.num || nextCode('factures').replace('FV', 'FR'), sentit: 'Rebuda', obraId: d.obraId || '', tercer: d.nom, nif: d.nif || '', concepte: '', comandaId: d.comandaId || '', tipusDespesa: d.tipus, tipusCost: 'Automàtic', base, iva: d.iva, retencio: 0, estat: 'Pendent', data: d.data, venciment: '', fitxerId: x.fitxerId });
        x.desat = 'factura rebuda';
      } else {
        await save('comandes', newId('co'), { num: nextCode('comandes'), obraId: d.obraId || '', proveidor: d.nom, nif: d.nif || '', docNum: d.num || '', tipus: d.tipus, tipusCost: 'Automàtic', concepte: d.classe === 'Altres' ? '' : d.classe + (d.num ? ' ' + d.num : ''), import: base, estat: d.classe === 'Pressupost' ? 'Esborrany' : 'Rebuda', data: d.data, fitxerId: x.fitxerId });
        x.desat = 'compra';
      }
      logA(`Document de compra: ${d.nom} · ${fmtM(base)}`); n++;
    } catch (e) { x.err = 'No s\'ha pogut desar. Torna-ho a provar.'; mal++; }
    lotPinta(x);
  }
  if (!mal) { closeDrawer(); toast(`${n} document${n === 1 ? '' : 's'} desat${n === 1 ? '' : 's'}.`); } else { toast(`${n} desats · ${mal} per revisar.`); b.disabled = false; }
}
document.addEventListener('click', (e) => {
  const l = e.target.closest('[data-lot]'), p = e.target.closest('[data-fp]'), a = e.target.closest('[data-act]');
  if (l) { const k = l.closest('[data-lotk]').dataset.lotk, x = LOT.find((q) => q.k === k); if (l.dataset.lot === 'veu') visor(x.f.name, async () => new Blob([x.f], { type: OKT[fext(x.f.name)] })); else { LOT = LOT.filter((q) => q !== x); l.closest('[data-lotk]').remove(); const y = LOT[0]; if (y) lotPinta(y); else document.querySelector('[data-act="lotDesa"]').disabled = true; } }
  else if (p) visor(FP.name, async () => new Blob([FP], { type: OKT[fext(FP.name)] }));
  else if (a && a.dataset.act === 'lot') obreLot(a.dataset.o);
  else if (a && a.dataset.act === 'lotDesa') lotDesa();
  else if (a && a.dataset.act === 'saveNif') desaNif();
});
document.addEventListener('change', (e) => {
  const t = e.target;
  if (t.id === 'lot-f') { lotAfegeix(t.files); t.value = ''; }
  else if (t.id === 'fld-fitxerId-f') { if (t.files[0]) adjunta(t.files[0]); }
  else if (t.id === 'lot-obra') LOT.filter((x) => !x.desat).forEach((x) => { x.d.obraId = t.value; if (!x.msg) { lotComanda(x); lotPinta(x); } });
  else if (t.dataset.l) { const x = LOT.find((q) => q.k === t.closest('[data-lotk]').dataset.lotk); x.d[t.dataset.l] = t.value; if (['classe', 'obraId'].includes(t.dataset.l)) { lotComanda(x); lotPinta(x); } }
});
document.addEventListener('input', (e) => { const t = e.target; if (t.dataset.l && t.tagName === 'INPUT') { const x = LOT.find((q) => q.k === t.closest('[data-lotk]').dataset.lotk); x.d[t.dataset.l] = t.value; } });
document.addEventListener('dragover', (e) => { const z = e.target.closest && e.target.closest('[data-dropl]'); if (z) { e.preventDefault(); z.classList.add('over'); } });
document.addEventListener('dragleave', (e) => { const z = e.target.closest && e.target.closest('[data-dropl]'); if (z) z.classList.remove('over'); });
document.addEventListener('drop', (e) => { const z = e.target.closest && e.target.closest('[data-dropl]'); if (z) { e.preventDefault(); z.classList.remove('over'); lotAfegeix(e.dataTransfer.files); } });

/* Botó i explicació a Compres i Facturació */
const _listD = listHtml;
listHtml = function (mk, fo) {
  const h = _listD(mk, fo);
  if (mk !== 'comandes' && mk !== 'factures') return h;
  const ex = mk === 'comandes' ? 'Compres: el que encarregues als proveïdors i subcontractistes (comandes i albarans).' : 'Facturació: les factures emeses al client i les rebudes dels proveïdors.';
  return `<div class="small" style="margin-bottom:8px">${ex}</div>` + (CANWRITE && ASSETS ? h.replace('<span style="flex:1"></span>', `<span style="flex:1"></span><button class="btn sm" data-act="lot" data-o="${esc(fo || '')}">Puja documents de compra</button>`) : h);
};

/* Dades fiscals pròpies */
const _cfgD = estrConfigHtml;
estrConfigHtml = function () {
  const e = cfgEmp(), st = 'border:1px solid var(--line);background:var(--surface);color:var(--ink);border-radius:5px;padding:7px 10px;font:inherit;min-width:0';
  return _cfgD() + `<section class="panel" style="margin-bottom:16px"><h2>La teva empresa</h2><div class="pb"><div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end"><label style="display:flex;flex-direction:column;gap:4px;font-size:13px">Nom fiscal<input id="emp-nom" value="${esc(e.nom || '')}" ${CANWRITE ? '' : 'disabled'} style="${st};width:260px;max-width:100%"></label><label style="display:flex;flex-direction:column;gap:4px;font-size:13px">NIF<input id="emp-nif" value="${esc(e.nif || '')}" ${CANWRITE ? '' : 'disabled'} style="${st};width:140px"></label>${CANWRITE ? '<button class="btn sm" data-act="saveNif">Desa</button>' : ''}</div><div class="small" style="margin-top:8px">Serveix per distingir-vos del proveïdor quan es llegeix un document.</div></div></section>`;
};
async function desaNif() {
  const nif = ObradorLectura.nifNet($('#emp-nif').value), nom = $('#emp-nom').value.trim();
  if (nif && !ObradorLectura.nifValid(nif)) { toast('Aquest NIF no és correcte.'); return; }
  const { id, ...p } = cfgEmp();
  try { await save('config', 'empresa', { ...p, nif, nom }); } catch (e) { return; }
  toast('Dades de l\'empresa desades.');
}
