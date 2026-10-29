import fs from 'node:fs/promises';
// Re-importing source assets after visual editing could replace referenced images.
try { await fs.access('editor/data/book.json'); throw new Error('編集データがあります。素材の再取得は別フォルダーで行い、編集画面へ反映してください。'); }
catch (error) { if(error.code!=='ENOENT')throw error; }
import path from 'node:path';
import crypto from 'node:crypto';
const doc=JSON.parse(await fs.readFile('source/google-doc.json','utf8'));
for(const dir of ['manuscripts','assets/images','reports','output']) await fs.mkdir(dir,{recursive:true});
const esc=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const inventory=[]; const entries=[];
for(const [idx,tab] of doc.tabs.entries()){
 const slug=String(idx+1).padStart(2,'0'); const objects={...tab.inlineObjects,...tab.positionedObjects}; const imageMap={};
 for(const [id,obj] of Object.entries(objects)){
  const embedded=(obj.inlineObjectProperties||obj.positionedObjectProperties)?.embeddedObject;
  const uri=embedded?.imageProperties?.contentUri;if(!uri)continue;
  const stem=`${slug}-${String(Object.keys(imageMap).length+1).padStart(2,'0')}`;
  const res=await fetch(uri);if(!res.ok)throw new Error(`Image ${stem}: ${res.status}`);
  const mime=res.headers.get('content-type');const ext=({'image/png':'png','image/jpeg':'jpg','image/gif':'gif','image/webp':'webp'})[mime?.split(';')[0]];
  if(!ext)throw new Error(`Unexpected image type: ${mime}`);
  const bytes=Buffer.from(await res.arrayBuffer()); const file=`assets/images/${stem}.${ext}`;await fs.writeFile(file,bytes);
  imageMap[id]=file; inventory.push({tab:tab.title,tabId:tab.tabId,objectId:id,file,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),sourceSize:embedded.size});
 }
 let plain='';
 function content(items){return (items||[]).map(item=>{
  if(item.paragraph){const p=item.paragraph;let html='';for(const e of p.elements||[]){
   if(e.textRun){const t=e.textRun;plain+=t.content;let s=esc(t.content).replaceAll('\n','<br>');if(t.textStyle?.bold)s=`<strong>${s}</strong>`;if(t.textStyle?.italic)s=`<em>${s}</em>`;if(t.textStyle?.link?.url)s=`<a href="${esc(t.textStyle.link.url)}">${s}</a>`;html+=s;}
   if(e.inlineObjectElement){const id=e.inlineObjectElement.inlineObjectId;plain+=`\n[画像: ${imageMap[id]||id}]\n`;html+=imageMap[id]?`<img src="../${imageMap[id]}" alt="">`:`<span>［画像未取得: ${esc(id)}］</span>`;}
  }
  for(const id of p.positionedObjectIds||[])if(imageMap[id])html+=`<img src="../${imageMap[id]}" alt="">`;
  const level=p.paragraphStyle?.namedStyleType?.match(/^HEADING_([1-6])$/)?.[1];const tag=level?`h${level}`:'p';return `<${tag}${p.bullet?' class="source-list-item"':''}>${html}</${tag}>`;
  }
  if(item.table)return '<table>'+item.table.tableRows.map(r=>'<tr>'+r.tableCells.map(c=>'<td>'+content(c.content)+'</td>').join('')+'</tr>').join('')+'</table>';
  if(item.tableOfContents)return content(item.tableOfContents.content);return '';
 }).join('\n');}
 const body=content(tab.body?.content);
 await fs.writeFile(`manuscripts/${slug}.html`,`<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>${esc(tab.title)}</title><link rel="stylesheet" href="../styles/book.css"></head><body><article data-source-tab="${esc(tab.tabId)}">${body}</article></body></html>`);
 await fs.writeFile(`source/${slug}.txt`,plain);
 entries.push({path:`manuscripts/${slug}.html`,title:tab.title,tabId:tab.tabId,characters:plain.length,images:Object.keys(imageMap).length});
 console.log(`${slug} ${tab.title}: ${plain.length} characters, ${Object.keys(imageMap).length} images`);
}
await fs.writeFile('reports/images.json',JSON.stringify(inventory,null,2));
await fs.writeFile('reports/chapters.json',JSON.stringify(entries,null,2));
await fs.writeFile('vivliostyle.config.js',`export default ${JSON.stringify({title:'nu_log Vol.01',author:'nu_digital',language:'ja',size:'182mm,257mm',entry:entries.map(e=>({path:e.path,title:e.title})),output:['output/nu_log-preparation.pdf'],workspaceDir:'.vivliostyle'},null,2)};\n`);
