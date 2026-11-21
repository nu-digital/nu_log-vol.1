export function addChapter(model,{title,author='',groupIndex=0,newGroup='',afterId=null,draft=false},uuid=()=>crypto.randomUUID()){
 if(model.articles.length>=100)throw Error('章は100件までです。');
 title=title.trim();newGroup=newGroup.trim();
 if(!title||title.length>300||author.length>200||newGroup.length>200)throw Error('章タイトル・著者・分類を確認してください。');
 if(newGroup&&model.groups.length>=20)throw Error('分類は20件までです。');
 let group=newGroup?{title:newGroup,articles:[]}:model.groups[groupIndex];
 if(!group)throw Error('分類を選んでください。');
 const n=Math.max(0,...model.articles.map(a=>Number(a.className.match(/ch-(\d+)/)?.[1]||0)))+1;
 const a={id:'chapter-'+uuid(),className:'chapter ch-'+n,title,author,draft,blocks:[{id:uuid(),type:'paragraph',text:'',breakBefore:false}]};
 if(newGroup)model.groups.push(group);
 const pos=group.articles.indexOf(afterId);group.articles.splice(pos<0?group.articles.length:pos+1,0,a.id);
 model.articles.push(a);
 const order=model.groups.flatMap(g=>g.articles);model.articles.sort((x,y)=>order.indexOf(x.id)-order.indexOf(y.id));
 return a.id;
}
export function removeChapter(model,id){
 if(model.articles.length<=1)throw Error('最後の1章は削除できません。');
 const i=model.articles.findIndex(a=>a.id===id);if(i<0)throw Error('章が見つかりません。');
 model.articles.splice(i,1);
 for(const g of model.groups)g.articles=g.articles.filter(x=>x!==id);
 return model.articles[Math.min(i,model.articles.length-1)].id;
}
