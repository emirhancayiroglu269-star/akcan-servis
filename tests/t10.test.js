const {JSDOM}=require('jsdom');
const html=require('fs').readFileSync(require('path').join(__dirname,'..','teklif.html'),'utf8');
const dom=new JSDOM(html,{runScripts:'outside-only',url:'https://x.test/teklif.html?t=TestToken1234567890abcdXYZ'});
const w=dom.window; const errs=[];
w.fetch=async(u,o)=>({ok:true,json:async()=>o&&o.method==="POST"?{ok:true,onay:{durum:"onay",zaman:Date.now(),ad:"Ali"}}:{firma:{ad:"AKCAN",tel:"0553",adres:"X"},no:"SRV-1",plaka:"34ABC123",marka:"Renault",model:"Clio",km:"120000",musteri:"Ali",sikayet:"Fren sesi",tespit:"Balata",durum:"Beklemede",tahminiTeslim:null,kalemler:[{tip:"Parça",ad:"Balata",adet:1,fiyat:800,kdv:20,tutar:800}],toplam:{ara:800,indirim:0,genel:800,kdv:133.33},onay:null}});
w.alert=m=>errs.push(m);
const s=html.slice(html.indexOf('<script>')+8,html.indexOf('</script>')); w.eval(s);
setTimeout(async()=>{ const d=w.document; console.log(d.querySelector('.plaka').textContent, '|', d.querySelector('.top.big').textContent);
 d.querySelector('button[data-k="onay"]').click(); await new Promise(r=>setTimeout(r,50)); console.log(d.querySelector('.sonuc').textContent); console.log('errs',errs); },50);
