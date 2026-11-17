// Yönetici programdan kullanıcı ekler, rolünü değiştirir ya da çıkarır.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { getDoc, putDoc, sb } from "../_shared/bh.ts";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const yanit = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const ROLLER = ["yonetici", "usta", "kasiyer"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const kendi = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") || "" } }, auth: { persistSession: false },
    });
    const { data: u } = await kendi.auth.getUser();
    const benim = String(u?.user?.email || "").toLowerCase();
    if (!benim) return yanit({ hata: "Giriş yapılmamış" }, 401);
    const { data: rol } = await kendi.rpc("akcan_rol");
    if (rol !== "yonetici") return yanit({ hata: "Bu işlemi yalnızca yönetici yapabilir" }, 403);

    const b = await req.json();
    const kayit: any = (await getDoc("ayarlar", "kullanicilar")) || { liste: [] };
    let liste: any[] = Array.isArray(kayit.liste) ? kayit.liste : [];
    // İlk kullanıcı eklenirken işlemi yapan kişi yönetici olarak listeye girer (kendini kilitlemesin)
    if (!liste.length) liste.push({ eposta: benim, ad: "Yönetici", rol: "yonetici", eklenme: Date.now() });
    const eposta = String(b.eposta || "").trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(eposta)) return yanit({ hata: "Geçerli bir e-posta girin" }, 400);

    if (b.islem === "ekle") {
      if (!ROLLER.includes(b.rol)) return yanit({ hata: "Rol geçersiz" }, 400);
      if (liste.some((k) => k.eposta === eposta)) return yanit({ hata: "Bu e-posta zaten listede" }, 400);
      const sifre = String(b.sifre || "");
      if (sifre.length < 8) return yanit({ hata: "Geçici şifre en az 8 karakter olmalı" }, 400);
      const { error } = await sb.auth.admin.createUser({ email: eposta, password: sifre, email_confirm: true });
      if (error && !/already|registered|exists/i.test(error.message)) return yanit({ hata: error.message }, 400);
      liste.push({ eposta, ad: String(b.ad || "").trim() || eposta, rol: b.rol, eklenme: Date.now(), ekleyen: benim });
    } else if (b.islem === "rol") {
      if (!ROLLER.includes(b.rol)) return yanit({ hata: "Rol geçersiz" }, 400);
      const k = liste.find((x) => x.eposta === eposta); if (!k) return yanit({ hata: "Kullanıcı bulunamadı" }, 404);
      if (eposta === benim && b.rol !== "yonetici") return yanit({ hata: "Kendi yönetici yetkinizi kaldıramazsınız" }, 400);
      k.rol = b.rol;
    } else if (b.islem === "cikar") {
      if (eposta === benim) return yanit({ hata: "Kendinizi çıkaramazsınız" }, 400);
      liste = liste.filter((x) => x.eposta !== eposta);
      // Girişini de kapat
      const { data: kul } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const hedef = kul?.users?.find((x: any) => String(x.email).toLowerCase() === eposta);
      if (hedef) await sb.auth.admin.deleteUser(hedef.id);
    } else return yanit({ hata: "İşlem geçersiz" }, 400);

    if (!liste.some((k) => k.rol === "yonetici")) return yanit({ hata: "En az bir yönetici kalmalı" }, 400);
    await putDoc("ayarlar", "kullanicilar", { liste });
    return yanit({ ok: true, liste });
  } catch (e) {
    return yanit({ hata: String((e as Error).message || e).slice(0, 300) }, 500);
  }
});
