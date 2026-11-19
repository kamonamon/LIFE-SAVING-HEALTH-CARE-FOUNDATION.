"use strict";
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const tab=await(await fetch("http://127.0.0.1:9238/json/new?http://localhost:4173/blog.html",{method:"PUT"})).json();
 const ws=new WebSocket(tab.webSocketDebuggerUrl);
 await new Promise((r,j)=>{ws.addEventListener("open",r,{once:true});ws.addEventListener("error",j,{once:true});});
 let id=0;const pending=new Map();
 ws.addEventListener("message",e=>{const m=JSON.parse(e.data);if(pending.has(m.id)){pending.get(m.id)(m.result);pending.delete(m.id);}});
 const c=(method,params={})=>new Promise(resolve=>{const i=++id;pending.set(i,resolve);ws.send(JSON.stringify({id:i,method,params}));});
 await c("Page.enable");await c("Runtime.enable");await c("Network.enable");await c("Network.setCacheDisabled",{cacheDisabled:true});
 let failures=0;
 for(const width of [320,390,640,768]){
  await c("Emulation.setDeviceMetricsOverride",{width,height:812,deviceScaleFactor:1,mobile:true});
  await c("Network.setBlockedURLs",{urls:["*images/banner.jpg*"]});
  await c("Page.navigate",{url:"http://localhost:4173/blog.html?test=blocked"+width});await sleep(850);
  const measure=async()=>{const r=await c("Runtime.evaluate",{expression:"(async()=>{for(let i=0;i<30;i++){const img=document.querySelector('#health-camp img');const camp=document.getElementById('health-camp');if(img&&camp){const rect=img.getBoundingClientRect();return {imageHeight:rect.height,sectionHeight:camp.getBoundingClientRect().height,loaded:img.complete&&img.naturalWidth>0,viewport:innerWidth};}await new Promise(r=>setTimeout(r,100))}return {error:'missing image or event section',location:location.href}})()",returnByValue:true,awaitPromise:true});if(!r?.result?.value)throw Error("DOM measurement failed: "+JSON.stringify(r));return r.result.value;};
  const blocked=await measure();
  await c("Network.setBlockedURLs",{urls:[]});
  await c("Page.navigate",{url:"http://localhost:4173/blog.html?test=loaded"+width});await sleep(950);
  const loaded=await measure();
  const difference=Math.abs(blocked.sectionHeight-loaded.sectionHeight);
  const ok=blocked.imageHeight>0 && loaded.imageHeight>0 && difference<=2 && loaded.loaded;
  if(!ok)failures++;
  console.log(ok?"PASS":"FAIL","banner-height",width,JSON.stringify({blocked,loaded,difference}));
 }
 ws.close();console.log("BANNER_LAYOUT_TEST failures="+failures);if(failures)process.exitCode=1;
})().catch(e=>{console.error(e.stack);process.exitCode=1;});