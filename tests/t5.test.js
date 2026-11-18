const {JSDOM}=require('jsdom');
const html=require('fs').readFileSync(require('path').join(__dirname,'..','index.html'),'utf8').replace(/XX/,'');
const dom=new JSDOM(html,{runScripts:'dangerously',url:'https://x.test/#panel',pretendToBeVisual:true});
const w=dom.window; w.scrollTo=()=>{}; w.open=()=>null; const errs=[]; w.addEventListener('error',e=>errs.push(e.message));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 await sleep(100);
 const T=w.__test, S=T.S, d=w.document;
 const click=sel=>{const el=d.querySelector(sel); if(!el) throw new Error('yok '+sel); el.dispatchEvent(new w.MouseEvent('click',{bubbles:true}));};
 const type=(sel,v,ev='input')=>{const el=d.querySelector(sel); if(!el) throw new Error('yok '+sel); el.value=v; el.dispatchEvent(new w.Event(ev,{bubbles:true}));};
 console.log('num', T.num('2.850'), T.num('2.850,50'), T.num('1250.5'), T.plakaFmt('34abc123'), T.plakaFmt('06 a 1234'));
 // stok kart
 w.location.hash='#stok'; await sleep(50);
 click('[data-act="stokYeni"]'); type('[data-st="kod"]','FLT-1'); type('[data-st="ad"]','Yağ filtresi'); type('[data-st="alis"]','100'); type('[data-st="satis"]','240'); type('[data-st="kritik"]','2');
 type('[data-sq="Sultanbeyli"]','5'); type('[data-sq="Velibaba"]','3');
 click('[data-act="stokKaydet"]'); await sleep(50);
 click('[data-act="hizmetYeni"]'); type('[data-st="ad"]','Periyodik bakım işçiliği'); type('[data-st="satis"]','1.500'); click('[data-act="stokKaydet"]'); await sleep(50);
 const st=Object.values(S.stok); console.log('stok', st.map(s=>[s.kod,s.ad,JSON.stringify(s.miktar),s.satis]));
 // iş emri
 w.location.hash='#isemirleri'; await sleep(50);
 click('[data-act="isYeni"]'); type('#f-plaka','34abc123','change'); type('#f-musteriAd','Ali Veli'); type('#f-musteriTel','0532 111 22 33'); type('#f-km','120000'); type('#f-marka','Renault');
 type('#f-ks','FLT'); click('#f-dd [data-act="kalemEkle"]'); type('#f-ks','HZM'); click('#f-dd [data-act="kalemEkle"]');
 type('[data-k="0.adet"]','2');
 type('#f-durum','Tamamlandı'); 
 click('[data-act="tahKalan"]');
 click('[data-act="isKaydet"]'); await sleep(150);
 const ie=Object.values(S.isemirleri)[0];
 console.log('is', ie.no, ie.durum, ie.plaka, JSON.stringify(ie.stokEtkisi), 'kapanis', !!ie.kapanis);
 console.log('stok sonrası', Object.values(S.stok).map(s=>s.kod+':'+JSON.stringify(s.miktar)));
 console.log('musteri', Object.values(S.musteriler).map(m=>m.ad+' '+m.tel), 'arac', Object.values(S.araclar).map(a=>a.plaka+' '+a.km));
 console.log('toplam', T.hesap(ie.kalemler,ie.indirim));
 // durum geri İşlemde -> stok iade
 type('#f-durum','İşlemde'); click('[data-act="isKaydet"]'); await sleep(150);
 console.log('geri açıldı', Object.values(S.stok).map(s=>s.kod+':'+JSON.stringify(s.miktar)));
 type('#f-durum','Teslim Edildi'); click('[data-act="isKaydet"]'); await sleep(150);
 console.log('teslim', Object.values(S.stok).map(s=>s.kod+':'+JSON.stringify(s.miktar)), !!Object.values(S.isemirleri)[0].teslim);
 click('.actions [data-act="kapat"]'); await sleep(30);
 // satış
 w.location.hash='#satis'; await sleep(50);
 type('#q-satis','FLT-1'); await sleep(30);
 d.querySelector('#q-satis').dispatchEvent(new w.KeyboardEvent('keydown',{key:'Enter',bubbles:true})); await sleep(30);
 type('#s-depo','Velibaba','change'); await sleep(30);
 click('[data-act="satisTamamla"]'); await sleep(150);
 const sa=Object.values(S.satislar)[0]; console.log('satis', sa.no, sa.depo, JSON.stringify(sa.stokEtkisi), sa.tahsilatlar[0].tutar);
 console.log('stok', Object.values(S.stok).map(s=>s.kod+':'+JSON.stringify(s.miktar)));
 // veresiye without musteri should block
 // render all views
 for(const v of ['panel','isemirleri','satis','araclar','musteriler','stok','raporlar','ayarlar']){ w.location.hash='#'+v; await sleep(40); const t=d.querySelector('#main h1'); console.log(v, t&&t.textContent, d.querySelector('#main').innerHTML.length); }
 // müşteri modal
 w.location.hash='#musteriler'; await sleep(40); click('#main [data-act="musAc"]'); await sleep(30); console.log('mus modal', d.querySelector('#modal h2').textContent, d.querySelector('#modal .tile .v').textContent);
 click('#modal [data-act="kapat"]');
 w.location.hash='#araclar'; await sleep(40); click('#main [data-act="aracAc"]'); await sleep(30); console.log('arac modal ok', !!d.querySelector('#modal [data-act="aracKaydet"]'));
 console.log('fis', d.querySelector('#modal')?'':'' );
 console.log('errors', errs);
})().catch(e=>{console.log('FAIL',e.stack, errs)});
