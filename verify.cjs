"use strict";
const {enabled,readIntent,normalizePhone,callApi}=require("../relworx");
function send(res,code,obj){return res.status(code).json(obj);}
module.exports=async function handler(req,res){
 res.setHeader("Cache-Control","no-store");
 if(req.method!=="POST")return send(res,405,{error:"Method not allowed"});
 if(!enabled())return send(res,503,{error:"Payment verification is not activated."});
 const intent=readIntent(req.body?.intent);
 if(!intent || req.body?.reference!==intent.reference)return send(res,400,{error:"Invalid or expired payment reference. Contact the foundation with your reference if needed."});
 try{
   const query=new URLSearchParams({
     internal_reference:intent.internalReference,account_no:process.env.RELWORX_ACCOUNT_NO
   });
   const result=await callApi("/mobile-money/check-request-status?"+query.toString());
   if(!result.ok || result.data?.success!==true){
     console.error("Relworx status query unavailable:",result.code,result.data?.message);
     return send(res,502,{error:"Payment status could not be checked right now. Please try again."});
   }
   const data=result.data;
   const status=String(data.request_status || data.status || "").toLowerCase();
   const known=["success","successful","completed","pending","failed","cancelled","canceled"];
   if(!known.includes(status))return send(res,200,{reference:intent.reference,status:"pending",message:"Payment is still processing. Check again shortly."});
   // Never mark a donation successful until its original reference, amount, phone and currency match.
   if(["success","successful","completed"].includes(status)){
     if(data.customer_reference!==intent.reference ||
       data.internal_reference!==intent.internalReference ||
       data.currency!=="UGX" || Number(data.amount)!==intent.amount ||
       normalizePhone(data.msisdn)!==intent.phone) {
       console.error("Relworx payment verification mismatch for reference",intent.reference);
       return send(res,502,{error:"Payment details could not be reconciled. Contact the foundation; do not retry immediately."});
     }
     return send(res,200,{reference:intent.reference,status:"successful",currency:"UGX",amount:intent.amount,
       message:"The donation has been verified with Relworx."});
   }
   if(["failed","cancelled","canceled"].includes(status))
     return send(res,200,{reference:intent.reference,status:"failed",message:"The payment was not completed."});
   return send(res,200,{reference:intent.reference,status:"pending",message:"Waiting for the provider to confirm your Mobile Money payment."});
 }catch(err){
   console.error("Relworx status unavailable:",err.message);
   return send(res,502,{error:"Payment status is temporarily unavailable. Check again shortly."});
 }
};