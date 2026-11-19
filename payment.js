/* Relworx Uganda Mobile Money; no merchant keys or PIN collection in browser. */
(function(){
 "use strict";
 const modal=document.getElementById("mobileMoneyModal");
 const form=document.getElementById("mmForm");
 const donate=document.getElementById("donationButton");
 const gatewayState=document.getElementById("gatewayState");
 const formState=document.getElementById("formState");
 const submit=document.getElementById("submitDonation");
 const panel=document.getElementById("pendingDonation");
 const refLabel=document.getElementById("pendingReference");
 const pendingState=document.getElementById("pendingState");
 const checkBtn=document.getElementById("checkPaymentBtn");
 const output=document.getElementById("paymentResult");
 const statusText=document.getElementById("paymentStatusText");
 const refresh=document.getElementById("refreshPayment");
 const STORAGE_KEY="lhcf_relworx_pending_v1";
 let lastFocus=null,requesting=false,checking=false,pending=null,timer=null,polls=0;
 function readSaved(){
  try{
   const p=JSON.parse(sessionStorage.getItem(STORAGE_KEY)||"null");
   return p&&/^LHCF[0-9a-f]{28}$/.test(p.reference)&&typeof p.intent==="string"?p:null;
  }catch(_){return null;}
 }
 function store(p){try{sessionStorage.setItem(STORAGE_KEY,JSON.stringify(p));}catch(_){}}
 function forget(){try{sessionStorage.removeItem(STORAGE_KEY);}catch(_){} pending=null;}
 function message(element,text,type){
  if(!element)return;
  element.textContent=text;
  element.dataset.type=type||"info";
 }
 function paymentMessage(text,type){
  if(output){output.hidden=false;output.dataset.type=type||"info";}
  if(statusText)statusText.textContent=text;
  message(pendingState,text,type);
 }
 function stopPolling(){if(timer){clearInterval(timer);timer=null;}}
 function showPending(){
  if(!pending)return;
  if(form)form.hidden=true;
  if(panel)panel.hidden=false;
  if(refLabel)refLabel.textContent=pending.reference;
  if(checkBtn){checkBtn.hidden=false;checkBtn.disabled=false;}
  if(refresh)refresh.hidden=false;
 }
 window.setNetwork=function(network){
  document.getElementById("selectedNetwork").value=network;
  for(const name of ["MTN","Airtel"]){
   const el=document.getElementById("net"+name);
   if(!el)continue;
   const on=name.toUpperCase()===network.toUpperCase();
   el.setAttribute("aria-pressed",String(on));
   el.classList.toggle(name==="MTN"?"border-yellow-500":"border-red-500",on);
   el.classList.toggle(name==="MTN"?"bg-yellow-50":"bg-red-50",on);
   el.classList.toggle("border-gray-200",!on);
  }
 };
 window.openMobileModal=function(){
  if(!modal||donate?.disabled)return;
  lastFocus=document.activeElement;
  if(pending)showPending();
  else {
   form?.reset();window.setNetwork("");
   if(form)form.hidden=false;
   if(panel)panel.hidden=true;
   message(formState,"","");
  }
  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden","false");
  document.body.style.overflow="hidden";
  document.getElementById("modalClose")?.focus();
 };
 window.closeMobileModal=function(){
  if(!modal||modal.classList.contains("hidden")||requesting)return;
  modal.classList.add("hidden");
  modal.setAttribute("aria-hidden","true");
  document.body.style.overflow="";
  if(lastFocus&&typeof lastFocus.focus==="function")lastFocus.focus();
 };
 async function checkPayment(){
  if(!pending||checking)return;
  checking=true;
  if(checkBtn){checkBtn.disabled=true;checkBtn.textContent="Checking with Relworx…";}
  paymentMessage("Checking with Relworx. Your payment is not yet confirmed.","info");
  try{
   const response=await fetch("/api/payments/verify",{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({reference:pending.reference,intent:pending.intent}),
    cache:"no-store"
   });
   const data=await response.json().catch(()=>({}));
   if(!response.ok)throw Error(data.error||"Could not check payment status.");
   if(data.status==="successful"){
    const amount=Number(data.amount).toLocaleString("en-UG");
    paymentMessage("Relworx verified your donation of UGX "+amount+". Reference: "+data.reference,"success");
    stopPolling();forget();
    if(checkBtn)checkBtn.hidden=true;
    if(refresh)refresh.hidden=true;
   }else if(data.status==="failed"){
    paymentMessage("Relworx reports this payment was not completed. Reference: "+data.reference,"error");
    stopPolling();forget();
    if(checkBtn)checkBtn.hidden=true;
    if(refresh)refresh.hidden=true;
   }else{
    paymentMessage("Still pending. Approve the Mobile Money prompt on your phone, or check again later. Reference: "+data.reference,"info");
   }
  }catch(error){paymentMessage(error.message||"Verification is temporarily unavailable. Check later.","error");}
  finally{checking=false;if(checkBtn){checkBtn.disabled=false;checkBtn.textContent="Check payment status";}}
 }
 function startPolling(){
  stopPolling();polls=0;
  timer=setInterval(()=>{
   if(!pending||polls>=9){stopPolling();return;}
   polls++;checkPayment();
  },10000);
 }
 window.handleMobileCheckout=async function(event){
  event.preventDefault();
  if(requesting||pending)return;
  const network=document.getElementById("selectedNetwork").value;
  const phone=document.getElementById("donorPhone").value.trim();
  const amount=Number(document.getElementById("donorAmount").value);
  if(!["MTN","AIRTEL"].includes(network)){message(formState,"Select MTN or Airtel.","error");return;}
  if(!/^(07\d{8}|\+2567\d{8}|2567\d{8})$/.test(phone.replace(/[\s-]/g,""))){
   message(formState,"Enter a valid Ugandan Mobile Money phone number.","error");return;
  }
  if(!Number.isSafeInteger(amount)||amount<500||amount>5000000){
   message(formState,"Enter an amount between UGX 500 and UGX 5,000,000.","error");return;
  }
  requesting=true;submit.disabled=true;submit.textContent="Requesting Mobile Money prompt…";
  message(formState,"Contacting Relworx. You will approve the payment on your phone.","info");
  try{
   const response=await fetch("/api/payments/initiate",{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({network,phone,amount})
   });
   const data=await response.json().catch(()=>({}));
   if(!response.ok)throw Error(data.error||"Payment request could not start.");
   if(data.provider!=="relworx"||data.status!=="pending"||!/^LHCF[0-9a-f]{28}$/.test(data.reference)||
      typeof data.intent!=="string")throw Error("Relworx returned an unexpected response. Contact the foundation.");
   pending={reference:data.reference,intent:data.intent};
   store(pending);showPending();
   paymentMessage("Payment request submitted. Check your phone and approve the prompt. Do not send a second request while this one is pending.","info");
   startPolling();
  }catch(error){message(formState,error.message||"Payment request could not start.","error");}
  finally{requesting=false;submit.disabled=false;submit.textContent="Request Mobile Money payment";}
 };
 checkBtn?.addEventListener("click",checkPayment);
 refresh?.addEventListener("click",checkPayment);
 modal?.addEventListener("click",event=>{if(event.target===modal)window.closeMobileModal();});
 pending=readSaved();
 if(pending){
  if(refresh)refresh.hidden=false;
  paymentMessage("You have a pending Relworx donation. Check its status before making another request. Reference: "+pending.reference,"info");
  startPolling();
 }
 (async function config(){
  if(!donate)return;
  try{
   const response=await fetch("/api/payments/config",{cache:"no-store"});
   const data=await response.json();
   if(!response.ok || data.provider!=="relworx")throw Error("Unavailable");
   donate.disabled=!data.ready;
   donate.closest(".donation-actions")?.setAttribute("data-gateway",data.ready?"online":"offline");
   donate.textContent=data.ready?"Donate via Mobile Money":"Online donations coming soon";
   if(gatewayState)gatewayState.textContent=data.ready?
    "Powered by Relworx. You'll approve your donation on your MTN or Airtel phone.":
    "Online Relworx payments are not activated yet. Contact the foundation for donation arrangements.";
  }catch(_){
   donate.disabled=true;
   donate.closest(".donation-actions")?.setAttribute("data-gateway","offline");
   donate.textContent="Online donations unavailable";
   if(gatewayState)gatewayState.textContent="Online donation checkout is temporarily unavailable. Contact the foundation.";
  }
 })();
})();