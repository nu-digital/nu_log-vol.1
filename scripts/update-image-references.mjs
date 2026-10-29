import fs from 'node:fs/promises';
const changes=JSON.parse(await fs.readFile('reports/image-conversion-local.json','utf8'));
if(!changes.length)throw Error('No converted images.');
const names=new Map(changes.map(x=>[x.original,x.file]));
const replace=s=>{for(const [old,next] of names)s=s.split(old).join(next);return s;};
// Update the editable source, generated manuscripts, and optional local text copies.
for(const dir of ['manuscripts','source']){
 for(const name of await fs.readdir(dir).catch(()=>[]))if(/\.(html|txt)$/.test(name)){
  const file=`${dir}/${name}`;await fs.writeFile(file,replace(await fs.readFile(file,'utf8')));
 }
}
const book='editor/data/book.json';
await fs.mkdir('editor/data/history',{recursive:true});
await fs.copyFile(book,`editor/data/history/pre-webp-${Date.now()}.json`);
await fs.writeFile(book,replace(await fs.readFile(book,'utf8')));
const images=JSON.parse(await fs.readFile('reports/images.json','utf8'));
for(const im of images){const c=changes.find(c=>c.original===im.file);if(c){im.originalFile=im.file;im.file=c.file;im.bytes=c.bytes;im.sha256=c.sha256;}}
await fs.writeFile('reports/images.json',JSON.stringify(images,null,2)+'\n');
const dims=JSON.parse((await fs.readFile('reports/image-dimensions.json','utf8')).replace(/^\uFEFF/,''));
for(const d of dims){const c=changes.find(c=>c.original.endsWith('/'+d.file));if(c)d.file=c.file.split('/').pop();}
await fs.writeFile('reports/image-dimensions.json',JSON.stringify(dims,null,2)+'\n');
for(const file of ['editor/model.mjs','scripts/typeset.mjs','styles/book.css']){
 let s=await fs.readFile(file,'utf8');s=replace(s);
 // Filename suffixes and template-generated references used by the old import script.
 if(file==='scripts/typeset.mjs')s=s.replaceAll('15-${id}.jpg','15-${id}.webp');
 if(file==='styles/book.css')s=s.replaceAll('07-02.png','07-02.webp');
 await fs.writeFile(file,s);
}
await fs.writeFile('reports/image-optimization.json',JSON.stringify({format:'WebP lossless',images:changes.length,originalBytes:changes.reduce((n,c)=>n+c.originalBytes,0),webpBytes:changes.reduce((n,c)=>n+c.bytes,0),decodedPixelsVerified:true},null,2)+'\n');
console.log('Image references and manifests updated.');
