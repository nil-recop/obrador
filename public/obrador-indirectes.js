/* Indirectes de l'obra: dedicacions de l'equip tècnic, dietes, desplaçaments, càrregues financeres i altres costos sense factura.
   Import = quantitat × preu (amb «% de l'import», quantitat % del preu) o entrat directament. Sempre és cost indirecte. */
const IND_TIPUS = ['Dedicació cap de grup', "Dedicació cap d'obra", 'Dedicació cap de producció', 'Dietes', 'Desplaçaments i peatges', 'Càrregues financeres internes', 'Altres costos sense factura'];
const IND_UT = ['hores', 'dies', 'mesos', "% de l'import", 'km', 'unitats'];
const IND_FIN = IND_TIPUS[5], IND_ALTRES = IND_TIPUS[6];
S.indirectes = [];
COLS.push('indirectes');
const indCalc = (o) => (buit(o.quantitat) || buit(o.preu) ? null : r2((+o.quantitat) * (+o.preu) / (o.unitat === IND_UT[3] ? 100 : 1)));
const nQ = (v) => (+v).toLocaleString('ca-ES', { maximumFractionDigits: 3, useGrouping: 'always' });
M.indirectes = { t: 'Indirectes', s: 'imputació', tit: 'tipus', sort: 'data', camps: [
  { k: 'obraId', l: 'Obra', tp: 'obra', req: 1 }, { k: 'data', l: 'Data (o mes que correspon)', tp: 'date', req: 1 },
  { k: 'tipus', l: 'Tipus', tp: 'sel', o: IND_TIPUS }, { k: 'persona', l: 'Persona', tp: 'text', ph: 'Nom i cognoms' },
  { k: 'concepte', l: 'Concepte', tp: 'text', w: 1 },
  { k: 'quantitat', l: 'Quantitat o dedicació', tp: 'num' }, { k: 'unitat', l: 'Unitat', tp: 'sel', o: IND_UT },
  { k: 'preu', l: 'Preu per unitat (€)', tp: 'money', d: 2 }, { k: 'import', l: 'Import (€)', tp: 'money', d: 2, req: 1 },
  { k: 'notes', l: 'Notes', tp: 'area', w: 1 }],
cols: ['data', 'obraId', 'tipus', 'persona', 'concepte', { l: 'Quantitat', num: 1, f: (o) => (buit(o.quantitat) ? '—' : esc(nQ(o.quantitat) + ' ' + (o.unitat === IND_UT[3] ? '%' : o.unitat || ''))) }, { l: 'Preu', num: 1, f: (o) => (buit(o.preu) ? '—' : MF2.format(+o.preu)) }, 'import'] };

const _finI = fin;
fin = function (oid) {
  const f = _finI(oid);
  f.indImp = sum(S.indirectes.filter((x) => x.obraId === oid), (x) => +x.import);
  f.indirecte += f.indImp;
  f.cost += f.indImp;
  f.marge = f.certificat ? (f.certificat - f.cost) / f.certificat : null;
  return f;
};

/* Pestanya de l'obra: quadre de tots els indirectes i llista */
const _listI = listHtml;
listHtml = function (mk, fo) {
  const h = _listI(mk, fo);
  if (mk !== 'indirectes' || !fo) return h;
  const f = fin(fo), e = econ(fo), xs = S.indirectes.filter((x) => x.obraId === fo);
  const fila = (l, v, s, b) => `<tr style="cursor:default"><td${b ? ' style="font-weight:600"' : ''}>${l}${s ? `<div class="small">${s}</div>` : ''}</td><td class="num"${b ? ' style="font-weight:600"' : ''}>${MF2.format(v)}</td></tr>`;
  const dis = e.indPrev == null ? null : e.indPrev - f.indirecte;
  return `<section class="panel" style="margin-bottom:16px"><h2>Cost indirecte de l'obra<span class="sp"></span><span class="small">Imports sense IVA</span></h2><div class="econ-g">
  <table><thead><tr><th>Entrat en aquest apartat</th><th class="num">Import</th></tr></thead><tbody>${IND_TIPUS.map((t) => fila(esc(t), sum(xs.filter((x) => x.tipus === t), (x) => +x.import))).join('')}${fila('Total Indirectes', f.indImp, '', 1)}</tbody></table>
  <table><thead><tr><th>Cost indirecte total</th><th class="num">Import</th></tr></thead><tbody>${fila('Aquest apartat', f.indImp)}${fila('Compres i factures indirectes', f.indCompres, 'Ve de Compres i Facturació')}${fila('Hores de tècnics', f.indMa, 'Ve dels parts')}${fila('Dietes i desplaçaments', f.extres, 'Ve dels parts')}${fila('Total', f.indirecte, '', 1)}${e.indPrev == null ? fila('Previst', 0, 'Sense previsió: s\'entra a «Edita l\'obra»').replace(MF2.format(0), '—') : fila('Previst', e.indPrev) + fila('Disponible', dis, '', 1).replace('font-weight:600">' + MF2.format(dis), `font-weight:600;color:${dis < 0 ? 'var(--bad)' : 'inherit'}">${MF2.format(dis)}`)}</tbody></table></div></section>` + h;
};

/* Formulari */
function indForm() {
  const fm = $('#frm');
  if (!fm || fm.dataset.mk !== 'indirectes') return;
  const e = fm.elements, o = { quantitat: e.quantitat.value, preu: e.preu.value, unitat: e.unitat.value, tipus: e.tipus.value }, c = indCalc(o);
  e.import.readOnly = c != null; e.import.style.opacity = c != null ? '.7' : '';
  if (c != null) e.import.value = c.toFixed(2);
  const pct = o.unitat === IND_UT[3];
  document.querySelector('label[for="fld-preu"]').textContent = pct ? 'Import sobre el qual s\'aplica (€)' : 'Preu per unitat (€)';
  e.persona.closest('.fld').style.display = [IND_FIN].includes(o.tipus) ? 'none' : '';
  let box = $('#ind-info');
  if (!box) { fm.insertAdjacentHTML('afterend', '<div class="small" id="ind-info"></div><datalist id="ind-pers"></datalist>'); box = $('#ind-info'); e.persona.setAttribute('list', 'ind-pers'); e.persona.autocomplete = 'off'; $('#ind-pers').innerHTML = S.personal.filter((p) => p.estat !== 'Inactiu').map((p) => `<option value="${esc(p.nom)}">`).join(''); }
  const nom = normC(e.persona.value), mes = e.data.value.slice(0, 7), ded = o.tipus.startsWith('Dedicació');
  const ps = nom && o.tipus !== IND_FIN && mes ? S.parts.filter((p) => p.obraId === e.obraId.value && String(p.data).startsWith(mes) && (normC(p.treballador) === nom || normC((S.personal.find((x) => x.id === p.personaId) || {}).nom) === nom)) : [];
  const dup = ded ? sum(ps, horesCost) : ['Dietes', 'Desplaçaments i peatges'].includes(o.tipus) ? sum(ps, o.tipus === 'Dietes' ? (p) => +p.dietes || 0 : (p) => +p.desplacament || 0) : 0;
  box.innerHTML = (c != null ? `Import calculat: ${nQ(o.quantitat)}${pct ? ' % de ' : ' × '}${MF2.format(+o.preu)} = <b>${MF2.format(c)}</b>.` : 'Entra la quantitat i el preu, o bé l\'import directament.')
    + (dup ? `<div style="color:var(--warn)">Aquesta persona ja té ${MF2.format(dup)} del mateix concepte als parts d'aquest mes en aquesta obra. Si és el mateix cost, no l'entris dues vegades.</div>` : '')
    + (o.tipus === IND_FIN ? '<div style="color:var(--warn)">Comprova que aquesta càrrega no estigui ja inclosa en el percentatge de cost d\'estructura.</div>' : '');
}
const _openI = openForm;
openForm = function (mk, id, def) { _openI(mk, id, def); indForm(); };
document.addEventListener('input', (e) => {
  if (!e.target.closest || !e.target.closest('#frm')) return;
  const fm = $('#frm');
  if (fm.dataset.mk === 'indirectes' && !fm.dataset.id) {
    // En una imputació nova proposa la unitat i el cost hora de la fitxa.
    const el = fm.elements;
    if (e.target.name === 'tipus') el.unitat.value = e.target.value === 'Dietes' ? 'dies' : e.target.value === IND_FIN || e.target.value === IND_ALTRES || e.target.value === 'Desplaçaments i peatges' ? 'unitats' : 'hores';
    if (e.target.name === 'persona' && el.unitat.value === 'hores' && !el.preu.value) { const p = S.personal.find((x) => normC(x.nom) === normC(e.target.value)); if (p && +p.costHora) el.preu.value = p.costHora; }
  }
  indForm();
});
const _saveI = saveForm;
saveForm = async function () {
  const fm = $('#frm');
  if (fm && fm.dataset.mk === 'indirectes') {
    indForm();
    if (fm.elements.tipus.value === IND_FIN) fm.elements.persona.value = '';
    const { o } = readForm();
    if (o.tipus === IND_ALTRES && !String(o.concepte || '').trim()) { toast('Explica el concepte d\'aquest cost.'); fm.elements.concepte.focus(); return; }
    if (!buit(o.import) && !+o.import) { toast('L\'import no pot ser zero.'); fm.elements.import.focus(); return; }
  }
  return _saveI();
};
