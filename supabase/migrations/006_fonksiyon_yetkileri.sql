revoke all on function public.akcan_maliyet_ayir() from public, anon, authenticated;
revoke all on function public.akcan_maliyet_yetkili() from public, anon, authenticated;
create or replace function public.akcan_simdi_esitle() returns void language plpgsql security definer set search_path = public as $$
begin
  if public.akcan_rol() = 'yok' then raise exception 'yetkisiz'; end if;
  perform public.bh_cagir('bh-push');
  perform public.bh_cagir('bh-pull');
  perform public.bh_cagir('bh-hareket');
end $$;
