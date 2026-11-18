const {JSDOM}=require('jsdom');
const html=require('fs').readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
const dom=new JSDOM(html,{runScripts:'dangerously',url:'https://x.test/#panel',pretendToBeVisual:true});
const w=dom.window; w.scrollTo=()=>{}; const errs=[]; w.addEventListener('error',e=>errs.push(e.message)); const opened=[]; w.open=u=>opened.push(u);
setTimeout(async()=>{ const T=w.__test,S=T.S, now=Date.now();
 T.setRol('yonetici');
 S.isemirleri={i1:{id:'i1',no:'SRV-1',durum:'İşlemde',giris:now-3600000,plaka:'34ABC123',musteriAd:'Ali',musteriTel:'05321112233',kalemler:[{tip:'parca',ad:'Balata',adet:1,fiyat:1500,kdv:20}],tahsilatlar:[],indirim:0,depo:'Sultanbeyli'}};
 S.satislar={s1:{id:'s1',no:'STS-1',tarih:now,depo:'Velibaba',kalemler:[{ad:'Ampul',adet:2,fiyat:800,kdv:20}],tahsilatlar:[{t:now,tutar:1600,yontem:'Kredi Kartı'}],indirim:0}};
 const d=w.document;
 d.querySelector('[data-act="ozetAc"]').click(); await new Promise(r=>setTimeout(r,100));
 console.log(d.querySelector('#modal pre').textContent);
 console.log('wa', d.querySelector('#modal a.btn.pri').href.slice(0,30));
 // durum Tamamlandı via select
 T.ACT? 0:0;
 w.location.hash='#isemirleri'; await new Promise(r=>setTimeout(r,100));
 const sel=d.querySelector('[data-durum-id="i1"]')||d.querySelector('select[data-durum-id]');
 if(sel){ sel.value='Tamamlandı'; sel.dispatchEvent(new w.Event('change',{bubbles:true})); await new Promise(r=>setTimeout(r,150));
  const ok=[...d.querySelectorAll('#onay-ov button')].pop(); if(ok) ok.click(); await new Promise(r=>setTimeout(r,150)); }
 const r=S.isemirleri.i1; console.log('durum',r.durum, JSON.stringify(r.durumGecmis&&r.durumGecmis.map(x=>x.d)), !!r.teklifToken, decodeURIComponent(opened[0]||'').slice(0,170));
 console.log('errors',errs); process.exit(0);
},200);
