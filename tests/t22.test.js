const {JSDOM}=require('jsdom');
const html=require('fs').readFileSync(require('path').join(__dirname,'..','teklif.html'),'utf8');
function run(durum,kalemler,cb){ const now=Date.now();
const dom=new JSDOM(html,{runScripts:'dangerously',url:'https://x.test/teklif.html?t=abcdefghijklmnopqrstuvwx',pretendToBeVisual:true,beforeParse(w){
 w.fetch=async()=>({ok:true,json:async()=>({firma:{ad:'AKCAN',tel:'0553',adres:'Sultanbeyli'},no:'SRV-1',plaka:'34ABC123',marka:'Ford',model:'Transit',km:'1000',musteri:'Ali',sikayet:'Fren',tespit:'',durum,tahminiTeslim:now+3600000,giris:now-7200000,teslim:null,durumGecmis:[{d:'Beklemede',t:now-7200000},{d:'İşlemde',t:now-3600000},{d:durum,t:now-60000}],bekleyenParca:durum==='Parça Bekleniyor'?[{ad:'Balata',beklenen:now+86400000}]:[],kalan:1500,kalemler,toplam:{ara:1500,indirim:0,genel:1500,kdv:250},onay:null})});
 w.setInterval=()=>0;}});
 const w=dom.window; const errs=[]; w.addEventListener('error',e=>errs.push(e.message));
 setTimeout(()=>{ const d=w.document; cb(durum, d.querySelector('.durum-buyuk').textContent, d.querySelectorAll('.adim.ok').length, d.querySelectorAll('.adim.su').length, !!d.getElementById('karar'), !!d.getElementById('ad'), d.body.textContent.includes('Balata'), d.body.textContent.includes('Ödenecek'), errs); },100);
}
const K=[{tip:'Parça',ad:'Balata',adet:1,fiyat:1500,kdv:20,tutar:1500}];
run('Parça Bekleniyor',K,(...a)=>{console.log(...a); run('Tamamlandı',K,(...b)=>{console.log(...b); run('Beklemede',[],(...c)=>{console.log(...c); process.exit(0);});});});
