/* Proformes: el que enviem a una empresa perquè ens faci la factura. Surten d'una comanda i les línies es poden canviar.
   Enviada i sense factura: compta com a provisió de cost. Quan arriba la factura i s'hi vincula, compta la factura. */
S.proformes = [];
COLS.push('proformes');
const PF_ESTATS = ['Esborrany', 'Enviada', 'Facturada', 'Anul·lada'];
TONE.Enviada = 'info'; TONE.Facturada = TONE.Facturada || 'warn'; TONE['Anul·lada'] = 'bad';
const pfFactures = (p) => S.factures.filter((f) => f.proformaId === p.id && f.sentit === 'Rebuda' && f.estat !== 'Esborrany');
const pfTot = (d) => { const b = r2(sum(d.linies || [], (l) => r2(nv(l.q) * nv(l.preu)))), isp = String(d.iva || '').startsWith('ISP'), iva = r2(b * (isp ? 0 : parseFloat(d.iva) || 0) / 100), ret = r2(b * (nv(d.retencio) || 0) / 100); return { b, iva, ret, total: r2(b + iva - ret), isp }; };
M.proformes = { t: 'Proformes', s: 'proforma', pref: 'PF', tit: 'concepte', camps: [
  { k: 'num', l: 'Núm.', tp: 'code', req: 1 }, { k: 'obraId', l: 'Obra', tp: 'obra' }, { k: 'proveidor', l: 'Empresa', tp: 'text' }, { k: 'concepte', l: 'Concepte', tp: 'text' }, { k: 'data', l: 'Data', tp: 'date' },
  { k: 'estat', l: 'Estat', tp: 'sel', o: PF_ESTATS }],
cols: ['num', 'obraId', 'proveidor', 'concepte', 'data', { l: 'Base', num: 1, f: (o) => fmtM(pfTot(o).b) }, { l: 'Factura', f: (o) => { const fs = pfFactures(o); return fs.length ? esc(fs.map((f) => f.num).join(', ')) : '<span class="muted">—</span>'; } }, 'estat'] };
(() => {
  const g = NAV.find((x) => x.items.some((i) => i[0] === 'factures')), k = g.items.findIndex((i) => i[0] === 'factures');
  g.items.splice(k + 1, 0, ['proformes', 'Proformes', 'M6 3h9l4 4v14H6zM14 3v5h5M9 12h6M9 16h6M9 8h2']);
  const s = document.createElement('style'); s.textContent = '#pf-l td{padding:4px 5px}#pf-l .ed{min-width:0}'; document.head.append(s);
  // A la factura rebuda: de quina proforma ve
  const fc = M.factures.camps; fc.splice(fc.findIndex((x) => x.k === 'comandaId'), 0, { k: 'proformaId', l: 'Proforma', tp: 'proforma' });
})();
const _fieldPF = fieldHtml;
fieldHtml = function (f, v) {
  if (f.tp !== 'proforma') return _fieldPF(f, v);
  return `<div class="fld"><label for="fld-proformaId">Proforma</label><select id="fld-proformaId" name="proformaId" data-v="${esc(v || '')}" ${CANWRITE ? '' : 'disabled'}><option value="${esc(v || '')}" selected>—</option></select></div>`;
};
function pfFacForm(init) {
  const fm = $('#frm'); if (!fm || fm.dataset.mk !== 'factures') return;
  const e = fm.elements, s = e.proformaId, val = init ? s.dataset.v : s.value;
  const ps = S.proformes.filter((p) => p.obraId === e.obraId.value && e.obraId.value && (p.id === val || ['Enviada', 'Facturada'].includes(p.estat)));
  s.innerHTML = '<option value="">— Sense proforma —</option>' + ps.map((p) => `<option value="${esc(p.id)}">${esc([p.num, p.proveidor, fmtM(pfTot(p).b)].join(' · '))}</option>`).join('');
  s.value = ps.some((p) => p.id === val) ? val : '';
  s.closest('.fld').style.display = e.sentit.value === 'Rebuda' ? '' : 'none';
  const p = ps.find((x) => x.id === s.value);
  if (p && !init && p.comandaId && e.comandaId.value !== p.comandaId) { e.comandaId.value = p.comandaId; if (e.comandaId.value === p.comandaId) e.comandaId.dispatchEvent(new Event('input', { bubbles: true })); }
}
const _openPF = openForm;
openForm = function (mk, id, def) {
  if (mk === 'proformes') return pfObre(id, def);
  _openPF(mk, id, def); pfFacForm(true);
  if (mk === 'comandes' && id && CANWRITE) { const cl = document.querySelector('#drawerHost footer [data-act="close"]'); if (cl) cl.insertAdjacentHTML('beforebegin', `<button class="btn" data-act="pfDeCom" data-id="${esc(id)}">Crea proforma</button>`); }
};
document.addEventListener('input', (e) => { if (e.target.name === 'proformaId' || e.target.name === 'obraId' || e.target.name === 'sentit') pfFacForm(); });
const _saveFPF = saveForm;
saveForm = async function () {
  const fm = $('#frm'), pid = fm && fm.dataset.mk === 'factures' && fm.elements.sentit.value === 'Rebuda' ? fm.elements.proformaId.value : '';
  const r = await _saveFPF();
  // La proforma passa a facturada quan hi ha factura vinculada
  const p = pid && S.proformes.find((x) => x.id === pid);
  if (p && p.estat !== 'Facturada' && !$('#frm')) { const { id, ...q } = p; try { await save('proformes', id, { ...q, estat: 'Facturada' }); logA(`Proforma ${p.num} facturada`); } catch (x) {} }
  return r;
};

/* ---------- Editor ---------- */
let PF = null;
function pfNova(def) {
  const c = def.comandaId && S.comandes.find((x) => x.id === def.comandaId);
  const pend = c ? Math.max(0, (+c.import || 0) - facturatCom(c) - sum(S.proformes.filter((p) => p.comandaId === c.id && pfPendent(p)), pfBase)) : 0;
  return { num: nextCode('proformes'), obraId: (c && c.obraId) || def.obraId || '', comandaId: c ? c.id : '', proveidor: c ? c.proveidor : '', nif: c ? c.nif || '' : '', concepte: c ? c.concepte || '' : '',
    data: today(), estat: 'Esborrany', iva: '21%', retencio: '', pagament: cfgEmp().pagament || '', notes: '', tipusDespesa: c ? c.tipus : 'Material', tipusCost: 'Automàtic',
    linies: [{ concepte: c ? c.concepte || c.tipus || 'Comanda ' + (c.num || '') : '', ut: c ? 'ut' : '', q: 1, preu: c ? r2(pend) : '' }] };
}
function pfObre(id, def) {
  const r = id && S.proformes.find((x) => x.id === id);
  if (id && !r) return;
  PF = { id: id || '', d: r ? JSON.parse(JSON.stringify((({ id: _, ...x }) => x)(r))) : pfNova(def || {}) };
  pfPinta();
}
function pfPinta() {
  const d = PF.d, bl = !CANWRITE || ['Facturada', 'Anul·lada'].includes(d.estat), dis = bl ? 'disabled' : '', fs = PF.id ? pfFactures({ id: PF.id }) : [];
  const op = (l, v) => l.map((x) => `<option ${x === v ? 'selected' : ''}>${esc(x)}</option>`).join('');
  const cs = S.comandes.filter((c) => c.obraId === d.obraId && d.obraId && (c.id === d.comandaId || !['Cancel·lada', 'Tancada'].includes(c.estat)));
  const inp = (k, l, extra = '') => `<div class="fld"><label for="pf-${k}">${l}</label><input id="pf-${k}" data-pf="${k}" value="${esc(d[k] ?? '')}" ${dis} ${extra}></div>`;
  const body = `<form id="pfrm" class="fgrid" novalidate>
   ${inp('num', 'Núm. de proforma *')}${inp('data', 'Data', 'type="date"')}
   <div class="fld"><label for="pf-obraId">Obra</label><select id="pf-obraId" data-pf="obraId" ${dis}>${obraOpts(d.obraId, '— Sense obra —')}</select></div>
   <div class="fld"><label for="pf-comandaId">Comanda</label><select id="pf-comandaId" data-pf="comandaId" ${dis}><option value="">— Sense comanda —</option>${cs.map((c) => `<option value="${esc(c.id)}" ${c.id === d.comandaId ? 'selected' : ''}>${esc([c.num, c.proveidor, fmtM(c.import)].join(' · '))}</option>`).join('')}</select></div>
   ${inp('proveidor', 'Empresa *')}${inp('nif', 'NIF de l\'empresa')}<div class="fld w"><label for="pf-concepte">Concepte</label><input id="pf-concepte" data-pf="concepte" value="${esc(d.concepte || '')}" ${dis}></div>
   <div class="fld"><label for="pf-iva">IVA</label><select id="pf-iva" data-pf="iva" ${dis}>${op(M.factures.camps.find((f) => f.k === 'iva').o, d.iva)}</select></div>
   ${inp('retencio', 'Retenció de garantia (%)', 'inputmode="decimal" class="ed"')}<div class="fld w"><label for="pf-pagament">Forma i termini de pagament</label><input id="pf-pagament" data-pf="pagament" value="${esc(d.pagament || '')}" placeholder="Confirming a 60 dies" ${dis}></div>
   ${d.comandaId ? '' : `<div class="fld"><label for="pf-tipusDespesa">Tipus de despesa</label><select id="pf-tipusDespesa" data-pf="tipusDespesa" ${dis}>${op(M.comandes.camps.find((f) => f.k === 'tipus').o, d.tipusDespesa)}</select></div>`}
   <div class="fld"><label for="pf-estat">Estat</label><select id="pf-estat" data-pf="estat" ${CANWRITE ? '' : 'disabled'}>${op(PF_ESTATS, d.estat)}</select></div>
   <div class="fld w"><label for="pf-notes">Observacions per a l'empresa</label><textarea id="pf-notes" data-pf="notes" ${dis}>${esc(d.notes || '')}</textarea></div></form>
  <div><b>Línies</b><div class="tw" style="margin-top:6px"><table id="pf-l"><thead><tr><th>Concepte</th><th>Ut</th><th class="num">Quantitat</th><th class="num">Preu</th><th class="num">Import</th><th></th></tr></thead><tbody>
  ${d.linies.map((l, i) => `<tr style="cursor:default" data-pl="${i}"><td><input class="ed txt" data-plk="concepte" value="${esc(l.concepte)}" aria-label="Concepte" ${dis}></td><td style="width:54px"><input class="ed txt" data-plk="ut" value="${esc(l.ut)}" aria-label="Unitat" ${dis}></td><td style="width:84px"><input class="ed" data-col="pq" data-plk="q" inputmode="decimal" value="${esc(typeof l.q === 'string' ? l.q : N3(l.q))}" aria-label="Quantitat" ${dis}></td><td style="width:96px"><input class="ed" data-col="pp" data-plk="preu" inputmode="decimal" value="${esc(typeof l.preu === 'string' ? l.preu : l.preu === '' ? '' : fmtN(l.preu))}" aria-label="Preu" ${dis}></td><td class="num" data-pli></td><td style="width:30px">${bl || d.linies.length < 2 ? '' : `<button class="btn sm" type="button" data-act="pfTreu" data-i="${i}" aria-label="Treu la línia">×</button>`}</td></tr>`).join('')}
  </tbody></table></div>${bl ? '' : '<button class="btn sm" type="button" data-act="pfLinia" style="margin-top:6px">+ Línia</button>'}</div>
  <div class="calc" id="pf-calc"></div>
  ${fs.length ? `<div class="small">Factura vinculada: ${fs.map((f) => esc(f.num) + ' · ' + fmtM(f.base)).join(', ')}</div>` : PF.id && d.estat === 'Enviada' ? '<div class="small">Compta com a provisió de cost fins que arribi la factura i la vinculis a aquesta proforma.</div>' : ''}
  ${cfgEmp().adreca ? '' : '<div class="small" style="color:var(--warn)">Falta l\'adreça fiscal de l\'empresa per al document: entra-la a Control de gestió.</div>'}`;
  const foot = CANWRITE ? `${PF.id ? `<button class="btn danger" data-act="pfDel">Elimina</button>` : ''}<button class="btn" data-act="pfPdf">PDF</button><span class="sp"></span><button class="btn" data-act="close">Cancel·la</button><button class="btn pri" data-act="pfDesa">${PF.id ? 'Desa' : 'Crea la proforma'}</button>` : `<button class="btn" data-act="pfPdf">PDF</button><span class="sp"></span><button class="btn" data-act="close">Tanca</button>`;
  drawer(PF.id ? `Proforma ${d.num}` : 'Nova proforma', body, foot);
  $('#drawerHost .drawer').classList.add('ampla');
  pfCalc();
}
function pfCalc() {
  if (!PF || !$('#pf-calc')) return;
  const t = pfTot(PF.d);
  PF.d.linies.forEach((l, i) => { const c = document.querySelector(`[data-pl="${i}"] [data-pli]`) || document.querySelector(`tr[data-pl="${i}"] td[data-pli]`); if (c) c.textContent = isNaN(nv(l.q) * nv(l.preu)) ? '—' : fmtM(r2(nv(l.q) * nv(l.preu))); });
  $('#pf-calc').innerHTML = `<span>Base imposable</span><b>${fmtM(t.b)}</b><span>${t.isp ? 'IVA (inversió del subjecte passiu)' : 'IVA ' + esc(PF.d.iva)}</span><b>${fmtM(t.iva)}</b>${t.ret ? `<span>Retenció de garantia ${fmtN(nv(PF.d.retencio))}%</span><b>−${fmtM(t.ret)}</b>` : ''}<span style="font-weight:600">Total</span><b>${fmtM(t.total)}</b>`;
}
document.addEventListener('input', (e) => {
  const t = e.target; if (!PF || !t.closest('#drawerHost')) return;
  if (t.dataset.pf) PF.d[t.dataset.pf] = t.value;
  else if (t.dataset.plk) PF.d.linies[+t.closest('tr').dataset.pl][t.dataset.plk] = t.value;
  else return;
  pfCalc();
});
document.addEventListener('change', (e) => {
  const t = e.target; if (!PF || !t.dataset.pf || !t.closest('#drawerHost')) return;
  if (t.dataset.pf === 'comandaId' && t.value) { const c = S.comandes.find((x) => x.id === t.value); Object.assign(PF.d, { proveidor: PF.d.proveidor || c.proveidor, nif: PF.d.nif || c.nif || '', concepte: PF.d.concepte || c.concepte || '' }); pfPinta(); }
  else if (t.dataset.pf === 'obraId') { PF.d.comandaId = ''; pfPinta(); }
  else if (t.dataset.pf === 'estat') pfPinta();
});
async function pfDesa() {
  const d = PF.d, t = pfTot(d);
  if (!String(d.num).trim()) { toast('Falta el número de proforma.'); return false; }
  if (!String(d.proveidor || '').trim()) { toast('Falta l\'empresa.'); return false; }
  if (d.linies.some((l) => isNaN(nv(l.q)) || isNaN(nv(l.preu)) || (l.preu === '' && l.concepte))) { toast('Hi ha quantitats o preus que no són correctes.'); return false; }
  if (d.linies.some((l) => !String(l.concepte).trim() && nv(l.q) * nv(l.preu))) { toast('Hi ha una línia amb import però sense concepte.'); return false; }
  if (!d.linies.some((l) => String(l.concepte).trim())) { toast('Falta alguna línia amb concepte.'); return false; }
  if (S.proformes.some((p) => p.id !== PF.id && p.num === d.num)) { toast('Ja hi ha una proforma amb aquest número.'); return false; }
  if (d.nif && !ObradorLectura.nifValid(d.nif)) { toast('El NIF de l\'empresa no és correcte.'); return false; }
  const net = { ...d, retencio: nv(d.retencio) || 0, linies: d.linies.filter((l) => String(l.concepte).trim() || nv(l.q) * nv(l.preu)).map((l) => ({ concepte: String(l.concepte).trim(), ut: String(l.ut || '').trim(), q: nv(l.q), preu: nv(l.preu) })), base: t.b };
  const id = PF.id || newId('pf'), nova = !PF.id;
  try { await save('proformes', id, net); } catch (e) { return false; }
  logA(`${nova ? 'Nova proforma' : 'Actualitzada la proforma'} ${d.num} · ${d.proveidor} · ${fmtM(t.b)}`);
  PF = { id, d: JSON.parse(JSON.stringify(net)) }; return true;
}
/* ---------- Document ---------- */
async function pfPdf() {
  const J = await jsPdf(), d = PF.d, t = pfTot(d), c = cfgEmp(), o = obra(d.obraId), logo = await capçalera(c.logo), doc = new J({ unit: 'mm', format: 'a4', compress: true }), W = 210, MX = 16, eur = (n) => pdfT(fmtM(n));
  const neg = (b) => doc.setFont('helvetica', b ? 'bold' : 'normal');
  if (logo) { const h = Math.min(20, 34 * logo.height / logo.width); doc.addImage(logo, 'PNG', MX, 14, h * logo.width / logo.height, h); } else { neg(1); doc.setFontSize(13).text(pdfT(c.nom || ''), MX, 22); }
  neg(1); doc.setFontSize(16).text('PROFORMA', W - MX, 22, { align: 'right' }); doc.setFontSize(9); neg(0);
  doc.text(`Núm. ${pdfT(d.num)}`, W - MX, 28, { align: 'right' }); doc.text(`Data ${fmtD(d.data)}`, W - MX, 33, { align: 'right' });
  let y = 48;
  const caixa = (x, tit, ls) => { neg(1); doc.setFontSize(8).setTextColor(90).text(tit, x, y); doc.setTextColor(0); doc.setFontSize(9.5); let yy = y + 5; ls.filter(Boolean).forEach((l, i) => { neg(i === 0); const s = doc.splitTextToSize(pdfT(l), 82); doc.text(s, x, yy); yy += 4.6 * s.length; }); return yy; };
  const y1 = caixa(MX, 'EMPRESA', [d.proveidor, d.nif && 'NIF ' + d.nif]);
  const y2 = caixa(112, 'FACTUREU A', [c.nom, c.nif && 'NIF ' + c.nif, c.adreca]);
  y = Math.max(y1, y2) + 4;
  if (o) { neg(1); doc.setFontSize(9).text('Obra:', MX, y); neg(0); doc.text(pdfT(`${o.codi} · ${o.certTitol || o.nom}`), MX + 14, y, { maxWidth: W - 2 * MX - 14 }); y += 6; }
  if (d.concepte) { neg(1); doc.text('Concepte:', MX, y); neg(0); const s = doc.splitTextToSize(pdfT(d.concepte), W - 2 * MX - 20); doc.text(s, MX + 20, y); y += 5 * s.length + 1; }
  if (!doc.autoTable) { const at = window.jspdf.autoTable || (window.jspdfAutoTable && window.jspdfAutoTable.default) || window.autoTable; doc.autoTable = (q) => at(doc, q); }
  doc.autoTable({ startY: y + 2, theme: 'grid', margin: { left: MX, right: MX, bottom: 20 }, styles: { font: 'helvetica', fontSize: 8.5, textColor: 0, lineColor: [128, 128, 128], lineWidth: 0.15, cellPadding: 1.6 }, headStyles: { fillColor: [217, 217, 217], textColor: 0, halign: 'center' },
    columnStyles: { 1: { halign: 'center', cellWidth: 14 }, 2: { halign: 'right', cellWidth: 24 }, 3: { halign: 'right', cellWidth: 26 }, 4: { halign: 'right', cellWidth: 28 } },
    head: [['CONCEPTE', 'UT', 'QUANTITAT', 'PREU', 'IMPORT']], body: d.linies.filter((l) => String(l.concepte).trim() || nv(l.q) * nv(l.preu)).map((l) => [pdfT(l.concepte), pdfT(l.ut), N3(nv(l.q)), eur(nv(l.preu)), eur(r2(nv(l.q) * nv(l.preu)))]) });
  y = doc.lastAutoTable.finalY + 8; if (y > 235) { doc.addPage(); y = 25; }
  [['Base imposable', t.b, 0], [t.isp ? 'IVA (inversió del subjecte passiu)' : `IVA ${d.iva}`, t.iva, 0], t.ret ? [`Retenció de garantia ${fmtN(nv(d.retencio))}%`, -t.ret, 0] : null, ['TOTAL', t.total, 1]].filter(Boolean).forEach(([l, v, b]) => { neg(b); doc.setFontSize(b ? 10.5 : 9.5).text(pdfT(l), 160, y, { align: 'right' }); doc.text(eur(v), W - MX, y, { align: 'right' }); y += b ? 7 : 5.5; });
  doc.setFontSize(9); y += 4; neg(0);
  const txt = [t.isp ? 'Operació amb inversió del subjecte passiu (art. 84.U.2º.f de la Llei de l\'IVA): la factura no ha de portar IVA repercutit.' : '', d.pagament ? `Forma i termini de pagament: ${d.pagament}.` : '', t.ret ? `Es retindrà un ${fmtN(nv(d.retencio))}% de la base en concepte de garantia.` : '', `Emeteu la factura a nom de ${c.nom || 'la nostra empresa'}${c.nif ? ' (NIF ' + c.nif + ')' : ''} amb aquests imports i indiqueu-hi la referència ${d.num}${o ? ' i l\'obra ' + o.codi : ''}.`, d.notes].filter(Boolean);
  txt.forEach((s) => { const l = doc.splitTextToSize(pdfT(s), W - 2 * MX); if (y + 5 * l.length > 280) { doc.addPage(); y = 25; } doc.text(l, MX, y); y += 5 * l.length + 2; });
  return { blob: doc.output('blob'), nom: `${d.num} ${d.proveidor}.pdf`.replace(/[\\/:*?"<>|]/g, '') };
}
document.addEventListener('click', async (e) => {
  const a = e.target.closest('[data-act]'); if (!a) return; const t = a.dataset.act;
  if (t === 'pfDeCom') { const c = S.comandes.find((x) => x.id === a.dataset.id); closeDrawer(); pfObre('', { comandaId: c.id }); return; }
  if (t === 'saveAdreca') { const { id, ...p } = cfgEmp(); try { await save('config', 'empresa', { ...p, adreca: $('#emp-adr').value.trim(), pagament: $('#emp-pag').value.trim() }); } catch (x) { return; } toast('Dades desades.'); return; }
  if (!PF) return;
  if (t === 'pfLinia') { PF.d.linies.push({ concepte: '', ut: '', q: 1, preu: '' }); pfPinta(); }
  else if (t === 'pfTreu') { PF.d.linies.splice(+a.dataset.i, 1); pfPinta(); }
  else if (t === 'pfDesa') { if (await pfDesa()) { closeDrawer(); PF = null; toast('Proforma desada.'); } }
  else if (t === 'pfPdf') {
    if (CANWRITE && !['Facturada', 'Anul·lada'].includes(PF.d.estat) && !(await pfDesa())) return;
    toast('Preparant el document…');
    let r; try { r = await pfPdf(); } catch (x) { toast('No s\'ha pogut generar el document. Comprova la connexió.'); return; }
    visor(r.nom, async () => r.blob);
    if (ASSETS && CANWRITE && PF.d.obraId) await uploadFiles([new File([r.blob], r.nom, { type: 'application/pdf' })], PF.d.obraId + '|09 Compres i factures');
  } else if (t === 'pfDel') { if (!a.classList.contains('arm')) { a.classList.add('arm'); a.textContent = 'Confirma: elimina'; return; } const n = PF.d.num; try { await remove('proformes', PF.id); } catch (x) { return; } logA(`Eliminada la proforma ${n}`); closeDrawer(); PF = null; toast('Proforma eliminada.'); }
});
/* Dades per facturar */
const _cfgPF = estrConfigHtml;
estrConfigHtml = function () {
  const e = cfgEmp(), st = 'border:1px solid var(--line);background:var(--surface);color:var(--ink);border-radius:5px;padding:7px 10px;font:inherit;min-width:0;max-width:100%';
  return _cfgPF() + `<section class="panel" style="margin-bottom:16px"><h2>Dades per facturar (proformes)</h2><div class="pb" style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end"><label style="display:flex;flex-direction:column;gap:4px;font-size:13px">Adreça fiscal<input id="emp-adr" value="${esc(e.adreca || '')}" ${CANWRITE ? '' : 'disabled'} style="${st};width:360px"></label><label style="display:flex;flex-direction:column;gap:4px;font-size:13px">Pagament habitual<input id="emp-pag" value="${esc(e.pagament || '')}" placeholder="Confirming a 60 dies" ${CANWRITE ? '' : 'disabled'} style="${st};width:220px"></label>${CANWRITE ? '<button class="btn sm" data-act="saveAdreca">Desa</button>' : ''}</div></section>`;
};
const _listPF = listHtml;
listHtml = function (mk, fo) {
  const h = _listPF(mk, fo);
  return mk === 'proformes' ? `<div class="small" style="margin-bottom:8px">Proformes: el que envieu a una empresa perquè us faci la factura. Es crea des d'una comanda (botó «Crea proforma») o des d'aquí.</div>` + h : h;
};
