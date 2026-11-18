const {JSDOM}=require('jsdom');
const html=require('fs').readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
const dom=new JSDOM(html,{runScripts:'dangerously',url:'https://x.test/#randevu',pretendToBeVisual:true});
const w=dom.window; w.scrollTo=()=>{}; const errs=[]; w.addEventListener('error',e=>errs.push(e.message)); const opened=[]; w.open=(u)=>{opened.push(u);};
setTimeout(()=>{ const T=w.__test,S=T.S; const D=86400000; const g=new Date(); g.setHours(0,0,0,0); const b=g.getTime();
 S.randevular={r1:{id:'r1',tarih:b+D+10*3600000,sure:60,musteriAd:'Ali',tel:'05321112233',plaka:'34ABC123',depo:'Sultanbeyli',is:'Bakım',durum:'Talep',kaynak:'online',not:'Fren sesi'},
  r2:{id:'r2',tarih:b+D+11*3600000,sure:60,musteriAd:'Veli',tel:'05330001122',depo:'Velibaba',is:'Fren',durum:'Bekleniyor'},
  r3:{id:'r3',tarih:b+14*3600000,sure:90,musteriAd:'Can',depo:'Sultanbeyli',durum:'Bekleniyor'}};
 T.setRol('yonetici');
 const d=w.document; const txt=()=>d.body.textContent;
 console.log('talep card',txt().includes('Onay bekleyen online talepler'),'hatirlat',txt().includes('Yarın için hatırlatma'),'takvim',!!d.querySelector('.rtak'),'cells+',d.querySelectorAll('.rtak-ekle').length);
 // hatırlat click
 const a=d.querySelector('a[data-rhat="r2"]'); console.log('wa', a&&decodeURIComponent(a.href).slice(0,140));
 a.addEventListener('click',e=>e.preventDefault()); a.click();
 setTimeout(()=>{ console.log('hatirlatildi', !!S.randevular.r2.hatirlatildi);
  d.querySelector('[data-act="randevuOnayla"][data-id="r1"]').click();
  setTimeout(()=>{ console.log('onay', S.randevular.r1.durum, opened.length, decodeURIComponent(opened[0]||'').slice(0,120));
   d.querySelector('.rtak-ekle').click();
   setTimeout(()=>{ console.log('modal yeni', !!d.querySelector('#r-tarih'), d.querySelector('#r-tarih').value, d.querySelector('#r-depo').value);
    w.location.hash='#ayarlar'; setTimeout(()=>{ console.log('ayar', txt().includes('Online randevu'), !!d.querySelector('[data-a="randevuSlot"]'));
     w.location.hash='#panel'; setTimeout(()=>{ console.log('panel', txt().includes('hatırlatılmadı')||txt().includes('onay bekliyor'), 'errors',errs); process.exit(0);},100);},100);},100);},150);},150);
},200);
