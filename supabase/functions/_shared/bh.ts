// BizimHesap API yardımcıları (ortak)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

export const BH = "https://uygulama.bizimhesap.com/api";
export const TOKEN = Deno.env.get("BH_TOKEN") ?? "";

export const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

export const KAPALI = ["Tamamlandı", "Teslim Edildi"];

let _secret: string | null = null;
export async function yetkili(req: Request): Promise<boolean> {
  if (_secret === null) {
    const { data } = await sb.from("akcan_gizli").select("deger").eq("ad", "fn_secret").maybeSingle();
    _secret = data?.deger ?? "";
  }
  const g = req.headers.get("x-akcan-secret") || "";
  return !!_secret && g.length === _secret.length && g === _secret;
}

export const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json" } });

/** "1.234,56" → 1234.56 ; "-381.913,93 TL" → -381913.93 */
export function trNum(v: unknown): number {
  if (typeof v === "number") return isFinite(v) ? v : 0;
  let s = String(v ?? "").replace(/TL|\s/gi, "");
  if (!s) return 0;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return isFinite(n) ? n : 0;
}
export const num = (v: unknown) => {
  if (typeof v === "number") return isFinite(v) ? v : 0;
  return trNum(v);
};
export const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

export async function bhGet(path: string) {
  const r = await fetch(BH + path, { headers: { Token: TOKEN } });
  if (r.status === 401) throw new Error("BizimHesap token hatalı (401)");
  if (!r.ok) throw new Error(`BizimHesap ${path} HTTP ${r.status}`);
  const j = await r.json();
  if (j.resultCode !== 1) throw new Error(`BizimHesap ${path}: ${j.errorText || "hata"}`);
  return j.data;
}
export async function bhPostToken(path: string, body: unknown) {
  const r = await fetch(BH + path, { method: "POST", headers: { Token: TOKEN, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const t = await r.text();
  let j: any; try { j = JSON.parse(t); } catch { throw new Error(`BizimHesap ${path} HTTP ${r.status}: ${t.slice(0, 200)}`); }
  if (!r.ok) throw new Error(`BizimHesap ${path} HTTP ${r.status}: ${j.ExceptionMessage || j.Message || ""}`);
  if (j.resultCode !== 1) throw new Error(`BizimHesap ${path}: ${j.errorText || "hata"}`);
  return j.data;
}
export async function bhPostFirm(path: string, body: Record<string, unknown>) {
  const r = await fetch(BH + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ firmId: TOKEN, ...body }) });
  const t = await r.text();
  let j: any; try { j = JSON.parse(t); } catch { throw new Error(`BizimHesap ${path} HTTP ${r.status}: ${t.slice(0, 200)}`); }
  if (!r.ok) throw new Error(`BizimHesap ${path} HTTP ${r.status}: ${j.ExceptionMessage || j.Message || ""}`);
  if (j.error) throw new Error(`BizimHesap ${path}: ${j.error}`);
  if (j.status !== undefined && String(j.status) === "-1") throw new Error(`BizimHesap ${path}: işlem başarısız`);
  return j;
}

export async function getDoc(col: string, id: string) {
  const { data, error } = await sb.from("docs").select("data").eq("col", col).eq("id", id).maybeSingle();
  if (error) throw error;
  return data?.data ?? null;
}
export async function putDoc(col: string, id: string, data: Record<string, unknown>) {
  const { error } = await sb.from("docs").upsert({ col, id, data: { ...data, id } });
  if (error) throw error;
}
export async function allDocs(col: string) {
  const out: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from("docs").select("id,data").eq("col", col).range(from, from + 999);
    if (error) throw error;
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
}

/** İstanbul yerel saatiyle yyyy-MM-ddTHH:mm:ss */
export function bhTarih(ms?: number | null) {
  const d = new Date((ms || Date.now()) + 3 * 3600_000);
  return d.toISOString().slice(0, 19);
}
