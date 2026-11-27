/* Producció per mesos (a origen), formularis amb format comptable i taules sense desplaçament horitzontal. */
(() => {
  const s = document.createElement('style');
  s.textContent = `.tabs{flex-wrap:wrap;overflow:visible}
th,th.num{white-space:normal;line-height:1.25;vertical-align:bottom;padding:8px 8px}td{padding:8px 8px;overflow-wrap:break-word}td.num{white-space:nowrap}td.t-main{min-width:90px}.kpi .v{font-size:22px;overflow-wrap:anywhere}
.prog span{width:auto;min-width:34px;white-space:nowrap}td .l2{display:block;font-size:12px;color:var(--muted)}
table.comp{font-size:12px}table.comp th{font-size:10px;letter-spacing:.02em;padding:6px 5px}table.comp td{padding:6px 5px}table.comp .bar{min-width:30px}table.comp td.t-main{min-width:70px}
table.fitxes,table.fitxes tbody{display:block}table.fitxes thead{display:none}table.fitxes tr{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(140px,100%),1fr));gap:4px 12px;padding:10px 12px;border-bottom:1px solid var(--line)}table.fitxes td{display:block;border:0;padding:2px 0;text-align:left!important;white-space:normal;min-width:0!important;overflow-wrap:anywhere}table.fitxes td.t-main,table.fitxes td[colspan]{grid-column:1/-1}table.fitxes td[data-l]:not([data-l=""])::before{content:attr(data-l);display:block;font-size:10.5px;color:var(--muted);text-transform:uppercase;letter-spacing:.03em}table.fitxes tr.cap{padding:0}table.fitxes tr.cap td{padding:9px 12px}
.ed{border:1px solid var(--line);background:var(--bg);color:var(--ink);border-radius:4px;padding:5px 6px;font:inherit;font-family:var(--f-mono);font-size:12.5px;text-align:right;width:100%;min-width:62px;box-sizing:border-box}.ed.txt{text-align:left;font-family:inherit}.ed:disabled{opacity:.6}.ed.canvi{border-color:var(--accent);background:color-mix(in srgb,var(--accent) 12%,transparent)}.ed.mal{border-color:var(--bad)}
.quad td{padding:4px 5px}.quad th{vertical-align:bottom}.barra{position:sticky;bottom:0;background:var(--surface);border:1px solid var(--line);border-radius:6px;padding:10px 12px;display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:12px;z-index:5}.barra .sp{flex:1}
.pers{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,250px),1fr));gap:10px;padding:12px 14px}.pers>div{border:1px solid var(--line);border-radius:6px;padding:10px;display:flex;flex-direction:column;gap:6px;min-width:0}.pers label{font-size:12px;color:var(--muted)}
.fld .nf{position:relative;display:block}.fld .nf>span{position:absolute;inset:1px;display:flex;align-items:center;padding:0 10px;background:var(--bg);border-radius:4px;pointer-events:none;overflow:hidden;white-space:nowrap}.fld .nf:focus-within>span{display:none}`;
  document.head.append(s);
})();

/* ---------- Números ---------- */
const N3 = (v) => fmtAm(v);
const N2 = (v) => (buit(v) || !isFinite(+v) ? '—' : fmtN(v));
const llegeix = (s) => (String(s).trim() === '' ? null : pnum(s));
document.addEventListener('keydown', (e) => {
  const t = e.target;
  if (!t.classList || !t.classList.contains('ed') || t.classList.contains('txt')) return;
  if (e.key === '.' || e.key === 'Decimal') { e.preventDefault(); t.setRangeText(',', t.selectionStart, t.selectionEnd, 'end'); t.dispatchEvent(new Event('input', { bubbles: true })); }
  else if (['Enter', 'ArrowDown', 'ArrowUp'].includes(e.key)) {
    const l = [...document.querySelectorAll(`.ed[data-col="${t.dataset.col}"]`)].filter((x) => !x.disabled && x.offsetParent), n = l[l.indexOf(t) + (e.key === 'ArrowUp' ? -1 : 1)];
    e.preventDefault(); if (n) { n.focus(); n.select(); }
  }
});
document.addEventListener('focusin', (e) => { if (e.target.classList && e.target.classList.contains('ed') && e.target.select) e.target.select(); });

/* Camps numèrics dels formularis: mateix format que les taules quan no s'hi escriu */
const DEC3 = ['amidament', 'executat'];
function vesteix() {
  document.querySelectorAll('#frm input[type=number]').forEach((i) => {
    const m = M[$('#frm').dataset.mk], f = m && m.camps.find((x) => x.k === i.name);
    if (!f || (f.tp !== 'money' && !DEC3.includes(f.k) && !['hores', 'quantitat'].includes(f.k))) return;
    let w = i.parentElement;
    if (!w.classList.contains('nf')) { const a = document.activeElement === i; w = document.createElement('span'); w.className = 'nf'; i.before(w); w.append(i, document.createElement('span')); if (a) i.focus(); }
    const s = w.lastElementChild, t = i.value === '' ? '' : DEC3.includes(f.k) ? N3(i.value) : fmtN(i.value) + (f.tp === 'money' ? ' €' : '');
    if (s.textContent !== t) s.textContent = t;
    s.style.visibility = t ? '' : 'hidden';
  });
}
setInterval(() => { if ($('#frm')) vesteix(); }, 200);
const _openV = openForm;
openForm = function (mk, id, def) { _openV(mk, id, def); vesteix(); };

/* ---------- Taules que caben ---------- */
function ajusta() {
  document.querySelectorAll('#view table,#drawerHost table').forEach((t) => {
    const w = t.parentElement; if (!w || !w.clientWidth) return;
    const cap = [...t.querySelectorAll('thead th')].map((x) => x.innerHTML.replace(/<br>/g, ' ').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').trim());
    t.classList.remove('comp', 'fitxes');
    const sobra = () => t.scrollWidth > w.clientWidth + 1 || t.offsetWidth > w.clientWidth + 1;
    if (!sobra()) return;
    t.classList.add('comp');
    if (!sobra() || !cap.length) return;
    t.querySelectorAll('tbody tr').forEach((r) => { if (r.cells.length === cap.length) [...r.cells].forEach((c, i) => { c.dataset.l = c.classList.contains('t-main') ? '' : cap[i]; }); });
    t.classList.remove('comp'); t.classList.add('fitxes');
  });
}
let ajT = 0;
const demana = () => { clearTimeout(ajT); ajT = setTimeout(ajusta, 0); };
const _paintA = paint;
paint = function () { _paintA(); ajusta(); };
new MutationObserver(demana).observe(document.getElementById('drawerHost'), { childList: true });
window.addEventListener('resize', demana);
if (document.fonts && document.fonts.ready) document.fonts.ready.then(demana);

/* ---------- Producció ---------- */
const mesAra = () => today().slice(0, 7);
const nomMesC = (m) => { const t = new Date(m + '-15T12:00:00').toLocaleDateString('ca-ES', { month: 'long', year: 'numeric' }); return t[0].toUpperCase() + t.slice(1); };
const mesMes = (m, n) => { const d = new Date(+m.slice(0, 4), +m.slice(5) - 1 + n, 15); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };
const mesosEntre = (a, b) => { const l = []; for (let m = a; m <= b && l.length < 240; m = mesMes(m, 1)) l.push(m); return l; };
/* L'execució entrada abans d'haver-hi mesos es considera del mes en què es va entrar. */
const prodDe = (p) => p.prod || (+p.executat ? { [String(p.actualitzat || '').slice(0, 7) || mesAra()]: +p.executat } : {});
const finsA = (p, m, inclos) => { const pr = prodDe(p), k = Object.keys(pr).filter((x) => (inclos ? x <= m : x < m)).sort().pop(); return k ? +pr[k] : 0; };
const darrerProd = (pr) => { const k = Object.keys(pr).sort().pop(); return k ? +pr[k] : 0; };
const prodItems = (oid) => ordItems(oid, [...S.partides.filter((p) => p.obraId === oid).map((p) => ({ mk: 'partides', p })), ...S.modificats.filter((p) => p.obraId === oid && p.estat !== 'Rebutjat').map((p) => ({ mk: 'modificats', p }))]);
const tancat = (oid, m) => ((obra(oid) || {}).prodTancat || []).includes(m);
const PD = { obra: '', mes: '', v: {} };
const _saveX = save;
save = async function (col, id, obj) {
  if (col === 'partides' || col === 'modificats') {
    const ant = S[col].find((x) => x.id === id), pr = prodDe(ant || {}), nou = +obj.executat || 0;
    obj = { ...obj };
    // Execució canviada fora de la pantalla de Producció: va al mes en curs.
    if (!obj.__prod && Math.abs(nou - darrerProd(pr)) > 1e-9) {
      if (tancat(obj.obraId, mesAra())) { toast('La producció d\'aquest mes està tancada: no es pot canviar l\'execució.'); throw new Error('tancat'); }
      obj.prod = { ...pr, [mesAra()]: nou };
      const k = Object.keys(obj.prod).sort().pop(); if (k !== mesAra()) obj.executat = +obj.prod[k];
    } else if (!obj.__prod && Object.keys(pr).length) obj.prod = pr;
    delete obj.__prod;
    if (col === 'modificats' && obj.codi != null) { obj.num = obj.codi; obj.import = r2((+obj.amidament || 0) * (+obj.preuVenda || 0)); obj.cost = r2((+obj.amidament || 0) * (+obj.costUnit || 0)); }
  }
  return _saveX(col, id, obj);
};
function prodVal(x) { // valor a origen del mes, amb l'edició pendent
  const d = PD.v[x.p.id]; if (!d) return finsA(x.p, PD.mes, true);
  const n = llegeix(d.t); if (n == null || isNaN(n)) return n == null ? 0 : NaN;
  return d.k === 'pct' ? Math.round(n * (+x.p.amidament || 0) * 10) / 1000 : n;
}
function prodCels(x) {
  const ant = finsA(x.p, PD.mes, false), o = prodVal(x), am = +x.p.amidament || 0, pv = +x.p.preuVenda || 0;
  return { ant, o, pct: am ? o / am * 100 : null, mes: o - ant, iMes: (o - ant) * pv, iOr: o * pv };
}
function prodHtml(oid) {
  const o = obra(oid), its = prodItems(oid);
  if (PD.obra !== oid) { PD.obra = oid; PD.mes = mesAra(); PD.v = {}; }
  if (!its.length) return '<div class="empty"><b>Encara no hi ha partides</b>Entra o importa les partides de l\'obra per poder-ne marcar la producció.</div>';
  const claus = its.flatMap((x) => Object.keys(prodDe(x.p))), ini = [String(o.inici || '').slice(0, 7), ...claus, mesAra()].filter((m) => /^\d{4}-\d\d$/.test(m)).sort()[0];
  const fi = [mesAra(), ...claus].sort().pop(), ms = mesosEntre(ini, fi).reverse(); if (!ms.includes(PD.mes)) PD.mes = mesAra();
  const blo = tancat(oid, PD.mes), dis = blo || !CANWRITE ? 'disabled' : '';
  const fila = (x) => { const c = prodCels(x), d = PD.v[x.p.id] || {}, id = x.p.id, ap = x.mk === 'partides' || ['Aprovat', 'Executat'].includes(x.p.estat);
    return `<tr style="cursor:default" data-pr="${esc(id)}"><td class="code">${esc(x.p.codi || '')}</td><td class="t-main">${esc(x.p.descripcio || '')}${x.mk === 'modificats' ? `<span class="l2">Contradictòria · ${esc(x.p.estat)}${ap ? '' : ' (no suma al total)'}</span>` : ''}</td><td>${esc(x.p.unitat || '')}</td><td class="num">${N3(x.p.amidament || 0)}</td><td class="num">${N3(c.ant)}</td>
    <td><input class="ed ${d.k === 'am' ? 'canvi' : ''}" id="pa-${esc(id)}" data-col="pa" data-pin="am" inputmode="decimal" autocomplete="off" aria-label="Amidament a origen" value="${esc(d.k === 'am' ? d.t : isNaN(c.o) ? '' : N3(c.o))}" ${dis}></td>
    <td><input class="ed ${d.k === 'pct' ? 'canvi' : ''}" id="pp-${esc(id)}" data-col="pp" data-pin="pct" inputmode="decimal" autocomplete="off" aria-label="Percentatge a origen" value="${esc(d.k === 'pct' ? d.t : c.pct == null || isNaN(c.pct) ? '' : fmtN(c.pct))}" ${+x.p.amidament ? dis : 'disabled'}></td>
    <td class="num" data-c="mes">${N3(c.mes)}</td><td class="num" data-c="iMes">${fmtM(c.iMes)}</td><td class="num" data-c="iOr">${fmtM(c.iOr)}</td></tr>`; };
  const q = (V.prodQ || '').toLowerCase(), caps = [...capsObra(oid), ''], gr = caps.map((c) => ({ c, xs: its.filter((x) => (x.p.capitol || '') === c && (!q || [x.p.codi, x.p.descripcio, c].some((t) => String(t || '').toLowerCase().includes(q)))) })).filter((g) => g.xs.length);
  gr.forEach((g) => g.xs.sort((a, b) => (a.mk > b.mk) - (a.mk < b.mk) || 0) && g.xs.sort((a, b) => (a.mk === b.mk ? (a.p.ordre ?? 1e9) - (b.p.ordre ?? 1e9) || String(a.p.codi).localeCompare(String(b.p.codi), 'ca', { numeric: true }) : a.mk === 'partides' ? -1 : 1)));
  return `<div class="tools"><select id="prod-mes" aria-label="Mes">${ms.map((m) => `<option value="${m}" ${m === PD.mes ? 'selected' : ''}>${nomMesC(m)}${tancat(oid, m) ? ' · tancat' : ''}</option>`).join('')}</select><input type="search" id="prod-q" placeholder="Cerca partides…" value="${esc(V.prodQ || '')}" aria-label="Cerca partides"><span style="flex:1"></span>${CANWRITE ? `<button class="btn sm" data-act="prodTanca">${blo ? 'Reobre el mes' : 'Tanca el mes'}</button>` : ''}</div>
  <div class="small" style="margin-bottom:8px">Entra l'amidament o el percentatge <b>a origen</b>. Enter passa a la línia següent. A la fila del capítol pots posar un mateix percentatge a totes les seves partides.${blo ? ' <b>Aquest mes està tancat.</b>' : ''}</div>
  <div class="kpis"><div class="kpi"><div class="l">Fins al mes anterior</div><div class="v" id="pt-ant"></div></div><div class="kpi"><div class="l">Producció del mes</div><div class="v" id="pt-mes"></div></div><div class="kpi"><div class="l">Producció a origen</div><div class="v" id="pt-or"></div></div><div class="kpi"><div class="l">% a origen</div><div class="v" id="pt-pct"></div></div></div>
  <div class="tw"><table class="quad"><thead><tr><th>Codi</th><th>Descripció</th><th>Ut</th><th class="num">Amid. contr.</th><th class="num">Fins mes anterior</th><th class="num">Amid. a origen</th><th class="num">% a origen</th><th class="num">Amid. del mes</th><th class="num">Import del mes</th><th class="num">Import a origen</th></tr></thead><tbody>
  ${gr.map((g) => `<tr class="cap" data-gr="${esc(g.c)}"><td colspan="6">${esc(g.c || SENSE_CAP)}</td><td><input class="ed" data-col="pg" data-pgr="1" inputmode="decimal" placeholder="%" aria-label="Percentatge per a tot el capítol" ${dis}></td><td colspan="3" class="num" data-c="gt"></td></tr>` + g.xs.map(fila).join('')).join('') || '<tr><td colspan="10" class="empty">Cap resultat.</td></tr>'}</tbody></table></div>
  <div class="barra"><span id="prod-st" class="small"></span><span class="sp"></span>${CANWRITE ? '<button class="btn" data-act="prodDesfes">Desfés els canvis</button><button class="btn pri" data-act="prodDesa">Desa la producció</button>' : ''}</div>`;
}
function prodTot() {
  if (!$('#pt-ant')) return;
  const its = prodItems(PD.obra); let a = 0, o = 0, v = 0; const gt = {};
  its.forEach((x) => { const c = prodCels(x), pv = +x.p.preuVenda || 0, k = x.p.capitol || ''; if (isNaN(c.o)) return; if (x.mk === 'modificats' && !['Aprovat', 'Executat'].includes(x.p.estat)) return; a += c.ant * pv; o += c.iOr; v += (+x.p.amidament || 0) * pv; const g = gt[k] || (gt[k] = { m: 0, o: 0 }); g.m += c.iMes; g.o += c.iOr; });
  $('#pt-ant').textContent = fmtM(a); $('#pt-mes').textContent = fmtM(o - a); $('#pt-or').textContent = fmtM(o); $('#pt-pct').textContent = v ? fmtN(o / v * 100) + '%' : '—';
  document.querySelectorAll('tr[data-gr]').forEach((r) => { const g = gt[r.dataset.gr] || { m: 0, o: 0 }; r.querySelector('[data-c=gt]').textContent = `Mes ${fmtM(g.m)} · origen ${fmtM(g.o)}`; });
  const n = Object.keys(PD.v).length; $('#prod-st').textContent = n ? `${n} ${n === 1 ? 'canvi' : 'canvis'} sense desar` : 'Tot desat';
  const b = document.querySelector('[data-act=prodDesa]'); if (b) b.disabled = !n;
}
function prodFila(x, menys) {
  const r = document.querySelector(`tr[data-pr="${CSS.escape(x.p.id)}"]`); if (!r) return;
  const c = prodCels(x), mal = isNaN(c.o) || c.o < 0;
  for (const k of ['am', 'pct']) { const i = r.querySelector(`[data-pin=${k}]`), d = PD.v[x.p.id]; i.classList.toggle('canvi', !!d && d.k === k); i.classList.toggle('mal', mal && !!d && d.k === k); if (i !== menys && !mal) i.value = k === 'am' ? N3(c.o) : c.pct == null ? '' : fmtN(c.pct); }
  r.querySelector('[data-c=mes]').textContent = mal ? '—' : N3(c.mes); r.querySelector('[data-c=mes]').style.color = c.mes < 0 ? 'var(--bad)' : ''; r.querySelector('[data-c=iMes]').textContent = mal ? '—' : fmtM(c.iMes); r.querySelector('[data-c=iOr]').textContent = mal ? '—' : fmtM(c.iOr);
}
async function prodDesa() {
  const its = prodItems(PD.obra).filter((x) => PD.v[x.p.id]), b = document.querySelector('[data-act=prodDesa]');
  if (tancat(PD.obra, PD.mes)) { toast('Aquest mes està tancat.'); return; }
  if (its.some((x) => { const v = prodVal(x); return isNaN(v) || v < 0; })) { toast('Hi ha valors que no són correctes, marcats en vermell.'); return; }
  b.disabled = true; let n = 0;
  for (const x of its) {
    const v = prodVal(x), { id, ...r } = x.p, pr = { ...prodDe(x.p), [PD.mes]: v };
    try { await save(x.mk, id, { ...r, prod: pr, executat: darrerProd(pr), __prod: 1 }); delete PD.v[id]; n++; const s = $('#prod-st'); if (s) s.textContent = `Desant ${n}/${its.length}…`; } catch (e) { toast(`S'ha aturat: desades ${n} de ${its.length}. La resta continua pendent.`); paint(); return; }
  }
  logA(`Producció de ${nomMesC(PD.mes).toLowerCase()} a ${obraTxt(PD.obra)}: ${n} partides`); toast('Producció desada.'); paint();
}
async function prodTanca() {
  if (Object.keys(PD.v).length) { toast('Desa o desfés els canvis abans.'); return; }
  const { id, ...o } = obra(PD.obra), l = o.prodTancat || [], t = l.includes(PD.mes);
  try { await save('obres', id, { ...o, prodTancat: t ? l.filter((m) => m !== PD.mes) : [...l, PD.mes].sort() }); } catch (e) { return; }
  logA(`Producció de ${nomMesC(PD.mes).toLowerCase()} ${t ? 'reoberta' : 'tancada'} a ${obraTxt(id)}`); toast(t ? 'Mes reobert.' : 'Mes tancat.'); paint();
}
document.addEventListener('input', (e) => {
  const t = e.target;
  if (t.id === 'prod-q') { V.prodQ = t.value; paint(); return; }
  if (t.dataset.pin) {
    const id = t.closest('tr').dataset.pr, x = prodItems(PD.obra).find((y) => y.p.id === id);
    PD.v[id] = { k: t.dataset.pin, t: t.value };
    if (!isNaN(prodVal(x)) && Math.abs(prodVal(x) - finsA(x.p, PD.mes, true)) < 1e-9) delete PD.v[id];
    prodFila(x, t); prodTot();
  }
});
document.addEventListener('change', (e) => {
  const t = e.target;
  if (t.id === 'prod-mes') { if (Object.keys(PD.v).length) { t.value = PD.mes; toast('Desa o desfés els canvis abans de canviar de mes.'); return; } PD.mes = t.value; paint(); }
  else if (t.dataset.pin) { const x = prodItems(PD.obra).find((y) => y.p.id === t.closest('tr').dataset.pr); if (x) { if (PD.v[x.p.id] && t.value.trim() === '') PD.v[x.p.id].t = '0'; prodFila(x); prodTot(); } }
  else if (t.dataset.pgr) {
    const n = llegeix(t.value), g = t.closest('tr').dataset.gr; if (n == null) return;
    if (isNaN(n) || n < 0) { toast('El percentatge no és correcte.'); return; }
    prodItems(PD.obra).filter((x) => (x.p.capitol || '') === g && +x.p.amidament).forEach((x) => { PD.v[x.p.id] = { k: 'pct', t: t.value }; if (Math.abs(prodVal(x) - finsA(x.p, PD.mes, true)) < 1e-9) delete PD.v[x.p.id]; prodFila(x); });
    prodTot();
  }
});
document.addEventListener('click', (e) => {
  const a = e.target.closest('[data-act]'); if (!a) return;
  if (a.dataset.act === 'prodDesa') prodDesa(); else if (a.dataset.act === 'prodTanca') prodTanca(); else if (a.dataset.act === 'prodDesfes') { PD.v = {}; paint(); }
});
window.addEventListener('beforeunload', (e) => { if (Object.keys(PD.v).length || Object.keys(QD).length) e.preventDefault(); });

const _listO = listHtml;
listHtml = function (mk, fo) { return mk === 'produccio' ? prodHtml(fo) : mk === 'indirectes' ? quadreHtml(fo) : _listO(mk, fo); };
const _paintO = paint;
paint = function () { _paintO(); prodTot(); quadreTot(); };
