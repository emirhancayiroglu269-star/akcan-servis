const {JSDOM}=require('jsdom');
const html=require('fs').readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
const dom=new JSDOM(html,{runScripts:'dangerously',url:'https://x.test/#raporlar',pretendToBeVisual:true});
const w=dom.window; w.scrollTo=()=>{}; const errs=[]; w.addEventListener('error',e=>errs.push(e.message));
setTimeout(()=>{ const d=w.document; console.log([...d.querySelectorAll('#main h2')].map(h=>h.textContent.trim().slice(0,30)).join(' | ')); console.log([...d.querySelectorAll('.tile .k')].map(x=>x.textContent).join(', ')); console.log('errors',errs); process.exit(0);},300);
