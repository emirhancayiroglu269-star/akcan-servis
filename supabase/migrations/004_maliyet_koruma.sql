-- Alış fiyatlarını yalnızca yöneticinin okuyabildiği 'maliyet' kayıtlarına ayırır.
--  maliyet/<stokId>            = {alis}            (güncel alış fiyatı)
--  maliyet/fis:<col>:<docId>   = {alis:{stokId:x}} (satış anındaki alış fiyatı; kâr hesabı için)
create or replace function public.akcan_maliyet_yetkili() returns boolean language plpgsql stable security definer set search_path = public as $$
declare r text := coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'role', '');
begin
  if r in ('', 'service_role', 'postgres', 'supabase_admin') then return true; end if;
  return public.akcan_rol() = 'yonetici';
end $$;

create or replace function public.akcan_maliyet_ayir() returns trigger language plpgsql security definer set search_path = public as $$
declare yetkili boolean; snap jsonb; eksik jsonb; k jsonb;
begin
  if new.col = 'stok' then
    if new.data ? 'alis' then
      yetkili := public.akcan_maliyet_yetkili();
      if yetkili then
        insert into docs(col, id, data) values ('maliyet', new.id, jsonb_build_object('id', new.id, 'alis', coalesce(new.data->'alis', '0'::jsonb)))
        on conflict (col, id) do update set data = excluded.data where docs.data->'alis' is distinct from excluded.data->'alis';
      end if;
      new.data := new.data - 'alis';
    end if;
  elsif new.col in ('isemirleri', 'satislar') and jsonb_typeof(new.data->'kalemler') = 'array' then
    -- satış anındaki alış fiyatlarının kopyası (her stok kalemi için bir kez)
    select data->'alis' into snap from docs where col = 'maliyet' and id = 'fis:' || new.col || ':' || new.id;
    snap := coalesce(snap, '{}'::jsonb);
    eksik := '{}'::jsonb;
    for k in select * from jsonb_array_elements(new.data->'kalemler') loop
      if coalesce(k->>'stokId', '') <> '' and not (snap ? (k->>'stokId')) and not (eksik ? (k->>'stokId')) then
        eksik := eksik || jsonb_build_object(k->>'stokId',
          coalesce((select m.data->'alis' from docs m where m.col = 'maliyet' and m.id = k->>'stokId'), k->'alis', '0'::jsonb));
      end if;
    end loop;
    if eksik <> '{}'::jsonb then
      insert into docs(col, id, data) values ('maliyet', 'fis:' || new.col || ':' || new.id, jsonb_build_object('id', 'fis:' || new.col || ':' || new.id, 'alis', snap || eksik))
      on conflict (col, id) do update set data = excluded.data;
    end if;
    if exists (select 1 from jsonb_array_elements(new.data->'kalemler') x where x ? 'alis') then
      new.data := jsonb_set(new.data, '{kalemler}', (select coalesce(jsonb_agg(x - 'alis' order by o), '[]'::jsonb) from jsonb_array_elements(new.data->'kalemler') with ordinality t(x, o)));
    end if;
  end if;
  return new;
end $$;
drop trigger if exists akcan_maliyet_ayir on public.docs;
create trigger akcan_maliyet_ayir before insert or update on public.docs for each row execute function public.akcan_maliyet_ayir();

-- Okuma/yazma kuralları: maliyet yalnızca yönetici
drop policy if exists "yetkili okur" on public.docs;
drop policy if exists "yetkili ekler" on public.docs;
drop policy if exists "yetkili gunceller" on public.docs;
create policy "yetkili okur" on public.docs for select to authenticated using ((select public.akcan_rol()) <> 'yok' and (col <> 'maliyet' or (select public.akcan_rol()) = 'yonetici'));
create policy "yetkili ekler" on public.docs for insert to authenticated with check ((select public.akcan_rol()) <> 'yok' and (col not in ('ayarlar', 'maliyet') or (select public.akcan_rol()) = 'yonetici'));
create policy "yetkili gunceller" on public.docs for update to authenticated using ((select public.akcan_rol()) <> 'yok' and (col not in ('ayarlar', 'maliyet') or (select public.akcan_rol()) = 'yonetici')) with check ((select public.akcan_rol()) <> 'yok' and (col not in ('ayarlar', 'maliyet') or (select public.akcan_rol()) = 'yonetici'));

-- Mevcut verileri taşı (uygulandı: 17.11.2026; BizimHesap'a gönderim tetiklenmesin)
-- alter table public.docs disable trigger bh_push_tetikle;
-- insert maliyet/<stokId> from stok.alis; insert maliyet/fis:<col>:<id> from kalemler.alis
-- update docs set data = data - 'alis' where col = 'stok';  update isemirleri/satislar (trigger kalem alis'ini siler)
-- alter table public.docs enable trigger bh_push_tetikle;
