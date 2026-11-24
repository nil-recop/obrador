-- Recull els parts cada 5 minuts, dins del mateix servidor. Executeu-ho DESPRÉS de migrar les dades de l'Obrador antic.
create extension if not exists pg_cron;
select cron.schedule('obrador-parts', '*/5 * * * *', 'select obrador_privat.recull_parts()');
-- Per aturar-ho: select cron.unschedule('obrador-parts');
