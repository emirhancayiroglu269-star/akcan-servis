-- Günlük otomatik yedek: özel 'yedekler' deposu ve her gece 03:07 (TR) yedek fonksiyonu
insert into storage.buckets (id, name, public) values ('yedekler', 'yedekler', false) on conflict (id) do nothing;
select cron.schedule('akcan-yedek', '7 0 * * *', $$select public.bh_cagir('yedek')$$);
