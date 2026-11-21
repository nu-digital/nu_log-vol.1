import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {JSDOM} from '@vivliostyle/jsdom';
import {importBook,renderBook,validate,revision} from './model.mjs';
const root=process.cwd();
const model=await importBook(root);
const allowed=new Set(JSON.parse(await fs.readFile('reports/images.json','utf8')).map(x=>x.file));
const source=JSON.parse(await fs.readFile('editor/data/book.json','utf8'));
const published=source.articles.filter(a=>!a.draft);
const imageCount=published.flatMap(a=>a.blocks).reduce((n,b)=>n+(b.images?.length||0),0);
test('all saved articles and body images survive the import',()=>{
 assert.equal(model.articles.length,published.length);
 assert.equal(model.articles.flatMap(a=>a.blocks).reduce((n,b)=>n+(b.images?.length||0),0),imageCount);
 const d=new JSDOM(renderBook(model)).window.document;
 assert.equal(d.querySelectorAll('img').length,imageCount+2);
 assert.equal(d.querySelectorAll('.toc-group a').length,source.groups.reduce((n,g)=>n+g.articles.filter(id=>published.some(a=>a.id===id)).length,0));
});
test('rendering retains text and URLs through a second import',async()=>{
 await fs.mkdir(path.join(root,'tmp'),{recursive:true});
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

test('cover-free output retains the complete contents and leaves the source unchanged',()=>{
 const before=revision(model);
 const full=new JSDOM(renderBook(model)).window.document;
 const bodyOnly=new JSDOM(renderBook(model,null,{includeCovers:false})).window.document;
 assert.equal(full.querySelectorAll('.cover').length,2);
 assert.equal(bodyOnly.querySelectorAll('.cover').length,0);
 assert.equal(bodyOnly.querySelector('.toc').outerHTML,full.querySelector('.toc').outerHTML);
 assert.deepEqual([...bodyOnly.querySelectorAll('article')].map(a=>a.outerHTML),[...full.querySelectorAll('article')].map(a=>a.outerHTML));
 assert.equal(revision(model),before);
});

test('chapter creation and deletion keep contents and navigation consistent',async()=>{
 const {addChapter,removeChapter}=await import('./public/chapters.js');
 const next=structuredClone(source);let serial=0;
 const id=addChapter(next,{title:'追加検証',groupIndex:0,afterId:next.articles[0].id},()=>`test-${++serial}`);
 assert.equal(next.articles[1].id,id);assert.equal(next.groups[0].articles[1],id);validate(next,allowed);
 const html=new JSDOM(renderBook(next)).window.document;
 assert.ok(html.querySelector(`article[id="${id}"]`));assert.ok(html.querySelector(`.toc a[href="#${id}"]`));
 removeChapter(next,id);assert.deepEqual(next,source);
 const only=structuredClone(source);only.articles=[only.articles[0]];only.groups=[{title:'one',articles:[only.articles[0].id]}];
 assert.throws(()=>removeChapter(only,only.articles[0].id),/最後/);
});
test('draft chapters and writing notes stay out of publication, but drafts can be previewed',()=>{
 const next=structuredClone(source),a=next.articles[0];a.draft=true;a.editorNotes='PRIVATE-NOTE';
 const d=new JSDOM(renderBook(next)).window.document;
 assert.equal(d.querySelector(`article[id="${a.id}"]`),null);assert.equal(d.querySelector(`.toc a[href="#${a.id}"]`),null);
 assert.ok(renderBook(next,a.id).includes(a.title));assert.ok(!renderBook(next,a.id).includes('PRIVATE-NOTE'));
});
test('new groups and draft status survive serialization and validation',async()=>{
 const {addChapter}=await import('./public/chapters.js');const next=structuredClone(source);let n=0;
 const id=addChapter(next,{title:'草稿',newGroup:'新分類',draft:true},()=>`new-${++n}`);
 const loaded=JSON.parse(JSON.stringify(next));validate(loaded,allowed);
 assert.equal(loaded.groups.at(-1).articles[0],id);assert.equal(loaded.articles.at(-1).draft,true);
 assert.ok(!renderBook(loaded).includes('新分類'));
});
