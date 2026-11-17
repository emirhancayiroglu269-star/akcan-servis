# Akcan Oto Servis

Akcan Group Otomotiv için oto servis + perakende satış programı.

- Site: GitHub Pages (`index.html`)
- Veri: Supabase projesi `akcan-servis` (tablo `docs`, giriş zorunlu)
- BizimHesap: `supabase/functions/bh-push` (programdaki satış/iş emri/tahsilatı anında gönderir), `bh-pull` (5 dakikada bir ürün, depo stoğu, müşteri ve bakiye çeker)
- BizimHesap token'ı yalnızca Supabase Edge Function secret `BH_TOKEN` olarak saklanır; bu depoda yoktur.
