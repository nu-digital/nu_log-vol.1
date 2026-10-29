import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {JSDOM} from '@vivliostyle/jsdom';
import {importBook,renderBook,validate,revision} from './model.mjs';
const root=process.cwd();
const model=await importBook(root);
const allowed=new Set(JSON.parse(await fs.readFile('reports/images.json','utf8')).map(x=>x.file));
test('all fourteen articles and ninety-three body images survive the import',()=>{
 assert.equal(model.articles.length,14);
 assert.equal(model.articles.flatMap(a=>a.blocks).reduce((n,b)=>n+(b.images?.length||0),0),93);
 const d=new JSDOM(renderBook(model)).window.document;
 assert.equal(d.querySelectorAll('img').length,95);
 assert.equal(d.querySelectorAll('.toc-group a').length,14);
});
test('rendering retains text and URLs through a second import',async()=>{
 const temp=await fs.mkdtemp(path.join(root,'tmp/editor-roundtrip-'));
 await fs.mkdir(path.join(temp,'manuscripts'));await fs.writeFile(path.join(temp,'manuscripts/book.html'),renderBook(model));
 const round=await importBook(temp);
 for(let i=0;i<model.articles.length;i++){
  const clean=a=>a.blocks.map(({id,...b})=>b);
  assert.deepEqual(clean(round.articles[i]),clean(model.articles[i]));
 }
});
test('photo controls and manual breaks are actually written to the document',()=>{
 const next=structuredClone(model),b=next.articles[0].blocks.find(x=>x.type==='figure');
 b.width=65;b.maxHeight=90;b.breakBefore=true;b.caption='確認 <script>alert(1)</script>';
 validate(next,allowed);const d=new JSDOM(renderBook(next)).window.document,f=d.querySelector('figure');
 assert.equal(f.style.width,'65%');assert.equal(f.style.breakBefore,'page');assert.equal(f.querySelector('img').style.maxHeight,'90mm');assert.equal(f.querySelector('script'),null);assert.equal(f.querySelector('figcaption').textContent,b.caption);
 assert.notEqual(revision(next),revision(model));
});
test('out-of-range controls, unknown files, and unsafe links are rejected',()=>{
 const next=structuredClone(model),b=next.articles[0].blocks.find(x=>x.type==='figure');
 b.width=200;assert.throws(()=>validate(next,allowed));b.width=100;b.images[0].src='../source/google-doc.json';assert.throws(()=>validate(next,allowed));
 const link=structuredClone(model);link.articles[0].blocks.push({id:'unsafe',type:'reference',text:'x',url:'javascript:alert(1)',displayUrl:'x',breakBefore:false});assert.throws(()=>validate(link,allowed));
});
