// Programdaki satış, iş emri, tahsilat, yeni müşteri ve yeni ürünleri BizimHesap'a gönderir.
// Tetikleme: docs tablosundaki trigger ({col,id}) ya da 5 dakikalık cron ({} = bekleyen her şeyi tara).
import { allDocs, bhPostFirm, bhPostToken, bhTarih, getDoc, json, KAPALI, num, putDoc, r2, sb, TOKEN, yetkili } from "../_shared/bh.ts";

type Rec = Record<string, any>;
let AYAR: Rec = {};

const ODEME: Record<string, string> = { "Nakit": "1", "Kredi Kartı": "2", "Havale/EFT": "3" };
const telRakam = (t: string) => { let d = String(t || "").replace(/\D/g, ""); if (d.startsWith("90") && d.length === 12) d = d.slice(2); if (d.startsWith("0")) d = d.slice(1); return d; };

function musteriBH(m: Rec | null) {
  if (!m) {
    return { customerId: AYAR.perakendeKod || AYAR.perakendeId || "", title: AYAR.perakendeAd || "Perakende Müşteri", address: "-" };
  }
  return {
    customerId: m.bhKod || m.bhId || m.id,
    title: m.ad,
    address: m.adres || "-",
    phone: telRakam(m.tel),
    email: m.eposta || "",
    taxNo: String(m.vergi || "").replace(/\D/g, "").length >= 10 ? String(m.vergi).replace(/\D/g, "").slice(-11) : "",
  };
}

// Müşteri kodu ve BizimHesap ID'si sırayla denenir; HTTP 500 hiçbir kayıt oluşturmaz
async function tahsilatEkle(adaylar: string[], govde: Rec, eposta?: string) {
  let son: unknown = null;
  for (const id of adaylar) {
    try { return await bhPostFirm("/b2b/AddCollection", { ...govde, customer: { customerId: id, email: eposta || "musteri@akcangroup.com" } }); }
    catch (e) { son = e; if (!/HTTP 500/.test(String((e as Error).message))) throw e; }
  }
  throw son || new Error("Tahsilat eklenemedi");
}

async function satisGonder(col: string, r: Rec) {
  const aktif = col === "satislar" ? !r.iptal : KAPALI.includes(r.durum);
  const m = r.musteriId ? await getDoc("musteriler", r.musteriId) : null;
  const adaylar = [...new Set((m ? [m.bhKod, m.bhId] : [AYAR.perakendeKod, AYAR.perakendeId]).filter(Boolean))] as string[];

  // 1) Belge
  if (!aktif) {
    if (r.bhGuid) { await bhPostFirm("/b2b/cancelinvoice", { guid: r.bhGuid }); r.bhGuid = null; r.bhUrl = null; }
  } else {
    const kalemler = (r.kalemler || []).filter((k: Rec) => num(k.adet) > 0);
    if (!kalemler.length) throw new Error("Kalem yok");
    const brut = kalemler.reduce((s: number, k: Rec) => s + num(k.adet) * num(k.fiyat), 0);
    const indirim = Math.min(num(r.indirim), brut), oran = brut > 0 ? (brut - indirim) / brut : 1;
    let G = 0, D = 0, N = 0, T = 0;
    const details = [];
    for (const k of kalemler) {
      const kdv = num(k.kdv), adet = num(k.adet);
      const st = k.stokId ? await getDoc("stok", k.stokId) : null;
      const birimHaric = num(k.fiyat) / (1 + kdv / 100);
      const gross = r2(adet * birimHaric), net = r2(gross * oran), disc = r2(gross - net), tax = r2(net * kdv / 100);
      G += gross; D += disc; N += net; T += tax;
      const kod = st?.kod || (k.tip === "parca" ? (k.kod || "") : (AYAR.iscilikKod || "AKCAN-ISCILIK"));
      details.push({
        productId: kod || undefined,
        productName: st?.ad || k.ad || (k.tip === "parca" ? "Parça" : "İşçilik"),
        barcode: st?.barkod || undefined,
        warehouseId: AYAR.depolar?.[r.depo] || undefined,
        note: st ? "" : (k.ad || ""),
        taxRate: kdv, quantity: adet, unitPrice: r2(birimHaric), grossPrice: gross, discount: disc, net, tax, total: r2(net + tax),
      });
    }
    const tarih = col === "satislar" ? r.tarih : (r.kapanis || r.teslim || r.giris);
    const plaka = r.plaka ? " · " + r.plaka : "";
    const res = await bhPostFirm("/b2b/addinvoice", {
      invoiceNo: r.no, invoiceType: 3,
      note: `${r.no}${plaka}${col === "isemirleri" ? " · Servis" : " · Akcan Oto Servis"}`,
      dates: { invoiceDate: bhTarih(tarih), dueDate: bhTarih(tarih) },
      customer: musteriBH(m),
      amounts: { currency: "TL", gross: r2(G), discount: r2(D), net: r2(N), tax: r2(T), total: r2(N + T) },
      details,
    });
    r.bhGuid = res.guid; r.bhUrl = res.url; r.bhFaturali = false; r.bhGonderim = Date.now();
    // Belge oluştu: tahsilat aşamasında hata olsa bile guid kaybolmasın
    r.bhSon = Date.now(); await putDoc(col, r.id, r);
  }

  // 2) Tahsilatlar
  const gonderilen: Rec[] = r.bhGonderilenTahsilat || [];
  const istenen = aktif ? (r.tahsilatlar || []).filter((t: Rec) => t.yontem !== "Veresiye" && num(t.tutar) > 0) : [];
  const anahtar = (t: Rec) => `${t.t}|${num(t.tutar)}|${t.yontem}`;
  const istenenSet = new Set(istenen.map(anahtar));
  const kalan: Rec[] = [];
  for (const g of gonderilen) {
    if (istenenSet.has(g.anahtar)) kalan.push(g);
    else { await bhPostFirm("/document/CancelCollection", { guid: g.guid }); }
  }
  const kalanSet = new Set(kalan.map((g) => g.anahtar));
  for (const t of istenen) {
    if (kalanSet.has(anahtar(t))) continue;
    if (!adaylar.length) throw new Error("BizimHesap'ta Perakende Müşteri carisi bulunamadı (Ayarlar)");
    const res = await tahsilatEkle(adaylar, {
      paymentType: ODEME[t.yontem] || "1", currency: "TL", amount: r2(num(t.tutar)), paymentDate: bhTarih(t.t),
      note: `${r.no} tahsilat`, cashId: AYAR.kasalar?.[`${r.depo}|${t.yontem}`] || AYAR.kasalar?.[t.yontem] || undefined,
    }, m?.eposta);
    kalan.push({ anahtar: anahtar(t), guid: res.guid });
  }
  r.bhGonderilenTahsilat = kalan;
  r.tahsilatlar = (r.tahsilatlar || []).map((t: Rec) => ({ ...t, bhAktarildi: t.yontem === "Veresiye" ? true : kalan.some((g) => g.anahtar === anahtar(t)) }));
  r.bhAktarildi = true; r.bhDegisti = false; r.bhHata = null;
}

async function musteriGonder(m: Rec) {
  if (!m.bhId && m.bhAktarildi === false) {
    const data = await bhPostToken("/b2b/addcustomer", {
      customerId: m.id, title: m.ad, phone: telRakam(m.tel), email: m.eposta || "", address: m.adres || "", currency: "TL",
    });
    m.bhId = data.code; m.bhKod = m.id; m.kaynak = "BizimHesap";
  }
  m.bhAktarildi = true;
  const adaylar = [...new Set([m.bhKod, m.bhId].filter(Boolean))] as string[];
  const odemeler: Rec[] = m.odemeler || [];
  for (const o of odemeler) {
    if (o.bhAktarildi || num(o.tutar) <= 0) continue;
    const res = await tahsilatEkle(adaylar, {
      paymentType: ODEME[o.yontem] || "1", currency: "TL", amount: r2(num(o.tutar)), paymentDate: bhTarih(o.t),
      note: o.not || "Akcan Oto Servis tahsilat", cashId: AYAR.kasalar?.[o.yontem] || undefined,
    }, m.eposta);
    o.bhAktarildi = true; o.bhGuid = res.guid;
  }
  m.odemeler = odemeler; m.bhBekleyen = false; m.bhHata = null;
}

async function stokGonder(s: Rec) {
  if (!s.kod) throw new Error("Stok kodu boş");
  await bhPostToken("/b2b/addproduct", {
    id: s.kod, title: s.ad, barcode: s.barkod || undefined, price: r2(num(s.satis) / (1 + num(s.kdv) / 100)),
    taxRate: num(s.kdv), currency: "TL", unit: s.birim && /^ad/i.test(s.birim) ? "Adet" : (s.birim || "Adet"),
    productType: s.tur === "hizmet" ? 2 : 1,
  });
  s.kaynak = "BizimHesap"; s.bhHata = null;
}

async function isle(col: string, id: string) {
  const d = await getDoc(col, id);
  if (!d) return "yok";
  try {
    if (col === "isemirleri" || col === "satislar") {
      if (d.bhAktarildi !== false) return "gerek yok";
      if (col === "isemirleri" && !KAPALI.includes(d.durum) && !d.bhGuid) return "açık iş emri";
      await satisGonder(col, d);
    } else if (col === "musteriler") {
      if (!(d.bhAktarildi === false || d.bhBekleyen === true)) return "gerek yok";
      await musteriGonder(d);
    } else if (col === "stok") {
      if (d.kaynak === "BizimHesap") return "gerek yok";
      await stokGonder(d);
    } else return "bilinmeyen";
    d.bhSon = Date.now();
    await putDoc(col, id, d);
    return "tamam";
  } catch (e) {
    const fresh = await getDoc(col, id);
    if (fresh) { fresh.bhHata = String((e as Error).message || e).slice(0, 300); fresh.bhSon = Date.now(); await putDoc(col, id, fresh); }
    return "hata: " + (e as Error).message;
  }
}

Deno.serve(async (req) => {
  if (!(await yetkili(req))) return json({ error: "yetkisiz" }, 401);
  if (!TOKEN) return json({ error: "BH_TOKEN tanımlı değil" }, 500);
  AYAR = (await getDoc("ayarlar", "bh")) || {};
  const body = await req.json().catch(() => ({}));
  const sonuc: Record<string, string> = {};
  if (body.col && body.id) {
    sonuc[`${body.col}/${body.id}`] = await isle(body.col, body.id);
  } else {
    // Tarama: sıra önemli (önce stok ve yeni müşteriler)
    for (const col of ["stok", "musteriler", "isemirleri", "satislar"]) {
      const { data, error } = await sb.from("docs").select("id,data").eq("col", col).or(
        col === "stok" ? "data->>kaynak.is.null,data->>kaynak.neq.BizimHesap"
        : col === "musteriler" ? "data->>bhAktarildi.eq.false,data->>bhBekleyen.eq.true"
        : "data->>bhAktarildi.eq.false",
      );
      if (error) { sonuc[col] = "sorgu hatası: " + error.message; continue; }
      for (const row of data || []) {
        // Hata veren kayıtları en fazla 10 dakikada bir dene
        if (row.data.bhHata && row.data.bhSon && Date.now() - row.data.bhSon < 9 * 60_000) continue;
        sonuc[`${col}/${row.id}`] = await isle(col, row.id);
      }
    }
  }
  return json({ sonuc });
});
