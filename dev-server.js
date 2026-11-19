"use strict";
// Local preview of the same Vercel functions. No packages or database required.
const http=require("node:http");
const fs=require("node:fs");
const path=require("node:path");
const root=__dirname;
if(fs.existsSync(path.join(root,".env.local"))) process.loadEnvFile(path.join(root,".env.local"));
const handlers={
  "/api/payments/config":require("./lib/handlers/config.cjs"),
  "/api/payments/initiate":require("./lib/handlers/initiate.cjs"),
  "/api/payments/verify":require("./lib/handlers/verify.cjs"),
  "/api/payments/webhook":require("./lib/handlers/webhook.cjs")
};
const media={".html":"text/html; charset=utf-8",".css":"text/css; charset=utf-8",
  ".js":"application/javascript; charset=utf-8",".jpg":"image/jpeg",".jpeg":"image/jpeg",
  ".png":"image/png",".webp":"image/webp",".mp3":"audio/mpeg",".mp4":"video/mp4",
  ".svg":"image/svg+xml",".ico":"image/x-icon"};
function fail(res,status,message){res.writeHead(status,{"Content-Type":"application/json","Cache-Control":"no-store"});res.end(JSON.stringify({error:message}));}
const server=http.createServer(async(req,res)=>{
  try {
    const parsed=new URL(req.url,"http://localhost");
    if(handlers[parsed.pathname]) {
      res.status=function(code){res.statusCode=code;return res;};
      res.json=function(data){res.setHeader("Content-Type","application/json");res.end(JSON.stringify(data));return res;};
      req.query=Object.fromEntries(parsed.searchParams);
      if(req.method==="POST"){
        let body="",length=0;
        for await(const chunk of req){length+=chunk.length;if(length>10000){return fail(res,413,"Request too large");}body+=chunk;}
        try{req.body=body?JSON.parse(body):{};}catch(_){return fail(res,400,"Invalid JSON");}
      }
      return await handlers[parsed.pathname](req,res);
    }
    if(req.method!=="GET" && req.method!=="HEAD") return fail(res,405,"Method not allowed");
    const decoded=decodeURIComponent(parsed.pathname);
    if(decoded.includes("\0") || decoded.includes("\\") || decoded.includes("..")) return fail(res,400,"Invalid path");
    const relative=decoded==="/"?"index.html":decoded.replace(/^\/+/,"");
    const name=path.resolve(root,relative);
    if(!name.startsWith(root+path.sep))return fail(res,403,"Forbidden");
    const ext=path.extname(name).toLowerCase();
    if(!media[ext])return fail(res,404,"Not found");
    if(ext===".js" && !name.startsWith(path.join(root,"assets")+path.sep))return fail(res,404,"Not found");
    const stat=await fs.promises.stat(name).catch(()=>null);
    if(!stat?.isFile())return fail(res,404,"Not found");
    res.setHeader("Content-Type",media[ext]);
    res.setHeader("Cache-Control","no-store");
    // Basic byte ranges allow the outreach video to seek without loading everything.
    if(req.headers.range && ext===".mp4"){
      const match=/bytes=(\d+)-(\d*)/.exec(req.headers.range);
      if(match){const start=Number(match[1]),end=match[2]?Math.min(Number(match[2]),stat.size-1):stat.size-1;
        if(start<stat.size && end>=start){
          res.writeHead(206,{"Accept-Ranges":"bytes","Content-Range":"bytes "+start+"-"+end+"/"+stat.size,"Content-Length":end-start+1});
          return fs.createReadStream(name,{start,end}).pipe(res);
        }
      }
      return res.writeHead(416).end();
    }
    res.setHeader("Content-Length",stat.size);
    if(req.method==="HEAD")return res.end();
    fs.createReadStream(name).pipe(res);
  } catch(error) {console.error("Local preview error:",error.message);if(!res.headersSent)fail(res,500,"Internal preview error");else res.end();}
});
const port=Number(process.env.PORT||4173);
server.listen(port,"127.0.0.1",()=>console.log("Life Saving Foundation local preview: http://localhost:"+port));
