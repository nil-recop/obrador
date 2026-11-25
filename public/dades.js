/* Capa de dades de l'Obrador: accés, base de dades i fitxers sobre Supabase, sense cap llibreria externa. */
(() => {
  const CFG = window.OBRADOR_CONFIG || {}, URL_ = String(CFG.url || '').replace(/\/$/, ''), KEY = CFG.clauPublica || '';
  const MEM = 'obrador-sessio', BUCKET = 'obrador', INTERVAL = 15000;
  let ses = null, renovant = null, perfil = null, membres = {}, files = new Map(), empremta = '', carregat = false, darrer = 0, carregant = null;
  const oients = [], signats = {};
  const err = (code, message) => Object.assign(new Error(message || code), { code });
  const guarda = (s) => { ses = s; try { s ? localStorage.setItem(MEM, JSON.stringify(s)) : localStorage.removeItem(MEM); } catch (e) {} };
  const deToken = (d) => ({ access_token: d.access_token, refresh_token: d.refresh_token, exp: Date.now() + (+d.expires_in || 3600) * 1000 });

  /* ---------- Accés ---------- */
  async function auth(cami, opc = {}, token) {
    const r = await fetch(URL_ + '/auth/v1/' + cami, { ...opc, headers: { apikey: KEY, 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) } });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(err('auth', d.msg || d.error_description || d.message || 'auth'), { status: r.status });
    return d;
  }
  async function token() {
    if (!ses) throw err('sense_sessio');
    if (ses.exp - Date.now() > 60000) return ses.access_token;
    renovant = renovant || (async () => {
      try { guarda(deToken(await auth('token?grant_type=refresh_token', { method: 'POST', body: JSON.stringify({ refresh_token: ses.refresh_token }) }))); }
      catch (e) { if (e.status >= 400 && e.status < 500 && e.status !== 429) { guarda(null); location.reload(); } throw e; }
      finally { renovant = null; }
    })();
    await renovant;
    return ses.access_token;
  }
  async function api(cami, opc = {}) {
    const r = await fetch(URL_ + cami, { ...opc, headers: { apikey: KEY, Authorization: 'Bearer ' + await token(), ...(opc.headers || {}) } });
    if (r.ok) return r;
    const d = await r.json().catch(() => ({}));
    if (r.status === 429) throw err('resource_exhausted');
    if (r.status === 413) throw err('too_large');
    if (r.status === 415) throw err('unsupported_type');
    if (r.status === 401 || r.status === 403 || d.code === '42501') throw err('invalid_argument', d.message);
    throw err('unavailable', d.message);
  }

  /* ---------- Documents ---------- */
  const TAULA = '/rest/v1/obrador_docs', clau = (c, i) => c + '/' + i;
  const J = { 'Content-Type': 'application/json' };
  const filtre = (c, i) => `?coleccio=eq.${encodeURIComponent(c)}&id=eq.${encodeURIComponent(i)}`;
  async function carrega() {
    if (carregant) return carregant;
    carregant = (async () => {
      const n = new Map();
      for (let o = 0; ; o += 1000) {
        const p = await (await api(`${TAULA}?select=coleccio,id,dades,versio&order=coleccio,id&limit=1000&offset=${o}`)).json();
        p.forEach((x) => n.set(clau(x.coleccio, x.id), x));
        if (p.length < 1000) break;
      }
      files = n; carregat = true; darrer = Date.now(); avisa();
    })().finally(() => { carregant = null; });
    return carregant;
  }
  // Mirada lleugera: només torna a carregar-ho tot si alguna cosa ha canviat.
  async function mira() {
    try {
      const d = await (await api('/rest/v1/rpc/obrador_empremta', { method: 'POST', headers: J, body: '{}' })).json();
      if (d !== empremta) { await carrega(); empremta = d; }
    } catch (e) { if (!carregat) oients.forEach((o) => o.err && o.err(e)); }
  }
  const emet = (o) => {
    if (!carregat) return;
    if (o.id) { const x = files.get(clau(o.col, o.id)); o.f({ exists: !!x, data: () => x && x.dades, metadata: { fromCache: false } }); }
    else o.f({ docs: [...files.values()].filter((x) => x.coleccio === o.col).map((x) => ({ id: x.id, data: () => x.dades })), metadata: { fromCache: false } });
  };
  const avisa = (col) => oients.forEach((o) => { if (!col || o.col === col) emet(o); });
  function doc(col, id) {
    const k = clau(col, id);
    return {
      async set(dades) {
        const vell = files.get(k);
        let r;
        if (vell) {
          // Només desa si ningú l'ha canviat mentrestant.
          const q = col === 'registre' ? '' : `&versio=eq.${vell.versio}`;
          r = await (await api(TAULA + filtre(col, id) + q, { method: 'PATCH', headers: { ...J, Prefer: 'return=representation' }, body: JSON.stringify({ dades }) })).json();
          if (!r.length) { if (perfil && perfil.rol === 'lectura') throw err('invalid_argument'); await carrega(); throw err('conflicte'); }
        } else {
          try { r = await (await api(TAULA, { method: 'POST', headers: { ...J, Prefer: 'return=representation' }, body: JSON.stringify({ coleccio: col, id, dades }) })).json(); }
          catch (e) { if (e.code === 'unavailable') { await carrega(); if (files.has(k)) throw err('conflicte'); } throw e; }
        }
        files.set(k, r[0]); avisa(col);
      },
      async delete() {
        const r = await (await api(TAULA + filtre(col, id), { method: 'DELETE', headers: { Prefer: 'return=representation' } })).json();
        if (!r.length && files.has(k)) { if (perfil && perfil.rol === 'lectura') throw err('invalid_argument'); await carrega(); return; }
        files.delete(k); avisa(col);
      },
      onSnapshot(f, e) { const o = { col, id, f, err: e }; oients.push(o); emet(o); return () => oients.splice(oients.indexOf(o), 1); },
    };
  }
  const db = {
    collection: (col) => ({ doc: (id) => doc(col, id), onSnapshot(f, e) { const o = { col, f, err: e }; oients.push(o); emet(o); return () => oients.splice(oients.indexOf(o), 1); } }),
    // Crea molts documents de cop; cada crida es desa sencera o gens.
    async crea(col, l) {
      const r = await (await api(TAULA, { method: 'POST', headers: { ...J, Prefer: 'return=representation' }, body: JSON.stringify(l.map((x) => ({ coleccio: col, id: x.id, dades: x.dades }))) })).json();
      r.forEach((x) => files.set(clau(x.coleccio, x.id), x)); avisa(col);
    },
    doc: (cami) => { const [c, i] = cami.split('/'); return doc(c, i); },
  };

  /* ---------- Fitxers ---------- */
  const assets = {
    async upload(fitxer, { type }) {
      const id = crypto.randomUUID();
      await api(`/storage/v1/object/${BUCKET}/${id}`, { method: 'POST', headers: { 'Content-Type': type, 'x-upsert': 'false' }, body: fitxer });
      return { id, sizeBytes: fitxer.size, contentType: type };
    },
    async delete(id) { await api(`/storage/v1/object/${BUCKET}/${encodeURIComponent(id)}`, { method: 'DELETE' }); },
  };
  window.ObradorBaixa = async (id) => (await api(`/storage/v1/object/authenticated/${BUCKET}/${encodeURIComponent(id)}`)).blob();
  window.ObradorBlob = (id) => (signats[id] && signats[id].u) || '#documents';
  window.ObradorSigna = async (ids) => {
    const falten = ids.filter((i) => !signats[i] || signats[i].t < Date.now() - 1800000);
    if (!falten.length) return;
    const d = await (await api(`/storage/v1/object/sign/${BUCKET}`, { method: 'POST', headers: J, body: JSON.stringify({ expiresIn: 3600, paths: falten }) })).json();
    d.forEach((x) => { const p = x.signedURL || x.signedUrl; if (p) signats[x.path] = { u: URL_ + '/storage/v1' + p, t: Date.now() }; });
  };

  /* ---------- Persones ---------- */
  const inicials = (n) => {
    const t = (String(n || '?').trim().split(/\s+/).map((x) => x[0]).slice(0, 2).join('') || '?').toUpperCase().replace(/[^\p{L}\p{N}?]/gu, '');
    return 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" fill="#E8A200"/><text x="20" y="26" text-anchor="middle" font-family="sans-serif" font-size="16" font-weight="600" fill="#1A1300">${t}</text></svg>`);
  };
  const user = {
    async me() { return { id: perfil.user_id, name: perfil.nom, avatarUrl: inicials(perfil.nom), canEdit: perfil.rol !== 'lectura' }; },
    async can(q) { return q === 'assets.write' ? perfil.rol === 'admin' : perfil.rol !== 'lectura'; },
    async profiles(ids) { const r = {}; ids.forEach((i) => { r[i] = { name: membres[i] || '' }; }); return r; },
  };
  window.claude = { use: async (n) => ({ db, user, assets: perfil && perfil.rol === 'lectura' ? null : assets }[n] || null) };

  /* ---------- Pantalla d'entrada ---------- */
  function pantalla(titol, text, camps, boto, fer, peu) {
    document.body.classList.add('bloquejat');
    let d = document.getElementById('acces');
    if (!d) { d = document.createElement('div'); d.id = 'acces'; document.body.append(d); }
    d.innerHTML = '<form class="acces-caixa" novalidate><div class="acces-marca">Obrador</div><h1></h1><p class="acces-text"></p><div class="acces-camps"></div><p class="acces-error" role="alert"></p><button class="btn pri" type="submit"></button><button class="acces-peu" type="button"></button></form>';
    const q = (s) => d.querySelector(s);
    q('h1').textContent = titol; q('.acces-text').textContent = text; q('.acces-text').hidden = !text;
    camps.forEach(([nom, etiqueta, tipus, auto]) => {
      const l = document.createElement('label'); l.textContent = etiqueta;
      const i = document.createElement('input'); i.name = nom; i.type = tipus; i.autocomplete = auto; i.required = true; l.append(i); q('.acces-camps').append(l);
    });
    const b = q('[type=submit]'); b.textContent = boto || ''; b.hidden = !boto;
    const p = q('.acces-peu'); p.hidden = !peu; if (peu) { p.textContent = peu[0]; p.onclick = peu[1]; }
    q('form').onsubmit = async (e) => {
      e.preventDefault(); b.disabled = true; q('.acces-error').textContent = '';
      const v = Object.fromEntries(new FormData(e.target));
      try { await fer(v); } catch (x) { q('.acces-error').textContent = x.message_ca || missatge(x); } finally { b.disabled = false; }
    };
    const pr = d.querySelector('input'); if (pr) pr.focus();
  }
  const missatge = (e) => e.status === 429 ? 'Massa intents. Espera uns minuts.' : e.status === 400 || e.status === 422 ? 'El correu o la contrasenya no són correctes.' : "No s'ha pogut connectar. Torna-ho a provar.";
  const ca = (m) => Object.assign(new Error(m), { message_ca: m });
  async function surt() { try { await auth('logout', { method: 'POST' }, await token()); } catch (e) {} guarda(null); location.hash = ''; location.reload(); }

  window.ObradorAcces = async (boot) => {
    if (!URL_ || !KEY) return pantalla('Falta configurar la connexió', "Omple public/config.js amb l'adreça i la clau pública del projecte de Supabase.", [], '', null);
    const entra = async () => {
      const sub = JSON.parse(atob(ses.access_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).sub;
      const m = await (await api('/rest/v1/obrador_membres?select=user_id,nom,rol')).json();
      perfil = m.find((x) => x.user_id === sub);
      if (!perfil) return pantalla('Encara no tens accés', "El teu compte existeix, però ningú l'ha afegit a l'Obrador. Demana-ho a qui l'administra.", [], '', null, ['Surt', surt]);
      m.forEach((x) => { membres[x.user_id] = x.nom; });
      const d = document.getElementById('acces'); if (d) d.remove();
      document.body.classList.remove('bloquejat');
      await boot(); await mira();
      setInterval(() => { if (!document.hidden) mira(); }, INTERVAL);
      document.addEventListener('visibilitychange', () => { if (!document.hidden && Date.now() - darrer > 3000) mira(); });
      const b = document.createElement('button'); b.className = 'surt'; b.type = 'button'; b.textContent = 'Surt'; b.onclick = surt;
      document.getElementById('who').after(b);
    };
    const nova = () => pantalla('Tria la contrasenya', 'Mínim 10 caràcters.', [['c1', 'Contrasenya nova', 'password', 'new-password'], ['c2', 'Repeteix-la', 'password', 'new-password']], 'Desa la contrasenya', async (v) => {
      if (v.c1.length < 10) throw ca('Ha de tenir 10 caràcters o més.');
      if (v.c1 !== v.c2) throw ca('Les dues contrasenyes no coincideixen.');
      try { await auth('user', { method: 'PUT', body: JSON.stringify({ password: v.c1 }) }, await token()); }
      catch (e) { throw e.status === 422 ? ca("Aquesta contrasenya no s'accepta. Tria'n una altra.") : e; }
      await entra();
    });
    const login = () => pantalla('Entra a l’Obrador', '', [['correu', 'Correu electrònic', 'email', 'username'], ['clau', 'Contrasenya', 'password', 'current-password']], 'Entra', async (v) => {
      guarda(deToken(await auth('token?grant_type=password', { method: 'POST', body: JSON.stringify({ email: v.correu.trim(), password: v.clau }) })));
      await entra();
    }, ['He oblidat la contrasenya', oblit]);
    const oblit = () => pantalla('Recupera l’accés', "T'enviarem un enllaç per triar una contrasenya nova.", [['correu', 'Correu electrònic', 'email', 'username']], "Envia'm l'enllaç", async (v) => {
      await auth('recover?redirect_to=' + encodeURIComponent(location.origin + location.pathname), { method: 'POST', body: JSON.stringify({ email: v.correu.trim() }) });
      pantalla('Mira el correu', 'Si aquest compte existeix, hi trobaràs un enllaç per entrar.', [], '', null, ['Torna', login]);
    }, ['Torna', login]);
    // Enllaç d'invitació o de recuperació que arriba per correu.
    const h = new URLSearchParams(location.hash.slice(1));
    if (h.get('access_token')) {
      const tipus = h.get('type');
      guarda(deToken({ access_token: h.get('access_token'), refresh_token: h.get('refresh_token'), expires_in: h.get('expires_in') }));
      history.replaceState(null, '', location.pathname);
      if (tipus === 'invite' || tipus === 'recovery') return nova();
    } else if (h.get('error_description')) { history.replaceState(null, '', location.pathname); }
    try { ses = ses || JSON.parse(localStorage.getItem(MEM)); } catch (e) {}
    if (!ses) return login();
    try { await entra(); } catch (e) { if (!ses) login(); else pantalla('No hi ha connexió', "No s'ha pogut carregar l'Obrador.", [], 'Torna-ho a provar', async () => location.reload(), ['Surt', surt]); }
  };
})();
