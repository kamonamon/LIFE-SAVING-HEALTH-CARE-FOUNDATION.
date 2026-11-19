"use strict";
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const tab=await(await fetch("http://127.0.0.1:9238/json/new?http://localhost:4173/",{method:"PUT"})).json();
 const ws=new WebSocket(tab.webSocketDebuggerUrl);
 await new Promise((r,j)=>{ws.addEventListener("open",r,{once:true});ws.addEventListener("error",j,{once:true});});
 const pend=new Map();let id=0;ws.addEventListener("message",e=>{const m=JSON.parse(e.data);if(pend.has(m.id)){const q=pend.get(m.id);pend.delete(m.id);q(m.result);}});
 const run=(method,params={})=>new Promise(r=>{const n=++id;pend.set(n,r);ws.send(JSON.stringify({id:n,method,params}));});
 await run("Page.enable");await run("Runtime.enable");
const code="(()=>{\nconst el=(q)=>{const n=document.querySelector(q);if(!n)return null;const r=n.getBoundingClientRect(),s=getComputedStyle(n);return {x:Math.round(r.x),right:Math.round(r.right),w:Math.round(r.width),visible:s.display!==\"none\"&&s.visibility!==\"hidden\"}};\nreturn {brand:el(\".brand-lockup\"),desktop:el(\".site-header .hidden.lg\\\\:flex\"),actions:el(\".header-actions\"),mobile:el(\"[aria-controls=mobileMenu]\"),donate:el(\".mobile-header-donate\"),horizontal:document.documentElement.scrollWidth,window:innerWidth,\n images:[...document.querySelectorAll(\"img\")].map(n=>({src:n.getAttribute(\"src\"),loading:n.loading,complete:n.complete,loaded:n.naturalWidth>0}))};\n})()";

 for(const width of [390,640,768,820,1024,1100,1280,1440]){
   await run("Emulation.setDeviceMetricsOverride",{width,height:900,deviceScaleFactor:1,mobile:width<1024});
   await run("Page.navigate",{url:"http://localhost:4173/index.html"});await sleep(900);
   const r=await run("Runtime.evaluate",{expression:code,returnByValue:true});
   console.log("HEADER",width,JSON.stringify(r.result.value).slice(0,2200));
 }
 await run("Emulation.setDeviceMetricsOverride",{width:390,height:900,deviceScaleFactor:1,mobile:true});
 for(const page of ["index.html","blog.html","insurance.html"]){
   await run("Page.navigate",{url:"http://localhost:4173/"+page});await sleep(600);
   const r=await run("Runtime.evaluate",{expression:"(async()=>{const images=[...document.querySelectorAll('img')];const report=[];for(const img of images){img.scrollIntoView({block:'center',behavior:'instant'});await new Promise(r=>setTimeout(r,180));if(!img.complete)await Promise.race([img.decode().catch(()=>null),new Promise(r=>setTimeout(r,1200))]);report.push({src:img.getAttribute('src'),complete:img.complete,loaded:img.naturalWidth>0,w:img.naturalWidth})}return report;})()",returnByValue:true,awaitPromise:true});
   console.log("IMAGES",page,JSON.stringify(r?.result?.value??r).slice(0,4500));
 }
 ws.close();console.log("QA_FINISHED");
})().catch(e=>{console.error(e.stack);process.exitCode=1;});