"use strict";
const crypto=require("node:crypto");
const {same}=require("../relworx");
function send(res,code,data){return res.status(code).json(data);}
module.exports=async function handler(req,res){
 res.setHeader("Cache-Control","no-store");
 if(req.method!=="POST")return send(res,405,{error:"Method not allowed"});
 const key=process.env.RELWORX_WEBHOOK_KEY?.trim();
 const url=process.env.RELWORX_WEBHOOK_URL?.trim();
 if(!key||!url)return send(res,503,{error:"Webhook verification not configured"});
 const header=req.headers["relworx-signature"];
 if(typeof header!=="string" || header.length>300)return send(res,401,{error:"Unauthorized"});
 const fields=Object.fromEntries(header.split(",").map(x=>x.split("=",2).map(s=>s.trim())));
 const timestamp=fields.t,received=fields.v;
 if(!/^\d{10,13}$/.test(timestamp||"") || typeof received!=="string")return send(res,401,{error:"Unauthorized"});
 const time=Number(timestamp.length===13?Number(timestamp)/1000:timestamp);
 if(!Number.isFinite(time)||Math.abs(Date.now()/1000-time)>600)return send(res,401,{error:"Unauthorized"});
 const body=req.body||{};
 if(!["success","failed","pending"].includes(body.status) ||
    typeof body.customer_reference!=="string" ||
    typeof body.internal_reference!=="string")return send(res,400,{error:"Invalid webhook payload"});
 // Relworx signs EXACT webhook URL + Unix timestamp + these three fields sorted by key.
 const params={
  customer_reference:body.customer_reference,
  internal_reference:body.internal_reference,
  status:body.status
 };
 let signed=url+timestamp;
 for(const k of Object.keys(params).sort())signed+=k+params[k];
 const hex=crypto.createHmac("sha256",key).update(signed).digest("hex");
 const base64=Buffer.from(hex,"hex").toString("base64");
 if(!same(hex,received.toLowerCase()) && !same(base64,received))return send(res,401,{error:"Unauthorized"});
 // No database or durable event queue is present. Acknowledge, but do not treat this
 // notification alone as a verified donation or issue a receipt.
 return send(res,200,{received:true});
};