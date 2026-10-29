import fs from 'node:fs/promises';
// Saved editor data is authoritative; regeneration must never erase edits.
try {
 const saved=JSON.parse(await fs.readFile('editor/data/book.json','utf8'));
 const { materialize }=await import('../editor/model.mjs');
 await materialize(process.cwd(),saved);
 console.log('Saved editor changes were preserved and typeset.');
 process.exit(0);
} catch(error) { if(error.code!=='ENOENT')throw error; }
const doc=JSON.parse(await fs.readFile('source/google-doc.json','utf8'));
const images=JSON.parse(await fs.readFile('reports/images.json','utf8'));
const dims=JSON.parse((await fs.readFile('reports/image-dimensions.json','utf8')).replace(/^\uFEFF/,''));
const esc=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const titles=['nu_digitalについて','協力型クッキングゲーム × LBEをUnityで作る！','謎解きゲーム「くいっく！」の制作フロー！','VRCで写真を上手く撮りたいよね','マルチローダーに取り組んだお話','Raspberry PiでWebサービスをリリース！','ちょっとわかった気になれたAIエージェント','Blender勢のためのUnity連携ガイド','Blenderのデータを現実に！独学・前提知識ゼロから始める3Dプリント','趣味絵と依頼絵の違いを考える','コード進行、自動化してみた','音楽学科の人間がAIと一緒に色々作ってみた話','「かすかなはな」の文字PV制作','動画制作と依頼までのフロー'];
const extraHeads=new Set(['準備したもの','実　践','計算ツール','カメラツール','振り返りと今後の発展とか','作ってみて感じたこと','今後やってみたいこと','まとめ','なぜ「製作物」を「現実」にしたくなったのか']);
const capTexts=new Set(['大量にプールされてるオブジェクト','厨房の配置','こんなのとか作ってました','XYZの書かれた箱さえ印刷できない....','おお()','こんなのとか','こんなのとか....','底面の曲がり　強度問題への直面もありました...','逆さツリーサポートが意外と安定...','おお','おぉ（笑）','実際にmeshy aiを使用しモデリングしてもらったものをblenderに落としたもの','調整をして印刷をしてみました。','(coconala HPより)','(左が試聴、右がnote)','ノベルゲーム用イラスト','オーキャンパンフ用イラスト']);
const notes=[],articles=[],used=new Set();
const imageById=id=>images.find(x=>x.objectId===id)?.file;
function figure(files,caption=''){
 const qr=files.every(f=>/05-01|13-0[23]/.test(f));
 const imgs=files.map(file=>{used.add(file);const d=dims.find(x=>file.endsWith(x.file));return `<img class="${d.height/d.width>1.2?'portrait':''}" src="../${file}" alt="" width="${d.width}" height="${d.height}">`;}).join('');
 return `<figure class="${files.length>1?'pair':''} ${qr?'qr':''}"><div class="pictures">${imgs}</div>${caption?`<figcaption>${esc(caption)}</figcaption>`:''}</figure>`;
}
for(let index=2;index<doc.tabs.length;index++){
 const tab=doc.tabs[index],title=titles[index-2],nodes=[];let omitted=false;
 for(const item of tab.body.content){
  if(!item.paragraph)continue;
  const p=item.paragraph,raw=p.elements.map(e=>e.textRun?.content||'').join('');
  if(/[-—ー]{2,}\s*コメント/.test(raw))omitted=true;
  if(omitted||raw.includes('ーー2,3は文量の都合で省略。')){notes.push({tab:tab.title,text:raw});continue;}
  let text='';
  const flush=()=>{for(let s of text.split(/[\n\v]/)){s=s.trim();if(!s)continue;if(s===title||(index===15&&s==='水甜瓜')||(index===2&&s==='本')||s==='→')continue;
    if(index===7)s=s.replace('右の図','図').replace('以下の図ような','以下の図のような');
    if(index===6)s=s.replace('右図','図');
    const heading=!capTexts.has(s)&&(extraHeads.has(s)||/^HEADING_/.test(p.paragraphStyle?.namedStyleType||'')||/^【.+】$/.test(s)||/^[0-9０-９]+[.．]\s*.{1,85}$/.test(s)||/^[①②③④]/.test(s)||/^[1-5]️⃣/.test(s)||/^\[♪|^〇\[/.test(s));
    s=s.replace(/([1-5])️⃣/g,'$1. ');
    nodes.push({type:heading?'heading':p.bullet?'li':'p',text:s});
  }text='';};
  for(const e of p.elements){if(e.textRun)text+=e.textRun.content;if(e.inlineObjectElement){flush();const f=imageById(e.inlineObjectElement.inlineObjectId);if(f)nodes.push({type:'image',file:f});}}flush();
  for(const id of p.positionedObjectIds||[]){const f=imageById(id);if(f)nodes.push({type:'image',file:f});}
 }
 if(index===7){for(const [start,end] of [['真白な知見','システム構成にしました。'],['これで自分が','見れるので、とても癒されます。'],['ただ、現状の脆弱性','ていきたいと思います。']]){const a=nodes.findIndex(n=>n.text?.startsWith(start)),b=nodes.findIndex((n,i)=>i>=a&&n.text===end);if(a>=0&&b>=a)nodes.splice(a,b-a+1,{type:'p',text:nodes.slice(a,b+1).map(n=>n.text||'').join('')});}
  const a=nodes.findIndex(n=>n.file==='assets/images/08-02.webp');const image=nodes.splice(a,1)[0];const b=nodes.findIndex(n=>n.text?.startsWith('真白な知見'));nodes.splice(b+1,0,image);
 }
 if(index===14){const ids=['08','01','10','11','09'];const first=nodes.findIndex(n=>n.type==='image'&&ids.some(id=>n.file.endsWith(`15-${id}.webp`)));if(first>=0){for(let i=nodes.length-1;i>=0;i--)if(nodes[i].type==='image'&&ids.some(id=>nodes[i].file.endsWith(`15-${id}.webp`)))nodes.splice(i,1);nodes.splice(first,0,...ids.map(id=>({type:'image',file:`assets/images/15-${id}.webp`})))} }
 if(index===11){
  for(let i=nodes.length-1;i>=0;i--)if(['ノベルゲーム用イラスト','オーキャンパンフ用イラスト'].includes(nodes[i].text))nodes.splice(i,1);
  nodes.find(n=>n.file==='assets/images/12-01.webp').caption='ノベルゲーム用イラスト';
  nodes.find(n=>n.file==='assets/images/12-02.webp').caption='オーキャンパンフ用イラスト';
 }
 for(let i=0;i<nodes.length-1;i++)if(nodes[i].type==='image'&&(capTexts.has(nodes[i+1].text)||/^図\s*[0-9０-９]|^協力者と友人|^↑/.test(nodes[i+1].text||''))){nodes[i].caption=nodes[i+1].text;nodes.splice(i+1,1);}
 let body='';
 for(let i=0;i<nodes.length;i++){
  const n=nodes[i];
  if(n.type==='image'){
   const run=[n];while(nodes[i+1]?.type==='image')run.push(nodes[++i]);
   let caption='';if(nodes[i+1]&&(capTexts.has(nodes[i+1].text)||/^図\s*[0-9０-９]|^協力者と友人/.test(nodes[i+1].text||'')))caption=nodes[++i].text;
   const step=[6,7,8,13].includes(index)?1:2;
   for(let k=0;k<run.length;k+=step){const batch=run.slice(k,k+step);const count=batch.filter(x=>x.caption).length;const own=batch.map((x,j)=>x.caption?`${count>1?(j===0?'左：':'右：'):''}${x.caption}`:'').filter(Boolean).join('　');body+=figure(batch.map(x=>x.file),own||(k+step>=run.length?caption:''));}
  }else if(n.type==='heading')body+=`<h2>${esc(n.text.replace(/^【|】$/g,''))}</h2>`;
  else if(n.type==='li')body+=`<p class="bullet">・${esc(n.text)}</p>`;
  else if(index===15&&/^https:\/\/youtu.be\//.test(n.text)&&nodes[i+1]?.type==='p'){
   const label=nodes[++i].text,url=n.text.split('?')[0];body+=`<p class="reference"><a href="${esc(n.text)}">${esc(label)}</a><span>${esc(url)}</span></p>`;
  }else body+=`<p>${esc(n.text).replace(/https?:\/\/[^\s<]+/g,u=>`<a href="${u}">${u}</a>`)}</p>`;
 }
 articles.push(`<article class="chapter ch-${index+1}" id="chapter-${index+1}"><header><h1>${esc(title)}</h1>${index===2?'':`<p class="author">${esc(tab.title)}</p>`}</header>${body}</article>`);
}
const groups=[['団体紹介',0,1],['ゲーム・VR',1,4],['システム・技術',4,7],['3D・イラスト',7,10],['音楽・映像',10,14]];
const toc=groups.map(([name,a,b])=>`<section class="toc-group"><h2>${name}</h2>${titles.slice(a,b).map((t,j)=>`<a href="#chapter-${a+j+3}"><span>${esc(t)}</span></a>`).join('')}</section>`).join('');
await fs.mkdir('output/pdf',{recursive:true});
await fs.writeFile('manuscripts/book.html',`<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>nu_log Vol.01</title><link rel="stylesheet" href="../styles/book.css"></head><body><section class="cover"><img src="../assets/images/01-02.webp" alt="nu_log 表紙"></section><nav class="toc"><h1>目次</h1>${toc}</nav>${articles.join('\n')}<section class="cover back"><img src="../assets/images/01-01.webp" alt="nu_digital 裏表紙"></section></body></html>`);
await fs.writeFile('reports/editorial-notes.json',JSON.stringify(notes,null,2));
await fs.writeFile('reports/layout-audit.json',JSON.stringify({bodyImages:used.size,unusedImages:images.filter(x=>!used.has(x.file)&&!x.file.includes('/01-')).map(x=>x.file),articleCount:articles.length},null,2));
await fs.writeFile('vivliostyle.config.js',`export default {title:'nu_log Vol.01',author:'nu_digital',language:'ja',size:'182mm,257mm',entry:'manuscripts/book.html',output:'output/pdf/nu_log.pdf',workspaceDir:'.vivliostyle'};\n`);
console.log(`Articles: ${articles.length}; body images: ${used.size}; notes: ${notes.length}`);
