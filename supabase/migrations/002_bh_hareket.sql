-- BizimHesap'ta yapılan satış/tahsilatları programa getiren görev (5 dakikada bir)
create table if not exists public.bh_ekstre (id text primary key, ad text, kod text, data jsonb, updated_at timestamptz default now());
alter table public.bh_ekstre enable row level security;
revoke all on public.bh_ekstre from anon, authenticated;
select cron.schedule('akcan-bh-hareket', '4-59/5 * * * *', $$select public.bh_cagir('bh-hareket')$$);
create or replace function public.akcan_simdi_esitle() returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.bh_cagir('bh-push');
  perform public.bh_cagir('bh-pull');
  perform public.bh_cagir('bh-hareket');
end $$;
