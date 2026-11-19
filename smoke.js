"use strict";
const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict");
const pages=["index.html","about.html","blog.html","insurance.html","donate.html"];
const root=path.resolve(__dirname,"..");
for(const name of pages){
 const text=fs.readFileSync(path.join(root,name),"utf8");
 assert(text.includes('assets/site.css'),name+" missing styles");
 assert(text.includes('assets/mobile.css'),name+" missing responsive styles");
 assert(text.includes('assets/site.js'),name+" missing navigation script");
 assert(!text.includes("<marquee"),name+" contains moving banner");
 assert(text.includes('aria-controls="mobileMenu"'),name+" missing mobile menu accessibility");
 assert(text.includes('href="blog.html#health-camp"'),name+" missing event link");
 for(const match of text.matchAll(/<(?:img|source)\b[^>]*\bsrc="([^"]+)"/g)){
   const src=match[1];if(/^(https?:|data:|\/\/)/.test(src))continue;
   const file=path.resolve(root,decodeURIComponent(src));
   assert(file.startsWith(root+path.sep)&&fs.existsSync(file),name+" missing asset: "+src);
 }
}
const donation=fs.readFileSync(path.join(root,"donate.html"),"utf8");
assert(!/<input[^>]*type="password"/i.test(donation),"Payment PIN form prohibited");
assert(donation.includes('id="pendingDonation"'),"Relworx approval view missing");
assert(donation.includes('min="500"')&&donation.includes('max="5000000"'),"Relworx amount limits incorrect");
const js=fs.readFileSync(path.join(root,"assets/payment.js"),"utf8");
assert(js.includes("/api/payments/initiate")&&js.includes("/api/payments/verify"),"Frontend payment endpoints missing");
assert(!js.includes("redirectUrl"),"Hosted checkout logic must not remain");
const env=fs.readFileSync(path.join(root,".env.example"),"utf8");
assert(env.includes("RELWORX_API_KEY=")&&!env.includes("FLW_SECRET_KEY="),"Merchant env example incorrect");
const old=process.env.RELWORX_ENABLED;process.env.RELWORX_ENABLED="false";
const response=()=>({code:200,setHeader(){},status(c){this.code=c;return this;},json(x){this.data=x;return this;}});
(async()=>{
 const cfg=require("../lib/handlers/config.cjs"),init=require("../lib/handlers/initiate.cjs"),verify=require("../lib/handlers/verify.cjs");
 let r=response();cfg({method:"GET"},r);assert.equal(r.data.ready,false);assert.equal(r.data.provider,"relworx");
 r=response();await init({method:"POST",body:{amount:500,phone:"0771234567"}},r);
 assert.equal(r.code,503,"Disabled checkout must fail closed");
 r=response();await verify({method:"POST",body:{}},r);
 assert.equal(r.code,503,"Disabled verification must fail closed");
 if(old===undefined)delete process.env.RELWORX_ENABLED;else process.env.RELWORX_ENABLED=old;
 console.log("PASS: 5 pages, assets, Relworx form, disabled-by-default gateway, no PIN, correct limits.");
})().catch(e=>{console.error(e);process.exitCode=1;});