"use strict";
const pause=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const tab=await (await fetch("http://127.0.0.1:9238/json/new?http://localhost:4173/",{method:"PUT"})).json();
 const ws=new WebSocket(tab.webSocketDebuggerUrl);
 await new Promise((resolve,reject)=>{ws.addEventListener("open",resolve,{once:true});ws.addEventListener("error",reject,{once:true});});
 let id=0;const outstanding=new Map();
 ws.addEventListener("message",e=>{const a=JSON.parse(e.data);if(outstanding.has(a.id)){const p=outstanding.get(a.id);outstanding.delete(a.id);a.error?p.reject(Error(a.error.message)):p.resolve(a.result);}});
 const run=(method,params={})=>new Promise((resolve,reject)=>{const n=++id;outstanding.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params}));setTimeout(()=>{if(outstanding.has(n)){outstanding.delete(n);reject(Error("timeout "+method));}},15000);});
 await run("Page.enable");await run("Runtime.enable");
 const pages=["index.html","about.html","insurance.html","blog.html","donate.html"];const results=[];let failed=0;
const code="(() => {\n const width=innerWidth;\n const pack=()=>({\n document:document.documentElement.scrollWidth,body:document.body.scrollWidth,windowWidth:innerWidth,scrollX:window.scrollX,\n overflow:[...document.querySelectorAll(\"body *\")].filter(el=>{\n const st=getComputedStyle(el);if(st.display===\"none\")return false;\n const r=el.getBoundingClientRect();return (r.right>width+1||r.left<-1) && r.width>1 && r.height>1;\n }).map(el=>{const st=getComputedStyle(el),r=el.getBoundingClientRect();\n return {tag:el.tagName,id:el.id,cls:String(el.className).slice(0,82),left:Math.round(r.left),right:Math.round(r.right),width:Math.round(r.width),scroll:el.scrollWidth,client:el.clientWidth,position:st.position,overflowX:st.overflowX,transform:st.transform===\"none\"?\"\":st.transform.slice(0,60)};}).slice(0,25),\n scrollables:[...document.querySelectorAll(\"body *\")].filter(el=>getComputedStyle(el).display!==\"none\" && el.scrollWidth>el.clientWidth+2 && el.clientWidth>0).map(el=>({tag:el.tagName,id:el.id,cls:String(el.className).slice(0,68),scroll:el.scrollWidth,client:el.clientWidth})).slice(0,25)\n });\n const initial=pack();document.querySelector(\"#mobileMenu\")?.remove();\n document.documentElement.style.overflowX=\"visible\";document.body.style.overflowX=\"visible\";\n return {initial,withoutMenu:pack()};\n})()";

 for(const width of [280,320,360,375,390,430,768]){
  await run("Emulation.setDeviceMetricsOverride",{width,height:800,deviceScaleFactor:1,mobile:true});
  for(const page of pages){
   await run("Page.navigate",{url:"http://localhost:4173/"+page});await pause(800);
   const raw=await run("Runtime.evaluate",{expression:code,returnByValue:true});
   const obj=raw?.result?.value;results.push({page,width,...obj});
   const ok=obj && obj.initial.document<=width+1 && obj.initial.body<=width+1 && obj.initial.overflow.length===0 && obj.withoutMenu.document<=width+1 && obj.withoutMenu.body<=width+1 && obj.withoutMenu.overflow.length===0;
   if(!ok) failed++;
   console.log(ok?"PASS":"FAIL",page,width,"body",obj?.initial.body,"document",obj?.initial.document,"offenders",obj?.initial.overflow.length,obj?.initial.overflow.slice(0,2).map(x=>x.id||x.cls));
  }
 }
 const fs=require("node:fs");fs.mkdirSync("tests/artifacts",{recursive:true});fs.writeFileSync("tests/artifacts/overflow-audit.json",JSON.stringify(results,null,2));
 ws.close();console.log("COMPLETE",results.length,"failures",failed);if(failed)process.exitCode=1;
})().catch(e=>{console.error(e.stack);process.exitCode=1;});