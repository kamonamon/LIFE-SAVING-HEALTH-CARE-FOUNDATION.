/* Vercel's current Web Request/Response signature around the tested Relworx core. */
export async function invokeLegacy(request,handler){
  const headers=new Headers({"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"});
  const uri=new URL(request.url);
  const query=Object.fromEntries(uri.searchParams.entries());
  let body={};
  if(request.method==="POST"){
    const raw=await request.text();
    if(Buffer.byteLength(raw,"utf8")>10000){
      return Response.json({error:"Request too large."},{status:413,headers});
    }
    try {body=raw?JSON.parse(raw):{};}
    catch(_) {return Response.json({error:"Invalid JSON body."},{status:400,headers});}
  }
  const req={method:request.method,body,query,headers:Object.fromEntries(request.headers.entries())};
  let status=200;
  const res={
    setHeader(k,v){headers.set(k,String(v));},
    status(code){status=code;return this;},
    json(data){return Response.json(data,{status,headers});}
  };
  try{
    const result=await handler(req,res);
    if(result instanceof Response)return result;
    return Response.json({error:"Invalid payment response."},{status:500,headers});
  }catch(err){
    console.error("Vercel Relworx adapter error:",err.message);
    return Response.json({error:"Payment service temporarily unavailable."},{status:502,headers});
  }
}
