const {JSDOM}=require('jsdom');
const html=require('fs').readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
const dom=new JSDOM(html,{runScripts:'dangerously',url:'https://x.test/#panel',pretendToBeVisual:true});
const w=dom.window; w.scrollTo=()=>{}; w.open=()=>null; const errs=[]; w.addEventListener('error',e=>errs.push(e.message));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 await sleep(100);
 const T=w.__test, S=T.S, d=w.document;
 const click=sel=>{const el=typeof sel==="string"?d.querySelector(sel):sel; if(!el) throw new Error('yok '+sel); el.dispatchEvent(new w.MouseEvent('click',{bubbles:true}));};
 const type=(sel,v,ev='input')=>{const el=d.querySelector(sel); if(!el) throw new Error('yok '+sel); el.value=v; el.dispatchEvent(new w.Event(ev,{bubbles:true}));};
 const key=(k,o={})=>d.activeElement.dispatchEvent(new w.KeyboardEvent('keydown',Object.assign({key:k,bubbles:true},o)));
 console.log('gbar', d.querySelector('#gbar').style.display);
 w.location.hash='#stok'; await sleep(50);
 click('[data-act="stokYeni"]'); type('[data-st="kod"]','FLT-1'); type('[data-st="ad"]','Yağ filtresi'); type('[data-st="satis"]','240'); type('[data-st="barkod"]','8690001'); type('[data-sq="Sultanbeyli"]','5'); click('[data-act="stokKaydet"]'); await sleep(50);
 // F3 new iş emri
 key('F3'); await sleep(20);
 console.log('F3 modal', !!d.querySelector('#modal .sekmeler'), 'sekme', d.querySelector('.sekmeler .on').textContent);
 type('#f-plaka','34abc123','change'); type('#f-musteriAd','Ali Veli');
 key('2',{altKey:true}); await sleep(10);
 console.log('alt2 visible parca', d.querySelector('[data-sekme="parca"]').style.display==="");
 type('#f-ks','FLT'); click('#f-dd [data-act="kalemEkle"]');
 click('[data-act="kalemSerbest"][data-tip="iscilik"]'); type('[data-k="1.ad"]','Fren balata değişimi'); type('[data-k="1.fiyat"]','800');
 console.log('tab header', d.querySelector('.sekmeler').textContent);
 d.querySelector('#f-ks').focus(); key('s',{ctrlKey:true}); await sleep(150);
 const ie=Object.values(S.isemirleri)[0]; console.log('saved', ie&&ie.no, ie&&ie.durum);
 key('Escape'); click('.hd [data-act="kapat"]'); await sleep(30);
 // second iş emri for same car: suggestions
 w.location.hash='#isemirleri'; await sleep(50);
 click('[data-act="isYeni"]'); type('#f-plaka','34 ABC 123','change'); await sleep(20);
 click('[data-act="isSekme"][data-v="parca"]');
 console.log('hizli', [...d.querySelectorAll('[data-act="hizliIscilik"]')].map(b=>b.textContent));
 console.log('onceki', [...d.querySelectorAll('[data-act="oncekiParca"]')].map(b=>b.textContent));
 click('[data-act="hizliIscilik"]'); click('[data-act="oncekiParca"]');
 console.log('kalemler', JSON.stringify(require('util').inspect(w.eval('0'))), d.querySelectorAll('#f-kal tbody tr').length);
 click('.actions [data-act="kapat"]'); await sleep(30);
 // quick status from list
 const sel=d.querySelector('.row select[data-durum-id]'); console.log('row select', !!sel);
 sel.value='Tamamlandı'; sel.dispatchEvent(new w.Event('change',{bubbles:true})); await sleep(150);
 console.log('quick', ie.id&&S.isemirleri[ie.id].durum, 'kapanis', !!S.isemirleri[ie.id].kapanis, 'stok', JSON.stringify(Object.values(S.stok)[0].miktar), 'modal', !!d.querySelector('#modal .sheet'));
 // pano
 click('[data-act="isGorunum"][data-v="pano"]'); await sleep(20);
 console.log('pano kolon', d.querySelectorAll('[data-kolon]').length, 'kart', d.querySelectorAll('[data-kart]').length);
 // global search
 const g=d.querySelector('#g-ara'); g.focus(); type('#g-ara','34abc');
 console.log('g results', [...d.querySelectorAll('#g-dd .grp')].map(x=>x.textContent), d.querySelectorAll('#g-dd [data-act="gAc"]').length);
 type('#g-ara','8690001'); console.log('g barkod', d.querySelector('#g-dd [data-act="gAc"]').textContent);
 type('#g-ara','ali'); key('Enter'); await sleep(20); console.log('g enter opens', d.querySelector('#modal .hd h2')&&d.querySelector('#modal .hd h2').textContent);
 click('.hd [data-act="kapat"]'); await sleep(20);
 type('#g-ara','06xyz99'); console.log('g new', d.querySelector('#g-dd').textContent);
 key('Escape'); console.log('esc cleared', d.querySelector('#g-dd').innerHTML==="");
 d.body.focus(); d.body.dispatchEvent(new w.KeyboardEvent('keydown',{key:'?',bubbles:true})); await sleep(10);
 console.log('kisayol', d.querySelector('#modal h2').textContent);
 console.log('errors', errs);
 process.exit(0);
})().catch(e=>{console.log('FAIL',e.message, errs);process.exit(1);});
