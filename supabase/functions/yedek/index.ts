// Günlük yedek: bütün kayıtları sıkıştırılmış JSON olarak özel 'yedekler' deposuna yazar, 30 günden eskileri siler.
// Zamanlanmış görev (x-akcan-secret) ya da programdaki yönetici (giriş jetonu) çağırabilir.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { sb, yetkili } from "../_shared/bh.ts";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const yanit = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const KOVA = "yedekler", SAKLA_GUN = 30;

async function yoneticiMi(req: Request) {
  const auth = req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return false;
  const k = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const { data } = await k.rpc("akcan_rol");
  return data === "yonetici";
}

async function yedekAl(kim: string) {
  const o: Record<string, any> = { surum: 1, tarih: new Date().toISOString(), kaynak: "otomatik-yedek", alan: kim };
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from("docs").select("col,id,data").order("col").order("id").range(from, from + 999);
    if (error) throw error;
    for (const r of data) (o[r.col] ||= {})[r.id] = r.data;
    if (data.length < 1000) break;
  }
  const ayarTum = o.ayarlar || {};
  o.ayarlarTum = ayarTum;
  o.ayarlar = ayarTum.genel || {};
  const ham = new TextEncoder().encode(JSON.stringify(o));
  const gz = await new Response(new Blob([ham]).stream().pipeThrough(new CompressionStream("gzip"))).arrayBuffer();
  const t = new Date(Date.now() + 3 * 3600000).toISOString().slice(0, 16).replace("T", "_").replace(":", "-");
  const ad = `${t}.json.gz`;
  const { error } = await sb.storage.from(KOVA).upload(ad, new Uint8Array(gz), { contentType: "application/gzip", upsert: true });
  if (error) throw error;
  // eski yedekleri sil
  const { data: L } = await sb.storage.from(KOVA).list("", { limit: 1000 });
  const sinir = Date.now() - SAKLA_GUN * 86400000;
  const sil = (L || []).filter((f) => f.created_at && new Date(f.created_at).getTime() < sinir).map((f) => f.name);
  if (sil.length) await sb.storage.from(KOVA).remove(sil);
  const say: Record<string, number> = {};
  for (const [c, v] of Object.entries(o)) if (v && typeof v === "object" && !["ayarlar", "ayarlarTum"].includes(c)) say[c] = Object.keys(v).length;
  return { ad, boyut: gz.byteLength, ham: ham.byteLength, kayit: say, silinen: sil.length };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const sistem = await yetkili(req);
    if (!sistem && !(await yoneticiMi(req))) return yanit({ hata: "Yalnızca yönetici" }, 403);
    const b = await req.json().catch(() => ({}));
    const islem = b.islem || (sistem ? "al" : "liste");
    if (islem === "al") return yanit({ ok: true, ...(await yedekAl(sistem ? "zamanlanmış" : "yönetici")) });
    if (islem === "liste") {
      const { data, error } = await sb.storage.from(KOVA).list("", { limit: 100, sortBy: { column: "name", order: "desc" } });
      if (error) throw error;
      return yanit({ ok: true, liste: (data || []).filter((f) => f.name.endsWith(".json.gz")).map((f) => ({ ad: f.name, boyut: f.metadata?.size || 0, zaman: f.created_at })) });
    }
    if (islem === "indir") {
      const ad = String(b.ad || "");
      if (!/^[\w\-]+\.json\.gz$/.test(ad)) return yanit({ hata: "Geçersiz dosya" }, 400);
      const { data, error } = await sb.storage.from(KOVA).createSignedUrl(ad, 300);
      if (error) throw error;
      return yanit({ ok: true, url: data.signedUrl });
    }
    return yanit({ hata: "İşlem geçersiz" }, 400);
  } catch (e) {
    return yanit({ hata: String((e as Error).message || e).slice(0, 300) }, 500);
  }
});
