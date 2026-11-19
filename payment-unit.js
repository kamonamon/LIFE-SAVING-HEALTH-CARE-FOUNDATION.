"use strict";
const assert=require("node:assert/strict");
const crypto=require("node:crypto");
const init=require("../lib/handlers/initiate.cjs"),verify=require("../lib/handlers/verify.cjs");
const webhook=require("../lib/handlers/webhook.cjs"),cfg=require("../lib/handlers/config.cjs");
const helper=require("../lib/relworx");
const response=()=>({code:200,headers:{},setHeader(k,v){this.headers[k]=v;},
 status(c){this.code=c;return this;},json(x){this.body=x;return this;}});
(async()=>{
 const original={};for(const key of ["RELWORX_ENABLED","RELWORX_API_KEY","RELWORX_ACCOUNT_NO",
 "RELWORX_INTENT_SECRET","RELWORX_WEBHOOK_KEY","RELWORX_WEBHOOK_URL"]){
  original[key]=process.env[key];
 }
 const origFetch=global.fetch;
 const account="RELTEST12345",internal="abcdef1234567890abcdef1234567890";
 process.env.RELWORX_ENABLED="true";
 process.env.RELWORX_API_KEY="relworx-fixture-not-real";
 process.env.RELWORX_ACCOUNT_NO=account;
 process.env.RELWORX_INTENT_SECRET="unit-test-intent-secret-for-signing";
 process.env.RELWORX_WEBHOOK_KEY="fixture-webhook-secret";
 process.env.RELWORX_WEBHOOK_URL="https://foundation.example/api/payments/webhook";
 try{
  let r=response();cfg({method:"GET"},r);
  assert.equal(r.body.ready,true);assert.equal(r.body.provider,"relworx");
  assert.equal(r.body.minAmount,500);assert.equal(r.body.maxAmount,5000000);
  let called;
  global.fetch=async(url,opts)=>{
   called={url:String(url),opts,payload:JSON.parse(opts.body)};
   return {ok:true,status:200,json:async()=>({success:true,message:"Request payment in progress.",internal_reference:internal})};
  };
  r=response();
  await init({method:"POST",body:{phone:"0782123456",amount:25000,network:"MTN"}},r);
  assert.equal(r.code,200);assert.equal(r.body.status,"pending");
  assert.equal(r.body.provider,"relworx");assert(!r.body.redirectUrl);
  const intent=r.body.intent,reference=r.body.reference;
  assert(/^LHCF[0-9a-f]{28}$/.test(reference));
  assert.equal(called.url,"https://payments.relworx.com/api/mobile-money/request-payment");
  assert.equal(called.payload.account_no,account);
  assert.equal(called.payload.msisdn,"+256782123456");
  assert.equal(called.payload.amount,25000);
  assert.equal(called.payload.currency,"UGX");
  assert.equal(called.payload.reference,reference);
  assert(!Object.hasOwn(called.payload,"network"));
  assert.equal(called.opts.headers.Accept,"application/vnd.relworx.v2");
  assert.equal(helper.readIntent(intent).amount,25000);
  r=response();await init({method:"POST",body:{phone:"0782123456",amount:499}},r);
  assert.equal(r.code,400);
  r=response();await init({method:"POST",body:{phone:"0782123456",amount:5000001}},r);
  assert.equal(r.code,400);
  r=response();await verify({method:"POST",body:{reference,intent:intent.slice(0,-4)+"abcd"}},r);
  assert.equal(r.code,400);
  let checkCalled;
  global.fetch=async(url,opts)=>{
   checkCalled={url:String(url),opts};
   return {ok:true,status:200,json:async()=>({success:true,status:"success",
    request_status:"success",customer_reference:reference,internal_reference:internal,
    msisdn:"+256782123456",amount:25000,currency:"UGX"})};
  };
  r=response();await verify({method:"POST",body:{reference,intent}},r);
  assert.equal(r.code,200);assert.equal(r.body.status,"successful");
  assert.equal(r.body.amount,25000);
  const u=new URL(checkCalled.url);
  assert.equal(u.pathname,"/api/mobile-money/check-request-status");
  assert.equal(u.searchParams.get("internal_reference"),internal);
  assert.equal(u.searchParams.get("account_no"),account);
  global.fetch=async()=>({ok:true,status:200,json:async()=>({success:true,status:"success",
   request_status:"success",customer_reference:reference,internal_reference:internal,
   msisdn:"+256782123456",amount:500,currency:"UGX"})});
  r=response();await verify({method:"POST",body:{reference,intent}},r);
  assert.equal(r.code,502,"Must reject verified amount mismatch");
  global.fetch=async()=>({ok:true,status:200,json:async()=>({success:true,request_status:"pending"})});
  r=response();await verify({method:"POST",body:{reference,intent}},r);
  assert.equal(r.body.status,"pending");
  global.fetch=async()=>({ok:true,status:200,json:async()=>({success:true,request_status:"failed"})});
  r=response();await verify({method:"POST",body:{reference,intent}},r);
  assert.equal(r.body.status,"failed");
  r=response();await webhook({method:"POST",headers:{"relworx-signature":"t=1,v=bad"},
   body:{status:"success",customer_reference:reference,internal_reference:internal}},r);
  assert.equal(r.code,401);
  const time=String(Math.floor(Date.now()/1000));
  const params={customer_reference:reference,internal_reference:internal,status:"success"};
  let signed=process.env.RELWORX_WEBHOOK_URL+time;
  for(const k of Object.keys(params).sort())signed+=k+params[k];
  const hmac=crypto.createHmac("sha256",process.env.RELWORX_WEBHOOK_KEY).update(signed).digest("hex");
  r=response();await webhook({method:"POST",headers:{"relworx-signature":"t="+time+",v="+hmac},body:params},r);
  assert.equal(r.code,200);assert.equal(r.body.received,true);
  r=response();await webhook({method:"POST",headers:{"relworx-signature":"t="+time+",v="+hmac.slice(0,-1)+"0"},body:params},r);
  assert.equal(r.code,401);
  console.log("PASS: Relworx request, 32-char ref, signed intent, amount reconciliation, pending/failure, webhook HMAC.");
 }finally{
  global.fetch=origFetch;
  for(const [key,val] of Object.entries(original)){
    if(val===undefined)delete process.env[key];else process.env[key]=val;
  }
 }
})().catch(e=>{console.error(e);process.exitCode=1;});