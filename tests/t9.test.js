const {JSDOM}=require('jsdom');
const html=require('fs').readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
const dom=new JSDOM(html,{runScripts:'dangerously',url:'https://x.test/#panel',pretendToBeVisual:true});
const w=dom.window; w.scrollTo=()=>{}; const errs=[]; w.addEventListener('error',e=>errs.push(e.message));
setTimeout(async()=>{ const d=w.document,T=w.__test;
 for(const r of ['usta','kasiyer','yonetici']){ T.setRol(r); await new Promise(x=>setTimeout(x,20));
  const nav=[...d.querySelectorAll('#nav a')].map(a=>a.textContent.replace(/\d+$/,'')).join(',');
  const gizli=[...d.querySelectorAll('#main .yon-only')].map(e=>w.getComputedStyle(e).display);
  console.log(r,'|',d.body.className,'|',nav,'|',gizli.join(','));
 }
 T.setRol('usta'); w.location.hash='#raporlar'; await new Promise(x=>setTimeout(x,30)); console.log('usta raporlar ->', d.querySelector('#main h1').textContent);
 console.log('errors',errs); process.exit(0);},150);
