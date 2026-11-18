const {JSDOM}=require('jsdom');
const html=require('fs').readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
const dom=new JSDOM(html,{runScripts:'dangerously',url:'https://x.test/#panel',pretendToBeVisual:true});
const w=dom.window; w.scrollTo=()=>{}; let printed=''; w.open=()=>({document:{open(){},write(h){printed=h},close(){}}}); const errs=[]; w.addEventListener('error',e=>errs.push(e.message));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 await sleep(100);
 const T=w.__test,S=T.S,d=w.document;
 const click=sel=>{const el=d.querySelector(sel); if(!el) throw new Error('yok '+sel); el.dispatchEvent(new w.MouseEvent('click',{bubbles:true}));};
 const type=(sel,v,ev='input')=>{const el=d.querySelector(sel); if(!el) throw new Error('yok '+sel); el.value=v; el.dispatchEvent(new w.Event(ev,{bubbles:true}));};
 // satış ile nakit tahsilat
 w.location.hash='#stok'; await sleep(50);
 click('[data-act="stokYeni"]'); type('[data-st="kod"]','FLT-1'); type('[data-st="ad"]','Yağ filtresi'); type('[data-st="alis"]','100'); type('[data-st="satis"]','240'); type('[data-sq="Sultanbeyli"]','5'); click('[data-act="stokKaydet"]'); await sleep(50);
 w.location.hash='#satis'; await sleep(50);
 type('#q-satis','FLT-1'); d.querySelector('#q-satis').dispatchEvent(new w.KeyboardEvent('keydown',{key:'Enter',bubbles:true})); await sleep(20);
 click('[data-act="satisTamamla"]'); await sleep(150);
 console.log('satis', Object.keys(S.satislar).length);
 // gider
 w.location.hash='#giderler'; await sleep(50);
 click('[data-act="giderYeni"]'); click('[data-act="giderKatSec"][data-v="Yemek, çay"]'); type('#g-tutar','40'); click('[data-act="giderKaydet"]'); await sleep(100);
 console.log('gider', Object.values(S.giderler).map(g=>g.kategori+' '+g.tutar+' '+g.odeme));
 console.log('gider sayfa', d.querySelector('#main .tile .v').textContent);
 // kasa
 w.location.hash='#kasa'; await sleep(50);
 console.log('kasa tiles', [...d.querySelectorAll('#main .tile')].map(t=>t.textContent.replace(/\s+/g,' ')).join(' | '));
 type('#k-acilis','500'); type('#k-sayim','690'); type('#k-sayim','690','change'); await sleep(20);
 console.log('nakit tablo', [...d.querySelectorAll('#main table')][0].textContent.replace(/\s+/g,' '));
 click('[data-act="kasaKapat"]'); await sleep(50);
 const onay=d.querySelector('#onay-ov'); if(onay){ console.log('onay', onay.textContent.replace(/\s+/g,' ').slice(0,120)); click('[data-act="onayEvet"]'); }
 await sleep(100);
 console.log('kapanis', JSON.stringify(Object.values(S.kasakapanis)).slice(0,250));
 click('[data-act="kasaYazdir"]'); console.log('yazdir', printed.length>500, /Gün sonu kasa/.test(printed));
 w.location.hash='#raporlar'; await sleep(50);
 console.log('rapor', [...d.querySelectorAll('#main .tile')].map(t=>t.textContent.replace(/\s+/g,' ')).filter(x=>/Gider|Net/.test(x)).join(' | '));
 console.log('errors', errs); process.exit(0);
})().catch(e=>{console.log('FAIL',e.message,errs);process.exit(1)});
