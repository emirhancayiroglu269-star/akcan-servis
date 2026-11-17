-- Akcan Oto Servis: tek tablo belge deposu + BizimHesap kuyruğu
create extension if not exists pg_net;
create extension if not exists pg_cron;

create table if not exists public.docs (
  col text not null,
  id text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (col, id)
);
create index if not exists docs_col_idx on public.docs (col);

alter table public.docs enable row level security;
drop policy if exists "giris yapan herkes okur" on public.docs;
drop policy if exists "giris yapan herkes yazar" on public.docs;
create policy "giris yapan herkes okur" on public.docs for select to authenticated using (true);
create policy "giris yapan herkes yazar" on public.docs for all to authenticated using (true) with check (true);

alter table public.docs replica identity full;
do $$ begin
  alter publication supabase_realtime add table public.docs;
exception when duplicate_object then null; end $$;

create or replace function public.docs_touch() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists docs_touch on public.docs;
create trigger docs_touch before insert or update on public.docs for each row execute function public.docs_touch();

-- BizimHesap'a gidecek kayıt varsa push fonksiyonunu hemen tetikle
create or replace function public.bh_push_tetikle() returns trigger language plpgsql security definer set search_path = public as $$
declare d jsonb := new.data; gerek boolean := false; url text; sec text;
begin
  -- Fonksiyonun kendi yazdığı (bhSon değişen) güncellemeler tekrar tetiklemez
  if tg_op = 'UPDATE' and (new.data->>'bhSon') is distinct from (old.data->>'bhSon') then return new; end if;
  if new.col in ('isemirleri','satislar') and coalesce(d->>'bhAktarildi','') = 'false' then gerek := true; end if;
  if new.col = 'musteriler' and (coalesce(d->>'bhAktarildi','') = 'false' or coalesce(d->>'bhBekleyen','') = 'true') then gerek := true; end if;
  if new.col = 'stok' and coalesce(d->>'kaynak','') <> 'BizimHesap' then gerek := true; end if;
  if gerek then
    select decrypted_secret into url from vault.decrypted_secrets where name = 'akcan_fn_url';
    select decrypted_secret into sec from vault.decrypted_secrets where name = 'akcan_fn_secret';
    if url is not null then
      perform net.http_post(url := url || '/bh-push', body := jsonb_build_object('col', new.col, 'id', new.id),
        headers := jsonb_build_object('Content-Type','application/json','x-akcan-secret', coalesce(sec,'')));
    end if;
  end if;
  return new;
end $$;
drop trigger if exists bh_push_tetikle on public.docs;
create trigger bh_push_tetikle after insert or update on public.docs for each row execute function public.bh_push_tetikle();

-- 5 dakikada bir: BizimHesap'tan çek + bekleyenleri yeniden dene
create or replace function public.bh_cagir(fn text) returns void language plpgsql security definer set search_path = public as $$
declare url text; sec text;
begin
  select decrypted_secret into url from vault.decrypted_secrets where name = 'akcan_fn_url';
  select decrypted_secret into sec from vault.decrypted_secrets where name = 'akcan_fn_secret';
  if url is null then return; end if;
  perform net.http_post(url := url || '/' || fn, body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type','application/json','x-akcan-secret', coalesce(sec,'')),
    timeout_milliseconds := 120000);
end $$;
revoke all on function public.bh_cagir(text) from public, anon, authenticated;
revoke all on function public.bh_push_tetikle() from public, anon, authenticated;

-- Programdaki "Şimdi eşitle" düğmesi
create or replace function public.akcan_simdi_esitle() returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.bh_cagir('bh-push');
  perform public.bh_cagir('bh-pull');
end $$;
revoke all on function public.akcan_simdi_esitle() from public, anon;
grant execute on function public.akcan_simdi_esitle() to authenticated;
