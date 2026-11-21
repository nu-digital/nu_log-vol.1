import {addChapter,removeChapter} from './chapters.js';
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
let model,rev,token,library,articleId,selected=null,mode='article',saved='',undo=[],redo=[],editKey=null,previewTimer,previewSeq=0,lastScope=null,pickImage,coverMode=false,saving=false,pdfTimer,toastTimer;
const draftKey='nu-log-editor-draft-v1';
const article=()=>model.articles.find(a=>a.id===articleId);
const serialize=()=>JSON.stringify(model);
const dirty=()=>serialize()!==saved;
function toast(message){$('#toast').textContent=message;$('#toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').hidden=true,5500);}
async function api(url,data){const r=await fetch(url,data===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json','X-Editor-Token':token},body:JSON.stringify(data)});const b=await r.json();if(!r.ok)throw new Error(b.error||'処理に失敗しました。');return b;}
function checkpoint(key=null){if(key&&key===editKey)return;undo.push(serialize());if(undo.length>100)undo.shift();redo=[];editKey=key;}
function stateChanged(){
 $('#dirty-dot').classList.toggle('unsaved',dirty());$('#save-status').textContent=saving?'保存しています…':dirty()?'未保存の変更あり':'保存済み';$('#undo').disabled=!undo.length;$('#redo').disabled=!redo.length;
 try{if(dirty())localStorage.setItem(draftKey,JSON.stringify({model,revision:rev}));else localStorage.removeItem(draftKey)}catch{toast('ブラウザーの下書き保存ができません。「保存」でファイルに保存してください。');}
 clearTimeout(previewTimer);if($('#auto-preview').checked)previewTimer=setTimeout(()=>refreshPreview().catch(e=>toast(e.message)),1500);
}
function change(fn,key=null,redraw=true){checkpoint(key);fn();stateChanged();if(redraw){renderNav();renderEditor();}}
function labels(type){return {paragraph:'本文',heading:'見出し',bullet:'箇条書き',figure:'写真・図',reference:'参考リンク',code:'コード'}[type];}
function renderNav(){
 const q=$('#search').value.toLowerCase();$('#article-count').textContent=model.articles.length;
 $('#articles').innerHTML=model.groups.map(g=>{const aa=g.articles.map(id=>model.articles.find(a=>a.id===id)).filter(a=>(a.title+' '+a.author).toLowerCase().includes(q));return aa.length?`<div class="group-name">${esc(g.title)}</div>${aa.map(a=>`<button class="article-link ${!coverMode&&a.id===articleId?'active':''}" data-article="${a.id}">${a.draft?'［下書き］':''}${esc(a.title)}<small>${esc(a.author||'団体紹介')}</small></button>`).join('')}`:''}).join('');
}
function blockCard(b,i){
 let content='';
 if(b.type==='figure'){
  content=`<div class="image-strip">${b.images.map((im,j)=>`<div class="image-item"><img class="image-thumb" src="/${esc(im.src)}" alt="写真 ${j+1} を差し替え" tabindex="0" role="button" data-image="${j}"><div class="image-actions"><button data-action="replace" data-index="${j}">差し替え</button>${b.images.length>1?`<button data-action="remove-image" data-index="${j}" aria-label="写真${j+1}を外す">外す</button>`:''}</div></div>`).join('')}</div><div class="image-actions">${b.images.length<2&&!b.fullPage?'<button data-action="add-image">＋ 写真を並べる</button>':b.images.length>1?'<button data-action="swap">左右を入れ替え</button>':''}</div><div class="image-settings"><label>並べ方<select data-field="layout"><option value="single" ${b.layout==='single'?'selected':''}>1列（縦に並べる）</option><option value="pair" ${b.layout==='pair'?'selected':''}>2列（横に並べる）</option></select></label><label>高さの上限（mm）<input type="number" min="20" max="180" placeholder="自動" value="${b.maxHeight??''}" data-field="maxHeight"></label><label class="width-setting">幅 <input aria-label="写真の幅" type="range" min="20" max="100" step="5" value="${b.width}" data-field="width"><output>${b.width}%</output></label></div>${b.images.length===1?`<label class="break-label"><input type="checkbox" data-field="fullPage" ${b.fullPage?'checked':''}>縦1ページに大きく掲載（全体を表示）</label>`:''}<label class="field-label">キャプション</label><textarea aria-label="キャプション" class="caption" data-field="caption" rows="2">${esc(b.caption)}</textarea>`;
 }else{
  content=`<textarea aria-label="${labels(b.type)}" data-field="text" rows="${Math.max(2,Math.min(9,Math.ceil(b.text.length/27)))}">${esc(b.text)}</textarea>`;
  if(b.type==='code')content+=`<label class="field-label">コードの説明</label><input style="width:100%" aria-label="コードの説明" data-field="caption" value="${esc(b.caption)}">`;
  if(b.type==='reference')content+=`<label class="field-label">リンク先</label><input style="width:100%" aria-label="リンク先" data-field="url" value="${esc(b.url)}"><label class="field-label">誌面に表示するURL</label><input style="width:100%" aria-label="表示URL" data-field="displayUrl" value="${esc(b.displayUrl)}">`;
 }
 return `<section class="block ${b.type} ${selected===b.id?'selected':''}" data-block="${b.id}"><div class="block-head"><span>${String(i+1).padStart(2,'0')}</span><span class="block-kind">${labels(b.type)}</span><button data-action="up" ${i===0?'disabled':''} aria-label="上へ移動">↑</button><button data-action="down" ${i===article().blocks.length-1?'disabled':''} aria-label="下へ移動">↓</button><button data-action="duplicate">複製</button><button data-action="delete" class="delete">削除</button></div>${content}<label class="break-label"><input type="checkbox" data-field="breakBefore" ${b.breakBefore?'checked':''}>この項目の前で改ページ</label></section>`;
}
function renderEditor(){
 if(!model.articles.some(a=>a.id===articleId)){articleId=model.articles[0].id;selected=null;}
 $('#delete-chapter').disabled=coverMode||model.articles.length<=1;
 if(coverMode){$('#article-meta').textContent='表紙・裏表紙';$('#block-count').textContent='';$('.insert-bar').hidden=true;$('#article-editor').innerHTML=['front','back'].map(k=>`<section class="block cover-card"><h3>${k==='front'?'表紙':'裏表紙'}</h3><img src="/${esc(model[k])}" alt="${k==='front'?'表紙':'裏表紙'}"><button data-cover="${k}">写真を差し替える</button></section>`).join('');return;}
 $('.insert-bar').hidden=false;const a=article();$('#article-meta').textContent=a.author||'団体紹介';$('#block-count').textContent=`${a.blocks.length}項目 · 写真${a.blocks.reduce((n,b)=>n+(b.images?.length||0),0)}点`;
 $('#article-editor').innerHTML=`<div class="article-fields"><label class="field-label">記事タイトル</label><textarea class="title-input" data-article-field="title" aria-label="記事タイトル" rows="2">${esc(a.title)}</textarea><label class="field-label">著者</label><input class="author-input" data-article-field="author" aria-label="著者" value="${esc(a.author)}"><label class="field-label">執筆メモ（PDFには載りません）</label><textarea data-article-field="editorNotes" aria-label="執筆メモ">${esc(a.editorNotes||'')}</textarea><label class="break-label"><input id="chapter-draft" type="checkbox" ${a.draft?'checked':''}>下書き（全冊プレビュー・PDFには含めない）</label></div>${a.blocks.map(blockCard).join('')}`;
}
function selectBlock(id){selected=id;document.querySelectorAll('.block[data-block]').forEach(e=>e.classList.toggle('selected',e.dataset.block===id));}
function findBlock(id){return article().blocks.find(b=>b.id===id);}
function imageInfo(item){return {src:item.src,width:item.width,height:item.height,className:item.height/item.width>1.2?'portrait':''};}
function showImages(callback){pickImage=callback;$('#image-search').value='';renderLibrary();$('#image-dialog').showModal();$('#image-search').focus();}
function renderLibrary(){const q=$('#image-search').value.toLowerCase();$('#image-library').innerHTML=library.filter(x=>(x.tab+' '+x.src).toLowerCase().includes(q)).map(x=>`<button class="library-item" data-src="${esc(x.src)}"><img src="/${esc(x.src)}" alt="" loading="lazy"><strong>${esc(x.tab)}</strong><span>${esc(x.src.split('/').pop())} · ${x.width}×${x.height}</span></button>`).join('');}
async function save(){
 if(saving)throw new Error('保存中です。少しお待ちください。');saving=true;$('#save').disabled=true;$('#save-status').textContent='保存しています…';
 const snapshot=serialize();try{const r=await api('/api/save',{model:JSON.parse(snapshot),revision:rev});rev=r.revision;saved=snapshot;toast('保存しました');return true;}finally{saving=false;$('#save').disabled=false;stateChanged();}
}
async function refreshPreview(){
 if(!model)return;clearTimeout(previewTimer);const seq=++previewSeq;$('#preview-status').textContent='紙面を組み直しています…';
 const r=await api('/api/preview',{model,articleId:mode==='article'&&!coverMode?articleId:null});if(seq!==previewSeq)return;
 const scope=mode+articleId+coverMode;let position='';try{if(lastScope===scope)position=$('#preview-frame').contentWindow.location.hash.match(/(?:^|&)f=([^&]+)/)?.[1]||'';}catch{}lastScope=scope;
 const rect=$('#preview-frame').getBoundingClientRect(),zoom=Math.max(.25,Math.min((rect.width-36)/688,(rect.height-80)/972));
 const src=location.origin+r.url;const viewer=`/viewer/index.html#src=${src}&bookMode=true&renderAllPages=true&spread=false&zoom=${zoom.toFixed(3)}${position?'&f='+position:''}`;
 $('#preview-frame').src=viewer;$('#open-preview').href=viewer;
 $('#preview-note').textContent=mode==='article'&&!coverMode?'記事単独の表示です。通しページ番号と目次は「全冊」で確認できます。':'全冊の組版結果です。目次・通しページ番号・記事のつながりを確認できます。';
}
let previewPoll;
$('#preview-frame').addEventListener('load',()=>{clearInterval(previewPoll);let ticks=0;previewPoll=setInterval(()=>{try{const doc=$('#preview-frame').contentDocument;const status=doc?.body?.getAttribute('data-vivliostyle-viewer-status');if(status==='complete'){const pages=doc.querySelector('#vivliostyle-total-pages')?.textContent||'';$('#preview-status').textContent=`プレビュー更新済み${pages?' · '+pages.replace('/','')+'ページ':''}`;clearInterval(previewPoll);}else if(++ticks>120){$('#preview-status').textContent='組版に時間がかかっています。更新をお試しください。';clearInterval(previewPoll);}}catch{clearInterval(previewPoll)}},500)});
function undoChange(forward=false){const from=forward?redo:undo,to=forward?undo:redo;if(!from.length)return;to.push(serialize());model=JSON.parse(from.pop());editKey=null;if(!model.articles.some(a=>a.id===articleId)){articleId=model.articles[0].id;selected=null;}stateChanged();renderNav();renderEditor();refreshPreview().catch(e=>toast(e.message));}
async function pollPdf(){
 const job=await api('/api/job');$('#pdf-log').textContent=job.log||'';
 if(job.status==='running'){$('#pdf-status').textContent=(job.includeCovers===false?'表紙・裏表紙なしで':'全冊を')+'組版してPDFを作成しています。1〜2分ほどかかる場合があります。';pdfTimer=setTimeout(()=>pollPdf().catch(e=>toast(e.message)),1500)}
 else{$('#export').disabled=false;if(job.status==='done'){$('#pdf-status').textContent=job.includeCovers===false?'表紙・裏表紙なしのPDFができました。目次と本文を出力しました。':'PDFができました。保存時点の全冊が出力されています。';$('#pdf-download').hidden=false;$('#pdf-download').href=(job.url||'/output/nu_log.pdf')+'?t='+Date.now()}else{$('#pdf-status').textContent='PDF出力に失敗しました。詳細を確認し、もう一度お試しください。';$('#pdf-details').open=true;}}
}
$('#articles').addEventListener('click',e=>{const b=e.target.closest('[data-article]');if(!b)return;articleId=b.dataset.article;selected=null;coverMode=false;renderNav();renderEditor();$('#article-editor').scrollTop=0;refreshPreview().catch(e=>toast(e.message));});
$('#search').addEventListener('input',renderNav);
$('#add-chapter').onclick=()=>{
 $('#chapter-group').innerHTML=model.groups.map((g,i)=>`<option value="${i}">${esc(g.title)}</option>`).join('');
 const groupIndex=model.groups.findIndex(g=>g.articles.includes(articleId));$('#chapter-group').value=String(Math.max(0,groupIndex));
 $('#chapter-title').value='';$('#chapter-author').value='';$('#chapter-new-group').value='';$('#new-chapter-draft').checked=false;$('#chapter-error').textContent='';
 $('#chapter-dialog').showModal();$('#chapter-title').focus();
};
$('#close-chapter').onclick=()=>$('#chapter-dialog').close();
$('#chapter-form').onsubmit=e=>{e.preventDefault();try{
 const next=structuredClone(model);const id=addChapter(next,{title:$('#chapter-title').value,author:$('#chapter-author').value,groupIndex:Number($('#chapter-group').value),newGroup:$('#chapter-new-group').value,afterId:articleId,draft:$('#new-chapter-draft').checked});
 change(()=>{model=next;articleId=id;selected=null;coverMode=false;$('#search').value='';});$('#chapter-dialog').close();refreshPreview().catch(e=>toast(e.message));
 }catch(err){$('#chapter-error').textContent=err.message;}};
$('#delete-chapter').onclick=()=>{if(!confirm(`「${article().title}」を章ごと削除しますか？「元に戻す」で戻せます。`))return;
 try{change(()=>{articleId=removeChapter(model,articleId);selected=null;});refreshPreview().catch(e=>toast(e.message));toast('章を削除しました。「保存」で確定します。');}catch(e){toast(e.message);}};

$('#article-editor').addEventListener('input',e=>{
 if(e.target.id==='chapter-draft'){change(()=>article().draft=e.target.checked,null,false);renderNav();return;}
 const field=e.target.dataset.field,af=e.target.dataset.articleField;
 if(af){change(()=>article()[af]=e.target.value,'article-'+af,false);renderNav();return;}
 if(!field)return;const card=e.target.closest('[data-block]'),b=findBlock(card.dataset.block);let value=e.target.value;
 if(field==='breakBefore'||field==='fullPage')value=e.target.checked;
 if(field==='width'){value=Number(value);e.target.nextElementSibling.textContent=value+'%';}
 if(field==='maxHeight'){if(value!==''&&(Number(value)<20||Number(value)>180))return;value=value===''?null:Number(value);}
 change(()=>b[field]=value,b.id+'-'+field,false);
});
$('#article-editor').addEventListener('focusout',()=>{editKey=null});
$('#article-editor').addEventListener('click',e=>{
 const cover=e.target.closest('[data-cover]');if(cover){showImages(im=>change(()=>model[cover.dataset.cover]=im.src));return;}
 const card=e.target.closest('[data-block]');if(!card)return;selectBlock(card.dataset.block);const b=findBlock(selected),a=article(),idx=a.blocks.indexOf(b);
 if(e.target.dataset.image!==undefined){showImages(im=>change(()=>b.images[Number(e.target.dataset.image)]=imageInfo(im)));return;}
 const button=e.target.closest('[data-action]');if(!button)return;const act=button.dataset.action;
 if(act==='up'||act==='down'){change(()=>{const other=idx+(act==='up'?-1:1);[a.blocks[idx],a.blocks[other]]=[a.blocks[other],a.blocks[idx]]});document.querySelector(`[data-block="${b.id}"]`)?.scrollIntoView({block:'nearest'});}
 if(act==='delete'){change(()=>a.blocks.splice(idx,1));toast('削除しました。「元に戻す」で戻せます。');}
 if(act==='duplicate')change(()=>{const c=structuredClone(b);c.id=crypto.randomUUID();a.blocks.splice(idx+1,0,c);selected=c.id;});
 if(act==='swap')change(()=>b.images.reverse());
 if(act==='remove-image')change(()=>{b.images.splice(Number(button.dataset.index),1);b.layout='single';});
 if(act==='replace')showImages(im=>change(()=>b.images[Number(button.dataset.index)]=imageInfo(im)));
 if(act==='add-image')showImages(im=>change(()=>{b.images.push(imageInfo(im));b.layout='pair';}));
});
$('#article-editor').addEventListener('keydown',e=>{if(e.target.dataset.image!==undefined&&(e.key==='Enter'||e.key===' ')){e.preventDefault();e.target.click();}});
document.querySelectorAll('[data-add]').forEach(button=>button.addEventListener('click',()=>{
 const type=button.dataset.add;const insert=im=>change(()=>{const a=article(),i=a.blocks.findIndex(b=>b.id===selected);const b={id:crypto.randomUUID(),type,breakBefore:false};if(type==='figure')Object.assign(b,{images:[imageInfo(im)],layout:'single',width:100,maxHeight:null,qr:false,caption:''});else {b.text='';if(type==='code')b.caption='';}a.blocks.splice(i<0?a.blocks.length:i+1,0,b);selected=b.id;setTimeout(()=>document.querySelector(`[data-block="${b.id}"]`)?.scrollIntoView({block:'center'}),0)});
 if(type==='figure')showImages(insert);else insert();
}));
$('#image-library').addEventListener('click',e=>{const b=e.target.closest('[data-src]');if(b){pickImage(library.find(x=>x.src===b.dataset.src));$('#image-dialog').close();}});
$('#image-search').addEventListener('input',renderLibrary);$('#close-images').onclick=()=>$('#image-dialog').close();
$('#undo').onclick=()=>undoChange();$('#redo').onclick=()=>undoChange(true);
$('#save').onclick=()=>save().catch(e=>toast(e.message));
$('#covers').onclick=()=>{coverMode=true;renderNav();renderEditor();refreshPreview().catch(e=>toast(e.message));};
for(const v of ['article','book'])$('#view-'+v).onclick=()=>{mode=v;$('#view-article').classList.toggle('active',v==='article');$('#view-book').classList.toggle('active',v==='book');refreshPreview().catch(e=>toast(e.message));};
$('#refresh-preview').onclick=()=>refreshPreview().catch(e=>toast(e.message));$('#auto-preview').onchange=()=>{if($('#auto-preview').checked)refreshPreview().catch(e=>toast(e.message));else clearTimeout(previewTimer)};
$('#export').onclick=async()=>{try{if(dirty())await save();$('#pdf-dialog').showModal();$('#pdf-download').hidden=true;$('#pdf-details').open=false;$('#pdf-status').textContent='書き出しを開始しています…';$('#export').disabled=true;await api('/api/build',{revision:rev,includeCovers:$('#pdf-scope').value!=='no-covers'});await pollPdf();}catch(e){$('#export').disabled=false;$('#pdf-status').textContent=e.message;toast(e.message);}};
$('#close-pdf').onclick=()=>$('#pdf-dialog').close();
window.addEventListener('beforeunload',e=>{if(model&&dirty()){e.preventDefault();e.returnValue='';}});
document.addEventListener('keydown',e=>{if(!(e.ctrlKey||e.metaKey)||!model)return;if(e.key.toLowerCase()==='s'){e.preventDefault();save().catch(e=>toast(e.message));}if(e.key.toLowerCase()==='z'){e.preventDefault();undoChange(e.shiftKey);}if(e.key.toLowerCase()==='y'){e.preventDefault();undoChange(true);}});
async function boot(){
 const data=await api('/api/state');({model,token,library}=data);rev=data.revision;saved=serialize();articleId=model.articles[0].id;
 let draft;try{draft=JSON.parse(localStorage.getItem(draftKey))}catch{}
 if(draft?.model&&JSON.stringify(draft.model)!==saved){$('#draft-banner').hidden=false;$('#restore-draft').onclick=()=>{if(draft.revision!==rev&&!confirm('保存済み原稿が更新されています。前回の下書きを画面に読み込みますか？保存するまではファイルは変更されません。'))return;checkpoint();model=draft.model;if(!model.articles.some(a=>a.id===articleId))articleId=model.articles[0].id;$('#draft-banner').hidden=true;renderNav();renderEditor();stateChanged();};$('#discard-draft').onclick=()=>{localStorage.removeItem(draftKey);$('#draft-banner').hidden=true;};}
 renderNav();renderEditor();$('#save-status').textContent='保存済み';$('#undo').disabled=true;$('#redo').disabled=true;await refreshPreview();
 if(data.job.status==='running'){$('#export').disabled=true;pollPdf().catch(e=>toast(e.message));}
}
boot().catch(e=>{$('#save-status').textContent='読み込みエラー';toast(e.message);});
