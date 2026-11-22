import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes} from 'node:crypto';
import {spawn} from 'node:child_process';
import {importBook,validate,revision,atomic,materialize,renderBook} from './model.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(process.env.NU_LOG_WORKSPACE||path.join(here,'..'));
const port=Number(process.env.NU_LOG_PORT||4177),origin=`http://127.0.0.1:${port}`;
const token=randomBytes(32).toString('hex');
const stateFile=path.join(root,'editor/data/book.json');
const original=await fs.readFile(path.join(root,'manuscripts/book.html'),'utf8');
let model;
try{model=JSON.parse(await fs.readFile(stateFile,'utf8'))}catch(e){if(e.code!=='ENOENT')throw e;model=await importBook(root);await atomic(path.join(root,'editor/data/original-book.html'),original);await atomic(stateFile,JSON.stringify(model,null,2));}
const inv=JSON.parse(await fs.readFile(path.join(root,'reports/images.json'),'utf8'));
const dims=JSON.parse((await fs.readFile(path.join(root,'reports/image-dimensions.json'),'utf8')).replace(/^\uFEFF/,''));
const library=inv.map(i=>({...i,...dims.find(d=>i.file.endsWith(d.file)),src:i.file,file:i.file}));
// Accept local drafts created before the lossless WebP migration.
function normalizeImages(book){
 const aliases=new Map(inv.filter(i=>i.originalFile).map(i=>[i.originalFile,i.file]));
 book.front=aliases.get(book.front)||book.front;book.back=aliases.get(book.back)||book.back;
 for(const article of book.articles||[])for(const block of article.blocks||[])for(const image of block.images||[])image.src=aliases.get(image.src)||image.src;
 return book;
}
normalizeImages(model);
const allowed=new Set(library.map(i=>i.src));validate(model,allowed);await materialize(root,model);
let rev=revision(model),busy=false,job={status:'idle'},previewId=0;const previews=new Map();
const fail=(status,message)=>Object.assign(new Error(message),{status});
async function body(req){const chunks=[];let size=0;for await(const c of req){chunks.push(c);size+=c.length;if(size>3000000)throw fail(413,'データが大きすぎます。');}try{return JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{throw fail(400,'JSONが不正です。')}}
function json(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
async function persist(next,expected){
 if(busy)throw fail(409,'保存またはPDF出力中です。完了後にもう一度お試しください。');
 if(expected!==rev)throw fail(409,'別の画面で保存されました。入力内容をコピーしてから再読み込みしてください。');
 normalizeImages(next);validate(next,allowed);busy=true;
 try{
  const stamp=new Date().toISOString().replaceAll(':','-')+'-'+rev.slice(0,8);
  await atomic(path.join(root,'editor/data/history',stamp+'.json'),JSON.stringify(model,null,2));
  await atomic(stateFile,JSON.stringify(next,null,2));model=next;rev=revision(model);
  await materialize(root,model);return rev;
 }finally{busy=false;}
}
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.gif':'image/gif','.svg':'image/svg+xml','.woff':'font/woff','.woff2':'font/woff2','.ttf':'font/ttf','.pdf':'application/pdf','.json':'application/json'};
async function serve(res,base,relative){const file=path.resolve(base,relative);if(!file.startsWith(path.resolve(base)+path.sep))throw fail(403,'アクセスできません。');const bytes=await fs.readFile(file);res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(bytes);}
const server=http.createServer(async(req,res)=>{
 try{
  if(req.headers.host!==`127.0.0.1:${port}`)throw fail(403,'このエディターはローカル専用です。');
  const url=new URL(req.url,origin),p=decodeURIComponent(url.pathname);
  if(req.method==='POST'){
   if(req.headers['x-editor-token']!==token||(req.headers.origin&&req.headers.origin!==origin))throw fail(403,'編集画面を再読み込みしてください。');
   const b=await body(req);
   if(p==='/api/save'){const revision=await persist(b.model,b.revision);return json(res,200,{revision});}
   if(p==='/api/preview'){
    normalizeImages(b.model);validate(b.model,allowed);const id=String(++previewId);previews.set(id,renderBook(b.model,b.articleId||null));if(previews.size>12)previews.delete(previews.keys().next().value);
    return json(res,200,{url:`/preview/${id}.html`});
   }
   if(p==='/api/build'){
    if(busy)throw fail(409,'PDF出力中です。');
    if(b.revision!==rev)throw fail(409,'先に変更を保存してください。');
    if(!model.articles.some(a=>!a.draft))throw fail(400,'PDFに含める章がありません。下書き設定を外してください。');
    const includeCovers=b.includeCovers!==false;
    const filename=includeCovers?'nu_log.pdf':'nu_log-no-covers.pdf';
    busy=true;job={status:'running',includeCovers,url:'/output/'+filename,startedAt:new Date().toISOString(),log:''};
    const browser=process.env.NU_LOG_BROWSER||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
    try{
    await fs.mkdir(path.join(root,'output/editor'),{recursive:true});
    if(!includeCovers)await atomic(path.join(root,'manuscripts/book-no-covers.html'),renderBook(model,null,{includeCovers:false}));
    const child=spawn(process.execPath,[path.join(here,'../node_modules/@vivliostyle/cli/dist/cli.js'),'build','-c',includeCovers?'vivliostyle.config.js':'vivliostyle.no-covers.config.js','-o','output/editor/'+filename,'--executable-browser',browser],{cwd:root,windowsHide:true});
    child.stdout.on('data',x=>job.log=(job.log+x).slice(-8000));child.stderr.on('data',x=>job.log=(job.log+x).slice(-8000));
    child.on('error',e=>{job={...job,status:'error',message:e.message};busy=false;});
    child.on('close',code=>{job={...job,status:code===0?'done':'error',finishedAt:new Date().toISOString(),revision:rev};busy=false;});
    return json(res,202,job);
    }catch(e){busy=false;job={...job,status:'error',message:e.message};throw e;}
   }
   throw fail(404,'操作が見つかりません。');
  }
  if(req.method!=='GET')throw fail(405,'未対応の操作です。');
  if(p==='/api/state')return json(res,200,{model,revision:rev,token,library,job});
  if(p==='/api/job')return json(res,200,job);
  if(p.startsWith('/preview/')){const html=previews.get(p.split('/').at(-1).replace('.html',''));if(!html)throw fail(404,'プレビューを更新してください。');res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});return res.end(html);}
  if(p.startsWith('/viewer/'))return await serve(res,path.join(here,'../node_modules/@vivliostyle/viewer/lib'),p.slice(8));
  if(p.startsWith('/assets/images/'))return await serve(res,path.join(root,'assets/images'),p.slice(15));
  if(p==='/styles/book.css')return await serve(res,path.join(root,'styles'),'book.css');
  if(['/output/nu_log.pdf','/output/nu_log-no-covers.pdf'].includes(p))return await serve(res,path.join(root,'output/editor'),p.slice(8));
  if(['/','/app.js','/app.css','/chapters.js'].includes(p))return await serve(res,path.join(here,'public'),p==='/'?'index.html':p.slice(1));
  throw fail(404,'見つかりません。');
 }catch(e){json(res,e.status|| (e.code==='ENOENT'?404:400),{error:e.message});}
});
server.listen(port,'127.0.0.1',()=>console.log(`nu_log editor: ${origin}`));
server.on('error',e=>{console.error(e.code==='EADDRINUSE'?`ポート${port}は使用中です。${origin} を開いてください。`:e);process.exit(1)});
