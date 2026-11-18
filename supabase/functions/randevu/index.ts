// Online randevu: müşterinin linkten boş saat görüp randevu talebi bırakması.
// Giriş gerektirmez. Dışarıya yalnızca boş/dolu saat bilgisi verir; başka müşterinin bilgisi dönmez.
// Talepler programa "Talep" durumunda düşer, servis onaylayınca kesinleşir.
import { sb } from "../_shared/bh.ts";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "GET, POST, OPTIONS" };
const yanit = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const num = (v: unknown, d = 0) => { const n = Number(String(v ?? "").replace(",", ".")); return isFinite(n) && String(v ?? "").trim() !== "" ? n : d; };
const TZ = 3 * 3600000; // Türkiye UTC+3 (yaz saati yok)
const GUN = 86400000;
const GUNLER = ["pazar", "pazartesi", "salı", "çarşamba", "perşembe", "cuma", "cumartesi"];
const PASIF = ["İptal", "Gelmedi"];

const dk = (s: unknown, d: number) => { const m = String(s ?? "").match(/^(\d{1,2})[:.](\d{2})$/); return m ? +m[1] * 60 + +m[2] : d; };
const hhmm = (m: number) => String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");
const gunStr = (ms: number) => new Date(ms + TZ).toISOString().slice(0, 10);
const gunBasi = (s: string) => Date.parse(s + "T00:00:00Z") - TZ; // yerel gece yarısı (UTC ms)
const telKey = (t: unknown) => { let s = String(t ?? "").replace(/\D/g, ""); if (s.startsWith("90")) s = s.slice(2); if (s.startsWith("0")) s = s.slice(1); return s; };
const plakaKey = (p: unknown) => String(p ?? "").toLocaleUpperCase("tr-TR").replace(/[^0-9A-ZÇĞİÖŞÜ]/g, "");

function ayar(A: any) {
  const depolar = String(A.depolar || "Sultanbeyli, Velibaba").split(",").map((s) => s.trim()).filter(Boolean);
  const kapali = String(A.randevuKapaliGunler ?? "pazar").toLocaleLowerCase("tr-TR").split(",").map((s) => s.trim()).filter(Boolean);
  return {
    acik: String(A.onlineRandevu ?? "acik") !== "kapali",
    bas: dk(A.randevuBas, 9 * 60), bit: dk(A.randevuBit, 18 * 60),
    slot: Math.max(15, Math.min(240, num(A.randevuSlot, 60))),
    kap: Math.max(1, num(A.randevuSlotKap, 2)),
    gunKap: Math.max(1, num(A.randevuKapasite, 8)),
    ileri: Math.max(1, Math.min(90, num(A.randevuIleriGun, 21))),
    kapaliGun: kapali.map((g) => GUNLER.indexOf(g)).filter((i) => i >= 0),
    hizmetler: String(A.randevuHizmetler || "Periyodik bakım, Arıza tespiti, Fren, Lastik, Klima, Diğer").split(",").map((s) => s.trim()).filter(Boolean),
    depolar,
    firma: { ad: A.firma || "", tel: A.tel || "", adres: A.adres || "" },
  };
}

async function randevular(b: number, e: number) {
  const { data, error } = await sb.from("docs").select("data").eq("col", "randevular")
    .gte("data->tarih", b - GUN).lt("data->tarih", e);
  if (error) throw error;
  return (data || []).map((r: any) => r.data).filter((x: any) => !PASIF.includes(x.durum));
}

function gunSlotlari(C: ReturnType<typeof ayar>, gun: string, depo: string, R: any[], simdi: number) {
  const b = gunBasi(gun), wd = new Date(b + TZ).getUTCDay();
  if (C.kapaliGun.includes(wd)) return { kapali: true, slotlar: [] as any[] };
  const gunR = R.filter((x) => x.tarih >= b && x.tarih < b + GUN);
  const depoR = gunR.filter((x) => (x.depo || C.depolar[0]) === depo);
  const gunDolu = depoR.length >= C.gunKap;
  const slotlar = [];
  for (let m = C.bas; m + C.slot <= C.bit; m += C.slot) {
    const t0 = b + m * 60000, t1 = t0 + C.slot * 60000;
    const n = depoR.filter((x) => x.tarih < t1 && x.tarih + (num(x.sure, 60) * 60000) > t0).length;
    slotlar.push({ saat: hhmm(m), bos: !gunDolu && n < C.kap && t0 > simdi + 3600000 });
  }
  return { kapali: false, slotlar };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const { data: g } = await sb.from("docs").select("data").eq("col", "ayarlar").eq("id", "genel").maybeSingle();
    const C = ayar(g?.data || {});
    if (!C.acik) return yanit({ hata: "Online randevu şu an kapalı. Lütfen bizi arayın.", firma: C.firma }, 403);
    const simdi = Date.now(), bugun = gunStr(simdi);
    const sonGun = gunStr(simdi + C.ileri * GUN);

    if (req.method === "GET") {
      const url = new URL(req.url);
      const depo = C.depolar.includes(url.searchParams.get("depo") || "") ? url.searchParams.get("depo")! : C.depolar[0];
      const R = await randevular(gunBasi(bugun), gunBasi(sonGun) + GUN);
      const gunler = [];
      for (let i = 0; i <= C.ileri; i++) {
        const gs = gunStr(simdi + i * GUN), s = gunSlotlari(C, gs, depo, R, simdi);
        gunler.push({ gun: gs, kapali: s.kapali, slotlar: s.slotlar });
      }
      return yanit({ firma: C.firma, depolar: C.depolar, depo, hizmetler: C.hizmetler, slotDk: C.slot, gunler });
    }

    if (req.method === "POST") {
      const b = await req.json().catch(() => ({}));
      if (b.web) return yanit({ ok: true }); // bot tuzağı
      const ad = String(b.ad || "").trim().slice(0, 80), tel = telKey(b.tel), plaka = plakaKey(b.plaka).slice(0, 12);
      const depo = C.depolar.includes(b.depo) ? b.depo : "", gun = String(b.gun || ""), saatS = String(b.saat || "");
      const is = String(b.is || "").trim().slice(0, 80), not = String(b.not || "").trim().slice(0, 500);
      if (ad.length < 2) return yanit({ hata: "Adınızı yazın." }, 400);
      if (!/^5\d{9}$/.test(tel)) return yanit({ hata: "Cep telefonunuzu 05xx xxx xx xx şeklinde yazın." }, 400);
      if (!depo) return yanit({ hata: "Şube seçin." }, 400);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(gun) || gun < bugun || gun > sonGun) return yanit({ hata: "Geçerli bir gün seçin." }, 400);
      const m = dk(saatS, -1); if (m < 0) return yanit({ hata: "Saat seçin." }, 400);
      const t = gunBasi(gun) + m * 60000;

      // Kötüye kullanım sınırı: aynı telefondan en fazla 2 açık talep, saatte en fazla 30 online talep
      const R = await randevular(gunBasi(bugun), gunBasi(sonGun) + GUN);
      if (R.filter((x) => x.kaynak === "online" && telKey(x.tel) === tel && x.tarih >= simdi && x.durum === "Talep").length >= 2)
        return yanit({ hata: "Bu telefonla bekleyen randevu talepleriniz var. Değişiklik için lütfen bizi arayın." }, 429);
      const { count } = await sb.from("docs").select("id", { count: "exact", head: true }).eq("col", "randevular")
        .eq("data->>kaynak", "online").gte("data->olusturma", simdi - 3600000);
      if ((count || 0) >= 30) return yanit({ hata: "Şu an çok fazla talep var, lütfen biraz sonra tekrar deneyin ya da bizi arayın." }, 429);

      const s = gunSlotlari(C, gun, depo, R, simdi).slotlar.find((x) => x.saat === hhmm(m));
      if (!s || !s.bos) return yanit({ hata: "Bu saat az önce doldu. Lütfen başka bir saat seçin.", dolu: true }, 409);

      const id = crypto.randomUUID().replace(/-/g, "").slice(0, 20);
      const doc = { id, tarih: t, sure: C.slot, plaka, aracId: null, musteriAd: ad, tel: "0" + tel, depo, is: is || "Randevu", not,
        durum: "Talep", kaynak: "online", isEmriId: null, olusturma: simdi, guncelleme: simdi };
      const { error } = await sb.from("docs").insert({ col: "randevular", id, data: doc });
      if (error) throw error;
      return yanit({ ok: true, gun, saat: hhmm(m), depo });
    }
    return yanit({ hata: "Geçersiz istek" }, 405);
  } catch (_e) {
    return yanit({ hata: "Bir sorun oluştu, lütfen daha sonra tekrar deneyin ya da bizi arayın." }, 500);
  }
});
