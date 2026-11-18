const {JSDOM}=require('jsdom');
const html=require('fs').readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
const dom=new JSDOM(html,{runScripts:'dangerously',url:'https://x.test/#musteriler',pretendToBeVisual:true});
const w=dom.window; w.scrollTo=()=>{}; const errs=[]; w.addEventListener('error',e=>errs.push(e.message));
setTimeout(()=>{ const T=w.__test,S=T.S, D=86400000, now=Date.now();
 T.setAY({bhhareket:{bakiye:{A:1500,B:300,P:9999,C:0,E:500},son:now},bh:{perakendeId:'P'}});
 S.musteriler={m1:{id:'m1',bhId:'A',ad:'Ali Usta',tel:'5321112233'}};
 S.bhhareket={h1:{id:'h1',musteriId:'A',musteriAd:'ALİ',yon:'borc',tutar:1000,tarih:now-60*D,vade:now-60*D},
  h2:{id:'h2',musteriId:'A',yon:'borc',tutar:1000,tarih:now-5*D,vade:now-5*D},
  h3:{id:'h3',musteriId:'B',musteriAd:'Veli',yon:'borc',tutar:300,tarih:now-10*D,vade:now+20*D},
  h4:{id:'h4',musteriId:'E',musteriAd:'Eski',yon:'borc',tutar:200,tarih:now-2*D,vade:now-2*D}};
 T.setRol('yonetici');
 console.log(JSON.stringify(T.vadeAnaliz().map(x=>[x.ad,x.gecen,x.gun,x.devir,x.bakiye])));
 w.location.hash='#panel'; setTimeout(()=>{ console.log('panel tile', w.document.body.textContent.includes('Vadesi geçen alacak'));
  w.document.querySelector('[data-act="vadeGit"]').click();
  setTimeout(()=>{ const d=w.document; console.log('vade view', d.body.textContent.includes('Ali Usta'), !!d.querySelector('a.wa'), decodeURIComponent((d.querySelector('a.wa')||{}).href||'').slice(0,160));
   console.log('errors',errs); process.exit(0);},150);},150);
},200);
