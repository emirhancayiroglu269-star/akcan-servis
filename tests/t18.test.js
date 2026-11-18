const {JSDOM}=require('jsdom');
const html=require('fs').readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
const dom=new JSDOM(html,{runScripts:'dangerously',url:'https://x.test/#stok',pretendToBeVisual:true});
const w=dom.window; w.scrollTo=()=>{}; const errs=[]; w.addEventListener('error',e=>errs.push(e.message));
setTimeout(()=>{ const T=w.__test, S=T.S;
 S.stok={a:{id:'a',kod:'A1',ad:'Yağ filtresi',tur:'urun',miktar:{Sultanbeyli:3,Velibaba:10},kritik:0,kdv:20},
   b:{id:'b',kod:'B1',ad:'Balata',tur:'urun',miktar:{Sultanbeyli:1,Velibaba:0},kritik:2,kdv:20},
   c:{id:'c',kod:'C1',ad:'Ampul',tur:'urun',miktar:{Sultanbeyli:50,Velibaba:50},kritik:0}};
 S.alislar={x:{id:'x',tarih:1,tedarikciAd:'Oto İsmail',tedarikciId:'t1',kalemler:[{stokId:'a',fiyat:120,adet:5}]}};
 T.TUK.veri={'a|Sultanbeyli':20,'c|Sultanbeyli':5}; T.TUK.bas=Date.now()-10*86400000; T.TUK.zaman=Date.now();
 T.setRol('yonetici');
 const L=T.siparisOnerileri(); console.log(L.map(r=>[r.key,r.mev,r.cik,r.gunluk.toFixed(2),Math.floor(r.kalan),r.oneri].join(' ')));
 w.document.querySelector('[data-act="stokF"][data-v="Sipariş"]').click();
 setTimeout(()=>{ const d=w.document; console.log('rows',d.querySelectorAll('[data-sipsec]').length, d.body.textContent.includes('10 günlük veri'));
  const cb=d.querySelector('[data-sipsec="a|Sultanbeyli"]'); cb.checked=true; cb.dispatchEvent(new w.Event('change',{bubbles:true}));
  setTimeout(()=>{ d.querySelector('[data-act="sipAlisAc"]').click();
   setTimeout(()=>{ const m=d.querySelector('#modal'); console.log('modal', m&&m.innerHTML.includes('Yağ filtresi'), m&&m.querySelector('[data-al="0.adet"]').value, m&&m.innerHTML.includes('Oto İsmail'));
    console.log('errors',errs); process.exit(0); },100); },100); },150);
},200);
