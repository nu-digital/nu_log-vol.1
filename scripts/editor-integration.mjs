import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn,execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
const root=process.cwd();
await fs.mkdir(path.join(root,'tmp'),{recursive:true});
const temp=await fs.mkdtemp(path.join(root,'tmp/editor-integration-'));
for(const folder of ['manuscripts','reports'])await fs.mkdir(path.join(temp,folder));
for(const f of ['manuscripts/book.html','reports/images.json','reports/image-dimensions.json'])await fs.copyFile(path.join(root,f),path.join(temp,f));
const port=process.env.NU_LOG_TEST_PORT||'4189';
const base=`http://127.0.0.1:${port}`;let child;
async function start(){child=spawn(process.execPath,[path.join(root,'editor/server.mjs')],{cwd:temp,env:{...process.env,NU_LOG_WORKSPACE:temp,NU_LOG_PORT:port},windowsHide:true,stdio:'pipe'});for(let i=0;i<40;i++){try{const r=await fetch(base+'/api/state');if(r.ok)return await r.json()}catch{}await new Promise(r=>setTimeout(r,200));}throw Error('Test server failed to start');}
async function stop(){child.kill();await new Promise(r=>child.once('close',r));}
try{
 let s=await start();const original=s.model.articles[0].title;
 const post=(route,data,token=s.token)=>fetch(base+route,{method:'POST',headers:{'Content-Type':'application/json','X-Editor-Token':token,Origin:base},body:JSON.stringify(data)});
 let r=await post('/api/save',{model:s.model,revision:s.revision},'invalid');assert.equal(r.status,403);
 s.model.articles[0].title=original+' 保存検証';
 r=await post('/api/save',{model:s.model,revision:s.revision});assert.equal(r.status,200);const result=await r.json();
 r=await post('/api/save',{model:s.model,revision:s.revision});assert.equal(r.status,409);
 const html=await fs.readFile(path.join(temp,'manuscripts/book.html'),'utf8');assert.ok(html.includes('保存検証'));
 await stop();s=await start();assert.equal(s.revision,result.revision);assert.equal(s.model.articles[0].title,original+' 保存検証');
 execFileSync(process.execPath,[path.join(root,'scripts/typeset.mjs')],{cwd:temp});assert.ok((await fs.readFile(path.join(temp,'manuscripts/book.html'),'utf8')).includes('保存検証'));
 r=await post('/api/preview',{model:s.model,articleId:s.model.articles[0].id});assert.equal(r.status,200);const preview=await r.json();const page=await(await fetch(base+preview.url)).text();assert.ok(page.includes('保存検証'));assert.equal((page.match(/<article /g)||[]).length,1);
 assert.equal((await fetch(base+'/source/google-doc.json')).status,404);
 assert.ok((await fs.readdir(path.join(temp,'editor/data/history'))).length>0);
 console.log('Passed: save, conflict protection, restart, regeneration, preview, backup, local request protection.');
}finally{if(child&&!child.killed)await stop();}
