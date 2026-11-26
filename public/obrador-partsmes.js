/* Parts mensuals: el cost de mà d'obra d'un mes entrat a mà, sense parts diaris.
   Import = cost de les hores; dietes i desplaçaments a part (sempre directes). Directe o indirecte com un part. */
S.partsMes = [];
COLS.push('partsMes');
M.partsMes = { t: 'Parts mensuals', s: 'part mensual', tit: 'treballador', sort: 'mes', camps: [
  { k: 'obraId', l: 'Obra', tp: 'obra', req: 1 }, { k: 'mes', l: 'Mes', tp: 'mes', req: 1 },
  { k: 'treballador', l: 'Treballador o equip', tp: 'text', ph: 'Equip de l\'obra' },
  { k: 'ofici', l: 'Categoria', tp: 'sel', o: [''].concat(M.parts.camps.find((f) => f.k === 'ofici').o) },
  { k: 'hores', l: 'Hores (opcional)', tp: 'num' }, { k: 'import', l: 'Cost de les hores (€)', tp: 'money', d: 2, req: 1 },
  { k: 'dietes', l: 'Dietes (€)', tp: 'money', d: 2 }, { k: 'desplacament', l: 'Desplaçaments (€)', tp: 'money', d: 2 },
  { k: 'tipusCost', l: 'Cost de les hores', tp: 'sel', o: TC }, { k: 'notes', l: 'Notes', tp: 'area', w: 1 }],
cols: [{ l: 'Mes', f: (o) => esc(/^\d{4}-\d\d$/.test(o.mes) ? nomMesC(o.mes) : o.mes || '—') }, 'obraId', 'treballador', 'ofici', 'hores', 'import', { l: 'Dietes i despl.', num: 1, f: (o) => fmtM(extresCost(o)) }, { l: 'Cost total', num: 1, f: (o) => fmtM(pmCost(o)) }, { l: 'Hores com a', f: (o) => natHtml(natPart(o), o.tipusCost) }] };
const pmHores = (p) => +p.import || 0;
const pmCost = (p) => pmHores(p) + extresCost(p);
const _fieldPM = fieldHtml;
fieldHtml = function (f, v) {
  if (f.tp !== 'mes') return _fieldPM(f, v);
  return `<div class="fld"><label for="fld-${f.k}">${esc(f.l)} *</label><input id="fld-${f.k}" name="${f.k}" type="month" value="${esc(v || mesAra())}" ${CANWRITE ? '' : 'disabled'} required></div>`;
};
const _saveFPM = saveForm;
saveForm = async function () {
  const fm = $('#frm');
  if (fm && fm.dataset.mk === 'partsMes') {
    const e = fm.elements;
    if (!/^\d{4}-\d\d$/.test(e.mes.value)) { toast('El mes ha de tenir el format AAAA-MM.'); e.mes.focus(); return; }
    if (!e.treballador.value.trim()) e.treballador.value = 'Equip de l\'obra';
    for (const k of ['hores', 'import', 'dietes', 'desplacament']) if (+e[k].value < 0) { toast('Els valors no poden ser negatius.'); e[k].focus(); return; }
  }
  return _saveFPM();
};

/* Costos de l'obra */
const _finPM = fin;
fin = function (oid) {
  const f = _finPM(oid), ps = S.partsMes.filter((p) => p.obraId === oid);
  const ma = sum(ps, pmHores), dir = sum(ps.filter((p) => natPart(p) === 'Directe'), pmHores), ex = sum(ps, extresCost);
  f.ma += ma + ex; f.dirMa += dir; f.indMa += ma - dir; f.extres += ex; f.pmCost = ma + ex;
  f.directe += dir + ex; f.indirecte += ma - dir; f.cost += ma + ex;
  f.marge = f.certificat ? (f.certificat - f.cost) / f.certificat : null;
  return f;
};

/* A Parts: els mensuals sota els diaris */
const _listPM = listHtml;
listHtml = function (mk, fo) {
  const h = _listPM(mk, fo);
  if (mk !== 'parts') return h;
  const ps = S.partsMes.filter((p) => !fo || p.obraId === fo).sort((a, b) => String(b.mes).localeCompare(String(a.mes)));
  const cols = M.partsMes.cols.filter((c) => !(fo && c === 'obraId'));
  const hd = (c) => (typeof c === 'object' ? c : { l: M.partsMes.camps.find((f) => f.k === c).l.replace(/ \(.*\)$/, ''), num: ['money', 'num'].includes(M.partsMes.camps.find((f) => f.k === c).tp) });
  return h + `<section class="panel" style="margin-top:18px"><h2>Parts mensuals<span class="sp"></span>${ps.length ? `<span class="small">${fmtM(sum(ps, pmCost))}</span>` : ''}${CANWRITE ? `<button class="btn sm pri" data-act="new" data-mk="partsMes" ${fo ? `data-def='${esc(JSON.stringify({ obraId: fo }))}'` : ''}>+ Part mensual</button>` : ''}</h2>
  ${ps.length ? `<div class="tw" style="border:0"><table><thead><tr>${cols.map((c) => { const x = hd(c); return `<th class="${x.num ? 'num' : ''}">${esc(x.l)}</th>`; }).join('')}</tr></thead><tbody>${ps.map((r) => `<tr data-act="edit" data-mk="partsMes" data-id="${esc(r.id)}">${cols.map((c, i) => { const v = cellVal('partsMes', c, r); return `<td class="${v.num ? 'num' : ''} ${i === 0 ? 't-main' : ''}">${v.h}</td>`; }).join('')}</tr>`).join('')}</tbody></table></div>` : `<div class="pb small">Per entrar el cost de mà d'obra d'un mes sencer sense parts diaris. Compta com a cost de l'obra igual que els parts.</div>`}</section>`;
};
