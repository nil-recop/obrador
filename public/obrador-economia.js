/* Detalls econòmics de l'obra: baixa i cost d'estructura.
   Contracte = licitació × (1 − baixa). Si no hi ha licitació, val l'import de contracte entrat a mà.
   Contracte vigent = contracte + modificats aprovats (ja porten la baixa).
   Estructura prevista = % × contracte vigent. Estructura acumulada = % × certificat. Imports sense IVA. */
const ESTR_DEFECTE = 12;
S.config = [];
COLS.push('config');
const buit = (v) => v == null || v === '';
const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const estrGeneral = () => { const c = S.config.find((x) => x.id === 'empresa'); return c && !buit(c.estructura) ? +c.estructura : ESTR_DEFECTE; };
const estrPct = (o) => (o && !buit(o.estructura) ? +o.estructura : estrGeneral());
const contracteDe = (o) => (+o.licitacio > 0 ? r2(+o.licitacio * (1 - (+o.baixa || 0) / 100)) : +o.pressupost || 0);
const p1 = (v) => (v == null ? '—' : (v * 100).toLocaleString('ca-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%');
const pn = (v) => (+v || 0).toLocaleString('ca-ES', { minimumFractionDigits: 2, maximumFractionDigits: 4 }) + '%';
function econ(id) {
  const o = obra(id) || {}, f = fin(id), pct = estrPct(o);
  const contracte = contracteDe(o), lic = +o.licitacio || 0;
  const modAp = sum(S.modificats.filter((m) => m.obraId === id && ['Aprovat', 'Executat'].includes(m.estat)), (m) => +m.import);
  const vigent = contracte + modAp, estPrev = vigent * pct / 100, estAcum = f.certificat * pct / 100;
  const brut = f.certificat - f.cost, net = brut - estAcum;
  return { o, f, pct, propi: !buit(o.estructura), lic, baixaI: lic ? lic - contracte : 0, contracte, modAp, vigent, estPrev, estAcum, brut, net,
    brutPct: f.certificat ? brut / f.certificat : null, netPct: f.certificat ? net / f.certificat : null, costMax: vigent - estPrev };
}

/* Camps de l'obra */
(() => {
  const c = M.obres.camps, i = c.findIndex((f) => f.k === 'pressupost');
  c[i].l = 'Import contracte (PEC, sense IVA)'; c[i].d = 2;
  c.splice(i, 0, { k: 'licitacio', l: 'Import de licitació (sense IVA)', tp: 'money', d: 2 }, { k: 'baixa', l: 'Baixa (%)', tp: 'pct' });
  c.splice(i + 3, 0, { k: 'estructura', l: "Cost d'estructura (%) — buit: general", tp: 'pct' });
  const k = M.obres.cols.indexOf('pressupost');
  M.obres.cols[k] = { l: 'Contracte', num: 1, f: (o) => fmtM(contracteDe(o)) };
  M.obres.cols.splice(k, 0, { l: 'Baixa', num: 1, f: (o) => (+o.licitacio > 0 ? pn(o.baixa) : '—') });
  M.obres.cols.push({ l: 'Marge net', num: 1, f: (o) => pctHtml(econ(o.id).netPct) });
})();

/* Formulari: el contracte es calcula sol quan hi ha licitació */
function econForm() {
  const fm = $('#frm');
  if (!fm || fm.dataset.mk !== 'obres') return;
  const e = fm.elements, lic = +e.licitacio.value || 0, auto = lic > 0;
  e.pressupost.readOnly = auto;
  e.pressupost.style.opacity = auto ? '.7' : '';
  if (auto) e.pressupost.value = contracteDe({ licitacio: lic, baixa: e.baixa.value }).toFixed(2);
  const box = $('#econ-calc');
  if (!box) return;
  const ct = +e.pressupost.value || 0, pct = buit(e.estructura.value) ? estrGeneral() : +e.estructura.value;
  box.innerHTML = (auto ? `<span>Licitació</span><b>${MF2.format(lic)}</b><span>Baixa ${pn(e.baixa.value)}</span><b>−${MF2.format(lic - ct)}</b>` : '')
    + `<span style="font-weight:600">Contracte sense IVA</span><b>${MF2.format(ct)}</b><span>Estructura ${pn(pct)}${buit(e.estructura.value) ? ' (general)' : ''}</span><b>${MF2.format(ct * pct / 100)}</b>`
    + (!auto && +e.baixa.value ? '<span style="grid-column:1/-1;color:var(--warn)">La baixa no s\'aplica fins que entris l\'import de licitació.</span>' : '');
}
const _formEcon = openForm;
openForm = function (mk, id, def) {
  _formEcon(mk, id, def);
  if (mk !== 'obres' || !$('#frm') || $('#frm').dataset.mk !== 'obres') return;
  $('#frm').insertAdjacentHTML('afterend', '<div class="calc" id="econ-calc"></div>');
  econForm();
};
document.addEventListener('input', (e) => { if (e.target.closest && e.target.closest('#frm')) econForm(); });
const _saveEcon = saveForm;
saveForm = async function () {
  const fm = $('#frm');
  if (fm && fm.dataset.mk === 'obres') {
    for (const k of ['baixa', 'estructura']) {
      const v = fm.elements[k].value;
      if (v !== '' && (+v < 0 || +v > 100)) { toast('La baixa i l\'estructura han de ser entre 0 i 100%.'); fm.elements[k].focus(); return; }
    }
    if (+fm.elements.licitacio.value < 0) { toast('L\'import de licitació no pot ser negatiu.'); return; }
    econForm();
  }
  return _saveEcon();
};

/* Control: marge final descomptant estructura */
const _ctl = ctlObra;
ctlObra = function (id) {
  const k = _ctl(id), e = econ(id);
  k.contracte = e.vigent; k.estPct = e.pct; k.estPrev = e.estPrev; k.estVenda = k.venda * e.pct / 100;
  k.margeNet = k.marge == null ? null : k.marge - e.pct / 100;
  return k;
};

/* Panell de la fitxa de l'obra */
function econPanel(id) {
  const e = econ(id), k = ctlObra(id), col = (v) => (v < 0 ? 'var(--bad)' : 'var(--ok)');
  const fila = (l, v, s, st) => `<tr style="cursor:default"><td${st ? ' style="font-weight:600"' : ''}>${l}${s ? `<div class="small">${s}</div>` : ''}</td><td class="num"${st ? ` style="font-weight:600;${st === true ? '' : 'color:' + st}"` : ''}>${v}</td></tr>`;
  const teCert = e.f.certificat > 0, tePart = k.ps.length > 0;
  return `<section class="panel" style="margin-bottom:16px"><h2>Detalls econòmics<span class="sp"></span><span class="small">Imports sense IVA</span></h2><div class="econ-g">
  <table><thead><tr><th>Contracte</th><th class="num">Import</th></tr></thead><tbody>
   ${e.lic ? fila('Import de licitació', MF2.format(e.lic)) + fila(`Baixa ${pn(e.o.baixa)}`, '−' + MF2.format(e.baixaI)) : fila('Baixa', '—', 'Entra l\'import de licitació i la baixa a «Edita l\'obra».')}
   ${fila('Contracte (PEC)', MF2.format(e.contracte), '', true)}
   ${fila('Contradictòries aprovades', MF2.format(e.modAp))}
   ${fila('Contracte vigent', MF2.format(e.vigent), '', true)}
   ${fila(`Cost d'estructura previst ${pn(e.pct)}`, '−' + MF2.format(e.estPrev), e.propi ? 'Percentatge propi d\'aquesta obra' : 'Percentatge general de l\'empresa')}
   ${fila('Cost d\'obra màxim per no perdre', MF2.format(e.costMax), 'Contracte vigent − estructura', true)}
  </tbody></table>
  <table><thead><tr><th>Resultat fins avui</th><th class="num">Import</th></tr></thead><tbody>
   ${fila('Certificat', MF2.format(e.f.certificat))}
   ${fila('Cost d\'obra real', '−' + MF2.format(e.f.cost), `Compres ${fmtM(e.f.compres)} · mà d'obra ${fmtM(e.f.ma)}`)}
   ${fila('Marge brut', teCert ? `${MF2.format(e.brut)} · ${p1(e.brutPct)}` : MF2.format(e.brut), '', true)}
   ${fila(`Cost d'estructura ${pn(e.pct)} del certificat`, '−' + MF2.format(e.estAcum))}
   ${fila('Marge net', teCert ? `${MF2.format(e.net)} · ${p1(e.netPct)}` : MF2.format(e.net), teCert ? '' : 'Encara no hi ha res certificat', col(e.net))}
   ${tePart ? fila('Marge net final previst', p1(k.margeNet), `Segons les partides: brut ${p1(k.marge)} − estructura ${pn(e.pct)}. Els preus de venda han de portar la baixa.`, col(k.margeNet || 0)) : ''}
  </tbody></table></div></section>`;
}
(() => { const s = document.createElement('style'); s.textContent = '.econ-g{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr));gap:0 24px;padding:4px 14px 12px}.econ-g table{width:100%;min-width:0}.econ-g td.num{white-space:nowrap;vertical-align:top}.econ-g .small{font-weight:400}#econ-calc{margin-top:12px}'; document.head.append(s); })();

/* Percentatge general */
function estrConfigHtml() {
  return `<section class="panel" style="margin-bottom:16px"><h2>Cost d'estructura de l'empresa</h2><div class="pb" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><label for="estr-g">Percentatge general sobre la venda (PEC) sense IVA</label><input id="estr-g" type="number" min="0" max="100" step="any" value="${estrGeneral()}" ${CANWRITE ? '' : 'disabled'} style="width:90px;border:1px solid var(--line);background:var(--surface);color:var(--ink);border-radius:5px;padding:7px 10px;font:inherit"> %
  ${CANWRITE ? '<button class="btn sm" data-act="saveEstr">Desa</button>' : ''}<span class="small">S'aplica a totes les obres que no tinguin un percentatge propi.</span></div></section>`;
}
document.addEventListener('click', async (e) => {
  if (!e.target.closest('[data-act="saveEstr"]')) return;
  const t = $('#estr-g').value, v = +t;
  if (t === '' || !(v >= 0 && v <= 100)) { toast('El percentatge ha de ser entre 0 i 100.'); return; }
  const prev = S.config.find((x) => x.id === 'empresa') || {}, ant = estrGeneral();
  try { await save('config', 'empresa', { ...prev, estructura: v }); } catch (x) { return; }
  if (ant !== v) logA(`Cost d'estructura general: ${pn(ant)} → ${pn(v)}`);
  toast('Percentatge general desat.');
});
