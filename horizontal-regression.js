"use strict";
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
(async()=>{
 const tab=await(await fetch("http://127.0.0.1:9238/json/new?http://localhost:4173/",{method:"PUT"})).json();
 const ws=new WebSocket(tab.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{ws.addEventListener("open",resolve,{once:true});ws.addEventListener("error",reject,{once:true});});
 let next=0;const waiting=new Map();ws.addEventListener("message",e=>{const m=JSON.parse(e.data);if(waiting.has(m.id)){const f=waiting.get(m.id);waiting.delete(m.id);f(m.result);}});
 const cmd=(method,params={})=>new Promise(resolve=>{const id=++next;waiting.set(id,resolve);ws.send(JSON.stringify({id,method,params}));});
 const evalJS=async code=>{const out=await cmd("Runtime.evaluate",{expression:code,returnByValue:true});if(out?.exceptionDetails)throw Error(JSON.stringify(out.exceptionDetails));return out.result.value;};
 await cmd("Page.enable");await cmd("Runtime.enable");let failed=0;
 for(const width of [280,320,375,390,430,600,640,700,768,820,900,1024]){
   await cmd("Emulation.setDeviceMetricsOverride",{width,height:800,deviceScaleFactor:1,mobile:true});
   for(const page of ["index.html","about.html","blog.html","insurance.html","donate.html"]){
     await cmd("Page.navigate",{url:"http://localhost:4173/"+page});await sleep(500);
     const initial=await evalJS('(()=>{window.scrollTo({left:9999,top:0,behavior:"instant"});return {viewport:innerWidth,html:document.documentElement.scrollWidth,body:document.body.scrollWidth,scrollX:scrollX,rootLeft:document.scrollingElement.scrollLeft,menuTransform:getComputedStyle(document.getElementById("mobileMenu")).transform}})()');
     const okay=initial.html<=width+1 && initial.body<=width+1 && initial.scrollX===0 && initial.rootLeft===0 && initial.menuTransform==="none";
     if(!okay)failed++;
     console.log((okay?"PASS":"FAIL")+" side-scroll "+width+" "+page+" "+JSON.stringify(initial));
   }
 }
 await cmd("Emulation.setDeviceMetricsOverride",{width:375,height:800,deviceScaleFactor:1,mobile:true});
 await cmd("Page.navigate",{url:"http://localhost:4173/index.html"});await sleep(650);
 const open=await evalJS('(()=>{toggleMobileMenu();const menu=document.getElementById("mobileMenu"),r=menu.getBoundingClientRect();return {open:menu.classList.contains("open"),left:r.left,right:r.right,viewport:innerWidth,backdrop:!document.getElementById("menuBackdrop").hidden,headerDonate:document.querySelector(".mobile-header-donate").getAttribute("href")}})()');
 await sleep(300);
 const closed=await evalJS('(()=>{document.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true}));window.scrollTo({left:1000,top:0,behavior:"instant"});return {closed:!document.getElementById("mobileMenu").classList.contains("open"),hiddenBackdrop:document.getElementById("menuBackdrop").hidden,html:document.documentElement.scrollWidth,body:document.body.scrollWidth,scrollX:scrollX}})()');
 const drawerOK=open.open && open.left>=0 && open.right<=open.viewport+1 && open.backdrop && closed.closed && closed.hiddenBackdrop && closed.scrollX===0 && closed.body<=375;
 if(!drawerOK)failed++;console.log((drawerOK?"PASS":"FAIL")+" MENU_OPEN_CLOSE",JSON.stringify({open,closed}));
 ws.close();console.log("FINAL_HORIZONTAL_SCROLL_TEST failures="+failed);if(failed)process.exitCode=1;
})().catch(e=>{console.error(e.stack);process.exitCode=1;});