-- Stok sipariş önerisi için tüketim geçmişi.
-- Saatlik iş: her ürün/depo için son görülen miktar (stok_son) ile şimdiki miktar
-- karşılaştırılır; düşüş varsa o günün çıkışına (stok_cikis) eklenir. Artışlar
-- (alış, sayım fazlası) tüketimi etkilemez.

drop function if exists public.akcan_stok_tuketim(integer);
drop function if exists public.akcan_stok_anlik();
drop table if exists public.stok_gunluk;
do $$ begin perform cron.unschedule('akcan-stok-anlik'); exception when others then null; end $$;

create table if not exists public.stok_son (
  stok_id text not null,
  depo text not null,
  miktar numeric not null default 0,
  guncelleme timestamptz not null default now(),
  ilk timestamptz not null default now(),
  primary key (stok_id, depo)
);

create table if not exists public.stok_cikis (
  gun date not null,
  stok_id text not null,
  depo text not null,
  cikis numeric not null default 0,
  primary key (gun, stok_id, depo)
);

alter table public.stok_son enable row level security;
alter table public.stok_cikis enable row level security;
revoke all on public.stok_son, public.stok_cikis from anon, authenticated;

create or replace function public.akcan_stok_izle()
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  with simdi as (
    select d.id as stok_id, m.key as depo,
           coalesce(nullif(m.value #>> '{}', '')::numeric, 0) as miktar
    from docs d, jsonb_each(d.data->'miktar') m
    where d.col = 'stok' and jsonb_typeof(d.data->'miktar') = 'object'
      and coalesce(d.data->>'tur', '') <> 'hizmet'
  ), dusus as (
    select s.stok_id, s.depo, o.miktar - s.miktar as fark
    from simdi s join stok_son o using (stok_id, depo)
    where s.miktar < o.miktar
  ), ekle as (
    insert into stok_cikis (gun, stok_id, depo, cikis)
    select (now() at time zone 'Europe/Istanbul')::date, stok_id, depo, fark from dusus
    on conflict (gun, stok_id, depo) do update set cikis = stok_cikis.cikis + excluded.cikis
    returning 1
  ), son as (
    insert into stok_son (stok_id, depo, miktar, guncelleme)
    select stok_id, depo, miktar, now() from simdi
    on conflict (stok_id, depo) do update set miktar = excluded.miktar, guncelleme = now()
      where stok_son.miktar is distinct from excluded.miktar
    returning 1
  )
  select count(*) into n from ekle;
  delete from stok_cikis where gun < (now() at time zone 'Europe/Istanbul')::date - 400;
  return n;
end $$;

create or replace function public.akcan_stok_tuketim(gun_sayisi integer default 30)
returns table(stok_id text, depo text, tuketim numeric)
language sql stable security definer set search_path = public as $$
  select c.stok_id, c.depo, sum(c.cikis)
  from stok_cikis c
  where c.gun > (now() at time zone 'Europe/Istanbul')::date - gun_sayisi
    and public.akcan_rol() <> 'yok'
  group by c.stok_id, c.depo
$$;

create or replace function public.akcan_stok_izleme_baslangic()
returns timestamptz language sql stable security definer set search_path = public as $$
  select case when public.akcan_rol() <> 'yok' then min(ilk) end from stok_son
$$;

revoke execute on function public.akcan_stok_izle() from public, anon, authenticated;
revoke execute on function public.akcan_stok_tuketim(integer) from public, anon;
revoke execute on function public.akcan_stok_izleme_baslangic() from public, anon;
grant execute on function public.akcan_stok_tuketim(integer) to authenticated;
grant execute on function public.akcan_stok_izleme_baslangic() to authenticated;

select public.akcan_stok_izle();
select cron.schedule('akcan-stok-izle', '11 * * * *', 'select public.akcan_stok_izle()');
