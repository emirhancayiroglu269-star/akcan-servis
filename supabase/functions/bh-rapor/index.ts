// Satış analizi için BizimHesap cari ekstrelerini (son 1 yıl) bh_ekstre tablosuna toplar.
import { sb, bhGet, yetkili, json } from "../_shared/bh.ts";

Deno.serve(async (req) => {
  if (!(await yetkili(req))) return json({ hata: "yetkisiz" }, 401);
  const musteriler: any[] = [];
  for (let p = 1; p < 50; p++) {
    const { customers } = await bhGet(`/b2b/customers?page=${p}&size=1000`);
    musteriler.push(...customers);
    if (customers.length < 1000) break;
  }
  let ok = 0; const hatalar: string[] = [];
  const kuyruk = [...musteriler];
  const isci = async () => {
    while (kuyruk.length) {
      const m = kuyruk.shift();
      const id = m.id || m.customerId; if (!id) continue;
      try {
        const ek = await bhGet(`/b2b/abstract/${id}`);
        await sb.from("bh_ekstre").upsert({ id, ad: m.title || ek.title || "", kod: m.code || "", data: ek, updated_at: new Date().toISOString() });
        ok++;
      } catch (e) { hatalar.push(`${m.title}: ${(e as Error).message}`); }
    }
  };
  await Promise.all([isci(), isci(), isci(), isci()]);
  await sb.from("bh_ekstre").upsert({ id: "_durum", ad: "durum", data: { ok, toplam: musteriler.length, hatalar: hatalar.slice(0, 20) }, updated_at: new Date().toISOString() });
  return json({ ok, toplam: musteriler.length, hata: hatalar.length });
});
