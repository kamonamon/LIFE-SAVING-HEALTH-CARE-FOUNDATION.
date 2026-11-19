"use strict";
const fs=require("node:fs"),path=require("node:path");
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const tab=await(await fetch("http://127.0.0.1:9238/json/new?http://localhost:4173/",{method:"PUT"})).json();
  if(!tab.webSocketDebuggerUrl)throw Error("No Chrome tab");
  const ws=new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((yes,no)=>{ws.addEventListener("open",yes,{once:true});ws.addEventListener("error",no,{once:true});});
  const waiting=new Map();let id=0;
  ws.addEventListener("message",e=>{const m=JSON.parse(e.data);if(waiting.has(m.id)){const p=waiting.get(m.id);waiting.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result);}});
  const call=(method,params={})=>new Promise((resolve,reject)=>{const current=++id;waiting.set(current,{resolve,reject});ws.send(JSON.stringify({id:current,method,params}));setTimeout(()=>{if(waiting.has(current)){waiting.delete(current);reject(Error("CDP TIMEOUT "+method));}},20000);});
  await call("Page.enable");await call("Runtime.enable");
  const out=path.join(__dirname,"artifacts","padding-audit");fs.mkdirSync(out,{recursive:true});let failures=0;
 const code="(()=>{\n  const rect=e=>{const r=e.getBoundingClientRect();return{x:Math.round(r.x),y:Math.round(r.y+scrollY),w:Math.round(r.width),h:Math.round(r.height)}};\n  const info=e=>{const cs=getComputedStyle(e),r=rect(e),children=[...e.children].filter(c=>{const s=getComputedStyle(c);return s.display!==\"none\"&&c.getBoundingClientRect().height>0});return{\n    tag:e.tagName.toLowerCase(),id:e.id||\"\",cls:String(e.className||\"\").slice(0,70),...r,\n    pt:cs.paddingTop,pb:cs.paddingBottom,pl:cs.paddingLeft,pr:cs.paddingRight,\n    grid:cs.gridTemplateColumns,mb:cs.marginBottom,\n    gap:cs.rowGap,overflowX:cs.overflowX,\n    childTop:children[0]?Math.round(children[0].getBoundingClientRect().top-e.getBoundingClientRect().top):null,\n    childEnd:children.length?Math.round(e.getBoundingClientRect().bottom-children[children.length-1].getBoundingClientRect().bottom):null\n  }};\n  const sections=[...document.querySelectorAll(\"body > section\")].filter(e=>getComputedStyle(e).display!==\"none\");\n  const headings=[...document.querySelectorAll(\"h1,h2,h3\")].slice(0,24).map(e=>({text:e.textContent.trim().slice(0,55),...rect(e),mb:getComputedStyle(e).marginBottom,mt:getComputedStyle(e).marginTop}));\n  return{page:location.pathname,viewport:innerWidth,doc:document.documentElement.scrollWidth,body:document.body.scrollWidth,height:document.documentElement.scrollHeight,\n    sections:sections.map(info),headings,cards:[...document.querySelectorAll(\".services-grid>.card,.donation-grid>div,.activities-section .grid>div\")].slice(0,14).map(info)};\n})()";

  for(const width of [320,390,640,768]){
    await call("Emulation.setDeviceMetricsOverride",{width,height:812,deviceScaleFactor:1,mobile:true});
    for(const p of ["index","about","insurance","blog","donate"]){
      await call("Page.navigate",{url:"http://localhost:4173/"+p+".html"});await sleep(900);
      const r=await call("Runtime.evaluate",{expression:code,returnByValue:true});
      if(!r?.result?.value)throw Error("Evaluation failed "+JSON.stringify(r).slice(0,1000));
      const data=r.result.value;fs.writeFileSync(path.join(out,p+"-"+width+".json"),JSON.stringify(data,null,2));
      const padded=data.sections.filter(s=>parseFloat(s.pt)>50 || parseFloat(s.pb)>50 || parseFloat(s.pl)>27 || parseFloat(s.pr)>27);
      const tallCards=(p==="index"&&width>=640)?data.cards.filter(c=>c.h>220):[];
      const overflow=data.doc>width+1 || data.body>width+1;
      if(padded.length||tallCards.length||overflow){failures++;console.error("PADDING_CHECK_FAIL",p,width,JSON.stringify({padded,tallCards,overflow}).slice(0,1800));}
      console.log("LAYOUT",p,width,"height",data.height,"sections",data.sections.map(s=>(s.id||s.cls.slice(0,16))+":"+s.h+",pad("+s.pt+","+s.pb+"),child("+s.childTop+","+s.childEnd+")").join("|"));
      if(width===390 || width===640 || width===768){
        const result=await call("Page.captureScreenshot",{format:"jpeg",quality:48,captureBeyondViewport:true,fromSurface:true});
        fs.writeFileSync(path.join(out,p+"-"+width+"-full.jpg"),Buffer.from(result.data,"base64"));
        console.log("SCREENSHOT",p,Buffer.byteLength(result.data,"base64"));
      }
    }
  }
  ws.close();console.log("LAYOUT_AUDIT_COMPLETE failures="+failures);if(failures)process.exitCode=1;
})().catch(e=>{console.error(e.stack);process.exitCode=1;});