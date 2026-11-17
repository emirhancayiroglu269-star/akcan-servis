-- Kullanıcı rolleri: ayarlar/kullanicilar listesi (boşsa giriş yapan herkes yönetici)
create or replace function public.akcan_rol() returns text language sql stable security definer set search_path = public as $$
  select case
    when not exists (select 1 from docs where col='ayarlar' and id='kullanicilar' and jsonb_array_length(coalesce(data->'liste','[]'::jsonb))>0) then 'yonetici'
    else coalesce((select k->>'rol' from docs d, jsonb_array_elements(d.data->'liste') k
                   where d.col='ayarlar' and d.id='kullanicilar' and lower(k->>'eposta')=lower(auth.jwt()->>'email') limit 1), 'yok')
  end
$$;
revoke all on function public.akcan_rol() from public, anon;
grant execute on function public.akcan_rol() to authenticated;
drop policy if exists "giris yapan herkes okur" on public.docs;
drop policy if exists "giris yapan herkes yazar" on public.docs;
create policy "yetkili okur" on public.docs for select to authenticated using ((select public.akcan_rol()) <> 'yok');
create policy "yetkili ekler" on public.docs for insert to authenticated with check ((select public.akcan_rol()) <> 'yok' and (col <> 'ayarlar' or (select public.akcan_rol()) = 'yonetici'));
create policy "yetkili gunceller" on public.docs for update to authenticated using ((select public.akcan_rol()) <> 'yok' and (col <> 'ayarlar' or (select public.akcan_rol()) = 'yonetici')) with check ((select public.akcan_rol()) <> 'yok' and (col <> 'ayarlar' or (select public.akcan_rol()) = 'yonetici'));
create policy "yonetici siler" on public.docs for delete to authenticated using ((select public.akcan_rol()) = 'yonetici');
