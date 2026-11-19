"use strict";
const crypto = require("node:crypto");
const BASE = "https://payments.relworx.com/api";
const MIN_UGX = 500, MAX_UGX = 5000000;
const VALID_REFERENCE = /^LHCF[0-9a-f]{28}$/;
const INTENT_TTL_MS = 24 * 60 * 60 * 1000;
function enabled() {
  return process.env.RELWORX_ENABLED === "true" &&
    Boolean(process.env.RELWORX_API_KEY?.trim() && process.env.RELWORX_ACCOUNT_NO?.trim());
}
function normalizePhone(value) {
  const n = String(value || "").replace(/[\s-]/g, "");
  const normalized = /^07\d{8}$/.test(n) ? "+256" + n.slice(1) :
    /^2567\d{8}$/.test(n) ? "+" + n : n;
  return /^\+2567\d{8}$/.test(normalized) ? normalized : null;
}
function validAmount(value) {
  return Number.isSafeInteger(value) && value >= MIN_UGX && value <= MAX_UGX;
}
function cryptoKey() {
  const key = process.env.RELWORX_INTENT_SECRET?.trim() || process.env.RELWORX_API_KEY?.trim();
  if (!key) throw Error("Missing Relworx signing secret");
  return crypto.createHmac("sha256", key).update("LHCF-v1-payment-intent").digest();
}
function same(a,b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const x=Buffer.from(a,"utf8"), y=Buffer.from(b,"utf8");
  return x.length === y.length && crypto.timingSafeEqual(x,y);
}
function signIntent(payload) {
  const data=Buffer.from(JSON.stringify(payload),"utf8").toString("base64url");
  const sig=crypto.createHmac("sha256",cryptoKey()).update(data).digest("base64url");
  return data+"."+sig;
}
function readIntent(token) {
  if (typeof token !== "string" || token.length > 1600) return null;
  const parts=token.split(".");
  if(parts.length!==2 || !/^[\w-]+$/.test(parts[0]) || !/^[\w-]+$/.test(parts[1]))return null;
  const sig=crypto.createHmac("sha256",cryptoKey()).update(parts[0]).digest("base64url");
  if(!same(parts[1],sig))return null;
  try {
    const p=JSON.parse(Buffer.from(parts[0],"base64url").toString("utf8"));
    if(p.v!==1 || !VALID_REFERENCE.test(p.reference) ||
      !validAmount(p.amount) || p.currency!=="UGX" ||
      !normalizePhone(p.phone) || p.phone!==normalizePhone(p.phone) ||
      typeof p.internalReference!=="string" || p.internalReference.length<8 ||
      p.internalReference.length>128 || !/^[\w-]+$/.test(p.internalReference) ||
      p.account!==process.env.RELWORX_ACCOUNT_NO ||
      !Number.isSafeInteger(p.exp) || Date.now()>p.exp || p.exp>Date.now()+INTENT_TTL_MS+120000) return null;
    return p;
  } catch(_) { return null; }
}
async function callApi(path,opts={}) {
  const key=process.env.RELWORX_API_KEY?.trim();
  if(!key)throw Error("Missing Relworx API credentials");
  const response=await fetch(BASE+path,{
    method:opts.method||"GET",
    headers:{"Authorization":"Bearer "+key,
      "Accept":"application/vnd.relworx.v2",
      "Content-Type":"application/json"},
    ...(opts.body?{body:JSON.stringify(opts.body)}:{}),
    signal:AbortSignal.timeout(20000)
  });
  const data=await response.json().catch(()=>null);
  return {ok:response.ok,code:response.status,data};
}
module.exports={enabled,normalizePhone,validAmount,signIntent,readIntent,same,callApi,
 MIN_UGX,MAX_UGX,VALID_REFERENCE,INTENT_TTL_MS};