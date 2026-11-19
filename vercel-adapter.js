"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
(async()=>{
 const root=path.resolve(__dirname,"..");
 const conf=await import("../api/payments/config.mjs");
 const init=await import("../api/payments/initiate.mjs");
 const verify=await import("../api/payments/verify.mjs");
 const webhook=await import("../api/payments/webhook.mjs");
 const old={};for(const k of ["RELWORX_ENABLED","RELWORX_API_KEY","RELWORX_ACCOUNT_NO","RELWORX_INTENT_SECRET"]){old[k]=process.env[k];}
 const fetchOld=global.fetch;
 try{
   process.env.RELWORX_ENABLED="false";
   let res=await conf.GET(new Request("https://foundation.example/api/payments/config"));
   assert.equal(res.status,200);let data=await res.json();assert.equal(data.ready,false);assert.equal(data.provider,"relworx");
   res=await init.POST(new Request("https://foundation.example/api/payments/initiate",{
    method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({amount:25000,phone:"0782123456"})
   }));
   assert.equal(res.status,503);data=await res.json();assert(!JSON.stringify(data).includes("secret"));
   res=await init.POST(new Request("https://foundation.example/api/payments/initiate",{
    method:"POST",body:"{"
   }));
   assert.equal(res.status,400);
   res=await verify.POST(new Request("https://foundation.example/api/payments/verify",{
    method:"POST",body:JSON.stringify({reference:"123",intent:"123"})
   }));
   assert.equal(res.status,503);
   process.env.RELWORX_ENABLED="true";
   process.env.RELWORX_API_KEY="test-placeholder-never-real";
   process.env.RELWORX_ACCOUNT_NO="TESTBUSINESS";
   process.env.RELWORX_INTENT_SECRET="unit-vercel-adapter-key";
   let captured;
   global.fetch=async(url,opts)=>{
     captured={url:String(url),opts};
     return {ok:true,status:200,json:async()=>({success:true,internal_reference:"0123456789abcdef0123456789abcdef"})};
   };
   res=await init.POST(new Request("https://foundation.example/api/payments/initiate",{
    method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({amount:25000,phone:"0782123456",network:"MTN"})
   }));
   assert.equal(res.status,200);data=await res.json();
   assert.equal(data.status,"pending");assert.equal(data.provider,"relworx");
   assert(captured.url.endsWith("/mobile-money/request-payment"));
   const payment=data;
   global.fetch=async()=>({ok:true,status:200,json:async()=>({
     success:true,request_status:"success",customer_reference:payment.reference,
     internal_reference:"0123456789abcdef0123456789abcdef",amount:25000,currency:"UGX",msisdn:"+256782123456"
   })});
   res=await verify.POST(new Request("https://foundation.example/api/payments/verify",{
     method:"POST",headers:{"Content-Type":"application/json"},
     body:JSON.stringify({reference:payment.reference,intent:payment.intent})
   }));
   assert.equal(res.status,200);data=await res.json();assert.equal(data.status,"successful");
   res=await webhook.POST(new Request("https://foundation.example/api/payments/webhook",{
    method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({})
   }));
   assert.equal(res.status,503,"Unconfigured webhook must reject");
   const c=JSON.parse(fs.readFileSync(path.join(root,"vercel.json"),"utf8"));
   assert.equal(c.framework,null);assert.equal(c.outputDirectory,"public");
   for(const name of ["config","initiate","verify","webhook"]){
      assert(fs.existsSync(path.join(root,"api/payments",name+".mjs")));
      assert(!fs.existsSync(path.join(root,"api/payments",name+".js")),"Old Vercel-incompatible handler remains in api");
   }
   console.log("PASS: Vercel module entrypoints, real Request/Response adapter, signed initiation/verification, fail-closed config.");
 }finally {
   global.fetch=fetchOld;
   for(const [k,v] of Object.entries(old)){if(v===undefined)delete process.env[k];else process.env[k]=v;}
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
