// BizimHesap'tan ürün, depo stoğu, müşteri ve bakiye çeker; sadece değişenleri yazar.
import { allDocs, bhGet, json, KAPALI, num, putDoc, getDoc, r2, sb, TOKEN, trNum, yetkili } from "../_shared/bh.ts";

type Rec = Record<string, any>;
const plakaRe = /\b(\d{2})\s*([A-ZÇĞİÖŞÜ]{1,3})\s*(\d{2,5})\b/;
const h = (s: string) => { let a = 5381, b = 52711; for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); a = (a * 33) ^ c; b = (b * 31) ^ c; a |= 0; b |= 0; } return (a >>> 0).toString(36) + (b >>> 0).toString(36); };
const depoAdi = (t: string) => /VEL[İI]BABA/i.test(t) ? "Velibaba" : /SULTANBEYL/i.test(t) ? "Sultanbeyli" : t.trim();
const kanon = (v: unknown): string => v && typeof v === "object" && !Array.isArray(v)
  ? "{" + Object.keys(v as Rec).sort().map((k) => JSON.stringify(k) + ":" + kanon((v as Rec)[k])).join(",") + "}"
  : Array.isArray(v) ? "[" + v.map(kanon).join(",") + "]" : JSON.stringify(v ?? null);
const ayni = (a: Rec, b: Rec, keys: string[]) => keys.every((k) => kanon(a?.[k]) === kanon(b?.[k]));

async function upsertMany(rows: { col: string; id: string; data: Rec }[]) {
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await sb.from("docs").upsert(rows.slice(i, i + 500).map((r) => ({ ...r, data: { ...r.data, id: r.id } })));
    if (error) throw error;
  }
}

Deno.serve(async (req) => {
  if (!(await yetkili(req))) return json({ error: "yetkisiz" }, 401);
  if (!TOKEN) return json({ error: "BH_TOKEN tanımlı değil" }, 500);
  const now = Date.now();
  const not: string[] = [];
  try {
    // --- Tanımlar
    const [{ warehouses }, { cashiers }] = await Promise.all([bhGet("/b2b/warehouses"), bhGet("/b2b/cashiers")]);
    const eskiAyar: Rec = (await getDoc("ayarlar", "bh")) || {};
    const depolar: Record<string, string> = {};
    for (const w of warehouses) depolar[depoAdi(w.title)] = w.id;
    const kasalar: Record<string, string> = { ...(eskiAyar.kasalar || {}) };
    const bul = (re: RegExp) => cashiers.find((c: Rec) => re.test(c.title))?.id;
    kasalar["Nakit"] ||= bul(/kasa|nakit/i) || cashiers[0]?.id;
    kasalar["Kredi Kartı"] ||= bul(/pos|kredi|kart/i) || kasalar["Nakit"];
    kasalar["Havale/EFT"] ||= bul(/banka|havale|eft/i) || kasalar["Nakit"];

    // --- Ürünler
    const urunler: Rec[] = [];
    for (let p = 1; p < 50; p++) {
      const { products } = await bhGet(`/b2b/products?page=${p}&size=1000`);
      urunler.push(...products);
      if (products.length < 1000) break;
    }
    const stokBH: Record<string, Record<string, number>> = {};
    for (const [ad, wid] of Object.entries(depolar)) {
      const { inventory } = await bhGet(`/b2b/inventory/${wid}`);
      for (const it of inventory) (stokBH[it.id] ||= {})[ad] = trNum(it.qty);
    }

    // --- Müşteriler
    const musBH: Rec[] = [];
    for (let p = 1; p < 50; p++) {
      const { customers } = await bhGet(`/b2b/customers?page=${p}&size=1000`);
      musBH.push(...customers);
      if (customers.length < 1000) break;
    }
    const perakende = musBH.find((c) => /perakende/i.test(c.title));
    // --- Tedarikçiler
    let tedYaz = 0;
    try {
      const { suppliers } = await bhGet("/b2b/suppliers");
      const mevcutTed = new Map((await allDocs("tedarikciler")).map((r) => [r.id, r.data]));
      const yaz: { col: string; id: string; data: Rec }[] = [];
      const TALAN = ["ad", "kod", "tel", "adres", "vergiNo", "vergiDairesi", "eposta", "bakiye", "bhId"];
      for (const t of suppliers || []) {
        const eski = mevcutTed.get(t.id) || {};
        const yeni: Rec = { ...eski, ad: t.title || "", kod: t.code || "", tel: t.phone || "", adres: t.address || "", vergiNo: t.taxno || "", vergiDairesi: t.taxoffice || "",
          eposta: t.email || "", bakiye: trNum(t.balance), bhId: t.id, kaynak: "BizimHesap" };
        if (!eski.olusturma) { yeni.olusturma = now; yeni.odemeler = []; }
        if (!ayni(eski, yeni, TALAN)) { yeni.guncelleme = now; yaz.push({ col: "tedarikciler", id: t.id, data: yeni }); }
      }
      await upsertMany(yaz); tedYaz = yaz.length;
    } catch (e) { not.push("tedarikçi: " + (e as Error).message); }
    await putDoc("ayarlar", "bh", { ...eskiAyar, depolar, kasalar, kasaListesi: cashiers, depoListesi: warehouses,
      perakendeId: perakende?.id || eskiAyar.perakendeId || "", perakendeKod: perakende?.code || "", perakendeAd: perakende?.title || "Perakende Müşteri" });

    // --- Programda bekleyen (BizimHesap'ta henüz faturalaşmamış) satışlar
    const [isler, satislar, alislar] = await Promise.all([allDocs("isemirleri"), allDocs("satislar"), allDocs("alislar")]);
    const kayitlar = [...isler.map((x) => ({ col: "isemirleri", ...x })), ...satislar.map((x) => ({ col: "satislar", ...x })), ...alislar.map((x) => ({ col: "alislar", ...x }))]
      .filter((x) => x.col === "isemirleri" ? KAPALI.includes(x.data.durum) : !x.data.iptal);
    // Faturalaşma tespiti: taslak siparişler ekstrede görünmez; ekstrede program no'su geçiyorsa faturalaşmıştır
    const bekleyenFatura = kayitlar.filter((x) => x.data.bhAktarildi && x.data.bhGuid && !x.data.bhFaturali);
    const musteriGrup = new Map<string, Rec[]>();
    for (const x of bekleyenFatura) {
      const cid = x.col === "alislar" ? (x.data.tedarikciId || "") : x.data.musteriId ? ((await getDoc("musteriler", x.data.musteriId))?.bhId || "") : (perakende?.id || "");
      if (!cid) continue;
      (musteriGrup.get(cid) || musteriGrup.set(cid, []).get(cid)!).push(x);
    }
    for (const [cid, xs] of musteriGrup) {
      try {
        const ek = await bhGet(`/b2b/abstract/${cid}`);
        // Tahsilat satırları da program no'sunu içerdiği için yalnızca belge satırlarına bakılır
        const satirlar = (ek.abstract || []).filter((a: Rec) => !/tahsilat|ödeme|devir/i.test(String(a.type || "") + " " + String(a.note || "")) || a.id);
        const faturali = (x: Rec) => satirlar.some((a: Rec) =>
          (a.id && String(a.id).toUpperCase() === String(x.data.bhGuid).toUpperCase()) ||
          (!/tahsilat|ödeme/i.test(String(a.type || "") + String(a.note || "")) && String(a.note || "").includes(x.data.no)));
        for (const x of xs) if (x.data.no && faturali(x)) {
          x.data.bhFaturali = true;
          await putDoc(x.col, x.id, x.data);
        }
      } catch (e) { not.push("ekstre: " + (e as Error).message); }
    }
    const BEKLEYEN: Record<string, number> = {};
    for (const x of kayitlar) {
      if (x.data.bhAktarildi && x.data.bhFaturali) continue;
      for (const [k, v] of Object.entries(x.data.stokEtkisi || {})) BEKLEYEN[k] = (BEKLEYEN[k] || 0) + num(v);
    }

    // --- Stok farkı
    const mevcutStok = new Map((await allDocs("stok")).map((r) => [r.id, r.data]));
    // Alış fiyatı yalnızca yöneticinin okuyabildiği maliyet kayıtlarında tutulur; karşılaştırma için geri birleştir
    for (const m of await allDocs("maliyet")) if (!String(m.id).startsWith("fis:") && mevcutStok.has(m.id)) mevcutStok.get(m.id).alis = m.data.alis;
    const stokYaz: { col: string; id: string; data: Rec }[] = [];
    const ALAN = ["kod", "ad", "barkod", "oem", "marka", "kategori", "alis", "satis", "kdv", "birim", "miktar", "aktif", "kaynak", "bhId", "tur"];
    for (const u of urunler) {
      const id = u.variantId ? `${u.id}_${u.variantId}` : u.id;
      const eski = mevcutStok.get(id) || {};
      const hizmet = eski.tur === "hizmet" || /HİZMET|İŞÇİLİK|DANIŞMANLIK/i.test(u.category || "");
      const miktar: Record<string, number> = {};
      if (!hizmet) for (const d of Object.keys(depolar)) miktar[d] = r2((stokBH[u.id]?.[d] || 0) - (BEKLEYEN[`${id}|${d}`] || 0));
      const yeni: Rec = {
        ...eski, kod: u.code || "", ad: u.title || "", barkod: u.barcode || "", oem: u.tag || eski.oem || "", marka: u.brand || "",
        kategori: u.category || "", alis: num(u.buyingPrice), satis: num(u.price), kdv: num(u.tax), birim: u.unit || "Adet",
        miktar, aktif: u.isActive === 1, kaynak: "BizimHesap", bhId: u.id, tur: hizmet ? "hizmet" : "urun",
      };
      if (!eski.olusturma) { yeni.olusturma = now; yeni.hareketler = []; yeni.kritik = 0; }
      if (!ayni(eski, yeni, ALAN)) { yeni.guncelleme = now; stokYaz.push({ col: "stok", id, data: yeni }); }
    }
    await upsertMany(stokYaz);

    // --- Müşteri farkı (+ isimdeki plakadan araç)
    const mevcutMus = new Map((await allDocs("musteriler")).map((r) => [r.id, r.data]));
    const bhIdden = new Map([...mevcutMus.values()].filter((m) => m.bhId).map((m) => [m.bhId, m]));
    const araclar = await allDocs("araclar");
    const plakalar = new Set(araclar.map((a) => a.data.plaka));
    const musYaz: { col: string; id: string; data: Rec }[] = [], aracYaz: { col: string; id: string; data: Rec }[] = [];
    const MALAN = ["ad", "tel", "eposta", "adres", "vergi", "devir", "bhId", "bhKod", "kaynak"];
    for (const c of musBH) {
      const eski = bhIdden.get(c.id) || mevcutMus.get(c.id) || {};
      const id = eski.id || c.id;
      const yeni: Rec = {
        ...eski, ad: c.title || "", tel: c.phone || "", eposta: c.email || "", adres: c.address || eski.adres || "",
        vergi: [c.taxoffice, c.taxno].filter(Boolean).join(" "), devir: trNum(c.balance), bhId: c.id, bhKod: c.code || "", kaynak: "BizimHesap",
      };
      if (!eski.olusturma) { yeni.olusturma = now; yeni.odemeler = []; yeni.bhAktarildi = true; yeni.not = ""; }
      if (!ayni(eski, yeni, MALAN)) { yeni.guncelleme = now; musYaz.push({ col: "musteriler", id, data: yeni }); }
      const m = String(c.title || "").toLocaleUpperCase("tr-TR").match(plakaRe);
      if (m && !eski.olusturma) {
        const pk = m[1] + m[2] + m[3];
        if (!plakalar.has(pk)) {
          const parts = String(c.title).split("/").map((s: string) => s.trim()).filter(Boolean);
          const i = parts.findIndex((p: string) => plakaRe.test(p.toLocaleUpperCase("tr-TR")));
          aracYaz.push({ col: "araclar", id: "bha" + h(pk), data: { plaka: pk, musteriId: id, marka: "", model: i >= 0 && parts[i + 1] ? parts[i + 1] : "", yil: "", sasi: "", motor: "", renk: "", km: "", sonrakiBakimTarih: null, sonrakiBakimKm: "", kaynak: "BizimHesap", olusturma: now, guncelleme: now } });
          plakalar.add(pk);
        }
      }
    }
    await upsertMany(musYaz);
    await upsertMany(aracYaz);

    const ozet = `${stokYaz.length} ürün, ${musYaz.length} müşteri güncellendi${aracYaz.length ? `, ${aracYaz.length} araç eklendi` : ""}${tedYaz ? `, ${tedYaz} tedarikçi` : ""}`;
    await putDoc("ayarlar", "senkron", { son: Date.now(), durum: "tamam", not: ozet + (not.length ? " · " + not.join(" · ") : ""), urun: urunler.length, musteri: musBH.length });
    return json({ ok: true, ozet, not });
  } catch (e) {
    const msg = String((e as Error).message || e).slice(0, 300);
    await putDoc("ayarlar", "senkron", { son: Date.now(), durum: "hata", not: msg }).catch(() => {});
    return json({ ok: false, error: msg }, 500);
  }
});
