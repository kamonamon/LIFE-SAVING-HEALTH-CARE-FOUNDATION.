"use strict";
/* Build only public website files. Never expose payment internals or .env files as static content. */
const fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,".."),target=path.join(root,"public");
fs.rmSync(target,{recursive:true,force:true});fs.mkdirSync(target,{recursive:true});
const files=["index.html","about.html","blog.html","insurance.html","donate.html",
 "back.jpg","life logo.jpg"];
const folders=["assets","audio","images"];
for(const filename of files){
 const source=path.join(root,filename);
 if(!fs.existsSync(source))throw Error("Missing website asset: "+filename);
 fs.copyFileSync(source,path.join(target,filename));
}
for(const name of folders){
 const source=path.join(root,name);
 if(!fs.existsSync(source))throw Error("Missing website folder: "+name);
 if(name==="assets"){
   fs.mkdirSync(path.join(target,name),{recursive:true});
   for(const filename of ["site.css","mobile.css","site.js","payment.js"]){
     fs.copyFileSync(path.join(source,filename),path.join(target,name,filename));
   }
 }else fs.cpSync(source,path.join(target,name),{recursive:true});
}
const expected=path.join(target,"api");if(fs.existsSync(expected))throw Error("Payment source must never be public.");
console.log("Vercel static output ready at public/; private Relworx code stays outside it.");
