// randevu.html with mocked fetch
const {JSDOM}=require('jsdom');
const html=require('fs').readFileSync(require('path').join(__dirname,'..','randevu.html'),'utf8');
const posted=[];
const dom=new JSDOM(html,{runScripts:'dangerously',url:'https://x.test/randevu.html',pretendToBeVisual:true,beforeParse(w){
 w.fetch=async(u,o)=>{ if(o&&o.method==='POST'){ posted.push(JSON.parse(o.body)); return {ok:true,json:async()=>({ok:true})}; }
  return {ok:true,json:async()=>({firma:{ad:'AKCAN',tel:'0553',adres:'Sultanbeyli adres'},depolar:['Sultanbeyli'],depo:'Sultanbeyli',hizmetler:['Fren','Bakım'],slotDk:60,gunler:[{gun:'2026-11-19',kapali:false,slotlar:[{saat:'09:00',bos:true},{saat:'10:00',bos:false}]}]})}; };
}});
const w=dom.window; const errs=[]; w.addEventListener('error',e=>errs.push(e.message));
setTimeout(async()=>{ const d=w.document;
 console.log('sube adimi', [...d.querySelectorAll('h2')].map(h=>h.textContent).join('|'), 'baslik', d.body.textContent.includes('Sultanbeyli servis'));
 d.querySelector('[data-saat="09:00"]').click();
 d.getElementById('f-ad').value='Ali Veli'; d.getElementById('f-tel').value='05321112233'; d.getElementById('f-sasi').value='wf0xxttgmnl88121'; d.getElementById('f-detay').value='Fren sesi var, balata kontrol';
 d.getElementById('gonder').click(); await new Promise(r=>setTimeout(r,50));
 console.log('hata1', (d.querySelector('.hata')||{}).textContent);
 d.getElementById('f-sasi').value='wf0x xttgm-nl88121'.replace('nl','nl8'); d.getElementById('f-sasi').value='WF0XXTTGMNL881212'; d.getElementById('gonder').click(); await new Promise(r=>setTimeout(r,50));
 console.log('posted', JSON.stringify(posted), d.body.textContent.includes('Talebiniz alındı'), errs); process.exit(0);
},100);
