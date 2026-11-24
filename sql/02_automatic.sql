-- Recull els parts cada dia a les 00:00 (hora de Madrid), dins del mateix servidor. Executeu-ho DESPRÉS de migrar les dades.
-- El servidor va en UTC: s'intenta a les 22 i a les 23 i només s'executa quan a Madrid són les 0 h (estiu i hivern).
create extension if not exists pg_cron;
select cron.schedule('obrador-parts', '0 22,23 * * *', $$select obrador_privat.recull_parts() where extract(hour from now() at time zone 'Europe/Madrid') = 0$$);
-- Per aturar-ho: select cron.unschedule('obrador-parts');
