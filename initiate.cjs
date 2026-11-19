"use strict";
const crypto=require("node:crypto");
const {enabled,normalizePhone,validAmount,signIntent,callApi}=require("../relworx");
function send(res,code,body){return res.status(code).json(body);}
module.exports=async function handler(req,res){
  res.setHeader("Cache-Control","no-store");
  if(req.method!=="POST")return send(res,405,{error:"Method not allowed"});
  if(!enabled())return send(res,503,{error:"Online donations are not activated yet. Contact the foundation."});
  const b=req.body||{};
  const phone=normalizePhone(b.phone);
  const amount=b.amount;
  if(!phone || !validAmount(amount))return send(res,400,{
    error:"Enter a valid Ugandan Mobile Money number and an amount between UGX 500 and UGX 5,000,000."
  });
  // Relworx detects the carrier from the phone; its request API has no network argument.
  const reference="LHCF"+crypto.randomBytes(14).toString("hex"); // 32 chars, Relworx max 36
  try{
    const {ok,code,data}=await callApi("/mobile-money/request-payment",{
      method:"POST",body:{
        account_no:process.env.RELWORX_ACCOUNT_NO,
        reference,
        msisdn:phone,
        currency:"UGX",
        amount,
        description:"Donation to Life Saving Health Care Foundation"
      }
    });
    if(!ok || data?.success!==true || typeof data.internal_reference!=="string" ||
      !/^[\w-]{8,128}$/.test(data.internal_reference)) {
      console.error("Relworx initiation rejected:",code,data?.message||"Invalid response");
      const isLimit=code===429;
      return send(res,isLimit?429:502,{error:isLimit?
        "Too many payment requests. Please wait before trying again.":
        "The Mobile Money request could not be started. No donation is confirmed."});
    }
    const intent=signIntent({
      v:1,reference,internalReference:data.internal_reference,
      phone,amount,currency:"UGX",account:process.env.RELWORX_ACCOUNT_NO,
      exp:Date.now()+24*60*60*1000
    });
    return send(res,200,{
      provider:"relworx",status:"pending",reference,intent,
      message:"Payment request submitted. Check your phone for the Mobile Money approval prompt. No money is confirmed yet."
    });
  }catch(error){
    console.error("Relworx request unavailable:",error.message);
    return send(res,502,{error:"We cannot reach the payment provider. Check for an existing phone prompt before retrying."});
  }
};