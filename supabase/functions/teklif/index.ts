// Müşteriye gönderilen teklif linki: iş emrinin müşteriye görünen hâlini verir, onay/red kaydeder.
// Giriş gerektirmez; erişim yalnızca iş emrine özel tahmin edilemez anahtarla (teklifToken) olur.
import { sb } from "../_shared/bh.ts";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "GET, POST, OPTIONS" };
const yanit = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const num = (v: unknown) => { const n = typeof v === "number" ? v : Number(String(v ?? "").replace(",", ".")); return isFinite(n) ? n : 0; };
const r2 = (n: number) => Math.round(n * 100) / 100;

function hesap(kalemler: any[], indirim: unknown) {
  let ara = 0, kdv = 0;
  for (const k of kalemler || []) { const t = num(k.adet) * num(k.fiyat), o = num(k.kdv); ara += t; kdv += t - t / (1 + o / 100); }
  const ind = Math.min(num(indirim), ara), genel = ara - ind, oran = ara > 0 ? genel / ara : 0;
  return { ara: r2(ara), indirim: r2(ind), genel: r2(genel), kdv: r2(kdv * oran) };
}
// Teklifin içeriği değişirse eski onay geçersiz sayılsın diye özet
export function ozet(r: any) {
  const s = JSON.stringify([(r.kalemler || []).map((k: any) => [k.tip, k.ad, num(k.adet), num(k.fiyat), num(k.kdv)]), num(r.indirim)]);
  let a = 5381; for (let i = 0; i < s.length; i++) a = ((a * 33) ^ s.charCodeAt(i)) | 0;
  return (a >>> 0).toString(36);
}

async function bul(t: string) {
  if (!/^[A-Za-z0-9]{20,64}$/.test(t)) return null;
  const { data } = await sb.from("docs").select("id,data").eq("col", "isemirleri").eq("data->>teklifToken", t).maybeSingle();
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const url = new URL(req.url);
    const govde = req.method === "POST" ? await req.json() : {};
    const t = String(url.searchParams.get("t") || govde.t || "");
    const kayit = await bul(t);
    if (!kayit) return yanit({ hata: "Teklif bulunamadı ya da link geçersiz." }, 404);
    const r = kayit.data;
    if (r.durum === "İptal") return yanit({ hata: "Bu iş emri iptal edilmiş." }, 410);

    if (req.method === "POST") {
      const karar = govde.karar === "red" ? "red" : "onay";
      const onay = { durum: karar, zaman: Date.now(), ad: String(govde.ad || "").slice(0, 80), not: String(govde.not || "").slice(0, 500), ozet: ozet(r), tutar: hesap(r.kalemler, r.indirim).genel };
      const yeni = { ...r, onay, onayGecmis: [...(r.onayGecmis || []), onay].slice(-10) };
      const { error } = await sb.from("docs").update({ data: yeni }).eq("col", "isemirleri").eq("id", kayit.id);
      if (error) throw error;
      return yanit({ ok: true, onay });
    }

    const { data: g } = await sb.from("docs").select("data").eq("col", "ayarlar").eq("id", "genel").maybeSingle();
    const A: any = g?.data || {};
    const h = hesap(r.kalemler, r.indirim);
    return yanit({
      firma: { ad: A.firma || "", tel: A.tel || "", adres: A.adres || "" },
      no: r.no, plaka: r.plaka, marka: r.marka || "", model: r.model || "", km: r.km || "", musteri: r.musteriAd || "",
      sikayet: r.sikayet || "", tespit: r.tespit || "", durum: r.durum, tahminiTeslim: r.tahminiTeslim || null,
      kalemler: (r.kalemler || []).map((k: any) => ({ tip: k.tip === "parca" ? "Parça" : "İşçilik", ad: k.ad, adet: num(k.adet), fiyat: num(k.fiyat), kdv: num(k.kdv), tutar: r2(num(k.adet) * num(k.fiyat)) })),
      toplam: h,
      onay: r.onay && r.onay.ozet === ozet(r) ? { durum: r.onay.durum, zaman: r.onay.zaman, ad: r.onay.ad } : null,
    });
  } catch (e) {
    return yanit({ hata: "Bir sorun oluştu, lütfen daha sonra tekrar deneyin." }, 500);
  }
});
