/* Lectura de documents de compra i d'Excel. Tot es fa dins del navegador: cap document surt cap a cap servei.
   Les llibreries es carreguen només quan calen, amb versió fixa i empremta comprovada. */
const ObradorLectura = (() => {
  const CDN = 'https://cdn.jsdelivr.net/npm/';
  const PDF = CDN + 'pdfjs-dist@4.10.38/';
  const LL = {
    pdf: [PDF + 'legacy/build/pdf.min.mjs', 'sha384-z/XbAtvhBXJoK+yvYimnFuTCF6/2wTCDSIFD09/HtIfwFtvDKOMdAe5Z3wOChkmW'],
    pdfw: [PDF + 'legacy/build/pdf.worker.min.mjs', 'sha384-vbNBYP03jHFPlgtK4qSXtazEmGfmpTWlSsfq9OiU20MroW/Q9TbaEXiM7PpeWg+6'],
    xlsx: ['https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js', 'sha384-EnyY0/GSHQGSxSgMwaIPzSESbqoOLSexfnSMN2AP+39Ckmn92stwABZynq1JyzdT'],
    ocr: [CDN + 'tesseract.js@5.1.1/dist/tesseract.min.js', 'sha384-GJqSu7vueQ9qN0E9yLPb3Wtpd7OrgK8KmYzC8T1IysG1bcvxvIO4qtYR/D3A991F'],
  };
  const fet = {};
  const blobJs = async ([u, integrity]) => URL.createObjectURL(new Blob([await (await fetch(u, { integrity, referrerPolicy: 'no-referrer' })).text()], { type: 'text/javascript' }));
  const un = (k, f) => (fet[k] = fet[k] || f().catch((e) => { delete fet[k]; throw e; }));
  const guio = ([src, integrity]) => new Promise((ok, no) => { const s = document.createElement('script'); Object.assign(s, { src, integrity, crossOrigin: 'anonymous', onload: ok, onerror: () => no(new Error('llibreria')) }); document.head.append(s); });
  const pdfjs = () => un('pdf', async () => { const m = await import(await blobJs(LL.pdf)); m.GlobalWorkerOptions.workerSrc = await blobJs(LL.pdfw); return m; });
  const xlsx = () => un('xlsx', async () => { await guio(LL.xlsx); return window.XLSX; });
  const ocr = () => un('ocr', async () => {
    await guio(LL.ocr);
    return window.Tesseract.createWorker(['spa', 'cat'], 1, { workerPath: CDN + 'tesseract.js@5.1.1/dist/worker.min.js', corePath: CDN + 'tesseract.js-core@5.1.1/tesseract-core-simd-lstm.wasm.js' });
  });
  const obrePdf = async (blob) => (await pdfjs()).getDocument({ data: await blob.arrayBuffer(), isEvalSupported: false, cMapUrl: PDF + 'cmaps/', cMapPacked: true, standardFontDataUrl: PDF + 'standard_fonts/' }).promise;

  /* ---------- Text d'un document en línies ---------- */
  function agrupa(its) {
    const ls = [];
    its.filter((i) => i.s.trim()).sort((a, b) => a.y - b.y || a.x - b.x).forEach((i) => {
      const l = ls.find((q) => Math.abs(q.y - i.y) < Math.max(2.5, (i.h || 8) * 0.45));
      if (l) l.items.push(i); else ls.push({ y: i.y, items: [i] });
    });
    ls.sort((a, b) => a.y - b.y);
    return ls.map((l) => {
      l.items.sort((a, b) => a.x - b.x);
      // Trossos separats per un buit gran: columnes diferents.
      const cel = [];
      l.items.forEach((i) => {
        const u = cel[cel.length - 1], buit = u ? i.x - (u.x + u.w) : 0;
        if (u && buit < Math.max(6, (i.h || 8) * 1.1)) { u.s += (buit > (i.h || 8) * 0.18 && !u.s.endsWith(' ') ? ' ' : '') + i.s; u.w = i.x + i.w - u.x; }
        else cel.push({ s: i.s, x: i.x, w: i.w });
      });
      cel.forEach((c) => { c.s = c.s.replace(/\s+/g, ' ').trim(); });
      return { cel, text: cel.map((c) => c.s).join('  ') };
    });
  }
  async function linies(blob, avisa) {
    const out = [];
    let escanejat = false;
    const deOcr = async (img) => {
      if (avisa) avisa('És una imatge: llegint el text, pot trigar un minut…');
      escanejat = true;
      const { data } = await (await ocr()).recognize(img);
      return agrupa((data.words || []).map((w) => ({ s: w.text, x: w.bbox.x0, y: (w.bbox.y0 + w.bbox.y1) / 2, w: w.bbox.x1 - w.bbox.x0, h: w.bbox.y1 - w.bbox.y0 })));
    };
    if (/^image\//.test(blob.type)) { out.push(...await deOcr(blob)); return { linies: out, escanejat }; }
    const doc = await obrePdf(blob), n = doc.numPages;
    const pags = n <= 4 ? [...Array(n).keys()].map((i) => i + 1) : [1, 2, n - 1, n];
    for (const i of pags) {
      const p = await doc.getPage(i), vp = p.getViewport({ scale: 1 }), tc = await p.getTextContent();
      const its = tc.items.filter((t) => t.str).map((t) => { const [x, y] = vp.convertToViewportPoint(t.transform[4], t.transform[5]); return { s: t.str, x, y, w: t.width, h: Math.hypot(t.transform[2], t.transform[3]) || 8 }; });
      if (its.reduce((a, t) => a + t.s.trim().length, 0) > 40) out.push(...agrupa(its));
      else {
        const v2 = p.getViewport({ scale: 2.2 }), c = document.createElement('canvas');
        c.width = v2.width; c.height = v2.height;
        await p.render({ canvasContext: c.getContext('2d'), viewport: v2, intent: 'print' }).promise;
        out.push(...await deOcr(c));
      }
    }
    doc.destroy();
    return { linies: out, escanejat };
  }

  /* ---------- Interpretació d'una factura, albarà o comanda ---------- */
  const net = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’`´]/g, "'");
  const IMP = /[-−]?\s?(?:\d{1,3}(?:\.\d{3})+,\d{2}|\d{1,3}(?:,\d{3})+\.\d{2}|\d{1,3}(?: \d{3})+,\d{2}|\d+[.,]\d{2})(?!\d|[.,]\d|\s?%)/g;
  const num = (s) => { s = s.replace(/−/g, '-').replace(/\s/g, ''); const c = s.lastIndexOf(','), p = s.lastIndexOf('.'); return +(c > p ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '')); };
  const imports = (s) => (s.replace(/\d{1,2}[./-]\d{1,2}[./-]\d{2,4}/g, ' ').match(IMP) || []).map(num);
  const nifNet = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^ES(?=[A-Z0-9]{9}$)/, '');
  function nifValid(s) {
    const n = nifNet(s);
    if (/^[XYZ]?\d{7,8}[A-Z]$/.test(n) && n.length === 9) { const d = +n.slice(0, -1).replace('X', 0).replace('Y', 1).replace('Z', 2); return 'TRWAGMYFPDXBNJZSQVHLCKE'[d % 23] === n[8]; }
    if (!/^[ABCDEFGHJNPQRSUVW]\d{7}[0-9A-J]$/.test(n)) return false;
    let t = 0;
    for (let i = 0; i < 7; i++) { const x = +n[i + 1]; t += i % 2 ? x : Math.floor(x * 2 / 10) + (x * 2) % 10; }
    const c = (10 - (t % 10)) % 10;
    return n[8] === String(c) || n[8] === 'JABCDEFGHI'[c];
  }
  const nifs = (s) => [...String(s).toUpperCase().matchAll(/(?:^|[^A-Z0-9])((?:ES[ -]?)?(?:[A-HJNP-W][ .-]?\d{2}[ .-]?\d{3}[ .-]?\d{2}[ .-]?[0-9A-J]|[XYZ][ .-]?\d{1}[ .-]?\d{3}[ .-]?\d{3}[ .-]?[A-Z]|\d{2}[ .]?\d{3}[ .]?\d{3}[ .-]?[A-Z]))(?![A-Z0-9])/g)].map((m) => nifNet(m[1])).filter(nifValid);
  const MES = ['gen|ene|jan', 'feb', 'mar', 'abr', 'mai|may', 'jun', 'jul', 'ago', 'set|sep', 'oct', 'nov', 'des|dic|dec'];
  function dates(s) {
    const o = [], ok = (a, m, d) => { a = +a; if (a < 100) a += 2000; if (+m >= 1 && +m <= 12 && +d >= 1 && +d <= 31 && a > 2000 && a < 2100) o.push(`${a}-${String(+m).padStart(2, '0')}-${String(+d).padStart(2, '0')}`); };
    const t = net(s);
    for (const m of t.matchAll(/(?<!\d)(\d{4})-(\d{2})-(\d{2})(?!\d)|(?<![\d.])(\d{1,2})\s?[/.-]\s?(\d{1,2})\s?[/.-]\s?(\d{4}|\d{2})(?!\d|[.,]\d)/g)) m[1] ? ok(m[1], m[2], m[3]) : ok(m[6], m[5], m[4]);
    for (const m of t.matchAll(/(\d{1,2})\s*(?:de |d'|-|\/)?\s*(gen|ene|jan|feb|mar|abr|mai|may|jun|jul|ago|set|sep|oct|nov|des|dic|dec)[a-z.]*\s*(?:de |del |,|-|\/)?\s*(\d{4}|\d{2})(?!\d)/g)) ok(m[3], MES.findIndex((x) => x.split('|').includes(m[2])) + 1, m[1]);
    return o;
  }
  // Busca a la dreta de l'etiqueta i, si no hi ha res, a sota de la seva columna.
  function prop(ls, i, re, treu) {
    const l = ls[i], k = l.cel.findIndex((c) => re.test(net(c.s)));
    if (k < 0) return [];
    const c = l.cel[k], m = net(c.s).match(re), dins = treu(c.s.slice(m.index + m[0].length));
    if (dins.length) return dins;
    for (const d of l.cel.slice(k + 1)) { const v = treu(d.s); if (v.length) return v; if (/[a-z]{4}/i.test(d.s)) break; }
    for (let j = i + 1; j <= Math.min(i + 3, ls.length - 1); j++) {
      const cand = ls[j].cel.filter((d) => d.x < c.x + c.w + 25 && d.x + d.w > c.x - 25).sort((a, b) => Math.abs(a.x + a.w / 2 - c.x - c.w / 2) - Math.abs(b.x + b.w / 2 - c.x - c.w / 2));
      for (const d of cand) { const v = treu(d.s); if (v.length) return v; }
    }
    return [];
  }
  const SOC = /\b(s\.?\s?l\.?\s?u?|s\.?\s?a\.?\s?u?|s\.?\s?l\.?\s?l|s\.?\s?c\.?\s?p|s\.?\s?c\.?\s?c\.?\s?l|s\.?\s?coop|c\.?\s?b|societat limitada|sociedad limitada|sociedad anonima|societat anonima)\b\.?(?=$|[\s,.;:-])/i;
  const netejaNom = (s) => s.replace(/^(ra[oó]n? social|nom(?: fiscal)?|nombre(?: fiscal)?|empresa|prove[iï]dor|proveedor|emisor|emissor|raz[oó]n social)\s*[:.-]\s*/i, '').replace(/\s*[-–·|,]?\s*\(?(n\.?i\.?f|c\.?i\.?f|vat)\b.*$/i, '').replace(/[\s,;:|-]+$/, '').trim();
  /* propi = {nif, nom}: la nostra empresa; coneguts = [{nif, nom}] */
  function interpreta(ls, propi = {}, coneguts = []) {
    const tot = ls.map((l) => l.text).join('\n'), t = net(tot), r = { avisos: [] };
    r.classe = /\bfactura/.test(t) && !/factura pro ?-?forma|proforma/.test(t) ? 'Factura' : /albara|albaran/.test(t) ? 'Albarà' : /pressupost|presupuesto|oferta|proforma/.test(t) ? 'Pressupost' : /comanda|pedido/.test(t) ? 'Comanda' : /tiquet|ticket|factura simpl/.test(t) ? 'Factura' : 'Altres';
    /* Imports */
    const BASE = /(base\s*(?:imp(?:onible|osable|\.)?|imposable|imponible|iva)|\bb\.\s?i\.(?!\w)|base\b(?=\s*[:€]|$)|total\s*(?:net\b|neto|sense iva|sin iva|abans|antes|base|bruto)|import(?:e)?\s*net(?:o)?\b|suma\s*(?:imports|importes)?(?=\s*[:€]|$)|sub\s?-?total|total\s*\(?(?:sin|sense|s\/)\s*iva)/;
    const TOTAL = /(total\s*(?:a\s*(?:pagar|abonar|ingressar)|factura|fra\.?|document(?:o)?|import(?:e)?|general|eur(?:os)?|€|amb iva|con iva|iva incl\w*)|import(?:e)?\s*total|l[ií]quid(?:o)?\s*a\s*\w+|^\s*total\s*[:€]?\s*$|^\s*total\s*[:€]?\s+(?=[-\d]))/;
    const bases = [], subt = [], totals = [];
    ls.forEach((l, i) => {
      const n = net(l.text);
      if (BASE.test(n)) {
        const v = prop(ls, i, BASE, imports);
        if (v.length) (/base|b\.\s?i\./.test(n.match(BASE)[0]) ? bases : subt).push(v[0]);
        // Taula de bases: les files de sota amb el mateix ordre de columnes.
        if (v.length && /base/.test(n) && !imports(l.text).length && /(iva|quota|cuota|%)/.test(n)) {
          const c = l.cel.find((q) => BASE.test(net(q.s)));
          const fil = ls.slice(i + 1, i + 5).filter((q) => /%|\b(21|10|4|0)([.,]00)?\b/.test(q.text) && !TOTAL.test(net(q.text))).map((q) => { const d = q.cel.filter((x) => imports(x.s).length).sort((a, b) => Math.abs(a.x + a.w / 2 - c.x - c.w / 2) - Math.abs(b.x + b.w / 2 - c.x - c.w / 2))[0]; return d ? imports(d.s)[0] : null; }).filter((x) => x != null);
          if (fil.length > 1) { bases.pop(); bases.push({ suma: fil }); }
        }
      }
      const ct = l.cel.find((q) => TOTAL.test(net(q.s)));
      if (ct && !/base|sin iva|sense iva|sub\s?-?total/.test(net(ct.s))) { const v = prop(ls, i, TOTAL, imports); if (v.length) totals.push(v[v.length - 1]); }
    });
    const r2n = (x) => Math.round(x * 100) / 100, prop2 = (a, b) => Math.abs(a - b) < 0.035;
    const tots = [...new Set(imports(tot))], total = totals.length ? totals.slice().sort((a, b) => Math.abs(b) - Math.abs(a))[0] : null;
    const cand = [];
    bases.forEach((b) => (b && b.suma ? cand.push(r2n(b.suma.reduce((a, x) => a + x, 0))) : cand.push(b)));
    const planes = [...new Set(bases.filter((b) => typeof b === 'number'))];
    if (planes.length > 1 && planes.length < 5) cand.push(r2n(planes.reduce((a, x) => a + x, 0)));
    cand.push(...subt);
    const quadra = (b) => b && [0.21, 0.1, 0.04].some((p) => tots.some((x) => prop2(x, b * p)) && tots.some((x) => prop2(x, b * (1 + p)))) || total != null && b && [0.21, 0.1, 0.04].some((p) => prop2(b * (1 + p), total) || (tots.some((x) => prop2(x, b * p)) && prop2(b + r2n(b * p), total)));
    const quadraM = (b) => total != null && tots.some((x) => x && prop2(b + x, total) && Math.abs(x) < Math.abs(b) * 0.22 && Math.abs(x) > 0);
    const isp = /inversi\w+ del? s\w+ passiu|inversion del sujeto pasivo|\bisp\b|art(?:icle|iculo|\.)?\s*84|exempt|exento/.test(t);
    let b = cand.find(quadra);
    if (b != null) r.comprovat = true;
    else if ((b = cand.find(quadraM)) != null) r.comprovat = true;
    else if (cand.length) { b = cand[0]; r.comprovat = total != null && isp && prop2(b, total); }
    else if (total != null) {
      b = tots.find((x) => [0.21, 0.1, 0.04].some((p) => prop2(x * (1 + p), total)));
      if (b != null) r.comprovat = true; else if (isp) { b = total; }
    }
    if (b != null) r.base = b;
    if (total != null) r.total = total;
    if (r.base == null) r.avisos.push("No s'ha trobat la base imposable");
    else if (!r.comprovat) r.avisos.push('La base no s\'ha pogut comprovar amb el total: revisa-la');
    r.iva = isp ? 'ISP (inversió del subjecte passiu)' : r.base && total != null && prop2(r.base * 1.1, total) ? '10%' : '21%';
    /* Data */
    const VENC = /venc|vto|pagament|pago|caduc|validesa|validez|entrega prev/;
    const etq = [/data\s*(?:de\s*(?:la\s*)?)?(?:factura|fra\.?|emissi\w+|expedici\w+)|fecha\s*(?:de\s*(?:la\s*)?)?(?:factura|fra\.?|emisi\w+|expedici\w+)/, /data\s*(?:de\s*)?(?:albar\w+|comanda|compra|document)|fecha\s*(?:de\s*)?(?:albar\w+|pedido|compra|documento)/, /\b(?:data|fecha)\b/];
    for (const re of etq) { for (let i = 0; i < ls.length && !r.data; i++) { const n = net(ls[i].text), m = n.match(re); if (m && !VENC.test(n.slice(m.index, m.index + m[0].length + 14))) r.data = prop(ls, i, re, dates)[0]; } if (r.data) break; }
    if (!r.data) { const l = ls.find((q) => dates(q.text).length && !VENC.test(net(q.text))); if (l) { r.data = dates(l.text)[0]; r.avisos.push('La data no porta etiqueta: revisa-la'); } }
    if (!r.data) r.avisos.push("No s'ha trobat la data");
    /* Número */
    const NUM = [/(?:factura|fra\.?)\s*(?:n[uú]m\w*\.?|n[º°o]\.?|:|#)\s*:?|(?:n[uú]m\w*\.?|n[º°]\.?)\s*(?:de\s*)?(?:factura|fra\.?)\s*:?/, /(?:albar\w+|comanda|pedido|pressupost|presupuesto|oferta)\s*(?:n[uú]m\w*\.?|n[º°]\.?|:)\s*:?|(?:n[uú]m\w*\.?|n[º°]\.?)\s*(?:de\s*)?(?:albar\w+|comanda|pedido|pressupost|presupuesto)\s*:?/, /^\s*(?:factura|n[uú]mero)\b/];
    const treuNum = (s) => { const m = s.replace(/^[\s:.#º°-]+/, '').match(/^[A-Z0-9][A-Z0-9/._-]*(?:\s?[-/]\s?[A-Z0-9]+)*/i); return m && /\d/.test(m[0]) && !dates(m[0]).length && m[0].length < 25 ? [m[0]] : []; };
    for (const re of NUM) { for (let i = 0; i < ls.length && !r.num; i++) if (re.test(net(ls[i].text))) r.num = prop(ls, i, re, treuNum)[0]; if (r.num) break; }
    /* Proveïdor: qualsevol NIF vàlid que no sigui el nostre, amb el nom més proper */
    const pn = nifNet(propi.nif), pnom = net(propi.nom).replace(/[^a-z0-9]/g, '');
    const nostre = (s) => pnom.length > 3 && net(s).replace(/[^a-z0-9]/g, '').includes(pnom.slice(0, 12));
    const oc = [];
    ls.forEach((l, i) => nifs(l.text).forEach((n) => { if (n !== pn && !oc.some((o) => o.n === n)) oc.push({ n, i }); }));
    const client = (i) => /client|destinatari|facturar a|facturat a|senyor|senor|adquir|comprador/.test(net(ls.slice(Math.max(0, i - 4), i + 1).map((l) => l.text).join(' ')));
    const con = oc.find((o) => coneguts.some((c) => nifNet(c.nif) === o.n));
    const tri = con || oc.find((o) => !client(o.i)) || (oc.length === 1 && pn ? oc[0] : null);
    if (tri) r.nif = tri.n;
    const noms = [];
    ls.forEach((l, i) => l.cel.forEach((c) => { if (SOC.test(c.s) && c.s.length < 90 && !nostre(c.s) && /[a-z]{3}/i.test(c.s)) noms.push({ nom: netejaNom(c.s.length > 60 ? c.s.slice(0, c.s.search(SOC) + c.s.match(SOC)[0].length) : c.s), i }); }));
    const cn = r.nif && coneguts.find((c) => nifNet(c.nif) === r.nif);
    if (cn) r.nom = cn.nom;
    else if (tri && noms.length) r.nom = noms.slice().sort((a, b2) => Math.abs(a.i - tri.i) - Math.abs(b2.i - tri.i))[0].nom;
    else if (noms.length) { const q = noms.find((x) => !client(x.i)); r.nom = (q || noms[0]).nom; }
    if (!r.nom) { const k = coneguts.find((c) => c.nom && c.nom.length > 5 && t.includes(net(c.nom))); if (k) { r.nom = k.nom; if (!r.nif && k.nif) r.nif = nifNet(k.nif); } }
    if (!r.nom && tri) { const i = tri.i, q = [...ls.slice(Math.max(0, i - 4), i)].reverse().find((l) => /[a-z]{3}/i.test(l.text) && !/\d{5}|carrer|calle|c\/|avda|tel|@|www|factura|data|fecha|client/i.test(net(l.text)) && !nostre(l.text)); if (q) { r.nom = netejaNom(q.cel[0].s); r.avisos.push('Nom fiscal dubtós: revisa\'l'); } }
    if (!r.nom) r.avisos.push("No s'ha trobat el nom fiscal");
    if (!r.nif) r.avisos.push("No s'ha trobat el número fiscal");
    if (!pn && oc.length > 1) r.avisos.push("Hi ha més d'un NIF: comprova que sigui el del proveïdor");
    return r;
  }

  /* ---------- Partides d'un full d'Excel ---------- */
  const UT = /^(m|ml|m2|m²|m3|m³|ut|u|ud|uds|uts|un|h|hr|hores|kg|t|tn|pa|p\.a\.?|pa\.?|l|mes|dia|d|km|cm|jor|viatge|conj|cj|cjt|ha|%|mu|mil)\.?$/;
  const CAPS = { ind: /^(industrial|industrials|subcontractista|subcontrata|subcontratista|prove[iï]dor|proveedor|empresa)$/, codi: /^(codi|codigo|code|cod\.?|ref|referencia|item|posicio|partida)$/, nat: /^(nat\.?|naturalesa|naturaleza|tipus|tipo)$/, unitat: /^(u\.?|ut\.?|uts|ud\.?|uds\.?|um|u\.?m\.?|unitat|unitats|unidad|unidades|unit\.?)$/, desc: /(descripci|resum|concepte|concepto|denominaci|designaci)|^text/, am: /(amidament|medici|quantitat|cantidad|canpres|^cant\.?|^quant)/, cost: /cost/, pv: /(preu|precio|prpres|^pvp|^p\.?\s?u\.?)/, imp: /(import|imppres|^total)/, cap: /^cap[ií]tol|^capitulo|^capitol$/ };
  const txt = (v) => (v == null ? '' : String(v).replace(/\s+/g, ' ').trim());
  function nombre(v) {
    if (typeof v === 'number') return v;
    let s = txt(v).replace(/[€\s]/g, '');
    if (!/^-?[\d.,]+$/.test(s)) return NaN;
    if (s.includes(',')) s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
    else if (/^\d{1,3}(\.\d{3}){2,}$/.test(s)) s = s.replace(/\./g, '');
    return +s;
  }
  function columnes(rows) {
    let best = null;
    rows.slice(0, 80).forEach((r, i) => {
      const m = {};
      r.forEach((v, j) => { const n = net(txt(v)); if (!n || n.length > 40 || typeof v === 'number') return; for (const k of Object.keys(CAPS)) if (m[k] == null && CAPS[k].test(n)) { m[k] = j; break; } });
      const p = Object.keys(m).length;
      if (p >= 3 && (m.desc != null || m.am != null || m.pv != null) && (!best || p > best.p)) best = { p, i, m };
    });
    const m = best ? { ...best.m } : {}, ini = best ? best.i + 1 : 0, cos = rows.slice(ini), nc = Math.max(0, ...rows.map((r) => r.length));
    const usats = () => new Set(Object.values(m));
    const st = [...Array(nc)].map((_, j) => { const vs = cos.map((r) => r[j]).filter((v) => txt(v)); return { j, n: vs.length, ut: vs.filter((v) => UT.test(net(txt(v)))).length, nu: vs.filter((v) => isFinite(nombre(v)) && txt(v)).length, ll: vs.length ? vs.reduce((a, v) => a + (isFinite(nombre(v)) ? 0 : txt(v).length), 0) / vs.length : 0 }; });
    const tria = (k, f, min) => { if (m[k] != null) return; const u = usats(), c = st.filter((s) => !u.has(s.j) && f(s) > min).sort((a, b) => f(b) - f(a))[0]; if (c) m[k] = c.j; };
    tria('unitat', (s) => s.ut / Math.max(1, s.n) * (s.ut > 1 ? 1 : 0), 0.5);
    tria('desc', (s) => s.ll, 9);
    // Triple preu × amidament = import
    if (m.am == null || m.pv == null) {
      const ns = st.filter((s) => s.nu > 1 && s.j !== m.codi && s.j !== m.unitat && s.j !== m.desc).map((s) => s.j); let tr = null;
      for (const a of ns) for (const b of ns) if (a < b) for (const c of ns) if (c !== a && c !== b) { const k = cos.filter((r) => { const x = nombre(r[a]), y = nombre(r[b]), z = nombre(r[c]); return x && y && z && Math.abs(x * y - z) < Math.max(0.06, Math.abs(z) * 0.002); }).length; if (k > 1 && (!tr || k > tr.k)) tr = { a, b, c, k }; }
      if (tr) {
        const { a, b, c } = tr;
        if (m.pv === a || m.am === b) { m.pv = a; m.am = b; } else if (m.pv === b || m.am === a) { m.pv = b; m.am = a; } else { m.pv = a; m.am = b; m.dubte = true; }
        if (m.imp == null) m.imp = c;
      }
    }
    if (m.codi == null && m.desc != null) { const u = usats(), c = st.filter((s) => !u.has(s.j) && s.j < m.desc && s.n > 1 && s.ll < 25).sort((a, b) => b.n - a.n)[0]; if (c) m.codi = c.j; }
    return { m, ini };
  }
  function partides(rows, m, ini) {
    const out = [], caps = [], pila = [], sense = { n: 0 };
    let import_ = 0;
    const g = (r, k) => (m[k] == null ? '' : r[m[k]]);
    rows.forEach((r, q) => {
      const codi = txt(g(r, 'codi')), desc = txt(g(r, 'desc')), ut = txt(g(r, 'unitat')), nat = net(txt(g(r, 'nat')));
      const am = nombre(g(r, 'am')), imp = nombre(g(r, 'imp')); let pv = nombre(g(r, 'pv')); const cost = nombre(g(r, 'cost'));
      const ple = r.map(txt).filter(Boolean);
      if (!ple.length) return;
      const tx = net(ple.join(' '));
      if (/^(sub)?total|^suma|^import total/.test(tx) || /^(sub)?total/.test(net(desc))) return;
      const esNat = nat && /^(cap|sub|part|mat|ma d|mano|maq|altr|otr)/.test(nat);
      if (esNat && /^(mat|ma d|mano|maq|altr|otr)/.test(nat)) return;
      if (q < ini && !/^(titol|capitol|capitulo|subcapitol|subcapitulo|subtitol|apartat)\b/.test(net(ple[0]))) return; // abans de la capçalera, només capítols
      const utOk = UT.test(net(ut));
      const esPart = esNat ? /^part/.test(nat) : desc && isFinite(am) && (isFinite(pv) || isFinite(imp) || (utOk && codi));
      const tipus = net(ple[0]), mot = /^(titol|capitol|capitulo|cap\.|subcapitol|subcapitulo|subtitol|apartat)\b/.exec(tipus);
      if (!esPart || (mot && !utOk && !esNat)) {
        if (esNat ? !/^(cap|sub)/.test(nat) : !(mot || (codi && desc && !isFinite(am) && !utOk))) return;
        if (!esNat && !mot && (codi.length > 20 || /\s/.test(codi) || desc.length > 150)) return;
        let parts = ple.filter((v, i) => { const j = r.findIndex((x) => txt(x) === v); return ![m.am, m.pv, m.imp, m.cost, m.nat, m.unitat].includes(j) || !isFinite(nombre(v)); });
        if (esNat || (!mot && codi)) parts = [codi, desc].filter(Boolean);
        const etq = parts.join(' ').replace(/^(t[ií]tol|cap[ií]tol|cap[ií]tulo|cap\.|subcap[ií]tol|subcap[ií]tulo|subt[ií]tol|apartat)\s*:?\s*/i, '').trim().slice(0, 140);
        if (!etq) return;
        const c0 = (etq.match(/^[\w.]+/) || [''])[0].replace(/\.$/, '');
        const niv = mot ? (/^(titol|capitol|capitulo|cap)/.test(mot[1]) ? 1 : 2) : 0;
        if (niv) while (pila.length && pila[pila.length - 1].niv >= niv) pila.pop();
        else while (pila.length && !(pila[pila.length - 1].c && c0.startsWith(pila[pila.length - 1].c + '.'))) pila.pop();
        pila.push({ etq, c: c0, niv: niv || 1 });
        return;
      }
      if (!isFinite(am) && !isFinite(pv) && !isFinite(imp)) { sense.n++; return; }
      if (!isFinite(pv) && isFinite(imp) && am) pv = Math.round(imp / am * 10000) / 10000;
      const cap = txt(g(r, 'cap')) || pila.map((x) => x.etq).join(' › ');
      if (cap && !caps.includes(cap)) caps.push(cap);
      import_ += isFinite(imp) ? imp : (am || 0) * (pv || 0);
      out.push({ codi: codi || String(out.length + 1).padStart(3, '0'), descripcio: desc.slice(0, 600) || codi, unitat: ut, amidament: isFinite(am) ? am : 0, preuVenda: isFinite(pv) ? pv : 0, costUnit: isFinite(cost) ? cost : 0, capitol: cap, industrial: txt(g(r, 'ind')), fila: q + 1 });
    });
    return { partides: out, capitols: caps, importFull: import_, sense: sense.n };
  }
  async function llibre(fitxer) {
    const X = await xlsx(), wb = X.read(await fitxer.arrayBuffer(), { type: 'array', cellFormula: false, cellHTML: false });
    return wb.SheetNames.map((n) => { const ws = wb.Sheets[n]; return { nom: n, rows: ws['!ref'] ? X.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '', blankrows: false }) : [] }; }).filter((f) => f.rows.length);
  }
  return { obrePdf, linies, interpreta, nifNet, nifValid, columnes, partides, llibre, xlsx, agrupa, net, nombre };
})();
