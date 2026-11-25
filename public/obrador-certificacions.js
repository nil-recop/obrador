/* Certificacions: es preparen amb la producció a origen del mes (editable) i generen el document en PDF i Excel.
   Import de línia = amidament × preu, arrodonit al cèntim. Import de la certificació = origen − certificació anterior. */
(() => {
  M.obres.camps.push({ k: 'certTitol', l: 'Títol de l\'obra a les certificacions — buit: nom', tp: 'text', w: 1 }, { k: 'certClient', l: 'Client de les certificacions — buit: client', tp: 'text' },
    { k: 'certRol', l: 'Hi som com a', tp: 'sel', o: ['Contractista', 'Subcontractista'] }, { k: 'certIva', l: 'IVA de les certificacions', tp: 'sel', o: ['21%', '10%', 'ISP (inversió del subjecte passiu)'] });
  const f = fieldHtml;
  fieldHtml = function (c, v) { return f(c, c.k === 'certRol' && !v ? 'Contractista' : c.k === 'certIva' && !v ? '21%' : v); };
})();
const CDN_ = 'https://cdn.jsdelivr.net/npm/';
let jspdfP = null;
const jsPdf = () => (jspdfP = jspdfP || (async () => {
  for (const [src, integrity] of [[CDN_ + 'jspdf@3.0.1/dist/jspdf.umd.min.js', 'sha384-ytX5osgYad9GPnagB0k+CxKTir/bsE7AfpzvCnQ7owfeWuDd+2l2y0PSIqRK+z/2'], [CDN_ + 'jspdf-autotable@5.0.2/dist/jspdf.plugin.autotable.min.js', 'sha384-voAWf+DQNBx+Eya8tGEw2DHSo8aPM0bTyJhi+ZbLLfV6HzrvPV/UqIvc3+ULj7bS']])
    await new Promise((ok, no) => { const s = document.createElement('script'); Object.assign(s, { src, integrity, crossOrigin: 'anonymous', onload: ok, onerror: () => no(new Error('llibreria')) }); document.head.append(s); });
  return window.jspdf.jsPDF;
})().catch((e) => { jspdfP = null; throw e; }));

/* Import en lletres */
function lletres(n) {
  const U = ['zero', 'un', 'dos', 'tres', 'quatre', 'cinc', 'sis', 'set', 'vuit', 'nou', 'deu', 'onze', 'dotze', 'tretze', 'catorze', 'quinze', 'setze', 'disset', 'divuit', 'dinou'], D = ['', '', 'vint', 'trenta', 'quaranta', 'cinquanta', 'seixanta', 'setanta', 'vuitanta', 'noranta'];
  const f = (x) => {
    if (x < 20) return U[x];
    if (x < 100) return D[Math.floor(x / 10)] + (x % 10 ? (x < 30 ? '-i-' : '-') + U[x % 10] : '');
    if (x < 1000) { const c = Math.floor(x / 100); return (c === 1 ? 'cent' : U[c] + '-cents') + (x % 100 ? ' ' + f(x % 100) : ''); }
    if (x < 1e6) { const m = Math.floor(x / 1000); return (m === 1 ? 'mil' : f(m) + ' mil') + (x % 1000 ? ' ' + f(x % 1000) : ''); }
    const m = Math.floor(x / 1e6); return (m === 1 ? 'un milió' : f(m) + ' milions') + (x % 1e6 ? ' ' + f(x % 1e6) : '');
  };
  const c = Math.round(Math.abs(n) * 100), e = Math.floor(c / 100), s = c % 100;
  return (n < 0 ? 'menys ' : '') + f(e) + (e >= 1e6 && e % 1e6 === 0 ? ' d\'euros' : e === 1 ? ' euro' : ' euros') + (s ? ' amb ' + f(s) + (s === 1 ? ' cèntim' : ' cèntims') : '');
}

/* ---------- Dades ---------- */
const CD = { obra: '', id: '', d: null, brut: false };
const certsDe = (oid) => S.certificacions.filter((c) => c.obraId === oid).sort((a, b) => +a.num - +b.num);
const certAnt = (oid, num, id) => certsDe(oid).filter((c) => c.id !== id && +c.num < +num).pop();
const origenAnt = (oid, num, id) => +(certAnt(oid, num, id) || {}).origen || 0;
const certItems = (oid) => {
  const ord = [...capsObra(oid), ''], k = (x) => [x.mk === 'partides' ? 0 : 1, ord.indexOf(x.p.capitol || ''), x.p.ordre ?? 1e9];
  return prodItems(oid).filter((x) => x.mk === 'partides' || ['Aprovat', 'Executat'].includes(x.p.estat)).sort((a, b) => { const p = k(a), q = k(b); return p[0] - q[0] || p[1] - q[1] || p[2] - q[2] || String(a.p.codi).localeCompare(String(b.p.codi), 'ca', { numeric: true }); });
};
const impL = (q, l) => r2((+q || 0) * (+l.pv || 0));
const nv = (t) => { if (typeof t !== 'string') return +t || 0; const neg = /^\s*-/.test(t), n = t.trim() === '' ? 0 : pnum(t.replace('-', '')); return neg ? -n : n; };
function certTot(d, oid, id) {
  const t = { part: { m: 0, o: 0 }, mod: { m: 0, o: 0 }, mal: false, caps: {} };
  (d.linies || []).forEach((l) => { const o = nv(l.or), a = nv(l.ant); if (isNaN(o) || isNaN(a)) { t.mal = true; return; } const io = impL(o, l), im = r2(io - impL(a, l)), g = t[l.mk === 'modificats' ? 'mod' : 'part']; g.o = r2(g.o + io); g.m = r2(g.m + im); const c = t.caps[l.mk + '|' + l.cap] || (t.caps[l.mk + '|' + l.cap] = { m: 0, o: 0 }); c.o = r2(c.o + io); c.m = r2(c.m + im); });
  t.origen = d.linies ? r2(t.part.o + t.mod.o) : nv(d.origen);
  t.ant = origenAnt(oid, d.num, id); t.mes = r2(t.origen - t.ant);
  t.linMes = r2(t.part.m + t.mod.m);
  t.pct = String(d.iva || '').startsWith('ISP') ? 0 : parseFloat(d.iva) || 0;
  t.iva = r2(t.mes * t.pct / 100); t.total = r2(t.mes + t.iva);
  return t;
}
/* Posa al dia les línies: partides noves, textos i preus actuals, i amidaments que no s'han tocat a mà */
function certOmple(oid, d, id, tot) {
  const prev = certAnt(oid, d.num, id), pl = prev && prev.linies, vells = new Map((d.linies || []).map((l) => [l.id, l]));
  d.linies = certItems(oid).map(({ mk, p }) => {
    const v = vells.get(p.id), pa = pl && pl.find((l) => l.id === p.id);
    const l = { id: p.id, mk, codi: p.codi || '', desc: p.descripcio || '', ut: p.unitat || '', cap: p.capitol || '', am: +p.amidament || 0, pv: +p.preuVenda || 0 };
    l.ant = pl ? (pa ? +pa.or : 0) : v && v.manA ? v.ant : prev ? finsA(p, d.mes, false) : 0;
    l.or = !tot && v && v.man ? v.or : finsA(p, d.mes, true);
    if (!pl && v && v.manA) l.manA = 1;
    if (!tot && v && v.man) l.man = 1;
    return l;
  });
}
const fiMes = (m) => { const d = new Date(+m.slice(0, 4), +m.slice(5), 0); return m + '-' + String(d.getDate()).padStart(2, '0'); };
function certNova(oid) {
  const cs = certsDe(oid), u = cs[cs.length - 1]; let mes = u ? mesMes(String(u.mes || u.data || today()).slice(0, 7), 1) : mesAra();
  if (mes > mesAra()) mes = mesAra();
  const d = { obraId: oid, num: u ? +u.num + 1 : 1, mes, des: mes + '-01', fins: fiMes(mes), data: fiMes(mes), estat: 'Esborrany', iva: (obra(oid) || {}).certIva || '21%', notes: '' };
  certOmple(oid, d, '', true);
  Object.assign(CD, { obra: oid, id: '', d, brut: true });
}
function certObre(id) {
  const { id: _, ...c } = S.certificacions.find((x) => x.id === id), d = JSON.parse(JSON.stringify(c));
  d.mes = d.mes || String(d.data || today()).slice(0, 7); d.des = d.des || d.mes + '-01'; d.fins = d.fins || fiMes(d.mes); d.iva = d.iva || (obra(d.obraId) || {}).certIva || '21%';
  if (d.linies && d.estat === 'Esborrany') certOmple(d.obraId, d, id);
  Object.assign(CD, { obra: d.obraId, id, d, brut: false });
}
const certTanca = () => Object.assign(CD, { obra: '', id: '', d: null, brut: false });

/* ---------- Pantalla ---------- */
const _listCe = listHtml;
listHtml = function (mk, fo) {
  if (mk === 'certificacions' && fo) return CD.d && CD.obra === fo ? certHtml(fo) : certLlista(fo);
  return _listCe(mk, fo);
};
function certLlista(oid) {
  const cs = certsDe(oid), e = econ(oid), tot = e.contracte + e.modAp;
  return `<div class="tools"><span style="flex:1"></span>${CANWRITE ? '<button class="btn pri sm" data-act="ceNova">+ Nova certificació</button>' : ''}</div>` + (cs.length ? `<div class="tw"><table><thead><tr><th>Certificació</th><th>Data</th><th class="num">Certificació mensual</th><th class="num">A origen</th><th class="num">% certificat</th><th class="num">Pendent</th><th>Detall</th><th>Estat</th></tr></thead><tbody>${cs.map((c) => `<tr data-act="edit" data-mk="certificacions" data-id="${esc(c.id)}"><td class="t-main">Certificació ${esc(c.num)}</td><td>${fmtD(c.data)}</td><td class="num">${fmtM(certPer(c))}</td><td class="num">${fmtM(c.origen)}</td><td class="num">${tot ? fmtN((+c.origen || 0) / tot * 100) + '%' : '—'}</td><td class="num">${fmtM(tot - (+c.origen || 0))}</td><td>${c.linies ? 'Per partides' : '<span class="muted">Només import</span>'}</td><td>${pill(c.estat)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty"><b>Encara no hi ha cap certificació</b>Marca la producció del mes i crea la primera.</div>');
}
function certHtml(oid) {
  const d = CD.d, t = certTot(d, oid, CD.id), prev = certAnt(oid, d.num, CD.id), bl = d.estat !== 'Esborrany' || !CANWRITE, dis = bl ? 'disabled' : '', antEd = !bl && prev && !prev.linies;
  const ms = mesosEntre([String((obra(oid) || {}).inici || '').slice(0, 7), d.mes, ...prodItems(oid).flatMap((x) => Object.keys(prodDe(x.p)))].filter((m) => /^\d{4}-\d\d$/.test(m)).sort()[0], [mesAra(), d.mes].sort().pop()).reverse();
  const camp = (k, l, h) => `<div class="fld"><label for="ce-${k}">${l}</label>${h}</div>`, op = (l, v) => l.map((x) => `<option ${x === v ? 'selected' : ''}>${esc(x)}</option>`).join('');
  const taula = (mk, titol) => {
    const ls = (d.linies || []).filter((l) => l.mk === mk); if (!ls.length) return '';
    const caps = [...new Set(ls.map((l) => l.cap))];
    return `<section class="panel" style="margin-bottom:14px"><h2>${titol}</h2><div class="tw" style="border:0"><table class="quad"><thead><tr><th>Codi</th><th>Concepte</th><th>Ut</th><th class="num">Amid. previst</th><th class="num">Preu unitari</th><th class="num">Amid. mes anterior</th><th class="num">Amid. a origen</th><th class="num">% a origen</th><th class="num">Amid. mes</th><th class="num">Cert. mensual</th><th class="num">Cert. a origen</th></tr></thead><tbody>
    ${caps.map((c) => (caps.length > 1 ? `<tr class="cap"><td colspan="8">${esc(c || SENSE_CAP)}</td><td colspan="3" class="num" data-cc="${esc(mk + '|' + c)}"></td></tr>` : '') + ls.filter((l) => l.cap === c).map((l) => `<tr style="cursor:default" data-ce="${esc(l.id)}"><td class="code">${esc(l.codi)}</td><td class="t-main" style="font-weight:400">${esc(l.desc)}</td><td>${esc(l.ut)}</td><td class="num">${N3(l.am)}</td><td class="num">${fmtM(l.pv)}</td>
      <td class="num">${antEd ? `<input class="ed ${l.manA ? 'canvi' : ''}" id="ca-${esc(l.id)}" data-col="ca" data-cin="ant" inputmode="decimal" autocomplete="off" aria-label="Amidament fins al mes anterior" value="${esc(typeof l.ant === 'string' ? l.ant : N3(l.ant))}">` : N3(nv(l.ant))}</td>
      <td><input class="ed ${l.man ? 'canvi' : ''}" id="co-${esc(l.id)}" data-col="co" data-cin="or" inputmode="decimal" autocomplete="off" aria-label="Amidament a origen" value="${esc(typeof l.or === 'string' ? l.or : N3(l.or))}" ${dis}></td>
      <td><input class="ed" id="cp-${esc(l.id)}" data-col="cp" data-cin="pct" inputmode="decimal" autocomplete="off" aria-label="Percentatge a origen" ${l.am ? dis : 'disabled'}></td><td class="num" data-c="mes"></td><td class="num" data-c="im"></td><td class="num" data-c="io"></td></tr>`).join('')).join('')}
    <tr class="cap"><td colspan="9">Total</td><td class="num" data-ct="${mk}m"></td><td class="num" data-ct="${mk}o"></td></tr></tbody></table></div></section>`;
  };
  return `<div class="tools"><button class="btn sm" data-act="ceTorna">← Certificacions</button><b>${CD.id ? `Certificació ${esc(d.num)}` : 'Nova certificació'}</b>${pill(d.estat)}<span style="flex:1"></span>${d.linies ? '<button class="btn sm" data-act="cePdf">PDF</button><button class="btn sm" data-act="ceXls">Excel</button>' : ''}</div>
  <section class="panel" style="margin-bottom:14px"><div class="pb"><div class="fgrid" style="grid-template-columns:repeat(auto-fit,minmax(min(100%,150px),1fr))">
   ${camp('num', 'Núm. certificació', `<input id="ce-num" data-cf="num" type="number" min="1" step="1" value="${esc(d.num)}" ${dis}>`)}
   ${camp('mes', 'Mes de producció', `<select id="ce-mes" data-cf="mes" ${dis}>${ms.map((m) => `<option value="${m}" ${m === d.mes ? 'selected' : ''}>${nomMesC(m)}</option>`).join('')}</select>`)}
   ${camp('des', 'Període: des de', `<input id="ce-des" data-cf="des" type="date" value="${esc(d.des)}" ${dis}>`)}${camp('fins', 'Fins a', `<input id="ce-fins" data-cf="fins" type="date" value="${esc(d.fins)}" ${dis}>`)}
   ${camp('data', 'Data de la certificació', `<input id="ce-data" data-cf="data" type="date" value="${esc(d.data || '')}" ${dis}>`)}
   ${camp('iva', 'IVA', `<select id="ce-iva" data-cf="iva" ${dis}>${op(M.obres.camps.find((f) => f.k === 'certIva').o, d.iva)}</select>`)}
   ${camp('estat', 'Estat', `<select id="ce-estat" data-cf="estat" ${CANWRITE ? '' : 'disabled'}>${op(['Esborrany', 'Presentada', 'Conformada', 'Facturada', 'Cobrada'], d.estat)}</select>`)}
   ${d.linies ? '' : camp('origen', 'Import a origen (€)', `<input id="ce-origen" class="ed" data-col="ceo" data-cf="origen" inputmode="decimal" value="${esc(typeof d.origen === 'string' ? d.origen : fmtN(d.origen))}" ${dis}>`)}
  </div>${d.linies ? (bl ? (CANWRITE ? '<div class="small" style="margin-top:8px">Aquesta certificació ja no és un esborrany: els amidaments queden fixats. Per canviar-los, torna-la a Esborrany.</div>' : '') : `<div class="small" style="margin-top:8px">Els amidaments surten de Producció de ${esc(nomMesC(d.mes).toLowerCase())}; els que canviïs aquí queden marcats i no toquen la producció. <button class="btn sm" data-act="ceRefa">Torna a agafar tota la producció</button></div>`) : `<div class="small" style="margin-top:8px">Aquesta certificació només té l'import.${bl ? '' : ' <button class="btn sm" data-act="ceDetall">Genera el detall per partides</button>'}</div>`}</div></section>
  <div id="ce-av"></div>${taula('partides', 'Partides')}${taula('modificats', 'Partides contradictòries')}
  <section class="panel"><h2>Resum</h2><div class="econ-g"><table><tbody>${[['Certificat a origen actual', 'to'], ['Certificat a origen anterior', 'ta'], ['Certificació mensual', 'tm'], ['IVA', 'ti'], ['Total a facturar', 'tt']].map(([l, k]) => `<tr style="cursor:default"><td${['tm', 'tt'].includes(k) ? ' style="font-weight:600"' : ''} data-cl="${k}">${l}</td><td class="num" data-cr="${k}"></td></tr>`).join('')}</tbody></table></div></section>
  <div class="barra"><span id="ce-st" class="small"></span><span class="sp"></span>${CANWRITE ? `${CD.id ? '<button class="btn danger" data-act="ceDel">Elimina</button>' : ''}<button class="btn" data-act="ceTorna">Tanca</button><button class="btn pri" data-act="ceDesa">Desa la certificació</button>` : ''}</div>`;
}
function certPinta(menys) {
  if (!CD.d || !$('#ce-st')) return;
  const d = CD.d, t = certTot(d, CD.obra, CD.id), prev = certAnt(CD.obra, d.num, CD.id);
  (d.linies || []).forEach((l) => {
    const r = document.querySelector(`tr[data-ce="${CSS.escape(l.id)}"]`); if (!r) return;
    const o = nv(l.or), a = nv(l.ant), mal = isNaN(o) || isNaN(a), p = r.querySelector('[data-cin=pct]'), q = r.querySelector('[data-cin=or]');
    q.classList.toggle('mal', isNaN(o)); q.classList.toggle('canvi', !!l.man);
    if (p !== menys) p.value = l.am && !isNaN(o) ? fmtN(o / l.am * 100) : '';
    if (menys && menys.dataset.cin === 'pct' && menys.closest('tr') === r && !isNaN(o)) q.value = N3(o);
    const set = (k, v) => { r.querySelector(`[data-c=${k}]`).textContent = mal ? '—' : v; };
    set('mes', N3(o - a)); set('im', fmtM(impL(o, l) - impL(a, l))); set('io', fmtM(impL(o, l)));
  });
  for (const [mk, g] of [['partides', t.part], ['modificats', t.mod]]) for (const k of ['m', 'o']) { const c = document.querySelector(`[data-ct="${mk}${k}"]`); if (c) c.textContent = fmtM(g[k]); }
  document.querySelectorAll('[data-cc]').forEach((c) => { const g = t.caps[c.dataset.cc] || { m: 0, o: 0 }; c.textContent = `${fmtM(g.m)} · ${fmtM(g.o)}`; });
  const cr = { to: t.origen, ta: t.ant, tm: t.mes, ti: t.iva, tt: t.total }; Object.keys(cr).forEach((k) => { document.querySelector(`[data-cr=${k}]`).textContent = fmtM(cr[k]); });
  document.querySelector('[data-cl=ti]').textContent = String(d.iva).startsWith('ISP') ? 'IVA (inversió del subjecte passiu)' : `IVA ${d.iva}`;
  const av = [];
  if (certsDe(CD.obra).some((c) => c.id !== CD.id && +c.num === +d.num)) av.push('Ja hi ha una certificació amb aquest número.');
  if (d.linies && Math.abs(t.linMes - t.mes) > 0.005) av.push(`Les línies del mes sumen ${fmtM(t.linMes)}, però la diferència amb la certificació anterior és ${fmtM(t.mes)}. ${prev && !prev.linies ? 'La certificació anterior no té detall: entra a «Amid. mes anterior» el que ja s\'havia certificat.' : 'Pot ser un arrodoniment o un preu canviat.'}`);
  if (t.mes < 0) av.push('La certificació mensual és negativa.');
  $('#ce-av').innerHTML = av.length ? `<div class="banner"><p>${av.map(esc).join('<br>')}</p></div>` : '';
  $('#ce-st').textContent = CD.brut ? 'Canvis sense desar' : 'Tot desat';
  const b = document.querySelector('[data-act=ceDesa]'); if (b) b.disabled = !CD.brut;
}
const _paintCe = paint;
paint = function () { _paintCe(); certPinta(); };
const _openCe = openForm;
openForm = function (mk, id, def) {
  if (mk !== 'certificacions') return _openCe(mk, id, def);
  if (CD.brut) { toast('Desa o tanca la certificació oberta abans.'); return; }
  const oid = id ? S.certificacions.find((c) => c.id === id).obraId : (def || {}).obraId;
  if (!oid || !obra(oid)) { drawer('Nova certificació', `<div class="fld"><label for="ce-ob">Obra</label><select id="ce-ob">${obraOpts('', '— Tria una obra —')}</select></div>`, '<span class="sp"></span><button class="btn" data-act="close">Cancel·la</button>'); return; }
  closeDrawer(); if (id) certObre(id); else certNova(oid);
  V.obraTab = 'certificacions';
  if (location.hash !== '#obra-' + oid) location.hash = 'obra-' + oid; else paint();
};
async function certDesa() {
  const d = CD.d, t = certTot(d, CD.obra, CD.id);
  if (t.mal || isNaN(t.origen)) { toast('Hi ha amidaments que no són correctes, marcats en vermell.'); return false; }
  if (!(+d.num > 0)) { toast('Falta el número de certificació.'); return false; }
  if (certsDe(CD.obra).some((c) => c.id !== CD.id && +c.num === +d.num)) { toast('Ja hi ha una certificació amb aquest número.'); return false; }
  const net = { ...d, num: +d.num, origen: t.origen }; if (d.linies) net.linies = d.linies.map((l) => ({ ...l, or: nv(l.or), ant: nv(l.ant) }));
  const id = CD.id || newId('ce'), nova = !CD.id;
  try { await save('certificacions', id, net); } catch (e) { return false; }
  logA(`${nova ? 'Nova certificació' : 'Actualitzada la certificació'} ${d.num} de ${obraTxt(CD.obra)} · ${d.estat}`);
  CD.id = id; CD.d = net; CD.brut = false; toast('Certificació desada.'); paint(); return true;
}
/* ---------- Document ---------- */
function certDades() {
  const d = CD.d, oid = CD.obra, o = obra(oid), e = econ(oid), c = cfgEmp(), t = certTot(d, oid, CD.id), total = r2(e.contracte + e.modAp);
  const hist = [...certsDe(oid).filter((x) => x.id !== CD.id && +x.num < +d.num).map((x) => ({ num: +x.num, o: +x.origen || 0 })), { num: +d.num, o: t.origen }];
  let a = 0; hist.forEach((h) => { h.m = r2(h.o - a); a = h.o; });
  const dt = new Date((d.data || d.fins) + 'T12:00:00'), llarg = dt.toLocaleDateString('ca-ES', { day: 'numeric', month: 'long', year: 'numeric' }).replace(/ del (\d{4})/, ' de $1');
  return { d, o, t, total, e, c, hist, titol: (o.certTitol || o.nom || '').toUpperCase(), client: o.certClient || o.client || '', rol: o.certRol || 'Contractista', per: `${fmtD(d.des)} - ${fmtD(d.fins)}`, signa: `${c.lloc ? c.lloc + ', ' : ''}${llarg}`, isp: String(d.iva).startsWith('ISP'),
    lletra: lletres(t.total).toUpperCase(), nom: `${o.codi} CERT ${String(d.num).padStart(2, '0')} ${nomMesC(d.mes).toUpperCase().replace(/ DEL? /, ' ')}` };
}
/* La lletra estàndard del PDF no té tots els signes */
const pdfT = (s) => String(s == null ? '' : s).replace(/[›»]/g, '>').replace(/[−–—]/g, '-').replace(/[’‘`´]/g, "'").replace(/[“”]/g, '"').replace(/…/g, '...').replace(/ŀl/g, 'l·l').replace(/[  ]/g, ' ').replace(/³/g, '³').replace(/[^\x09\x0a\x20-\x7e¡-ÿ€•]/g, '');
const capçalera = async (src) => (src ? new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = src; }) : null);
async function certPdf() {
  const J = await jsPdf(), x = certDades(), logo = await capçalera(x.c.logo), doc = new J({ unit: 'mm', format: 'a4', compress: true }), W = 210, MX = 13, eur = (n) => pdfT(fmtM(n));
  const cap = (t) => {
    if (logo) { const h = Math.min(20, 34 * logo.height / logo.width); doc.addImage(logo, 'PNG', MX + 4, 14, h * logo.width / logo.height, h); }
    else { doc.setFont('helvetica', 'bold').setFontSize(13).text(pdfT(x.c.nom || ''), MX, 20, { maxWidth: 80 }); }
    doc.setFont('helvetica', 'bold').setFontSize(10); const l = doc.splitTextToSize(pdfT(x.titol), 92); doc.text(l, W - MX, 18, { align: 'right', lineHeightFactor: 1.3 });
    const y = 18 + l.length * 4.8 + 2; doc.setFontSize(9).text(pdfT(x.client.toUpperCase()), W - MX, y, { align: 'right', maxWidth: 92 });
    if (t) { doc.setFontSize(9).text(`CERTIFICACIÓ ${x.d.num}`, MX, 42); doc.text(`PERÍODE ${x.per}`, MX, 47); }
  };
  const GR = [128, 128, 128], num = { halign: 'right' }, head = ['AMID.\nPREVIST', 'CONCEPTE', 'UT', 'PREU\nUNITARI', 'AMID. A\nORIGEN', '% EXEC.\nA ORIGEN', 'AMID. MES\nANTERIOR', 'AMID.\nMES', 'CERT.\nMENSUAL', 'CERT. A\nORIGEN'];
  const opc = (fons) => ({ theme: 'grid', margin: { left: MX, right: MX, top: 51, bottom: 16 }, styles: { font: 'helvetica', fontSize: 6.3, cellPadding: 0.8, lineColor: GR, lineWidth: 0.15, textColor: 0, valign: 'middle', overflow: 'linebreak' }, headStyles: { fillColor: fons, textColor: 0, fontStyle: 'bold', halign: 'center' }, rowPageBreak: 'avoid', didDrawPage: () => cap(true),
    columnStyles: { 0: { cellWidth: 16, ...num }, 1: { cellWidth: 'auto' }, 2: { cellWidth: 8, halign: 'center' }, 3: { cellWidth: 17, ...num }, 4: { cellWidth: 16, ...num }, 5: { cellWidth: 14, ...num }, 6: { cellWidth: 16, ...num }, 7: { cellWidth: 15, ...num }, 8: { cellWidth: 19, ...num }, 9: { cellWidth: 20, ...num } } });
  let y = 51;
  const taula = (mk, g, tit, rot, fons) => {
    const ls = x.d.linies.filter((l) => l.mk === mk); if (!ls.length) return;
    if (tit) { if (y > 255) { doc.addPage(); y = 51; } doc.setFont('helvetica', 'bold').setFontSize(8).text(tit, MX, y + 4); y += 6; }
    const caps = [...new Set(ls.map((l) => l.cap))], cos = [];
    caps.forEach((c) => {
      if (caps.length > 1) cos.push([{ content: pdfT(c || 'SENSE CAPÍTOL'), colSpan: 10, styles: { fontStyle: 'bold', halign: 'left', fillColor: [242, 242, 242] } }]);
      ls.filter((l) => l.cap === c).forEach((l) => { const o = nv(l.or), a = nv(l.ant), io = impL(o, l); cos.push([N3(l.am), pdfT((l.codi ? l.codi + '  ' : '') + l.desc), pdfT(l.ut), eur(l.pv), N3(o), l.am ? fmtN(o / l.am * 100) + '%' : '', N3(a), N3(o - a), eur(io - impL(a, l)), eur(io)]); });
      if (caps.length > 1) { const s = x.t.caps[mk + '|' + c]; cos.push([{ content: 'Total capítol', colSpan: 8, styles: { halign: 'right' } }, eur(s.m), eur(s.o)]); }
    });
    cos.push([{ content: rot, colSpan: 8, styles: { fontStyle: 'bold', halign: 'center', fillColor: fons } }, { content: eur(g.m), styles: { fontStyle: 'bold', fillColor: fons } }, { content: eur(g.o), styles: { fontStyle: 'bold', fillColor: fons } }]);
    doc.autoTable({ ...opc(fons), startY: y, head: [head], body: cos }); y = doc.lastAutoTable.finalY + 2;
  };
  if (!doc.autoTable) { const at = window.jspdf.autoTable || (window.jspdfAutoTable && window.jspdfAutoTable.default) || window.autoTable; doc.autoTable = (q) => at(doc, q); }
  taula('partides', x.t.part, '', 'TOTAL', [217, 217, 217]); taula('modificats', x.t.mod, 'PREUS CONTRADICTORIS', 'TOTAL SOBRE PREUS CONTRADICTORIS', [238, 236, 225]);
  if (y > 240) { doc.addPage(); cap(true); y = 51; }
  const res = [['IMPORT ACUMULAT CERTIFICACIÓ ACTUAL', x.t.origen], ['IMPORT ACUMULAT CERTIFICACIÓ ANTERIOR', x.t.ant], ['IMPORT DE CERTIFICACIÓ MENSUAL', x.t.mes], [x.isp ? 'IVA (INVERSIÓ DEL SUBJECTE PASSIU)' : `${x.d.iva.replace('%', ' %')} IVA`, x.t.iva], ['IMPORT A FACTURAR', x.t.total]];
  doc.setFontSize(8); y += 5; res.forEach(([l, v], i) => { doc.setFont('helvetica', i === 2 || i === 4 ? 'bold' : 'normal'); doc.text(l, W - MX - 32, y, { align: 'right' }); doc.text(eur(v), W - MX, y, { align: 'right' }); y += 5; });
  /* Certificat */
  doc.addPage(); cap(false); y = 50; const neg = (b) => doc.setFont('helvetica', b ? 'bold' : 'normal');
  doc.setFontSize(10.5); neg(1); doc.text('CERTIFICACIÓ D\'OBRA', MX + 4, y); doc.line(MX + 4, y + 1, MX + 4 + doc.getTextWidth('CERTIFICACIÓ D\'OBRA'), y + 1); y += 10; doc.setFontSize(9);
  [['Núm. de certificació:', String(x.d.num)], ['Període de certificació:', x.per], null, ['Definició de l\'obra:', x.titol], [x.rol + ':', x.c.nom || ''], ['NIF:', x.c.nif || '']].forEach((f) => { if (!f) { y += 4; return; } neg(1); doc.text(f[0], MX + 4, y); neg(0); const l = doc.splitTextToSize(pdfT(f[1]), 134); doc.text(l, MX + 46, y); y += 5 * l.length; });
  y += 4; [['Import pressupost adjudicació abans IVA:', x.e.contracte], ['Import treballs complementaris acceptats:', x.e.modAp], ['TOTAL:', x.total]].forEach(([l, v], i) => { neg(1); doc.text(l, MX + 4, y); neg(i === 2); doc.text(eur(v), MX + 98, y, { align: 'right' }); y += 5; });
  doc.autoTable({ startY: y + 3, theme: 'grid', margin: { left: 25, right: 25, top: 45 }, styles: { font: 'helvetica', fontSize: 8.5, textColor: 0, lineColor: 0, lineWidth: 0.15, cellPadding: 1.8, halign: 'right' }, headStyles: { fillColor: [217, 217, 217], textColor: 0, halign: 'center' }, columnStyles: { 0: { halign: 'left' }, 3: { halign: 'center' } }, didDrawPage: () => cap(false),
    head: [['', 'CERTIFICACIÓ\nMENSUAL', 'TOTAL CERTIFICAT\nA ORIGEN', '% CERTIFICAT', 'PENDENT']], body: x.hist.map((h) => [`CERTIFICACIÓ ${h.num}`, eur(h.m), eur(h.o), x.total ? fmtN(h.o / x.total * 100) + '%' : '', eur(x.total - h.o)]) });
  y = doc.lastAutoTable.finalY + 10; if (y > 205) { doc.addPage(); cap(false); y = 55; } doc.setFontSize(9);
  [['Total certificat abans IVA', x.t.mes, 1], [x.isp ? 'IVA (inversió del subjecte passiu)' : `IVA ${x.d.iva}`, x.t.iva, 0], ['Total a facturar' + (x.isp ? '' : ' IVA inclòs'), x.t.total, 1]].forEach(([l, v, b], i) => { if (i === 2) y += 3; neg(b); doc.text(l, 140, y, { align: 'right' }); doc.text(eur(v), 170, y, { align: 'right' }); y += 5; });
  y += 6; neg(0); doc.text('La Direcció Facultativa:', MX + 4, y); y += 5; const l = doc.splitTextToSize(`CERTIFICA que l'import de les obres executades ascendeix a la quantitat de ${pdfT(x.lletra)}${x.isp ? '' : ' (IVA inclòs)'}`, 175); doc.text(l, MX + 4, y); y += 5 * l.length + 6;
  doc.text(pdfT(x.signa), MX + 4, y); y += 14; neg(1); doc.text('EL CLIENT', 55, y, { align: 'center' }); doc.text('EL CONTRACTISTA', 150, y, { align: 'center' }); neg(0); doc.text(pdfT(x.client), 55, y + 5, { align: 'center', maxWidth: 75 }); doc.text(pdfT(x.c.nom || ''), 150, y + 5, { align: 'center', maxWidth: 80 });
  const n = doc.getNumberOfPages(); for (let i = 1; i <= n; i++) { doc.setPage(i); neg(0); doc.setFontSize(7).setTextColor(110).text(`${i} / ${n}`, W - MX, 290, { align: 'right' }); doc.setTextColor(0); }
  return { blob: doc.output('blob'), nom: x.nom + '.pdf', pag: n };
}
async function certXls() {
  const X = await ObradorLectura.xlsx(), x = certDades(), E = '#,##0.00 "€"', Q = '#,##0.000', P = '0.00%';
  const num = (v, z, f) => ({ t: 'n', v: +v || 0, z, ...(f ? { f } : {}) }), A = [], S2 = [];
  A.push([x.titol], [x.client], [], [`CERTIFICACIÓ ${x.d.num}`], [`PERÍODE ${x.per}`], []);
  const tots = {};
  const taula = (mk, tit, rot) => {
    const ls = x.d.linies.filter((l) => l.mk === mk); if (!ls.length) return;
    if (tit) A.push([tit]);
    A.push(['CODI', 'AMID. PREVIST', 'CONCEPTE', 'UT', 'PREU UNITARI', 'AMID. A ORIGEN', '% EXECUTAT A ORIGEN', 'AMID. MES ANTERIOR', 'AMID. MES', 'CERT. MENSUAL', 'CERT. A ORIGEN']);
    const ini = A.length + 1, caps = [...new Set(ls.map((l) => l.cap))];
    caps.forEach((c) => { if (caps.length > 1) A.push(['', '', c || SENSE_CAP]); ls.filter((l) => l.cap === c).forEach((l) => { const r = A.length + 1, o = nv(l.or), a = nv(l.ant), io = impL(o, l), ia = impL(a, l); A.push([l.codi, num(l.am, Q), l.desc, l.ut, num(l.pv, E), num(o, Q), num(l.am ? o / l.am : 0, P, `IF(B${r}=0,0,F${r}/B${r})`), num(a, Q), num(o - a, Q, `F${r}-H${r}`), num(r2(io - ia), E, `K${r}-ROUND(H${r}*E${r},2)`), num(io, E, `ROUND(F${r}*E${r},2)`)]); }); });
    const fi = A.length, g = mk === 'partides' ? x.t.part : x.t.mod; A.push(['', '', rot, '', '', '', '', '', '', num(g.m, E, `SUM(J${ini}:J${fi})`), num(g.o, E, `SUM(K${ini}:K${fi})`)]); tots[mk] = A.length; A.push([]);
  };
  taula('partides', '', 'TOTAL'); taula('modificats', 'PREUS CONTRADICTORIS', 'TOTAL SOBRE PREUS CONTRADICTORIS');
  const r0 = A.length + 1, b = (l, v, f) => A.push(['', '', '', '', '', '', '', '', '', l, num(v, E, f)]);
  b('ACUMULAT ACTUAL', x.t.origen, Object.values(tots).map((r) => 'K' + r).join('+')); b('ACUMULAT ANTERIOR', x.t.ant); b('CERTIFICACIÓ MENSUAL', x.t.mes, `K${r0}-K${r0 + 1}`); b(x.isp ? 'IVA (ISP)' : `IVA ${x.d.iva}`, x.t.iva, `ROUND(K${r0 + 2}*${x.t.pct}/100,2)`); b('A FACTURAR', x.t.total, `K${r0 + 2}+K${r0 + 3}`);
  S2.push(['CERTIFICACIÓ D\'OBRA'], [], ['Núm. de certificació', x.d.num], ['Període', x.per], ['Definició de l\'obra', x.titol], ['Client', x.client], [x.rol, x.c.nom || ''], ['NIF', x.c.nif || ''], [], ['Import pressupost adjudicació abans IVA', num(x.e.contracte, E)], ['Import treballs complementaris acceptats', num(x.e.modAp, E)], ['TOTAL', num(x.total, E, 'B10+B11')], [], ['', 'CERTIFICACIÓ MENSUAL', 'TOTAL A ORIGEN', '% CERTIFICAT', 'PENDENT']);
  x.hist.forEach((h) => { const r = S2.length + 1; S2.push([`CERTIFICACIÓ ${h.num}`, num(h.m, E, r === 15 ? `C${r}` : `C${r}-C${r - 1}`), num(h.o, E), num(x.total ? h.o / x.total : 0, P, `IF($B$12=0,0,C${r}/$B$12)`), num(x.total - h.o, E, `$B$12-C${r}`)]); });
  S2.push([], ['Total certificat abans IVA', num(x.t.mes, E)], [x.isp ? 'IVA (inversió del subjecte passiu)' : `IVA ${x.d.iva}`, num(x.t.iva, E)], ['Total a facturar', num(x.t.total, E)], [], [`CERTIFICA que l'import de les obres executades ascendeix a la quantitat de ${x.lletra}${x.isp ? '' : ' (IVA inclòs)'}`], [x.signa]);
  const wb = X.utils.book_new(), w1 = X.utils.aoa_to_sheet(A), w2 = X.utils.aoa_to_sheet(S2);
  w1['!cols'] = [8, 12, 60, 6, 13, 12, 12, 12, 12, 22, 15].map((wch) => ({ wch })); w2['!cols'] = [42, 24, 20, 14, 18].map((wch) => ({ wch }));
  X.utils.book_append_sheet(wb, w1, 'Relació'); X.utils.book_append_sheet(wb, w2, 'Certificat');
  return { blob: new Blob([X.write(wb, { type: 'array', bookType: 'xlsx' })], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), nom: x.nom + '.xlsx' };
}
function baixaBlob(b, nom) { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = nom; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 10000); }
async function certDocument(tipus) {
  if (CD.brut && !(CANWRITE && await certDesa())) { if (CANWRITE) return; }
  toast('Preparant el document…');
  let r; try { r = await (tipus === 'pdf' ? certPdf() : certXls()); } catch (e) { toast('No s\'ha pogut generar el document. Comprova la connexió.'); return; }
  if (tipus !== 'pdf') { baixaBlob(r.blob, r.nom); toast('Excel descarregat.'); return; }
  visor(r.nom, async () => r.blob);
  if (ASSETS && CANWRITE) await uploadFiles([new File([r.blob], r.nom, { type: 'application/pdf' })], CD.obra + '|03 Certificacions');
}
/* ---------- Accions ---------- */
document.addEventListener('input', (e) => {
  const t = e.target; if (!CD.d) return;
  if (t.dataset.cin) {
    const l = CD.d.linies.find((x) => x.id === t.closest('tr').dataset.ce);
    if (t.dataset.cin === 'pct') { const n = nv(t.value); l.or = isNaN(n) ? t.value : Math.round(n * l.am * 10) / 1000; l.man = 1; }
    else if (t.dataset.cin === 'or') { l.or = t.value; l.man = 1; } else { l.ant = t.value; l.manA = 1; }
    CD.brut = true; certPinta(t);
  } else if (t.dataset.cf && ['num', 'origen'].includes(t.dataset.cf)) { CD.d[t.dataset.cf] = t.value; CD.brut = true; certPinta(t); }
});
document.addEventListener('change', (e) => {
  const t = e.target;
  if (t.id === 'ce-ob' && t.value) { openForm('certificacions', null, { obraId: t.value }); return; }
  if (!CD.d) return;
  if (t.dataset.cin && t.dataset.cin !== 'pct') { const n = nv(t.value); if (!isNaN(n)) { const l = CD.d.linies.find((x) => x.id === t.closest('tr').dataset.ce); l[t.dataset.cin] = n; t.value = N3(n); certPinta(t); } }
  else if (t.dataset.cf) {
    const k = t.dataset.cf, d = CD.d; d[k] = t.value; CD.brut = true;
    if (k === 'mes') { d.des = d.mes + '-01'; d.fins = d.data = fiMes(d.mes); }
    if ((k === 'mes' || k === 'num') && d.linies && d.estat === 'Esborrany') certOmple(CD.obra, d, CD.id);
    if (k === 'estat' && d.estat === 'Esborrany' && d.linies) certOmple(CD.obra, d, CD.id);
    setTimeout(paint, 0);
  }
});
document.addEventListener('click', async (e) => {
  const a = e.target.closest('[data-act]'); if (!a) return; const t = a.dataset.act;
  if (t === 'ceNova') { certNova(qObra()); paint(); return; }
  if (!CD.d) return;
  if (t === 'ceTorna') { if (CD.brut && !a.classList.contains('arm')) { a.classList.add('arm'); a.textContent = 'Surt sense desar'; return; } certTanca(); paint(); }
  else if (t === 'ceDesa') certDesa();
  else if (t === 'ceRefa') { certOmple(CD.obra, CD.d, CD.id, true); CD.brut = true; paint(); }
  else if (t === 'ceDetall') { certOmple(CD.obra, CD.d, CD.id, true); CD.brut = true; paint(); }
  else if (t === 'cePdf') certDocument('pdf'); else if (t === 'ceXls') certDocument('xls');
  else if (t === 'ceDel') { if (!a.classList.contains('arm')) { a.classList.add('arm'); a.textContent = 'Confirma: elimina'; return; } const n = CD.d.num, o = CD.obra; try { await remove('certificacions', CD.id); } catch (x) { return; } logA(`Eliminada la certificació ${n} de ${obraTxt(o)}`); certTanca(); toast('Certificació eliminada.'); paint(); }
});
window.addEventListener('hashchange', () => { if (CD.d && !CD.brut && qObra() !== CD.obra) certTanca(); });
window.addEventListener('beforeunload', (e) => { if (CD.brut) e.preventDefault(); });

/* Logotip i lloc de signatura */
const _cfgCe = estrConfigHtml;
estrConfigHtml = function () {
  const e = cfgEmp();
  return _cfgCe() + `<section class="panel" style="margin-bottom:16px"><h2>Document de certificació</h2><div class="pb" style="display:flex;gap:14px;flex-wrap:wrap;align-items:flex-end">${e.logo ? `<img src="${esc(e.logo)}" alt="Logotip" style="max-height:54px;max-width:170px;background:#fff;padding:4px;border-radius:4px">` : '<span class="small">Sense logotip.</span>'}${CANWRITE ? '<label class="btn sm" for="emp-logo">Puja el logotip</label><input type="file" id="emp-logo" accept="image/png,image/jpeg" hidden>' : ''}<label style="display:flex;flex-direction:column;gap:4px;font-size:13px">Lloc de signatura<input id="emp-lloc" value="${esc(e.lloc || '')}" ${CANWRITE ? '' : 'disabled'} style="border:1px solid var(--line);background:var(--surface);color:var(--ink);border-radius:5px;padding:7px 10px;font:inherit"></label>${CANWRITE ? '<button class="btn sm" data-act="saveLloc">Desa</button>' : ''}</div></section>`;
};
async function desaEmp(x, m) { const { id, ...p } = cfgEmp(); try { await save('config', 'empresa', { ...p, ...x }); } catch (e) { return; } toast(m); paint(); }
document.addEventListener('click', (e) => { if (e.target.closest('[data-act="saveLloc"]')) desaEmp({ lloc: $('#emp-lloc').value.trim() }, 'Lloc desat.'); });
document.addEventListener('change', async (e) => {
  if (e.target.id !== 'emp-logo' || !e.target.files[0]) return;
  const u = URL.createObjectURL(e.target.files[0]), i = await capçalera(u); URL.revokeObjectURL(u);
  if (!i) { toast('No s\'ha pogut llegir la imatge.'); return; }
  const c = document.createElement('canvas'), k = Math.min(1, 560 / i.width); c.width = Math.round(i.width * k); c.height = Math.round(i.height * k);
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(i, 0, 0, c.width, c.height);
  const d = c.toDataURL('image/png'); if (d.length > 400000) { toast('La imatge és massa gran. Prova amb un logotip més petit.'); return; }
  desaEmp({ logo: d }, 'Logotip desat.');
});
