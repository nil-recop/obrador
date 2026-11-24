-- Fitxa de cada treballador/a i encarregat/ada (sense compte ni accés) i enllaç amb els seus parts.
-- Només llegeix RECOPAPP. No toca PIN ni cap compte.
begin;
create function obrador_privat.recull_personal() returns jsonb language plpgsql security invoker set search_path = '' as $$
declare w record; v_vist jsonb; v_docid text; v_font text; n int := 0; c int := 0; e int := 0; ara text := to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
begin
  if not pg_try_advisory_xact_lock(7326472) then return jsonb_build_object('ocupat', true); end if;
  select dades->'creades' into v_vist from public.obrador_docs where coleccio = 'registre' and id = 'persones';
  v_vist := coalesce(v_vist, '[]');
  for w in
    select x.*, concat_ws('|', x.nom, x.rol, x.categoria, x.vinculacio, x.cost, x.estat) font from (
      select t.id, t.active,
        t.name || case when t.external and coalesce(t.company, '') <> '' then ' (' || t.company || ')' else '' end nom,
        case when t.role = 'encarregat' then 'Encarregat/ada' else 'Treballador/a' end rol,
        coalesce(t.position, '') categoria, case when t.external then 'Subcontracta' else 'Plantilla' end vinculacio,
        coalesce(t.hourly_rate, 0)::float8 cost, case when t.active then 'Actiu' else 'Inactiu' end estat
      from public.workers t where t.role in ('treballador', 'encarregat')) x order by x.nom
  loop
    v_docid := 'rp-' || w.id::text;
    v_font := null;
    select dades->>'recopFont' into v_font from public.obrador_docs where coleccio = 'personal' and id = v_docid;
    if found then
      continue when v_font is not distinct from w.font;
      update public.obrador_docs set dades = dades || jsonb_build_object('nom', w.nom, 'rol', w.rol, 'categoria', w.categoria, 'vinculacio', w.vinculacio, 'costHora', w.cost, 'estat', w.estat, 'recopFont', w.font, 'actualitzat', ara)
        where coleccio = 'personal' and id = v_docid;
      c := c + 1;
    else
      continue when not w.active or v_vist ? v_docid;         -- inactiu, o fitxa esborrada a l'Obrador
      insert into public.obrador_docs(coleccio, id, dades) values ('personal', v_docid, jsonb_build_object('nom', w.nom, 'rol', w.rol, 'categoria', w.categoria, 'vinculacio', w.vinculacio, 'obraId', '', 'costHora', w.cost, 'estat', w.estat, 'prl', '', 'aptitud', '', 'habilitacio', '', 'notes', '', 'origen', 'RECOPAPP', 'recopId', w.id, 'recopFont', w.font, 'actualitzat', ara));
      v_vist := v_vist || to_jsonb(v_docid);
      n := n + 1;
    end if;
  end loop;
  -- Enllaça els parts recollits que encara no tenen persona (respecta els canvis fets a l'Obrador).
  update public.obrador_docs d set dades = d.dades || jsonb_build_object('personaId', p.id)
    from public.fitxatges f join public.obrador_docs p on p.coleccio = 'personal' and p.id = 'rp-' || f.worker_id::text
    where d.coleccio = 'parts' and d.dades->>'recopId' = f.id::text and not d.dades ? 'personaId';
  get diagnostics e = row_count;
  if n > 0 then
    insert into public.obrador_docs(coleccio, id, dades) values ('registre', 'persones', jsonb_build_object('creades', v_vist, 'ultima', ara))
    on conflict (coleccio, id) do update set dades = excluded.dades;
  end if;
  return jsonb_build_object('nous', n, 'corregits', c, 'enllacats', e);
end $$;
create function obrador_privat.recull() returns jsonb language plpgsql security invoker set search_path = '' as $$
declare a jsonb; b jsonb;
begin
  a := obrador_privat.recull_parts();
  b := obrador_privat.recull_personal();
  return jsonb_build_object('parts', a, 'personal', b);
end $$;
revoke all on function obrador_privat.recull_personal(), obrador_privat.recull() from public, anon, authenticated;
commit;
