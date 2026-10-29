import fs from 'node:fs/promises';
import path from 'node:path';
import { JSDOM } from '@vivliostyle/jsdom';
import { randomUUID, createHash } from 'node:crypto';
export const esc=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
export const revision=model=>createHash('sha256').update(JSON.stringify(model)).digest('hex');
export async function importBook(root){
 const html=await fs.readFile(path.join(root,'manuscripts/book.html'),'utf8');
 const d=new JSDOM(html).window.document;
 const model={version:1,title:'nu_log Vol.01',articles:[],groups:[],front:'assets/images/01-02.webp',back:'assets/images/01-01.webp'};
 for(const a of d.querySelectorAll('article.chapter')){
  const article={id:a.id,className:a.className,title:a.querySelector('h1').textContent,author:a.querySelector('.author')?.textContent||'',blocks:[]};
  for(const e of a.children){
   if(e.tagName==='HEADER')continue;
   const b={id:randomUUID(),breakBefore:false};
   if(e.tagName==='FIGURE')Object.assign(b,{type:'figure',images:[...e.querySelectorAll('img')].map(i=>({src:i.getAttribute('src').replace(/^\.\.\//,''),className:i.className,width:Number(i.getAttribute('width')),height:Number(i.getAttribute('height'))})),caption:e.querySelector('figcaption')?.textContent||'',layout:e.classList.contains('pair')?'pair':'single',qr:e.classList.contains('qr'),width:100,maxHeight:null});
   else if(e.classList.contains('reference'))Object.assign(b,{type:'reference',text:e.querySelector('a')?.textContent||'',url:e.querySelector('a')?.getAttribute('href')||'',displayUrl:e.querySelector('span')?.textContent||''});
   else Object.assign(b,{type:e.tagName==='H2'?'heading':e.classList.contains('bullet')?'bullet':'paragraph',text:e.textContent});
   article.blocks.push(b);
  }
  model.articles.push(article);
 }
 for(const g of d.querySelectorAll('.toc-group'))model.groups.push({title:g.querySelector('h2').textContent,articles:[...g.querySelectorAll('a')].map(a=>a.getAttribute('href').slice(1))});
 return model;
}
export function validate(model,allowed){
 const ok=(condition,message)=>{if(!condition)throw new Error(message)};
 const str=(v,max=30000)=>typeof v==='string'&&v.length<=max;
 ok(model?.version===1&&str(model.title,200),'編集データの形式が違います。');
 ok(allowed.has(model.front)&&allowed.has(model.back),'表紙画像が見つかりません。');
 ok(Array.isArray(model.articles)&&model.articles.length>0&&model.articles.length<=100,'記事数が不正です。');
 const ids=new Set();
 for(const a of model.articles){
  ok(str(a.id,100)&&/^[\w-]+$/.test(a.id)&&!ids.has(a.id),'記事IDが重複しています。');ids.add(a.id);
  ok(str(a.title,300)&&str(a.author,200)&&/^chapter ch-\d+$/.test(a.className),'記事情報が不正です。');
  ok(Array.isArray(a.blocks)&&a.blocks.length<=2000,'ブロック数が不正です。');
  for(const b of a.blocks){
   ok(str(b.id,100)&&!ids.has(b.id),'ブロックIDが重複しています。');ids.add(b.id);
   ok(typeof b.breakBefore==='boolean','改ページ指定が不正です。');
   if(b.type==='figure'){
    ok(Array.isArray(b.images)&&b.images.length>=1&&b.images.length<=2,'写真は1ブロック2枚までです。');
    ok(['pair','single'].includes(b.layout)&&str(b.caption)&&typeof b.qr==='boolean','写真設定が不正です。');
    ok(Number.isFinite(b.width)&&b.width>=20&&b.width<=100,'写真の幅は20〜100%です。');
    ok(b.maxHeight===null||(Number.isFinite(b.maxHeight)&&b.maxHeight>=20&&b.maxHeight<=180),'写真の高さは20〜180mmです。');
    for(const img of b.images)ok(allowed.has(img.src)&&Number.isFinite(img.width)&&img.width>0&&Number.isFinite(img.height)&&img.height>0&&/^(portrait)?$/.test(img.className),'画像情報が不正です。');
   }else{
    ok(['heading','paragraph','bullet','reference'].includes(b.type)&&str(b.text),'文章の形式が不正です。');
    if(b.type==='reference')ok(str(b.url,2000)&&/^https?:\/\//.test(b.url)&&str(b.displayUrl,2000),'リンクはhttpまたはhttpsで指定してください。');
   }
  }
 }
 ok(Array.isArray(model.groups)&&model.groups.length<=20,'目次の形式が不正です。');
 for(const g of model.groups)ok(str(g.title,200)&&Array.isArray(g.articles)&&g.articles.every(id=>model.articles.some(a=>a.id===id)),'目次の記事が見つかりません。');
 return model;
}
function blockHtml(b){
 const br=b.breakBefore?' style="break-before:page"':'';
 if(b.type==='figure'){
  const override=b.maxHeight!==null?`max-height:${b.maxHeight}mm!important;`:'';
  const width=b.width!==100?`width:${b.width}%;margin-left:auto;margin-right:auto;`:'';
  const pics=b.images.map(i=>`<img class="${i.className}" src="../${esc(i.src)}" alt="" width="${i.width}" height="${i.height}"${override?` style="${override}"`:''}>`).join('');
  return `<figure data-block="${b.id}" class="${b.layout==='pair'?'pair':''} ${b.qr?'qr':''} ${b.layout==='single'&&b.images.length>1?'stack':''}" style="${width}${b.breakBefore?'break-before:page;':''}"><div class="pictures">${pics}</div>${b.caption?`<figcaption>${esc(b.caption).replaceAll('\n','<br>')}</figcaption>`:''}</figure>`;
 }
 if(b.type==='reference')return `<p class="reference"${br}><a href="${esc(b.url)}">${esc(b.text)}</a><span>${esc(b.displayUrl)}</span></p>`;
 const text=esc(b.text).replace(/https?:\/\/[^\s<]+/g,u=>`<a href="${u}">${u}</a>`).replaceAll('\n','<br>');
 const tag=b.type==='heading'?'h2':'p';
 return `<${tag} data-block="${b.id}"${b.type==='bullet'?' class="bullet"':''}${br}>${text}</${tag}>`;
}
export function renderBook(m,articleId=null){
 const articles=m.articles.filter(a=>!articleId||a.id===articleId);
 const body=articles.map(a=>`<article class="${a.className}" id="${a.id}"><header><h1>${esc(a.title)}</h1>${a.author?`<p class="author">${esc(a.author)}</p>`:''}</header>${a.blocks.map(blockHtml).join('\n')}</article>`).join('\n');
 const toc=m.groups.map(g=>`<section class="toc-group"><h2>${esc(g.title)}</h2>${g.articles.map(id=>{const a=m.articles.find(a=>a.id===id);return `<a href="#${id}"><span>${esc(a.title)}</span></a>`}).join('')}</section>`).join('');
 return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>${esc(m.title)}</title><link rel="stylesheet" href="../styles/book.css"><style>.stack .pictures img{display:block;margin:3mm auto}figure.stack{break-inside:auto}</style></head><body>${articleId?'':`<section class="cover"><img src="../${esc(m.front)}" alt="表紙"></section><nav class="toc"><h1>目次</h1>${toc}</nav>`}${body}${articleId?'':`<section class="cover back"><img src="../${esc(m.back)}" alt="裏表紙"></section>`}</body></html>`;
}
export async function atomic(file,content){await fs.mkdir(path.dirname(file),{recursive:true});const tmp=file+'.'+randomUUID()+'.tmp';await fs.writeFile(tmp,content,'utf8');await fs.rename(tmp,file);}
export async function materialize(root,model){await atomic(path.join(root,'manuscripts/book.html'),renderBook(model));}
