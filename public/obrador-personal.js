/* Personal d'obra: fitxa per persona (sense compte) i control dels seus parts. */
(() => {
  const mesos = ['gener', 'febrer', 'març', 'abril', 'maig', 'juny', 'juliol', 'agost', 'setembre', 'octubre', 'novembre', 'desembre'];
  const nomMes = (m) => mesos[+m.slice(5) - 1] + ' ' + m.slice(0, 4);
  const F = { persona: '', mes: '' };
  const partsDe = (id) => S.parts.filter((p) => p.personaId === id);
  const nHores = (a) => (Math.round(sum(a, (p) => +p.hores) * 100) / 100).toLocaleString('ca-ES');
  const persOrd = () => S.personal.slice().sort((a, b) => String(a.nom).localeCompare(String(b.nom), 'ca'));
  const persOpts = (sel, buit) => `<option value="">${esc(buit)}</option>` + persOrd().map((p) => `<option value="${esc(p.id)}" ${p.id === sel ? 'selected' : ''}>${esc(p.nom)}${p.estat === 'Inactiu' ? ' (inactiu)' : ''}</option>`).join('');

  NAV.forEach((g) => g.items.forEach((i) => { if (i[0] === 'personal') i[1] = 'Personal i parts'; }));
  M.personal.t = 'Personal i parts';
  M.personal.camps.splice(1, 0, { k: 'rol', l: 'Rol', tp: 'sel', o: ['Treballador/a', 'Encarregat/ada', 'Tècnic/a'] });
  M.personal.cols = ['nom', 'rol', 'categoria', 'vinculacio',
    { l: 'Parts', num: 1, f: (o) => partsDe(o.id).length || '—' },
    { l: 'Hores del mes', num: 1, f: (o) => nHores(partsDe(o.id).filter((p) => String(p.data).startsWith(today().slice(0, 7)))) },
    { l: 'Hores totals', num: 1, f: (o) => nHores(partsDe(o.id)) },
    { l: 'Cost total', num: 1, f: (o) => fmtM(sum(partsDe(o.id), costPart)) }, 'prl', 'aptitud', 'estat'];
  M.parts.camps.splice(2, 0, { k: 'personaId', l: 'Persona', tp: 'persona' });

  const _cell = cellVal;
  cellVal = function (mk, c, r) {
    if (mk === 'personal' && c === 'estat') return { h: `<span class="pill t-${r.estat === 'Actiu' ? 'ok' : 'neu'}">${esc(r.estat || '—')}</span>` };
    return _cell(mk, c, r);
  };
  const _field = fieldHtml;
  fieldHtml = function (f, v) {
    if (f.tp !== 'persona') return _field(f, v);
    const perdut = v && !S.personal.some((p) => p.id === v);
    return `<div class="fld"><label for="fld-${f.k}">${esc(f.l)}</label><select id="fld-${f.k}" name="${f.k}" ${CANWRITE ? '' : 'disabled'}>${persOpts(v, '— Sense fitxa —')}${perdut ? `<option value="${esc(v)}" selected>Fitxa eliminada</option>` : ''}</select></div>`;
  };
  // Triar la persona omple el nom, la categoria i el cost en un part nou.
  document.addEventListener('change', (e) => {
    const t = e.target;
    if (t.id === 'fld-personaId') {
      const p = S.personal.find((x) => x.id === t.value), fm = $('#frm');
      if (p && fm && !fm.dataset.id) {
        fm.elements.treballador.value = p.nom || '';
        if (p.costHora) fm.elements.preuHora.value = p.costHora;
        const o = fm.elements.ofici;
        if (p.categoria && o) { if (![...o.options].some((x) => x.value === p.categoria)) o.add(new Option(p.categoria, p.categoria)); o.value = p.categoria; }
      }
    } else if (t.dataset.pers) { F[t.dataset.pers] = t.value; paint(); }
  });

  const _list = listHtml;
  listHtml = function (mk, fo) {
    if (mk !== 'parts') return _list(mk, fo);
    const tots = S.parts, del = tots.filter((p) => !fo || p.obraId === fo);
    if (!del.length) return _list(mk, fo);
    const ms = [...new Set(del.map((p) => String(p.data || '').slice(0, 7)).filter((m) => m.length === 7))].sort().reverse();
    const mes = ms.includes(F.mes) ? F.mes : '';
    const filtra = (p) => (!F.persona || (F.persona === '-' ? !S.personal.some((x) => x.id === p.personaId) : p.personaId === F.persona)) && (!mes || String(p.data).startsWith(mes));
    const bar = `<div class="tools"><select id="fp-persona" data-pers="persona" aria-label="Filtra per persona">${persOpts(F.persona, 'Totes les persones')}<option value="-" ${F.persona === '-' ? 'selected' : ''}>Parts sense fitxa</option></select>
      <select id="fp-mes" data-pers="mes" aria-label="Filtra per mes"><option value="">Tots els mesos</option>${ms.map((m) => `<option value="${m}" ${m === mes ? 'selected' : ''}>${nomMes(m)}</option>`).join('')}</select></div>`;
    if (!del.some(filtra)) return bar + '<div class="empty"><b>Cap part amb aquests filtres</b>Tria una altra persona o un altre mes.</div>';
    S.parts = tots.filter(filtra);
    try { return bar + _list(mk, fo); } finally { S.parts = tots; }
  };

  const _form = openForm;
  openForm = function (mk, id, def) {
    _form(mk, id, def);
    if (mk !== 'personal' || !id) return;
    const b = $('#drawerHost .body');
    if (!b) return;
    const ps = partsDe(id).sort((x, y) => String(y.data).localeCompare(String(x.data))), gr = {};
    ps.forEach((p) => { const m = String(p.data || '').slice(0, 7); (gr[m] = gr[m] || []).push(p); });
    b.insertAdjacentHTML('beforeend', `<div><b>Parts de treball</b><div class="muted" style="font-size:12.5px;margin:2px 0 8px">Aquesta fitxa no dona accés a l'Obrador.</div>${ps.length ? Object.keys(gr).sort().reverse().map((m) => `<details ${m === Object.keys(gr).sort().pop() ? 'open' : ''} style="margin-bottom:8px"><summary style="cursor:pointer"><b>${m.length === 7 ? nomMes(m) : 'Sense data'}</b> · ${nHores(gr[m])} h · ${fmtM(sum(gr[m], costPart))}</summary>
      <div class="tw" style="margin-top:6px"><table><thead><tr><th>Data</th><th>Obra</th><th class="num">Hores</th><th class="num">Cost</th></tr></thead><tbody>${gr[m].map((p) => `<tr data-act="edit" data-mk="parts" data-id="${esc(p.id)}"><td>${fmtD(p.data)}</td><td>${obraLbl(p.obraId)}</td><td class="num">${esc(p.hores)}</td><td class="num">${fmtM(costPart(p))}</td></tr>`).join('')}</tbody></table></div></details>`).join('') : '<div class="muted">Encara no té cap part.</div>'}</div>`);
  };
})();
