"use strict";
const {enabled,MIN_UGX,MAX_UGX}=require("../relworx");
module.exports=function handler(req,res){
 res.setHeader("Cache-Control","no-store");
 if(req.method!=="GET")return res.status(405).json({error:"Method not allowed"});
 return res.status(200).json({provider:"relworx",ready:enabled(),currency:"UGX",
   minAmount:MIN_UGX,maxAmount:MAX_UGX});
};