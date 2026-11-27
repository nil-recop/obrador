/* Comparatius de compres per partida (model «Comparatiu de compres»).
   Cada comparatiu: les partides de l'obra que es contracten, una columna per proveïdor amb preu i import,
   PEC + baixa (preu de venda de la partida) i cost objectiu (cost previst de la partida).
   Total del comparatiu = subtotal + ajudes / altres conceptes (no van al contracte). Millora = 1 − (total + financers) ÷ cost objectiu.
   K adjudicat = PEC ÷ total adjudicat. K planificat = cost objectiu ÷ total adjudicat. Coeficient = PEC ÷ cost objectiu.
   Import adjudicat (el de la comanda) = subtotal del proveïdor, sense les ajudes. */
const CP_ESTATS = ['En curs', 'Adjudicat', 'Anul·lat'];
TONE['Anul·lat'] = 'bad';
M.ofertes = { t: 'Comparatius', s: 'comparatiu', pref: 'CMP', tit: 'nom', camps: [{ k: 'num', l: 'Núm.', tp: 'code', req: 1 }, { k: 'nom', l: 'Activitat', tp: 'text', req: 1 }, { k: 'obraId', l: 'Obra', tp: 'obra', req: 1 }], cols: [] };
(() => {
  NAV.forEach((g) => g.items.forEach((i) => { if (i[0] === 'ofertes') i[1] = 'Comparatius'; }));
  const s = document.createElement('style');
  s.textContent = `.cpt{table-layout:auto}.cpt td,.cpt th{padding:4px 5px;vertical-align:top}.cpt .ed{min-width:0;width:100%}.cpt td.best{background:color-mix(in srgb,var(--ok) 16%,transparent)}.cpt td.falta{background:color-mix(in srgb,var(--warn) 12%,transparent)}.cpt .l2{display:block;font-size:11.5px;color:var(--muted);text-align:right;white-space:nowrap}.cpt .desc{font-size:12.5px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}.cpt tr.tot td{font-weight:600;border-top:1px solid var(--line)}.cpt tr.sec td{background:var(--bg);font-weight:600;font-size:12px}.cpt th.pv{min-width:92px}.cpt input[data-cpl=am],.cpt input[data-cpa=am]{min-width:80px}.cpt input[data-cpl=ut],.cpt input[data-cpa=ut]{min-width:42px}.cpt input[data-cpl=codi]{min-width:70px}textarea[data-cp=comentaris]{min-height:38px;height:38px}.cpcards{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,270px),1fr));gap:10px}.cpcard{border:1px solid var(--line);border-radius:6px;padding:10px;display:flex;flex-direction:column;gap:6px}.cpcard.adj{border-color:var(--ok);box-shadow:0 0 0 1px var(--ok)}.cpcard label{display:flex;flex-direction:column;gap:2px;font-size:12px;color:var(--muted)}.cpcard .duo{display:grid;grid-template-columns:1fr 1fr;gap:6px}.cpsel tr.cap td{font-weight:600;background:var(--bg)}`;
  document.head.append(s);
})();

/* ---------- Càlculs ---------- */
const cpVal = (raw, preus) => {
  if (typeof raw === 'number') return { n: raw };
  if (raw == null || String(raw).trim() === '') return { buit: 1, n: null };
  const s = String(raw).replace(/€/g, '').trim();
  if (/^[=\d+\-.,\s(]/.test(s)) { const n = evalua(s, preus); return isNaN(n) ? { mal: 1, n: null } : { n }; }
  return { t: String(raw).trim(), n: null }; // «inclòs», «no inclòs»…
};
function cpCalc(d) {
  const L = d.linies || [], A = d.ajudes || [], P = d.prov || [];
  const r = { l: {}, a: {}, p: {}, pem: 0, obj: 0, mal: 0, falten: 0 };
  L.forEach((l) => { const am = evalua(l.am), pe = cpVal(l.pem), ob = cpVal(l.obj); if (isNaN(am) || pe.mal || ob.mal) r.mal++;
    const x = { am: isNaN(am) ? 0 : am, pem: r2((isNaN(am) ? 0 : am) * (pe.n || 0)), obj: r2((isNaN(am) ? 0 : am) * (ob.n || 0)), imp: {}, best: null };
    r.pem = r2(r.pem + x.pem); r.obj = r2(r.obj + x.obj); r.l[l.id] = x; });
  P.forEach((p) => {
    const t = { sub: 0, aj: 0, falten: 0 };
    L.forEach((l) => { const v = cpVal((p.pr || {})[l.id]); if (v.mal) r.mal++; if (v.buit) t.falten++; const i = v.n == null ? null : r2(r.l[l.id].am * v.n); r.l[l.id].imp[p.id] = { v, i }; if (i != null) t.sub = r2(t.sub + i); });
    A.forEach((a) => { const am = evalua(a.am), v = cpVal((p.ajv || {})[a.id], [{ codi: 'SUBTOTAL', preu: t.sub }]); if (v.mal || isNaN(am)) r.mal++; const i = v.n == null || isNaN(am) ? null : r2(am * v.n); (r.a[a.id] = r.a[a.id] || {})[p.id] = { v, i }; if (i != null) t.aj = r2(t.aj + i); });
    t.total = r2(t.sub + t.aj); t.fin = nv(p.fin) || 0; t.totFin = r2(t.total + t.fin); t.millora = r.obj ? 1 - t.totFin / r.obj : null;
    r.p[p.id] = t;
  });
  L.forEach((l) => { const xs = P.map((p) => r.l[l.id].imp[p.id]).filter((y) => y.i != null && y.i > 0); if (xs.length > 1) r.l[l.id].best = Math.min(...xs.map((y) => y.i)); });
  const tots = P.map((p) => r.p[p.id].totFin); r.millor = tots.length ? Math.min(...tots) : null;
  const adj = P.find((p) => p.id === d.adj); r.adj = adj || null;
  if (adj) { const t = r.p[adj.id]; r.impAdj = t.sub; r.totAdj = t.total; r.kAdj = t.total ? r.pem / t.total : null; r.kPlan = t.total ? r.obj / t.total : null; }
  r.coef = r.obj ? r.pem / r.obj : null;
  return r;
}
const cpPct = (x) => (x == null || !isFinite(x) ? '—' : fmtN(x * 100) + '%');
const cpTxtV = (v) => (v.t ? v.t : v.n == null ? '' : fmtN(v.n));

/* ---------- Llista ---------- */
function cpLlista(fo) {
  const st = mv('ofertes'), all = S.ofertes.filter((r) => Array.isArray(r.linies) && (!fo || r.obraId === fo));
  let rows = all.slice();
  if (!fo && st.obra) rows = rows.filter((r) => r.obraId === st.obra);
  if (st.q) { const q = st.q.toLowerCase(); rows = rows.filter((r) => [r.num, r.nom, ...(r.prov || []).map((p) => p.nom), r.obraId ? obraTxt(r.obraId) : ''].some((v) => String(v || '').toLowerCase().includes(q))); }
  const tools = `<div class="tools"><input type="search" id="q-ofertes${fo ? 'o' : ''}" placeholder="Cerca comparatius o proveïdors…" value="${esc(st.q || '')}" data-bind="q" data-mk="ofertes" aria-label="Cerca">${fo ? '' : `<select id="fo-ofertes" data-bind="obra" data-mk="ofertes" aria-label="Filtra per obra"><option value="">Totes les obres</option>${obraOpts(st.obra)}</select>`}<span style="flex:1"></span>${CANWRITE ? `<button class="btn pri sm" data-act="new" data-mk="ofertes" data-def='${esc(JSON.stringify(fo ? { obraId: fo } : {}))}'>+ Nou comparatiu</button>` : ''}</div>`;
  const intro = '<div class="small" style="margin-bottom:8px">Un comparatiu per activitat: tries les partides de l\'obra, adjuntes les ofertes dels proveïdors i compares preu a preu amb el PEC i el cost objectiu.</div>';
  if (!all.length) return intro + emptyHtml('Encara no hi ha cap comparatiu', 'Crea\'n un, tria les partides i adjunta les ofertes rebudes.', 'ofertes', fo ? { obraId: fo } : null).replace(`+ Nova ${M.ofertes.s}`, '+ Nou comparatiu');
  if (!rows.length) return intro + tools + '<div class="empty">Cap resultat amb aquests filtres.</div>';
  rows.sort((a, b) => String(b.num).localeCompare(String(a.num), 'ca', { numeric: true }));
  return intro + tools + `<div class="tw"><table><thead><tr><th>Núm.</th><th>Activitat</th>${fo ? '' : '<th>Obra</th>'}<th class="num">Partides</th><th class="num">Ofertes</th><th>Millor oferta</th><th class="num">Cost objectiu</th><th>Adjudicat a</th><th class="num">Import adjudicat</th><th>Estat</th></tr></thead><tbody>
  ${rows.map((d) => { const c = cpCalc(d), P = d.prov || [], mp = P.length ? P.reduce((a, p) => (c.p[p.id].totFin < c.p[a.id].totFin ? p : a), P[0]) : null;
    return `<tr data-act="edit" data-mk="ofertes" data-id="${esc(d.id)}"><td class="code">${esc(d.num || '')}</td><td class="t-main">${esc(d.nom || '')}</td>${fo ? '' : `<td>${esc((obra(d.obraId) || {}).codi || '')}</td>`}<td class="num">${(d.linies || []).length}</td><td class="num">${P.length}</td><td>${mp ? `${esc(mp.nom || 'Sense nom')}<span class="l2" style="text-align:left">${fmtM(c.p[mp.id].totFin)}</span>` : '<span class="muted">—</span>'}</td><td class="num">${c.obj ? fmtM(c.obj) : '—'}</td><td>${c.adj ? esc(c.adj.nom || '') : '<span class="muted">—</span>'}</td><td class="num">${c.adj ? fmtM(c.impAdj) : '—'}</td><td>${pill(d.estat || 'En curs')}</td></tr>`; }).join('')}</tbody></table></div>`;
}
const _listCP = listHtml;
listHtml = function (mk, fo) { return mk === 'ofertes' ? cpLlista(fo) : _listCP(mk, fo); };
const _pageCP = listPage;
listPage = function (mk) { const h = _pageCP(mk); return mk === 'ofertes' ? h.replace(`>+ Nova ${M.ofertes.s}</button>`, '>+ Nou comparatiu</button>').replace(/<button class="btn pri sm" data-act="new" data-mk="ofertes"[^>]*>\+ Nou comparatiu<\/button>/, '') : h; };

/* ---------- Nou comparatiu ---------- */
const _openCP = openForm;
openForm = function (mk, id, def) {
  if (mk !== 'ofertes') return _openCP(mk, id, def);
  if (id) { location.hash = 'comp-' + id; return; }
  if (!CANWRITE) return;
  const oid = (def && def.obraId) || '';
  drawer('Nou comparatiu', `<form id="cpnou" class="fgrid" novalidate><div class="fld w"><label for="cpn-nom">Activitat *</label><input id="cpn-nom" placeholder="Mòduls d'obra, estructura, bastida…" autocomplete="off"></div>
   <div class="fld w"><label for="cpn-obra">Obra *</label><select id="cpn-obra">${obraOpts(oid, '— Tria l\'obra —')}</select></div>
   <div class="fld"><label for="cpn-tipus">Tipus de compra</label><select id="cpn-tipus">${M.comandes.camps.find((f) => f.k === 'tipus').o.map((x) => `<option ${x === 'Subcontracta' ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></div></form>
   <div class="small">Després tries les partides de l'obra i adjuntes les ofertes.</div>`, '<span class="sp"></span><button class="btn" data-act="close">Cancel·la</button><button class="btn pri" data-act="cpCrea">Crea el comparatiu</button>');
  setTimeout(() => { const n = $('#cpn-nom'); if (n) n.focus(); }, 30);
};
async function cpCrea() {
  const nom = $('#cpn-nom').value.trim(), oid = $('#cpn-obra').value, o = obra(oid);
  if (!nom) { toast('Falta l\'activitat.'); return; }
  if (!o) { toast('Tria l\'obra.'); return; }
  const id = newId('cmp'), d = { num: nextCode('ofertes'), nom, obraId: oid, tipus: $('#cpn-tipus').value, capObra: o.cap || '', data: today(), contracte: '', inici: '', final: '', penal: 'Segons contracte', comentaris: '', estat: 'En curs', linies: [], prov: [], ajudes: [], adj: '' };
  try { await save('ofertes', id, d); } catch (e) { return; }
  logA(`Nou comparatiu ${d.num}: ${nom}`); closeDrawer(); location.hash = 'comp-' + id;
  setTimeout(() => { if (CP && CP.id === id) cpTria(); }, 60);
}

/* ---------- Pantalla del comparatiu ---------- */
let CP = null; // {id, d, brut, v}
const CPMSG = {}; // missatges de lectura per proveïdor
const _routeCP = route;
route = function () { const h = decodeURIComponent(location.hash.slice(1)); if (h.startsWith('comp-')) return { v: 'comp', id: h.slice(5) }; return _routeCP(); };
const _navCP = navHtml;
navHtml = function (r) { return _navCP(r.v === 'comp' ? { v: 'ofertes' } : r); };
const _viewCP = viewHtml;
viewHtml = function (r) {
  if (r.v !== 'comp') return _viewCP(r);
  if (!LOCAL && !COLS.every((c) => loaded[c])) return '<div class="loading">Carregant…</div>';
  const s = S.ofertes.find((x) => x.id === r.id);
  if (!s || !Array.isArray(s.linies)) return '<div class="empty"><b>No s\'ha trobat el comparatiu</b><div><a class="btn" href="#ofertes">Torna a Comparatius</a></div></div>';
  if (!CP || CP.id !== r.id || (!CP.brut && CP.v !== s.actualitzat)) CP = { id: r.id, d: JSON.parse(JSON.stringify((({ id, ...x }) => x)(s))), brut: false, v: s.actualitzat };
  if (!CP.brut) cpOrdena(CP.d);
  return cpHtml();
};
const cpBloc = () => !CANWRITE || CP.d.estat === 'Anul·lat';
const cpIn = (attrs, v, cls = '', extra = '') => `<input class="ed ${cls}" ${attrs} value="${esc(v ?? '')}" autocomplete="off" ${cpBloc() ? 'disabled' : ''} ${extra}>`;
function cpHtml() {
  const d = CP.d, o = obra(d.obraId) || {}, P = d.prov, dis = cpBloc() ? 'disabled' : '';
  const camp = (l, h, w) => `<div class="fld${w ? ' w' : ''}"><label>${l}</label>${h}</div>`;
  const hd = (k, l, t = '') => camp(l, cpIn(`data-cp="${k}" ${t ? `type="${t}"` : ''}`, d[k], 'txt'));
  const provTh = P.map((p, i) => `<th class="pv num">${esc(p.nom || 'Proveïdor ' + (i + 1))}</th>`).join('');
  const fila = (l, i) => `<tr style="cursor:default" data-cl="${i}"><td class="code" style="white-space:nowrap">${l.pid ? esc(l.codi || '') : cpIn(`data-cpl="codi" aria-label="Codi"`, l.codi, 'txt', 'style="width:84px"')}</td>
    <td style="min-width:180px">${l.pid ? `<span class="desc" title="${esc(l.desc || '')}">${esc(l.desc || '')}</span>` : cpIn(`data-cpl="desc" aria-label="Descripció"`, l.desc, 'txt')}</td>
    <td style="width:86px">${cpIn(`data-cpl="am" inputmode="decimal" aria-label="Amidament"`, typeof l.am === 'number' ? N3(l.am) : l.am)}</td><td style="width:54px">${cpIn(`data-cpl="ut" aria-label="Unitat"`, l.ut, 'txt')}</td>
    ${P.map((p, j) => `<td data-cc="${j}">${cpIn(`data-cpp="${j}" aria-label="Preu de ${esc(p.nom || 'proveïdor')}"`, (p.pr || {})[l.id])}<span class="l2" data-ci="${j}"></span></td>`).join('')}
    <td>${cpIn(`data-cpl="pem" inputmode="decimal" aria-label="Preu PEC"`, typeof l.pem === 'number' ? fmtN(l.pem) : l.pem)}<span class="l2" data-cpem></span></td>
    <td>${cpIn(`data-cpl="obj" inputmode="decimal" aria-label="Preu cost objectiu"`, typeof l.obj === 'number' ? fmtN(l.obj) : l.obj)}<span class="l2" data-cobj></span></td>
    <td style="width:30px">${dis ? '' : `<button class="btn sm" data-act="cpTreuL" data-i="${i}" aria-label="Treu la línia">×</button>`}</td></tr>`;
  const ajF = (a, i) => `<tr style="cursor:default" data-ca="${i}"><td></td><td>${cpIn(`data-cpa="desc" aria-label="Concepte"`, a.desc, 'txt')}</td><td>${cpIn(`data-cpa="am" inputmode="decimal" aria-label="Quantitat"`, typeof a.am === 'number' ? N3(a.am) : a.am)}</td><td>${cpIn(`data-cpa="ut" aria-label="Unitat"`, a.ut, 'txt')}</td>
    ${P.map((p, j) => `<td>${cpIn(`data-cpav="${j}" aria-label="Preu de ${esc(p.nom || 'proveïdor')}"`, (p.ajv || {})[a.id])}<span class="l2" data-cai="${j}"></span></td>`).join('')}<td></td><td></td><td>${dis ? '' : `<button class="btn sm" data-act="cpTreuA" data-i="${i}" aria-label="Treu el concepte">×</button>`}</td></tr>`;
  const tot = (k, l, extra = '') => `<tr class="tot" style="cursor:default"><td colspan="4">${l}</td>${P.map((p, j) => `<td class="num" data-ct="${k}" data-j="${j}">${k === 'fin' ? cpIn(`data-cpv="fin" data-j="${j}" inputmode="decimal" aria-label="Financers de ${esc(p.nom || 'proveïdor')}"`, typeof p.fin === 'number' ? fmtN(p.fin) : p.fin) : ''}</td>`).join('')}<td class="num" data-ctp="${k}"></td><td class="num" data-cto="${k}"></td><td>${extra}</td></tr>`;
  const card = (p, j) => `<div class="cpcard ${d.adj === p.id ? 'adj' : ''}" data-cpc="${j}">
    <label>Empresa${cpIn(`data-cpv="nom" data-j="${j}"`, p.nom, 'txt')}</label>
    <div class="duo"><label>CIF / NIF${cpIn(`data-cpv="nif" data-j="${j}"`, p.nif, 'txt')}</label><label>Contacte${cpIn(`data-cpv="contacte" data-j="${j}"`, p.contacte, 'txt')}</label></div>
    <div class="duo"><label>Telèfon${cpIn(`data-cpv="tel" data-j="${j}"`, p.tel, 'txt')}</label><label>E-mail${cpIn(`data-cpv="email" data-j="${j}"`, p.email, 'txt')}</label></div>
    <div class="duo"><label>Pagament (tipus)${cpIn(`data-cpv="pagTipus" data-j="${j}" list="cp-pag"`, p.pagTipus, 'txt')}</label><label>Dies${cpIn(`data-cpv="pagDies" data-j="${j}" inputmode="numeric"`, p.pagDies, 'txt')}</label></div>
    <label>Retenció de garantia (%)${cpIn(`data-cpv="ret" data-j="${j}" inputmode="decimal"`, p.ret, 'txt')}</label>
    <label>Observacions<textarea class="ed txt" data-cpv="obs" data-j="${j}" rows="2" ${dis}>${esc(p.obs || '')}</textarea></label>
    <div class="small">${(p.docs || []).map((f, k) => { const x = S.fitxers.find((y) => y.id === f); return x ? `<div style="display:flex;gap:6px;align-items:center"><span style="flex:1;overflow-wrap:anywhere">${esc(x.nom)}</span><button class="btn sm" data-act="veuDoc" data-id="${esc(f)}">Veure</button>${dis ? '' : `<button class="btn sm" data-act="cpTreuDoc" data-j="${j}" data-k="${k}" aria-label="Treu el document">×</button>`}</div>` : ''; }).join('') || 'Sense oferta adjunta.'}</div>
    ${p.llegit != null ? `<div class="small" data-cpll="${j}"></div>` : ''}<div class="small" data-cpmsg="${j}" aria-live="polite">${esc(CPMSG[p.id] || '')}</div>
    ${dis ? '' : `<div style="display:flex;gap:6px;flex-wrap:wrap">${ASSETS ? `<label class="btn sm" for="cpf-${j}" style="display:inline-flex;flex-direction:row;color:inherit">Adjunta l'oferta</label><input type="file" id="cpf-${j}" data-cpfile="${j}" accept=".pdf,.png,.jpg,.jpeg,.webp,.xlsx,.xls,.doc,.docx" multiple hidden>` : ''}<span class="sp" style="flex:1"></span><button class="btn sm danger" data-act="cpTreuP" data-j="${j}">Treu</button></div>`}</div>`;
  const back = o.id ? `<a href="#obra-${esc(o.id)}" data-act="cpObra" data-id="${esc(o.id)}">${esc(o.codi || '')} · ${esc(o.nom || '')}</a> / Comparatius` : '<a href="#ofertes">Comparatius</a>';
  return `<div class="crumb">${back}</div>
  <div class="head"><div><div class="eyebrow">Comparatiu de compres · ${esc(d.num || '')}</div><h1>${esc(d.nom || 'Comparatiu')}</h1></div>${pill(d.estat)}<span class="sp"></span>${dis ? '' : '<button class="btn" data-act="cpTria">Tria partides</button>'}</div>
  <section class="panel" style="margin-bottom:14px"><div class="pb"><div class="fgrid" style="grid-template-columns:repeat(auto-fit,minmax(min(100%,160px),1fr))">
   ${hd('nom', 'Activitat')}${camp('Obra', `<input class="ed txt" value="${esc((o.codi || '') + ' · ' + (o.nom || ''))}" disabled>`)}${hd('capObra', "Cap d'obra")}${hd('data', 'Data', 'date')}${hd('contracte', 'Núm. contracte')}
   ${camp('Tipus de compra', `<select class="ed txt" data-cp="tipus" ${dis}>${M.comandes.camps.find((f) => f.k === 'tipus').o.map((x) => `<option ${x === d.tipus ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select>`)}
   ${hd('inici', 'Inici', 'date')}${hd('final', 'Final', 'date')}${hd('penal', 'Penalització')}
   ${camp('Estat', `<select class="ed txt" data-cp="estat" ${CANWRITE ? '' : 'disabled'}>${CP_ESTATS.map((x) => `<option ${x === d.estat ? 'selected' : ''}>${x}</option>`).join('')}</select>`)}
   ${camp('Comentaris', `<textarea class="ed txt" data-cp="comentaris" rows="1" ${dis}>${esc(d.comentaris || '')}</textarea>`, 1)}
  </div></div></section>
  <section class="panel" style="margin-bottom:14px"><h2>Ofertes rebudes<span class="sp"></span>${dis ? '' : `${ASSETS ? '<label class="btn sm" for="cpf-nous" style="color:inherit">Afegeix ofertes (documents)</label><input type="file" id="cpf-nous" data-cpfile="nous" accept=".pdf,.png,.jpg,.jpeg,.webp,.xlsx,.xls,.doc,.docx" multiple hidden>' : ''}<button class="btn sm" data-act="cpNouP">+ Proveïdor</button>`}</h2>
   <div class="pb">${P.length ? `<div class="small" style="margin-bottom:8px">Cada document que afegeixes crea un proveïdor i se'n llegeixen l'empresa, el NIF, el telèfon, el correu i el total. Els preus de cada partida s'entren a la taula (pots obrir l'oferta amb «Veure»).</div><div class="cpcards">${P.map(card).join('')}</div>` : '<div class="empty" style="padding:16px"><b>Encara no hi ha ofertes</b>Afegeix els documents de les ofertes: cada un crea un proveïdor.</div>'}</div></section>
  <section class="panel" style="margin-bottom:14px"><h2>Comparatiu<span class="sp"></span><span class="small">Preus en €/ut. Pots escriure «inclòs» o «no inclòs».</span></h2>
  ${d.linies.length || d.ajudes.length ? `<div class="tw" style="border:0"><table class="cpt"><thead><tr><th>Codi</th><th>Descripció</th><th class="num">Amid.</th><th>Ut</th>${provTh}<th class="pv num">${+o.baixa ? 'PEC + baixa' : 'PEC'}</th><th class="pv num">Cost objectiu</th><th></th></tr></thead><tbody>
   ${d.linies.map(fila).join('')}
   ${tot('sub', 'Subtotal (import del contracte)')}
   <tr class="sec"><td colspan="${7 + P.length}">Ajudes / altres conceptes (no es redacten en el contracte)</td></tr>
   ${d.ajudes.map(ajF).join('')}
   ${dis ? '' : `<tr style="cursor:default"><td></td><td colspan="${6 + P.length}"><button class="btn sm" data-act="cpNouA">+ Concepte</button></td></tr>`}
   ${tot('aj', 'Suma d\'ajudes i altres conceptes')}${tot('total', 'TOTAL DEL COMPARATIU')}${tot('fin', 'Financers')}${tot('totFin', 'Total comparatiu inclòs financers')}${tot('millora', 'Millora segons planificat')}
   <tr class="tot" style="cursor:default"><td colspan="4">Adjudicatari</td>${P.map((p, j) => `<td class="num"><label style="display:inline-flex;gap:4px;align-items:center;font-weight:400"><input type="radio" name="cp-adj" data-cpadj="${j}" ${d.adj === p.id ? 'checked' : ''} ${dis}>Adjudica</label></td>`).join('')}<td colspan="3">${d.adj && !dis ? '<button class="btn sm" data-act="cpNoAdj">Treu l\'adjudicació</button>' : ''}</td></tr>
   </tbody></table></div>` : '<div class="empty"><b>Encara no hi ha partides</b>Tria les partides de l\'obra que entren en aquest comparatiu.</div>'}
   ${dis ? '' : '<div class="pb" style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn sm" data-act="cpTria">Tria partides</button><button class="btn sm" data-act="cpNovaL">+ Línia lliure</button></div>'}</section>
  <section class="panel" style="margin-bottom:14px"><h2>Resum</h2><div class="pb" id="cp-res"></div></section>
  <datalist id="cp-pag"><option value="CONF."><option value="TRANSF."><option value="PAGARÉ"></datalist>
  <div class="barra"><span id="cp-st" class="small"></span><span class="sp"></span>${CANWRITE ? '<button class="btn danger" data-act="cpDel">Elimina</button><button class="btn" data-act="cpDesfes">Desfés els canvis</button>' : ''}<button class="btn" data-act="cpDoc" data-t="xls">Excel</button><button class="btn" data-act="cpDoc" data-t="pdf">PDF</button>${CANWRITE ? '<button class="btn pri" data-act="cpDesa">Desa</button>' : ''}</div>`;
}
function cpPinta() {
  if (!CP || !$('#cp-st')) return;
  const d = CP.d, c = cpCalc(d), P = d.prov;
  document.querySelectorAll('tr[data-cl]').forEach((tr) => { const l = d.linies[+tr.dataset.cl], x = c.l[l.id];
    P.forEach((p, j) => { const y = x.imp[p.id], td = tr.querySelector(`td[data-cc="${j}"]`); tr.querySelector(`[data-ci="${j}"]`).textContent = y.v.t ? '' : y.i == null ? (y.v.mal ? 'error' : '—') : fmtM(y.i);
      td.classList.toggle('best', x.best != null && y.i === x.best); td.classList.toggle('falta', !!y.v.buit); td.querySelector('input').classList.toggle('mal', !!y.v.mal); });
    tr.querySelector('[data-cpem]').textContent = x.pem ? fmtM(x.pem) : ''; tr.querySelector('[data-cobj]').textContent = x.obj ? fmtM(x.obj) : '';
    tr.querySelector('[data-cpl="am"]').classList.toggle('mal', isNaN(evalua(l.am))); });
  document.querySelectorAll('tr[data-ca]').forEach((tr) => { const a = d.ajudes[+tr.dataset.ca], x = c.a[a.id] || {};
    P.forEach((p, j) => { const y = x[p.id]; if (!y) return; tr.querySelector(`[data-cai="${j}"]`).textContent = y.i == null ? (y.v.mal ? 'error' : '') : fmtM(y.i); tr.querySelector(`[data-cpav="${j}"]`).classList.toggle('mal', !!y.v.mal); }); });
  const fm = { sub: (t) => fmtM(t.sub), aj: (t) => fmtM(t.aj), total: (t) => fmtM(t.total), totFin: (t) => fmtM(t.totFin), millora: (t) => `<span style="color:${t.millora != null && t.millora < 0 ? 'var(--bad)' : 'var(--ok)'}">${cpPct(t.millora)}</span>` };
  document.querySelectorAll('[data-ct]').forEach((td) => { const k = td.dataset.ct; if (k === 'fin') return; const p = P[+td.dataset.j], t = c.p[p.id]; td.innerHTML = fm[k](t) + (k === 'totFin' && P.length > 1 && t.totFin === c.millor ? '<span class="l2" style="color:var(--ok)">Millor</span>' : ''); });
  const pt = { sub: c.pem, total: c.pem, totFin: c.pem }, ot = { sub: c.obj, total: c.obj, totFin: c.obj };
  document.querySelectorAll('[data-ctp]').forEach((td) => { const v = pt[td.dataset.ctp]; td.textContent = v ? fmtM(v) : ''; });
  document.querySelectorAll('[data-cto]').forEach((td) => { const v = ot[td.dataset.cto]; td.textContent = v ? fmtM(v) : ''; });
  P.forEach((p, j) => { const el = document.querySelector(`[data-cpll="${j}"]`); if (el) { const dif = r2(p.llegit - c.p[p.id].sub); el.innerHTML = `Total llegit del document: <b>${fmtM(p.llegit)}</b>${c.p[p.id].sub && Math.abs(dif) > 0.5 ? ` <span style="color:var(--warn)">(la taula suma ${fmtM(c.p[p.id].sub)})</span>` : ''}`; } });
  const f = (l, v, s) => `<tr style="cursor:default"><td>${l}${s ? `<div class="small">${s}</div>` : ''}</td><td class="num">${v}</td></tr>`, nn = (x) => (x == null || !isFinite(x) ? '—' : fmtN(x));
  const com = d.comandaId && S.comandes.find((x) => x.id === d.comandaId);
  $('#cp-res').innerHTML = `<div class="econ-g"><table><tbody>${f(+((obra(d.obraId) || {}).baixa) ? 'PEC + baixa' : 'PEC', fmtM(c.pem), 'Preu de venda de les partides')}${f('Cost objectiu', fmtM(c.obj), 'Cost previst de les partides')}${f('Coeficient PEC / planificat', nn(c.coef))}</tbody></table>
   <table><tbody>${c.adj ? f('Adjudicatari', esc(c.adj.nom || '')) + f('Import adjudicat', fmtM(c.impAdj), 'Subtotal del proveïdor: és l\'import de la comanda') + f('Total adjudicat amb ajudes', fmtM(c.totAdj)) + f('K adjudicat', nn(c.kAdj), 'PEC ÷ total adjudicat') + f('K planificat', nn(c.kPlan), 'Cost objectiu ÷ total adjudicat') : f('Adjudicatari', '<span class="muted">Encara no</span>', 'Marca «Adjudica» a la columna del proveïdor')}</tbody></table></div>
   ${c.adj && CANWRITE ? `<div style="margin-top:10px;display:flex;gap:8px;align-items:center;flex-wrap:wrap">${com ? `<span class="small">Comanda ${esc(com.num)} · ${esc(com.estat || '')} · ${fmtM(com.import)}</span><button class="btn sm" data-act="edit" data-mk="comandes" data-id="${esc(com.id)}">Obre la comanda</button>` : '<button class="btn sm pri" data-act="cpComanda">Crea la comanda</button><span class="small">Es crea en esborrany a Compres, amb l\'import adjudicat.</span>'}</div>` : ''}
   ${c.mal ? `<div class="small" style="color:var(--bad);margin-top:6px">Hi ha ${c.mal} valors que no es poden calcular (en vermell).</div>` : ''}`;
  $('#cp-st').textContent = CP.brut ? 'Canvis sense desar' : 'Tot desat';
  const b = document.querySelector('[data-act=cpDesa]'); if (b) b.disabled = !CP.brut;
}
const _paintCP = paint;
paint = function () { _paintCP(); cpPinta(); };
const cpBrut = () => { CP.brut = true; cpPinta(); };
document.addEventListener('input', (e) => {
  const t = e.target; if (!CP || !t.closest || !t.closest('#view') || !$('#cp-st')) return;
  const d = CP.d, ds = t.dataset;
  if (ds.cp) d[ds.cp] = t.value;
  else if (ds.cpl) d.linies[+t.closest('tr').dataset.cl][ds.cpl] = t.value;
  else if (ds.cpp != null) { const p = d.prov[+ds.cpp]; (p.pr = p.pr || {})[d.linies[+t.closest('tr').dataset.cl].id] = t.value; }
  else if (ds.cpa) d.ajudes[+t.closest('tr').dataset.ca][ds.cpa] = t.value;
  else if (ds.cpav != null) { const p = d.prov[+ds.cpav]; (p.ajv = p.ajv || {})[d.ajudes[+t.closest('tr').dataset.ca].id] = t.value; }
  else if (ds.cpv) d.prov[+ds.j][ds.cpv] = t.value;
  else return;
  cpBrut();
  if (ds.cpv === 'nom') { const th = document.querySelectorAll('.cpt thead th.pv')[+ds.j]; if (th) th.textContent = t.value || 'Proveïdor ' + (+ds.j + 1); }
});
document.addEventListener('change', async (e) => {
  const t = e.target; if (!CP || !t.closest || !t.closest('#view') || !$('#cp-st')) return;
  const ds = t.dataset;
  if (ds.cpadj != null) { CP.d.adj = CP.d.prov[+ds.cpadj].id; if (CP.d.estat === 'En curs') CP.d.estat = 'Adjudicat'; CP.brut = true; paint(); return; }
  if (ds.cp === 'estat') { CP.brut = true; paint(); return; }
  if (ds.cpfile) { const fs = [...t.files]; t.value = ''; if (fs.length) await cpAdjunta(ds.cpfile, fs); return; }
  // Format dels números en sortir del camp
  if (t.classList.contains('ed') && !t.classList.contains('txt') && (ds.cpl || ds.cpp != null || ds.cpa || ds.cpav != null || ds.cpv === 'fin')) {
    const v = t.value.trim(); if (v && v[0] !== '=' && /^[-\d.,\s€]+$/.test(v) && !isNaN(nv(v.replace('€', '')))) t.value = (ds.cpl === 'am' || ds.cpa === 'am') ? N3(nv(v)) : fmtN(nv(v.replace('€', '')));
  }
});

/* ---------- Partides ---------- */
const cpItems = (oid) => ordItems(oid, prodItems(oid).filter((x) => x.mk === 'partides' || ['Aprovat', 'Executat'].includes(x.p.estat)));
const cpGrup = (x) => (x.mk === 'modificats' ? 'Contradictòries · ' : '') + (x.p.capitol || SENSE_CAP);
/* Les línies amb partida, en l'ordre de Partides i Contradictòries; les lliures, al final */
function cpOrdena(d) {
  const ix = new Map(cpItems(d.obraId).map((x, i) => [x.p.id, i]));
  const k = (l) => (l.pid && ix.has(l.pid) ? ix.get(l.pid) : 1e9);
  d.linies = d.linies.map((l, i) => ({ l, i })).sort((a, b) => k(a.l) - k(b.l) || a.i - b.i).map((x) => x.l);
}
function cpTria() {
  const d = CP.d, its = cpItems(d.obraId), ja = new Set(d.linies.map((l) => l.pid).filter(Boolean));
  if (!its.length) { toast('L\'obra encara no té partides. Pots afegir línies lliures.'); return; }
  const caps = [...new Set(its.map(cpGrup))], inds = [...new Set(its.map((x) => x.p.industrial).filter(Boolean))].sort();
  const body = `<div class="tools" style="margin:0 0 8px"><input type="search" id="cps-q" placeholder="Cerca codi o descripció…" aria-label="Cerca partides">${inds.length ? `<select id="cps-ind" aria-label="Industrial"><option value="">Tots els industrials</option>${inds.map((x) => `<option>${esc(x)}</option>`).join('')}</select>` : ''}</div>
   <div class="tw"><table class="cpsel"><tbody>${caps.map((c) => `<tr class="cap" data-scap="${esc(c)}"><td style="width:30px"><input type="checkbox" data-cpscap aria-label="Tot el capítol ${esc(c)}"></td><td colspan="3">${esc(c)}</td></tr>` + its.filter((x) => cpGrup(x) === c).map((x) => `<tr style="cursor:default" data-sp="${esc(x.p.id)}" data-sc="${esc(c)}" data-si="${esc(x.p.industrial || '')}" data-st="${esc(((x.p.codi || '') + ' ' + (x.p.descripcio || '')).toLowerCase())}"><td><input type="checkbox" data-cps="${esc(x.p.id)}" ${ja.has(x.p.id) ? 'checked disabled' : ''} aria-label="${esc(x.p.codi || '')}"></td><td class="code">${esc(x.p.codi || '')}</td><td style="font-size:12.5px">${esc(String(x.p.descripcio || '').slice(0, 140))}${x.p.industrial ? `<span class="l2" style="text-align:left">${esc(x.p.industrial)}</span>` : ''}</td><td class="num" style="white-space:nowrap">${N3(+x.p.amidament || 0)} ${esc(x.p.unitat || '')}</td></tr>`).join('')).join('')}</tbody></table></div>`;
  drawer('Tria les partides', body, '<span class="small" id="cps-n"></span><span class="sp"></span><button class="btn" data-act="close">Cancel·la</button><button class="btn pri" data-act="cpAfegeix">Afegeix</button>');
  $('#drawerHost .drawer').classList.add('ampla'); cpSelN();
}
function cpSelN() { const n = document.querySelectorAll('[data-cps]:checked:not(:disabled)').length, e = $('#cps-n'); if (e) e.textContent = n ? `${n} seleccionades` : ''; }
function cpSelFiltra() {
  const q = ($('#cps-q') || {}).value || '', ind = ($('#cps-ind') || {}).value || '';
  document.querySelectorAll('tr[data-sp]').forEach((tr) => { tr.hidden = (q && !tr.dataset.st.includes(q.toLowerCase())) || (ind && tr.dataset.si !== ind); });
  document.querySelectorAll('tr[data-scap]').forEach((tr) => { tr.hidden = ![...document.querySelectorAll(`tr[data-sc="${CSS.escape(tr.dataset.scap)}"]`)].some((x) => !x.hidden); });
}
document.addEventListener('input', (e) => { if (e.target.id === 'cps-q') cpSelFiltra(); });
document.addEventListener('change', (e) => {
  const t = e.target;
  if (t.id === 'cps-ind') cpSelFiltra();
  else if (t.dataset && t.dataset.cpscap != null) { const c = t.closest('tr').dataset.scap; document.querySelectorAll(`tr[data-sc="${CSS.escape(c)}"]`).forEach((tr) => { if (tr.hidden) return; const x = tr.querySelector('[data-cps]'); if (!x.disabled) x.checked = t.checked; }); cpSelN(); }
  else if (t.dataset && t.dataset.cps) cpSelN();
});
function cpAfegeix() {
  const ids = [...document.querySelectorAll('[data-cps]:checked:not(:disabled)')].map((x) => x.dataset.cps);
  if (!ids.length) { toast('No has triat cap partida.'); return; }
  const its = cpItems(CP.d.obraId);
  // en l'ordre de l'obra
  its.filter((x) => ids.includes(x.p.id)).forEach((x) => { const p = x.p; CP.d.linies.push({ id: newId('cl'), pid: p.id, mk: x.mk, codi: p.codi || '', desc: p.descripcio || '', am: +p.amidament || 0, ut: p.unitat || '', pem: +p.preuVenda || 0, obj: +p.costUnit || 0 }); });
  cpOrdena(CP.d); closeDrawer(); CP.brut = true; paint(); toast(`${ids.length} partides afegides.`);
}

/* ---------- Ofertes (documents) ---------- */
const cpNouProv = (nom = '') => ({ id: newId('cpp'), nom, nif: '', contacte: '', tel: '', email: '', pagTipus: '', pagDies: '', ret: '', obs: '', fin: '', docs: [], pr: {}, ajv: {} });
async function cpLlegeix(file) {
  const b = file.type ? file : new Blob([file], { type: OKT[fext(file.name)] });
  const { linies } = await ObradorLectura.linies(b);
  const e = cfgEmp(), r = ObradorLectura.interpreta(linies, { nif: e.nif, nom: e.nom }, coneguts()), T = linies.map((l) => String(l.text || ''));
  // Correus i telèfons: fora els nostres (el bloc de «client» de l'oferta) i millor els del domini del proveïdor
  const nrm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(), paraules = (s) => nrm(s).split(/[^a-z0-9]+/).filter((w) => w.length >= 4);
  const propis = paraules(e.nom), seus = paraules(r.nom).filter((w) => !['construcciones', 'construccions', 'alquiler', 'lloguer', 'maquinaria', 'modulares', 'serveis', 'servicios'].includes(w));
  const dom = (m) => nrm(m.split('@')[1] || '').split('.')[0], casa = (m, ws) => { const c = dom(m); return c.length >= 3 && ws.some((w) => w.includes(c) || c.includes(w)); };
  const nifP = ObradorLectura.nifNet(e.nif), mails = [], tels = [], nostres = new Set(), nifs = new Set();
  T.forEach((t, i) => { (t.match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g) || []).forEach((m) => { m = m.toLowerCase(); if (casa(m, propis)) nostres.add(i); else mails.push({ m, i }); }); if (nifP && ObradorLectura.nifNet(t).includes(nifP)) nifs.add(i); // la línia del nostre NIF, però no les veïnes
    for (const x of t.matchAll(/(?<![\d,])(?<!\d\.)(?:\+34[\s.]?)?(?:([6789]\d{2})[\s.]?(\d{3})[\s.]?(\d{3})|([6789]\d{2})[\s.](\d{2})[\s.](\d{2})[\s.](\d{2})|([89]\d)[\s.](\d{3})[\s.](\d{2})[\s.](\d{2}))(?![\d.,])/g)) tels.push({ t: x.slice(1).filter(Boolean).join(' '), i }); });
  const lluny = (x) => !nifs.has(x.i) && ![...nostres].some((k) => Math.abs(k - x.i) <= 1), generic = (m) => /^(info|dpto|depto|departament|direcci|admin|contab|credit|factur|comercial@|rrhh|no-?reply)|rrhh|credit/.test(m);
  const ms = mails.filter(lluny).sort((a, b) => (casa(b.m, seus) - casa(a.m, seus)) || (generic(a.m) - generic(b.m)) || a.i - b.i);
  const mail = ms[0], ts = tels.filter(lluny).sort((a, b) => (mail ? Math.abs(a.i - mail.i) - Math.abs(b.i - mail.i) : 0));
  return { nom: r.nom || '', nif: r.nif || '', base: r.base, email: mail ? mail.m : '', tel: ts[0] ? ts[0].t : '' };
}
async function cpAdjunta(on, files) {
  if (!ASSETS) { toast('No tens permís per pujar documents.'); return; }
  const d = CP.d;
  for (const file of files) {
    let j = on === 'nous' ? -1 : +on;
    if (j < 0) { d.prov.push(cpNouProv(file.name.replace(/\.[^.]+$/, ''))); j = d.prov.length - 1; d.prov[j].nomDoc = true; }
    const p = d.prov[j]; CP.brut = true; paint();
    const msg = (s) => { CPMSG[p.id] = s; const m = document.querySelector(`[data-cpmsg="${j}"]`); if (m) m.textContent = s; };
    msg(`Pujant ${file.name}…`);
    let fid; try { fid = await pujaFitxer(file, d.obraId); } catch (x) { msg('No s\'ha pogut pujar el document.'); continue; }
    (p.docs = p.docs || []).push(fid); paint();
    if (!LLEGIBLE.includes(fext(file.name))) { msg('Document desat. Aquest format no es llegeix: entra les dades a mà.'); continue; }
    msg('Llegint el document…');
    let r; try { r = await cpLlegeix(file); } catch (x) { msg('No s\'ha pogut llegir. Entra les dades a mà.'); continue; }
    const posats = [];
    if (r.nom && (!p.nom || p.nomDoc)) { p.nom = r.nom; delete p.nomDoc; posats.push('empresa'); }
    [['nif', 'NIF'], ['email', 'correu'], ['tel', 'telèfon']].forEach(([k, l]) => { if (r[k] && !p[k]) { p[k] = r[k]; posats.push(l); } });
    if (r.base != null) { p.llegit = r.base; posats.push('total'); }
    paint(); msg(posats.length ? `Llegit: ${posats.join(', ')}. Revisa-ho.` : 'No s\'hi han trobat dades. Entra-les a mà.');
  }
  logA(`Ofertes adjuntades al comparatiu ${d.num}`);
}

/* ---------- Desa, comanda, documents ---------- */
async function cpDesa() {
  const d = CP.d, c = cpCalc(d), b = document.querySelector('[data-act=cpDesa]');
  if (!String(d.nom || '').trim()) { toast('Falta l\'activitat.'); return false; }
  if (c.mal) { toast('Hi ha valors que no es poden calcular (en vermell).'); return false; }
  if (d.prov.some((p) => p.nif && !ObradorLectura.nifValid(p.nif))) { toast('Hi ha un CIF / NIF de proveïdor que no és correcte.'); return false; }
  const net = JSON.parse(JSON.stringify(d)); net.linies.forEach((l) => { ['am', 'pem', 'obj'].forEach((k) => { const v = evalua(l[k]); if (typeof l[k] === 'string' && l[k].trim()[0] !== '=' && !isNaN(v)) l[k] = v; }); });
  net.ajudes.forEach((a) => { const v = evalua(a.am); if (typeof a.am === 'string' && a.am.trim()[0] !== '=' && !isNaN(v)) a.am = v; });
  net.prov.forEach((p) => { delete p.nomDoc; const v = nv(p.fin); if (typeof p.fin === 'string' && p.fin.trim() && !isNaN(v)) p.fin = v; if (c.p[p.id]) p.sub = c.p[p.id].sub; });
  net.pem = c.pem; net.obj = c.obj; net.impAdj = c.adj ? c.impAdj : null;
  if (b) b.disabled = true;
  try { await save('ofertes', CP.id, net); } catch (e) { if (b) b.disabled = false; return false; }
  CP.brut = false; CP.d = net; const s = S.ofertes.find((x) => x.id === CP.id); if (s) CP.v = s.actualitzat;
  logA(`Comparatiu ${d.num} desat: ${d.nom}`); paint(); return true;
}
async function cpComanda() {
  if (CP.brut && !(await cpDesa())) return;
  const d = CP.d, c = cpCalc(d), p = c.adj; if (!p) return;
  const id = newId('co'), num = nextCode('comandes');
  const det = d.linies.map((l) => { const y = c.l[l.id].imp[p.id]; return `${l.codi ? l.codi + ' ' : ''}${String(l.desc || '').slice(0, 60)}: ${y.v.t || (y.i == null ? '—' : fmtM(y.i))}`; }).join('\n');
  try { await save('comandes', id, { num, obraId: d.obraId, proveidor: p.nom || '', nif: p.nif || '', tipus: d.tipus || 'Subcontracta', concepte: d.nom, import: c.impAdj, estat: 'Esborrany', data: today(), comparatiuId: CP.id, notes: `Comparatiu ${d.num}.${p.pagTipus ? ` Pagament: ${p.pagTipus} ${p.pagDies || ''}.` : ''}${p.ret ? ` Retenció ${p.ret}%.` : ''}\n${det}` }); } catch (e) { return; }
  const { id: _, ...s } = S.ofertes.find((x) => x.id === CP.id);
  try { await save('ofertes', CP.id, { ...s, comandaId: id, estat: 'Adjudicat' }); } catch (e) { return; }
  CP.d.comandaId = id; CP.d.estat = 'Adjudicat';
  logA(`Comanda ${num} creada des del comparatiu ${d.num} (${p.nom})`); toast(`Comanda ${num} creada en esborrany a Compres.`); paint();
}
function cpDades() {
  const d = CP.d, c = cpCalc(d), o = obra(d.obraId) || {}, P = d.prov;
  return { d, c, o, P, emp: cfgEmp(), pemL: +o.baixa ? 'PEC + baixa' : 'PEC', nom: `Comparatiu ${o.codi || ''} ${d.nom || ''}`.replace(/[\\/:*?"<>|]/g, '').trim() };
}
async function cpPdf() {
  const x = cpDades(), { d, c, o, P } = x, J = await jsPdf(), gran = P.length > 4, doc = new J({ unit: 'mm', format: gran ? 'a3' : 'a4', orientation: 'landscape', compress: true });
  const W = doc.internal.pageSize.getWidth(), MX = 10, eur = (n) => pdfT(fmtM(n)), neg = (b) => doc.setFont('helvetica', b ? 'bold' : 'normal'), logo = await capçalera(x.emp.logo);
  if (!doc.autoTable) { const at = window.jspdf.autoTable || (window.jspdfAutoTable && window.jspdfAutoTable.default) || window.autoTable; doc.autoTable = (q) => at(doc, q); }
  if (logo) { const h = Math.min(14, 40 * logo.height / logo.width); doc.addImage(logo, 'PNG', MX, 8, h * logo.width / logo.height, h); }
  neg(1); doc.setFontSize(14).text('COMPARATIU DE COMPRES', MX + 48, 17);
  doc.autoTable({ startY: 7, margin: { left: W - MX - 150 }, tableWidth: 150, theme: 'grid', styles: { fontSize: 7.5, cellPadding: 1, lineColor: 0, lineWidth: 0.2, textColor: 0 }, columnStyles: { 0: { fontStyle: 'bold', cellWidth: 22 }, 2: { fontStyle: 'bold', cellWidth: 22 }, 3: { cellWidth: 24 } },
    body: [['ACTIVITAT', pdfT(d.nom || ''), 'DATA', fmtD(d.data)], ['OBRA', pdfT(o.nom || ''), 'N. OBRA', pdfT(o.codi || '')], ["CAP D'OBRA", pdfT(d.capObra || '-'), 'N. CONTRACTE', pdfT(d.contracte || '')], ['', '', 'BAIXA', +o.baixa ? pdfT(fmtN(o.baixa) + '%') : '—']] });
  const vC = (y) => (y.v.t ? pdfT(y.v.t) : y.i == null ? '' : fmtN(y.v.n)), iC = (y) => (y.v.t ? '' : y.i == null ? '-' : eur(y.i));
  const head = [[{ content: 'N. partida', rowSpan: 6 }, { content: 'Amid.', rowSpan: 6 }, { content: 'u', rowSpan: 6 }, { content: 'Descripció', rowSpan: 6 }, ...P.map((p) => ({ content: pdfT(p.nom || ''), colSpan: 2 })), { content: x.pemL, colSpan: 2, rowSpan: 5 }, { content: 'COST OBJECTIU', colSpan: 2, rowSpan: 5 }],
    ...['nif', 'contacte', 'tel', 'email'].map((k) => P.map((p) => ({ content: pdfT(p[k] || ''), colSpan: 2, styles: { fontStyle: 'normal', fontSize: 6.5 } }))),
    [...P.flatMap(() => ['Preu', 'Import']), 'Preu', 'Import', 'Preu', 'Import']];
  const body = d.linies.map((l) => { const z = c.l[l.id]; return [pdfT(l.codi || ''), N3(z.am), pdfT(l.ut || ''), pdfT(l.desc || ''), ...P.flatMap((p) => { const y = z.imp[p.id], b = z.best != null && y.i === z.best; const st = b ? { fillColor: [214, 239, 214] } : {}; return [{ content: vC(y), styles: st }, { content: iC(y), styles: { ...st, fontStyle: 'bold' } }]; }), nv(l.pem) ? fmtN(nv(l.pem)) : '', z.pem ? eur(z.pem) : '', nv(l.obj) ? fmtN(nv(l.obj)) : '', z.obj ? eur(z.obj) : '']; });
  const fil = (l, f, pem, obj, st = {}) => [{ content: l, colSpan: 4, styles: { fontStyle: 'bold', ...st } }, ...P.flatMap((p) => [{ content: f(c.p[p.id], p), colSpan: 2, styles: { halign: 'right', fontStyle: 'bold', ...st } }]), { content: pem, colSpan: 2, styles: { halign: 'right', fontStyle: 'bold' } }, { content: obj, colSpan: 2, styles: { halign: 'right', fontStyle: 'bold' } }];
  body.push(fil('SUBTOTAL (IMPORT DEL CONTRACTE)', (t) => eur(t.sub), eur(c.pem), eur(c.obj)));
  if (d.ajudes.length) { body.push([{ content: 'AJUDES / ALTRES CONCEPTES:', colSpan: 8 + 2 * P.length, styles: { fontStyle: 'bold', fillColor: [235, 235, 235] } }]);
    d.ajudes.forEach((a) => { const am = evalua(a.am); body.push(['', isNaN(am) ? '' : fmtN(am), pdfT(a.ut || ''), pdfT(a.desc || ''), ...P.flatMap((p) => { const y = (c.a[a.id] || {})[p.id] || { v: {}, i: null }; return [vC(y), y.i == null ? '' : eur(y.i)]; }), '', '', '', '']); });
    body.push(fil('SUMA JUNTAMENT AMB ALTRES CONCEPTES (NO ES REDACTEN EN EL CONTRACTE)', (t) => eur(t.aj), '', '')); }
  body.push(fil('TOTAL DEL COMPARATIU', (t, p) => (d.adj === p.id ? '[X] ' : '') + eur(t.total), eur(c.pem), eur(c.obj), { fontSize: 8.5 }));
  body.push(fil('FINANCERS', (t) => (t.fin ? eur(t.fin) : ''), c.adj ? 'K adjudicat ' + (c.kAdj == null ? '—' : fmtN(c.kAdj)) : '', c.adj ? 'K planificat ' + (c.kPlan == null ? '—' : fmtN(c.kPlan)) : ''));
  body.push(fil('TOTAL COMPARATIU - INCLÒS FINANCERS', (t) => eur(t.totFin), '', ''));
  body.push(fil('MILLORA SEGONS PLANIFICAT', (t) => cpPct(t.millora), 'Coeficient PEC/planificat', c.coef == null ? '—' : fmtN(c.coef)));
  body.push(fil('CONDICIONS DE PAGAMENT', (t, p) => pdfT([p.pagTipus, p.pagDies].filter(Boolean).join(' ')), '', ''));
  body.push(fil('RETENCIÓ DE GARANTIA', (t, p) => (p.ret ? pdfT(p.ret + '%') : ''), '', ''));
  body.push(fil('OBSERVACIONS', (t, p) => pdfT(p.obs || ''), '', '', { fontStyle: 'normal', halign: 'left', fontSize: 6.5 }));
  const pw = W - 2 * MX, fixa = 18 + 12 + 9 + 4 * 17, dw = Math.max(40, pw - fixa - P.length * 2 * 17);
  const cs = { 0: { cellWidth: 18 }, 1: { cellWidth: 12, halign: 'right' }, 2: { cellWidth: 9 }, 3: { cellWidth: dw } }; for (let i = 4; i < 8 + 2 * P.length; i++) cs[i] = { halign: 'right', cellWidth: 17 };
  doc.autoTable({ startY: 30, margin: { left: MX, right: MX, bottom: 12 }, theme: 'grid', styles: { font: 'helvetica', fontSize: gran ? 7 : 6.5, textColor: 0, lineColor: [90, 90, 90], lineWidth: 0.15, cellPadding: 1, overflow: 'linebreak' }, headStyles: { fillColor: [235, 235, 235], textColor: 0, halign: 'center', valign: 'middle', fontStyle: 'bold' }, columnStyles: cs, head, body });
  let y = doc.lastAutoTable.finalY + 6; if (y > doc.internal.pageSize.getHeight() - 45) { doc.addPage(); y = 15; }
  const pa = c.adj;
  doc.autoTable({ startY: y, margin: { left: MX }, tableWidth: 120, theme: 'grid', styles: { fontSize: 7.5, cellPadding: 1.2, lineColor: 0, lineWidth: 0.2, textColor: 0 }, columnStyles: { 0: { fontStyle: 'bold', cellWidth: 26 }, 2: { fontStyle: 'bold', cellWidth: 18 } },
    body: [['FORMA PAGAMENT', '', 'DATES', ''], ['DIES', pa ? pdfT(pa.pagDies || '') : '', 'INICI', d.inici ? fmtD(d.inici) : ''], ['TIPUS', pa ? pdfT(pa.pagTipus || '') : '', 'FINAL', d.final ? fmtD(d.final) : ''], ['RET.', pa && pa.ret ? pdfT(pa.ret + '%') : '', 'PENAL.', pdfT(d.penal || '')], ['COMENTARIS', { content: pdfT(d.comentaris || ''), colSpan: 3 }]] });
  doc.autoTable({ startY: y, margin: { left: MX + 125 }, tableWidth: 70, theme: 'grid', styles: { fontSize: 8, cellPadding: 1.5, lineColor: 0, lineWidth: 0.2, textColor: 0, halign: 'center' },
    body: [[{ content: 'ADJUDICATARI', styles: { fontStyle: 'bold' } }], [{ content: pa ? pdfT(pa.nom || '') : '—', styles: { fontStyle: 'bold', fontSize: 11, fillColor: [160, 50, 40], textColor: 255, minCellHeight: 12, valign: 'middle' } }], [{ content: 'IMPORT ADJUDICAT', styles: { fontStyle: 'bold' } }], [{ content: pa ? eur(c.impAdj) : '—', styles: { fontStyle: 'bold', fontSize: 11 } }]] });
  doc.autoTable({ startY: y, margin: { left: MX + 200 }, tableWidth: Math.min(90, W - MX - (MX + 200)), theme: 'grid', styles: { fontSize: 7.5, cellPadding: 1.2, lineColor: 0, lineWidth: 0.2, textColor: 0, halign: 'center' },
    body: [[{ content: 'VALIDACIÓ I SIGNATURES', colSpan: 3, styles: { fontStyle: 'bold' } }], [{ content: "CAP D'OBRA", styles: { fontStyle: 'bold' } }, { content: "CAP D'ÀREA", styles: { fontStyle: 'bold' } }, { content: 'DIRECCIÓ GENERAL', styles: { fontStyle: 'bold' } }], [{ content: '', styles: { minCellHeight: 18 } }, '', ''], ['DATA: ' + fmtD(d.data), 'DATA:', 'DATA:']] });
  const n = doc.getNumberOfPages(); for (let i = 1; i <= n; i++) { doc.setPage(i); neg(0); doc.setFontSize(6.5).setTextColor(110).text(`Data d'impressió: ${fmtD(today())}   ${i} / ${n}`, MX, doc.internal.pageSize.getHeight() - 5); doc.setTextColor(0); }
  return { blob: doc.output('blob'), nom: x.nom + '.pdf' };
}
async function cpXls() {
  const X = await ObradorLectura.xlsx(), x = cpDades(), { d, c, o, P } = x, E = '#,##0.00 "€"', Q = '#,##0.000', N2 = '#,##0.00', PC = '0%';
  const col = (i) => X.utils.encode_col(i), A = [], n = (v, z, f) => (v == null || v === '' ? '' : { t: 'n', v: +v || 0, z, ...(f ? { f } : {}) });
  const c0 = 4, cPem = c0 + 2 * P.length, cObj = cPem + 2;
  A.push(['COMPARATIU DE COMPRES'], ['ACTIVITAT', d.nom || '', '', '', 'DATA', d.data || ''], ['OBRA', o.nom || '', '', '', 'N. OBRA', o.codi || ''], ["CAP D'OBRA", d.capObra || '', '', '', 'N. CONTRACTE', d.contracte || ''], ['', '', '', '', 'BAIXA', +o.baixa ? n(+o.baixa / 100, '0.00%') : '']);
  A.push([]);
  const hdr = (l, k) => { const r = ['', '', '', l]; P.forEach((p) => { r.push(p[k] || '', ''); }); A.push(r); };
  hdr('Empresa', 'nom'); hdr('C.I.F.', 'nif'); hdr('Contacte', 'contacte'); hdr('Telèfon', 'tel'); hdr('E-mail', 'email');
  A[A.length - 5].push(x.pemL, '', 'COST OBJECTIU', '');
  A.push(['N. partida', 'Amid.', 'u', 'Descripció', ...P.flatMap(() => ['Preu', 'Import']), 'Preu', 'Import', 'Preu', 'Import']);
  const ini = A.length + 1;
  d.linies.forEach((l) => { const r = A.length + 1, z = c.l[l.id];
    A.push([l.codi || '', n(z.am, Q), l.ut || '', l.desc || '', ...P.flatMap((p, j) => { const y = z.imp[p.id], cp = col(c0 + 2 * j); return y.v.t ? [y.v.t, ''] : y.v.n == null ? ['', ''] : [n(y.v.n, N2), n(y.i, E, `ROUND(${cp}${r}*$B${r},2)`)]; }),
      n(nv(l.pem), N2), n(z.pem, E, `ROUND(${col(cPem)}${r}*$B${r},2)`), n(nv(l.obj), N2), n(z.obj, E, `ROUND(${col(cObj)}${r}*$B${r},2)`)]); });
  const fi = A.length, rSub = A.length + 1, sumC = (ci) => `SUM(${col(ci)}${ini}:${col(ci)}${fi})`;
  A.push(['', '', '', 'SUBTOTAL (IMPORT DEL CONTRACTE)', ...P.flatMap((p, j) => ['', n(c.p[p.id].sub, E, sumC(c0 + 2 * j + 1))]), '', n(c.pem, E, sumC(cPem + 1)), '', n(c.obj, E, sumC(cObj + 1))]);
  A.push(['AJUDES / ALTRES CONCEPTES:']);
  const aIni = A.length + 1;
  d.ajudes.forEach((a) => { const r = A.length + 1, am = evalua(a.am); A.push(['', n(isNaN(am) ? 0 : am, N2), a.ut || '', a.desc || '', ...P.flatMap((p, j) => { const y = (c.a[a.id] || {})[p.id] || { v: {}, i: null }; return y.v.t ? [y.v.t, ''] : y.v.n == null ? ['', ''] : [n(y.v.n, N2), n(y.i, E, `ROUND(${col(c0 + 2 * j)}${r}*$B${r},2)`)]; })]); });
  const aFi = A.length, rAj = A.length + 1;
  A.push(['', '', '', 'SUMA JUNTAMENT AMB ALTRES CONCEPTES (NO ES REDACTEN EN EL CONTRACTE)', ...P.flatMap((p, j) => ['', n(c.p[p.id].aj, E, aFi >= aIni ? `SUM(${col(c0 + 2 * j + 1)}${aIni}:${col(c0 + 2 * j + 1)}${aFi})` : undefined)])]);
  const rTot = A.length + 1;
  A.push(['TOTAL DEL COMPARATIU', '', '', '', ...P.flatMap((p, j) => [d.adj === p.id ? 'ADJUDICAT' : '', n(c.p[p.id].total, E, `${col(c0 + 2 * j + 1)}${rSub}+${col(c0 + 2 * j + 1)}${rAj}`)]), '', n(c.pem, E), '', n(c.obj, E)]);
  const rFin = A.length + 1;
  A.push(['FINANCERS', '', '', '', ...P.flatMap((p) => ['', n(c.p[p.id].fin, E)]), 'K adjudicat', c.kAdj == null ? '' : n(c.kAdj, N2), 'K planificat', c.kPlan == null ? '' : n(c.kPlan, N2)]);
  const rTf = A.length + 1;
  A.push(['TOTAL COMPARATIU - INCLÒS FINANCERS', '', '', '', ...P.flatMap((p, j) => ['', n(c.p[p.id].totFin, E, `${col(c0 + 2 * j + 1)}${rTot}+${col(c0 + 2 * j + 1)}${rFin}`)])]);
  A.push(['MILLORA SEGONS PLANIFICAT', '', '', '', ...P.flatMap((p, j) => ['', c.obj ? n(c.p[p.id].millora, PC, `1-${col(c0 + 2 * j + 1)}${rTf}/$${col(cObj + 1)}$${rTot}`) : '']), 'COEFICIENT PEC/PLANIFICAT', c.coef == null ? '' : n(c.coef, N2)]);
  A.push([]);
  A.push(['CONDICIONS DE PAGAMENT', '', '', '', ...P.flatMap((p) => [p.pagTipus || '', p.pagDies || ''])]);
  A.push(['RETENCIÓ DE GARANTIA', '', '', '', ...P.flatMap((p) => [p.ret ? p.ret + '%' : '', ''])]);
  A.push(['OBSERVACIONS', '', '', '', ...P.flatMap((p) => [p.obs || '', ''])]);
  A.push([]);
  const pa = c.adj;
  A.push(['FORMA PAGAMENT', '', 'DATES', '', 'ADJUDICATARI', pa ? pa.nom || '' : '']);
  A.push(['DIES:', pa ? pa.pagDies || '' : '', 'INICI', d.inici || '', 'IMPORT ADJUDICAT', pa ? n(c.impAdj, E) : '']);
  A.push(['TIPUS:', pa ? pa.pagTipus || '' : '', 'FINAL', d.final || '']);
  A.push(['RET.:', pa && pa.ret ? pa.ret + '%' : '', 'PENAL.', d.penal || '']);
  A.push(['COMENTARIS', d.comentaris || '']);
  A.push([], ['VALIDACIÓ I SIGNATURES'], ["CAP D'OBRA", '', "CAP D'ÀREA", '', 'DIRECCIÓ GENERAL'], [], ['DATA:', d.data || '', 'DATA:', '', 'DATA:']);
  const ws = X.utils.aoa_to_sheet(A.map((r) => r.map((v) => (v && typeof v === 'object' && v.f === undefined && 'f' in v ? { t: v.t, v: v.v, z: v.z } : v))));
  ws['!cols'] = [12, 10, 6, 55, ...P.flatMap(() => [11, 13]), 11, 13, 11, 13].map((wch) => ({ wch }));
  const wb = X.utils.book_new(); X.utils.book_append_sheet(wb, ws, 'COMP');
  return { blob: new Blob([X.write(wb, { type: 'array', bookType: 'xlsx' })], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), nom: x.nom + '.xlsx' };
}
async function cpDoc(t) {
  if (CP.brut && CANWRITE && !(await cpDesa())) return;
  toast('Preparant el document…');
  let r; try { r = await (t === 'pdf' ? cpPdf() : cpXls()); } catch (e) { console.error(e); toast('No s\'ha pogut generar el document. Comprova la connexió.'); return; }
  if (t !== 'pdf') { baixaBlob(r.blob, r.nom); toast('Excel descarregat.'); return; }
  visor(r.nom, async () => r.blob);
}

/* ---------- Accions ---------- */
document.addEventListener('click', async (e) => {
  const a = e.target.closest('[data-act]'); if (!a) return; const t = a.dataset.act;
  if (t === 'cpCrea') { cpCrea(); return; }
  if (t === 'cpAfegeix') { cpAfegeix(); return; }
  if (!CP || !t.startsWith('cp')) return;
  const d = CP.d;
  if (t === 'cpObra') { e.preventDefault(); V.obraTab = 'ofertes'; location.hash = 'obra-' + a.dataset.id; }
  else if (t === 'cpTria') cpTria();
  else if (t === 'cpNovaL') { d.linies.push({ id: newId('cl'), pid: '', codi: '', desc: '', am: 1, ut: 'u', pem: '', obj: '' }); CP.brut = true; paint(); }
  else if (t === 'cpTreuL') { d.linies.splice(+a.dataset.i, 1); CP.brut = true; paint(); }
  else if (t === 'cpNouA') { d.ajudes.push({ id: newId('ca'), desc: '', am: 1, ut: 'u' }); CP.brut = true; paint(); }
  else if (t === 'cpTreuA') { d.ajudes.splice(+a.dataset.i, 1); CP.brut = true; paint(); }
  else if (t === 'cpNouP') { d.prov.push(cpNouProv()); CP.brut = true; paint(); }
  else if (t === 'cpTreuP') { if (!a.classList.contains('arm')) { a.classList.add('arm'); a.textContent = 'Confirma'; return; } const p = d.prov.splice(+a.dataset.j, 1)[0]; if (d.adj === p.id) d.adj = ''; CP.brut = true; paint(); }
  else if (t === 'cpTreuDoc') { d.prov[+a.dataset.j].docs.splice(+a.dataset.k, 1); CP.brut = true; paint(); }
  else if (t === 'cpNoAdj') { d.adj = ''; if (d.estat === 'Adjudicat' && !d.comandaId) d.estat = 'En curs'; CP.brut = true; paint(); }
  else if (t === 'cpDesa') { if (await cpDesa()) toast('Comparatiu desat.'); }
  else if (t === 'cpDesfes') { CP = null; paint(); }
  else if (t === 'cpComanda') cpComanda();
  else if (t === 'cpDoc') cpDoc(a.dataset.t);
  else if (t === 'cpDel') { if (!a.classList.contains('arm')) { a.classList.add('arm'); a.textContent = 'Confirma: elimina'; return; } const nm = d.num; try { await remove('ofertes', CP.id); } catch (x) { return; } logA(`Eliminat el comparatiu ${nm}`); const oid = d.obraId; CP = null; toast('Comparatiu eliminat.'); if (oid) { V.obraTab = 'ofertes'; location.hash = 'obra-' + oid; } else location.hash = 'ofertes'; }
});
window.addEventListener('beforeunload', (e) => { if (CP && CP.brut) e.preventDefault(); });
window.addEventListener('hashchange', () => { if (CP && !CP.brut && !location.hash.startsWith('#comp-')) CP = null; });
