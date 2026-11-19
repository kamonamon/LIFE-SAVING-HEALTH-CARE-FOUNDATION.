"use strict";
const fs=require("node:fs"),path=require("node:path");const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const r=await fetch("http://127.0.0.1:9238/json/new?http://localhost:4173/index.html",{method:"PUT"});
 const obj=await r.json();const ws=new WebSocket(obj.webSocketDebuggerUrl);
 await new Promise((a,b)=>{ws.addEventListener("open",a,{once:true});ws.addEventListener("error",b,{once:true});});
 let id=0;const requests=new Map();
 ws.addEventListener("message",e=>{const m=JSON.parse(e.data);if(requests.has(m.id)){requests.get(m.id)(m.result);requests.delete(m.id);}});
 const call=(method,params={})=>new Promise(resolve=>{const n=++id;requests.set(n,resolve);ws.send(JSON.stringify({id:n,method,params}));});
 await call("Page.enable");await call("Runtime.enable");
 const out=path.join(__dirname,"artifacts");fs.mkdirSync(out,{recursive:true});let failures=0;
 async function snap(label){const v=await call("Page.captureScreenshot",{format:"jpeg",quality:70,captureBeyondViewport:false});fs.writeFileSync(path.join(out,label+".jpg"),Buffer.from(v.data,"base64"));}
 async function evaluate(expr){const v=await call("Runtime.evaluate",{expression:expr,returnByValue:true,awaitPromise:true});return v.result.value;}
 for(const width of [320,360,390,430,768]){
  await call("Emulation.setDeviceMetricsOverride",{width,height:812,deviceScaleFactor:1,mobile:width<1024});
  await call("Page.navigate",{url:"http://localhost:4173/index.html"});await sleep(1600);
  const metrics=await evaluate('(()=>{ const rect=(el)=>{if(!el)return null;const r=el.getBoundingClientRect();return{x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height),right:Math.round(r.right),bottom:Math.round(r.bottom)}}; const bar=document.querySelector(".mobile-action-bar"),top=document.querySelector(".mobile-header-donate"),header=document.querySelector(".site-header"),brand=document.querySelector(".brand-lockup"),menu=document.querySelector("[aria-controls=mobileMenu]"); const hit=(el)=>{const r=el.getBoundingClientRect();const e=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return Boolean(e&&(el===e||el.contains(e)))};return {viewport:innerWidth,document:document.documentElement.scrollWidth,bar:rect(bar),top:rect(top),header:rect(header),brand:rect(brand),menu:rect(menu),topClickable:hit(top),barClickable:hit(bar.querySelector("a")),serviceCards:document.querySelectorAll(".services-grid > .card").length,pageColors:{bar:getComputedStyle(bar.querySelector("a")).backgroundColor,header:getComputedStyle(top).backgroundColor}}; })()');
  const overlap=metrics.brand.right > metrics.top.x+3 || metrics.top.right>metrics.menu.x+3;
  const okay=metrics.document<=width+2 && metrics.topClickable && metrics.barClickable && !overlap && metrics.serviceCards===8;
  if(!okay)failures++;
  console.log((okay?"PASS":"FAIL")+" mobile="+width+" "+JSON.stringify(metrics));
  if(width===320)await snap("mobile-home-320");
  if(width===390){await snap("mobile-home-390");await evaluate('document.getElementById("services").scrollIntoView({block:"start",behavior:"instant"});true');await sleep(350);await snap("mobile-services-390");}
 }
 await call("Emulation.setDeviceMetricsOverride",{width:390,height:812,deviceScaleFactor:1,mobile:true});
 await call("Page.navigate",{url:"http://localhost:4173/index.html"});await sleep(1400);
 await evaluate('document.querySelector(".mobile-header-donate").click();true');
 await sleep(1450);
 const testNavigation=await evaluate('(()=>({url:location.pathname+location.hash,donateOptionsVisible:!!document.getElementById("donation-options"),topDonate:document.querySelector(".mobile-header-donate")?.getAttribute("href"),bottomDonate:document.querySelector(".mobile-action-donate")?.getAttribute("href"),paymentReady:!document.getElementById("donationButton")?.disabled,contactVisible:getComputedStyle(document.querySelector(".donation-contact-link")).display!=="none",contactLink:document.querySelector(".donation-contact-link").href,offlineButtonHidden:getComputedStyle(document.getElementById("donationButton")).display==="none"}))()');
 const hrefOK=testNavigation && testNavigation.url==="/donate.html#donation-options"&&testNavigation.donateOptionsVisible && testNavigation.contactVisible && testNavigation.offlineButtonHidden && testNavigation.contactLink.startsWith("https://wa.me/");
 if(!hrefOK)failures++;
 console.log((hrefOK?"PASS":"FAIL")+" DONATE_NAVIGATION "+JSON.stringify(testNavigation));
 await sleep(450);await snap("mobile-donate-anchor-390");
 for(const page of ["about.html","insurance.html","blog.html","donate.html"]){
  await call("Page.navigate",{url:"http://localhost:4173/"+page});await sleep(950);
  await snap("mobile-"+page.replace(".html","")+"-390");
 }
 console.log("MOBILE_REVIEW_RESULTS failures="+failures+" screenshots="+out);ws.close();if(failures)process.exitCode=1;
})().catch(e=>{console.error(e.stack);process.exitCode=1});