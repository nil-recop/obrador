# Obra-empresa

Plataforma de gestió d'obra i documents. Web autònoma: no depèn de Claude.

- `public/`: la web. No cal compilar res ni instal·lar llibreries.
- `sql/`: taules, permisos i recollida automàtica dels parts de RECOPAPP.
- `proves/`: proves amb dades inventades.

**Aquest repositori és públic: no hi pugeu mai dades reals, contrasenyes ni claus secretes.** Les dades són a Supabase, només per a membres.

## Com funciona

Cada persona entra amb correu i contrasenya. Només hi accedeix qui figura a `obrador_membres` (rols `lectura`, `edicio` i `admin`).
La recollida s'executa dins de Supabase cada 5 minuts. Només llegeix RECOPAPP; no en copia baixes ni PIN. Una edició feta a l'Obrador es conserva fins que el mateix part canvia a RECOPAPP. Un part esborrat a l'Obrador no es torna a crear.

## Posada en marxa

1. Feu una còpia de seguretat i executeu `sql/01_obrador.sql` al projecte de Supabase de RECOPAPP.
2. Supabase → Authentication: desactiveu l'alta pública i poseu l'adreça de la web a *URL Configuration*.
3. Convideu cada persona des de *Users* i doneu-la d'alta:
   `insert into public.obrador_membres select id, 'Nom', 'admin' from auth.users where email = '...';`
4. Ompliu `public/config.js` amb l'adreça i la clau **pública**.
5. Importeu les dades de l'Obrador antic, **inclòs `registre/recopapp`**. Conserveu els identificadors.
6. Executeu `sql/02_automatic.sql` i desactiveu la tasca programada de Claude.
7. Publiqueu la carpeta `public/`. Netlify llegeix `netlify.toml`.

## Proves

`python -m http.server 8765 --bind 127.0.0.1` i obriu `http://localhost:8765/proves/`. Per veure la web amb dades inventades, obriu `proves/app.html`.
