-- Obrador: taules pròpies, accés només per a membres i recollida de parts de RECOPAPP.
-- S'executa al projecte de Supabase de RECOPAPP. No modifica cap taula de RECOPAPP.
begin;
create schema if not exists obrador_privat;
revoke all on schema obrador_privat from public;

create table public.obrador_membres(
  user_id uuid primary key references auth.users on delete cascade,
  nom text not null,
  rol text not null default 'edicio' check (rol in ('lectura','edicio','admin')));
create table public.obrador_docs(
  coleccio text not null, id text not null,
  dades jsonb not null check (jsonb_typeof(dades) = 'object'),
  versio bigint not null default 1,
  actualitzat timestamptz not null default now(),
  primary key (coleccio, id));

create function obrador_privat.versiona() returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then new.versio := old.versio + 1; else new.versio := 1; end if;
  new.actualitzat := now();
  return new;
end $$;
create trigger versiona before insert or update on public.obrador_docs for each row execute function obrador_privat.versiona();

-- Rol de qui fa la petició; null si no és membre. Definer perquè la regla de membres no es cridi a si mateixa.
create function obrador_privat.rol() returns text language sql stable security definer set search_path = '' as
$$ select rol from public.obrador_membres where user_id = auth.uid() $$;
revoke all on function obrador_privat.rol(), obrador_privat.versiona() from public;
grant usage on schema obrador_privat to authenticated;
grant execute on function obrador_privat.rol() to authenticated;

alter table public.obrador_membres enable row level security;
alter table public.obrador_docs enable row level security;
revoke all on public.obrador_membres, public.obrador_docs from public, anon, authenticated;
grant select on public.obrador_membres to authenticated;
grant select, insert, update, delete on public.obrador_docs to authenticated;

create policy membres_llegir on public.obrador_membres for select to authenticated using ((select obrador_privat.rol()) is not null);
create policy docs_llegir on public.obrador_docs for select to authenticated using ((select obrador_privat.rol()) is not null);
create policy docs_crear on public.obrador_docs for insert to authenticated with check ((select obrador_privat.rol()) in ('edicio','admin'));
create policy docs_canviar on public.obrador_docs for update to authenticated using ((select obrador_privat.rol()) in ('edicio','admin')) with check ((select obrador_privat.rol()) in ('edicio','admin'));
create policy docs_esborrar on public.obrador_docs for delete to authenticated using ((select obrador_privat.rol()) in ('edicio','admin'));

-- Canvia quan canvia qualsevol document (les regles d'accés s'hi apliquen).
create function public.obrador_empremta() returns text language sql stable security invoker set search_path = '' as
$$ select count(*) || ':' || coalesce(sum(versio), 0) || ':' || coalesce(max(actualitzat)::text, '') from public.obrador_docs $$;
revoke all on function public.obrador_empremta() from public, anon;
grant execute on function public.obrador_empremta() to authenticated;

-- Fitxers privats, 20 MB.
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types) values ('obrador', 'obrador', false, 20971520,
  array['application/pdf','image/png','image/jpeg','image/gif','image/webp','image/svg+xml','video/mp4','video/webm','text/csv','text/markdown','application/json','text/plain']);
create policy obrador_fitxers_llegir on storage.objects for select to authenticated using (bucket_id = 'obrador' and (select obrador_privat.rol()) is not null);
create policy obrador_fitxers_pujar on storage.objects for insert to authenticated with check (bucket_id = 'obrador' and (select obrador_privat.rol()) in ('edicio','admin'));
create policy obrador_fitxers_esborrar on storage.objects for delete to authenticated using (bucket_id = 'obrador' and (select obrador_privat.rol()) = 'admin');

-- Recollida: només llegeix RECOPAPP. Exclou baixes i obres sense codi de 5 xifres.
create function obrador_privat.recull_parts() returns jsonb language plpgsql security invoker set search_path = '' as $$
declare f record; v_obra text; v_imp jsonb; v_font text; v_docid text; n int := 0; c int := 0; ara text := to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
begin
  if not pg_try_advisory_xact_lock(7326471) then return jsonb_build_object('ocupat', true); end if;
  select coalesce(dades->'importats', '[]') into v_imp from public.obrador_docs where coleccio = 'registre' and id = 'recopapp';
  v_imp := coalesce(v_imp, '[]');
  for f in
    select x.*, concat_ws('|', x.date, x.codi, x.treballador, x.ofici, x.hores, x.preu, x.dietes, x.despl) font from (
      select t.id, t.date, left(o.name, 5) codi, substr(o.name, 7) nom, coalesce(o.address, '') adreca,
        w.name || case when w.external and coalesce(w.company, '') <> '' then ' (' || w.company || ')' else '' end treballador,
        coalesce(w.position, '') ofici, t.hours::float8 hores, coalesce(t.hourly_rate, 0)::float8 preu,
        (case when t.dieta then coalesce(t.dieta_rate, 0) else 0 end)::float8 dietes,
        (case when t.desplacament then coalesce(t.desplacament_rate, 0) else 0 end)::float8 despl,
        coalesce(t.comment, '') feina
      from public.fitxatges t join public.workers w on w.id = t.worker_id join public.obres o on o.id = t.obra_id
      where not t.baixa and o.name ~ '^[0-9]{5} ') x order by x.date
  loop
    v_docid := 'rc-' || left(f.id::text, 8);
    v_font := null;
    select dades->>'recopFont' into v_font from public.obrador_docs where coleccio = 'parts' and id = v_docid;
    if found then
      continue when v_font is not distinct from f.font;       -- conserva les edicions fetes a l'Obrador
    else
      continue when v_imp ? v_docid;                          -- algú el va esborrar a l'Obrador
    end if;
    v_obra := null;
    select id into v_obra from public.obrador_docs where coleccio = 'obres' and dades->>'codi' = f.codi order by id limit 1;
    if v_obra is null then
      v_obra := 'rc-' || f.codi;
      insert into public.obrador_docs(coleccio, id, dades) values ('obres', v_obra, jsonb_build_object('codi', f.codi, 'nom', f.nom, 'ubicacio', f.adreca, 'client', '', 'tipus', '', 'estat', 'En execució', 'cap', '', 'superficie', null, 'inici', '', 'fi', '', 'pressupost', null, 'avanc', null, 'origen', 'RECOPAPP', 'actualitzat', ara));
    end if;
    if v_font is null and not exists (select 1 from public.obrador_docs where coleccio = 'parts' and id = v_docid) then n := n + 1; else c := c + 1; end if;
    insert into public.obrador_docs(coleccio, id, dades) values ('parts', v_docid,
      jsonb_build_object('data', f.date, 'obraId', v_obra, 'treballador', f.treballador, 'ofici', f.ofici, 'hores', f.hores, 'preuHora', f.preu, 'dietes', f.dietes, 'desplacament', f.despl, 'feina', f.feina, 'origen', 'RECOPAPP', 'recopId', f.id, 'recopFont', f.font, 'actualitzat', ara))
    on conflict (coleccio, id) do update set dades = public.obrador_docs.dades || case when f.feina = '' then excluded.dades - 'feina' else excluded.dades end;
    if not v_imp ? v_docid then v_imp := v_imp || to_jsonb(v_docid); end if;
  end loop;
  if n + c > 0 then
    insert into public.obrador_docs(coleccio, id, dades) values ('registre', 'recopapp', jsonb_build_object('importats', v_imp, 'ultima', ara))
    on conflict (coleccio, id) do update set dades = excluded.dades;
  end if;
  return jsonb_build_object('nous', n, 'corregits', c);
end $$;
revoke all on function obrador_privat.recull_parts() from public, anon, authenticated;
commit;
