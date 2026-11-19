"use strict";
const fs=require("node:fs"),path=require("node:path");
const {spawn}=require("node:child_process");
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const port=9238;
async function main(){
 const chrome="C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
 const profile=path.join(process.env.TEMP||"C:\\Temp","lhcf-browser-check");
 const args=["--headless=new","--no-first-run","--disable-gpu","--remote-debugging-port="+port,"--user-data-dir="+profile,"about:blank"];
 const processChrome=spawn(chrome,args,{detached:true,stdio:"ignore",windowsHide:true});processChrome.unref();
 let endpoint;
 for(let k=0;k<35;k++){try{
   const response=await fetch("http://127.0.0.1:"+port+"/json/new?http://localhost:4173/index.html",{method:"PUT"});
   if(response.ok){endpoint=await response.json();break;}
 }catch(e){}await sleep(300);}
 if(!endpoint?.webSocketDebuggerUrl)throw Error("Chrome DevTools failed to start");
 const ws=new WebSocket(endpoint.webSocketDebuggerUrl);
 await new Promise((resolve,reject)=>{ws.addEventListener("open",resolve,{once:true});ws.addEventListener("error",reject,{once:true});});
 let next=0;const pending=new Map();
 ws.addEventListener("message",event=>{
   let packet;try{packet=JSON.parse(event.data);}catch(_){return;}
   if(packet.id && pending.has(packet.id)){
     const {resolve,reject}=pending.get(packet.id);pending.delete(packet.id);
     packet.error?reject(Error(packet.error.message)):resolve(packet.result);
   }
 });
 const cdp=(method,params={})=>new Promise((resolve,reject)=>{
   const id=++next;const t=setTimeout(()=>{pending.delete(id);reject(Error("CDP timeout "+method));},15000);
   pending.set(id,{resolve:result=>{clearTimeout(t);resolve(result);},reject:e=>{clearTimeout(t);reject(e);}});
   ws.send(JSON.stringify({id,method,params}));
 });
 await cdp("Page.enable");await cdp("Runtime.enable");await cdp("Network.enable");
 const pageNames=["index.html","about.html","insurance.html","blog.html","donate.html"];
 const widths=[320,375,768,1024,1440];
 const artifacts=path.join(__dirname,"artifacts");fs.mkdirSync(artifacts,{recursive:true});
 let failed=0;const report=[];
 for(const width of widths){
   const height=width<=375?812:900;
   await cdp("Emulation.setDeviceMetricsOverride",{width,height,deviceScaleFactor:1,mobile:width<=768});
   for(const name of pageNames){
     await cdp("Page.navigate",{url:"http://localhost:4173/"+name});
     await sleep(1250);
     const expression="({title:document.title,innerWidth:window.innerWidth,scrollWidth:document.documentElement.scrollWidth,bodyWidth:document.body.scrollWidth,notice:!!document.getElementById('siteNotice'),menu:!!document.getElementById('mobileMenu'),links:[...document.querySelectorAll('a')].filter(a=>a.getAttribute('href')==='#').length,styles:!!document.querySelector('link[href=\"assets/site.css\"]'),button:document.getElementById('donationButton')?.disabled ?? null,errors:document.querySelectorAll('img:not([src])').length})";
     const result=await cdp("Runtime.evaluate",{expression,returnByValue:true,awaitPromise:true});
     const data=result.result.value;
     // Off-canvas mobile menu intentionally extends bodyWidth; document scrollWidth measures actual horizontal scrolling.
     const overflow=data.scrollWidth>data.innerWidth+2;
     report.push({width,name,overflow,...data});
     console.log((overflow?"OVERFLOW":"OK")+" "+width+" "+name+" viewport="+data.innerWidth+" scroll="+data.scrollWidth);
     if(overflow)failed++;
     if((width===375 || width===1440) && ["index.html","donate.html"].includes(name)){
       const image=await cdp("Page.captureScreenshot",{format:"png",captureBeyondViewport:false});
       fs.writeFileSync(path.join(artifacts,name.replace(".html","")+"-"+width+".png"),Buffer.from(image.data,"base64"));
     }
   }
 }
 // Basic interactive test: menu opens/closes and notice dismisses.
 await cdp("Emulation.setDeviceMetricsOverride",{width:375,height:812,deviceScaleFactor:1,mobile:true});
 await cdp("Page.navigate",{url:"http://localhost:4173/index.html"});await sleep(1250);
 const interaction=await cdp("Runtime.evaluate",{
 expression:"(async()=>{ const m=document.getElementById('mobileMenu');toggleMobileMenu();const opened=m.classList.contains('open');toggleMobileMenu();const closed=!m.classList.contains('open');dismissNotice();return {opened,closed,dismissed:document.getElementById('siteNotice').hidden}})()",
 returnByValue:true,awaitPromise:true
 });
 const interactionResult=interaction.result.value;
 if(!interactionResult.opened || !interactionResult.closed || !interactionResult.dismissed)failed++;
 console.log("INTERACTION "+JSON.stringify(interactionResult));
 fs.writeFileSync(path.join(artifacts,"report.json"),JSON.stringify({failed,report,interaction:interactionResult},null,2));
 console.log("BROWSER_CHECK_FINISHED failures="+failed+" screenshots="+artifacts);
 ws.close();if(failed)process.exitCode=1;
}
main().catch(e=>{console.error("BROWSER_CHECK_ERROR "+e.stack);process.exitCode=1;});