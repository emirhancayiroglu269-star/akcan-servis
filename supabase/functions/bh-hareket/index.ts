// BizimHesap'ta yapılan satış ve tahsilatları (cari ekstrelerinden) programa getirir.
// Yalnızca bakiyesi değişen carilerin ekstresi okunur; ilk çalışmada hepsi okunur.
import { allDocs, getDoc, json, putDoc, sb, TOKEN, trNum, yetkili, BH } from "../_shared/bh.ts";

type Rec = Record<string, any>;
const bekle = (ms: number) => new Promise((r) => setTimeout(r, ms));
const kanon = (v: unknown): string => v && typeof v === "object" && !Array.isArray(v)
  ? "{" + Object.keys(v as Rec).sort().map((k) => JSON.stringify(k) + ":" + kanon((v as Rec)[k])).join(",") + "}"
  : Array.isArray(v) ? "[" + v.map(kanon).join(",") + "]" : JSON.stringify(v ?? null);
// "17.11.2026" → İstanbul öğlen (gün kayması olmasın)
const tarihMs = (s: string) => { const [g, a, y] = String(s || "").split(".").map(Number); return y ? Date.UTC(y, a - 1, g, 9) : null; };
const PROG_NO = /\b[A-ZÇĞİÖŞÜ]{2,6}-\d{6}-\d{2,}\b/;

async function ekstre(id: string): Promise<Rec> {
  for (let deneme = 0; deneme < 2; deneme++) {
    const r = await fetch(`${BH}/b2b/abstract/${id}`, { headers: { Token: TOKEN } });
    if (r.status === 429) { if (deneme >= 1) break; await bekle(3000); continue; }
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const j = await r.json();
    if (j.resultCode !== 1) throw new Error(j.errorText || "hata");
    return j.data;
  }
  throw new Error("HTTP 429 (istek sınırı)");
}

Deno.serve(async (req) => {
  if (!(await yetkili(req))) return json({ error: "yetkisiz" }, 401);
  if (!TOKEN) return json({ error: "BH_TOKEN tanımlı değil" }, 500);
  const basla = Date.now();
  const sinir = Number(new URL(req.url).searchParams.get("max") || 0);
  const durum: Rec = (await getDoc("ayarlar", "bhhareket")) || {};
  const bakiyeEski: Record<string, any> = durum.bakiye || {};
  try {
    const musBH: Rec[] = [];
    for (let p = 1; p < 50; p++) {
      const r = await fetch(`${BH}/b2b/customers?page=${p}&size=1000`, { headers: { Token: TOKEN } });
      const j = await r.json(); if (j.resultCode !== 1) throw new Error(j.errorText || `müşteri listesi HTTP ${r.status}`);
      musBH.push(...j.data.customers); if (j.data.customers.length < 1000) break;
    }
    const appMus = new Map((await allDocs("musteriler")).filter((m) => m.data.bhId).map((m) => [m.data.bhId, m.id]));
    const mevcut = await allDocs("bhhareket");
    const mevcutMap = new Map(mevcut.map((d) => [d.id, d.data]));
    // BizimHesap ekstre servisinin istek sınırı düşük: günlük bütçe ve sınıra takılınca 1 saat bekleme.
    // Öncelik: perakende cari (peşin satışlar, 10 dakikada bir), bakiyesi değişenler, sonra sırayla diğerleri (çalışma başına 1).
    const simdi = Date.now();
    const gun = new Date(simdi + 3 * 3600000).toISOString().slice(0, 10);
    const sayac = durum.sayac && durum.sayac.gun === gun ? durum.sayac : { gun, n: 0 };
    // BizimHesap ekstre sorgusu günde ~200 civarında sınırlanıyor; 40 sorgu faturalaşma kontrolüne (bh-pull) ayrılır.
    const GUNLUK = 140;
    if (!sinir && durum.bekle && simdi < durum.bekle) {
      return json({ ok: true, bekleme: new Date(durum.bekle).toISOString() });
    }
    const MAX = sinir || Math.max(0, Math.min(5, GUNLUK - sayac.n));
    const sirali = [...musBH].sort((a, b) => String(a.id).localeCompare(String(b.id)));
    const sec = new Map<string, Rec>();
    if (MAX > 0 && (!durum.perakendeSon || simdi - durum.perakendeSon > 10 * 60000)) for (const c of sirali) if (/perakende/i.test(c.title || "") && sec.size < MAX) sec.set(c.id, c);
    for (const c of sirali) if (sec.size < MAX && bakiyeEski[c.id] !== undefined && Number(bakiyeEski[c.id]) !== trNum(c.balance)) sec.set(c.id, c);
    let imlec = Number(durum.imlec || 0) % Math.max(1, sirali.length);
    for (let n = 0, eklendi = 0; sec.size < MAX && eklendi < 1 && n < sirali.length; n++) { const c = sirali[imlec]; imlec = (imlec + 1) % sirali.length; if (!sec.has(c.id)) { sec.set(c.id, c); eklendi++; } }
    const degisen = [...sec.values()];
    const kuyruk = [...degisen];
    console.log("bh-hareket basla", { musteri: musBH.length, okunacak: kuyruk.length, imlec });
    const bakiyeYeni: Record<string, any> = { ...bakiyeEski };
    let okunan = 0, yazilan = 0, silinen = 0; const hatalar: string[] = [];

    let sinirda = false;
    const isci = async () => {
      while (kuyruk.length && !sinirda && Date.now() - basla < 80000) {
        const c = kuyruk.shift()!;
        try {
          const ek = await ekstre(c.id); okunan++;
          const satirlar: Rec[] = (ek.abstract || []).filter((a: Rec) => a.id && /^(Satış|Tahsilat|İade|Satış İadesi)/i.test(String(a.type || "")));
          const yaz: Rec[] = []; const gorulen = new Set<string>();
          for (const a of satirlar) {
            const id = String(a.id); gorulen.add(id);
            const borc = trNum(a.debit), alacak = trNum(a.credit);
            const not = String(a.note || "").replace(/\s+/g, " ").trim();
            const data: Rec = {
              id, bhMusteriId: c.id, musteriId: appMus.get(c.id) || null, musteriAd: c.title || "",
              tip: String(a.type), tarih: tarihMs(a.trxdate), vade: tarihMs(a.duedate),
              tutar: borc || alacak, yon: borc ? "borc" : "alacak", odeme: a.payment || "", not,
              programNo: (not.match(PROG_NO) || [""])[0],
            };
            if (kanon(mevcutMap.get(id)) !== kanon(data)) yaz.push({ col: "bhhareket", id, data });
          }
          if (yaz.length) { const { error } = await sb.from("docs").upsert(yaz); if (error) throw error; yazilan += yaz.length; }
          // BizimHesap'ta silinen/iptal edilen hareketler
          const sil = mevcut.filter((d) => d.data.bhMusteriId === c.id && !gorulen.has(d.id)).map((d) => d.id);
          if (sil.length) { await sb.from("docs").delete().eq("col", "bhhareket").in("id", sil); silinen += sil.length; }
          bakiyeYeni[c.id] = trNum(c.balance) as any; sayac.n++;
          if (/perakende/i.test(c.title || "")) durum.perakendeSon = Date.now();
          await bekle(700);
        } catch (e) {
          const m = (e as Error).message;
          if (/429/.test(m)) { sinirda = true; sayac.n++; kuyruk.unshift(c); } else hatalar.push(`${c.title}: ${m}`);
          console.log("hata", c.title, m);
        }
      }
    };
    await isci();
    const kalan = kuyruk.length;
    console.log("bh-hareket bitti", { okunan, yazilan, silinen, kalan, hata: hatalar.length });
    await putDoc("ayarlar", "bhhareket", { son: Date.now(), imlec: sinirda ? (durum.imlec || 0) : imlec, sinirda, bekle: sinirda ? Date.now() + 60 * 60000 : null, sayac, perakendeSon: durum.perakendeSon || null, bakiye: bakiyeYeni, okunan, yazilan, silinen, kalan, hatalar: hatalar.slice(0, 5) });
    return json({ ok: true, sinirda, degisen: degisen.length, okunan, yazilan, silinen, kalan, hata: hatalar.length });
  } catch (e) {
    console.log("genel hata", (e as Error).message);
    return json({ ok: false, error: String((e as Error).message || e).slice(0, 300) }, 500);
  }
});
