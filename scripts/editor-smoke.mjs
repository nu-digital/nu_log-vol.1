import puppeteer from 'puppeteer-core';
import fs from 'node:fs/promises';
const browser=await puppeteer.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,args:['--no-first-run'],defaultViewport:{width:1512,height:982}});
try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4177',{waitUntil:'networkidle2'});
 await page.waitForSelector('.block');
 await page.waitForFunction(()=>{const f=document.querySelector('#preview-frame');return f.contentDocument?.body?.dataset.vivliostyleViewerStatus==='complete'},{timeout:90000});
 await page.waitForFunction(()=>document.querySelector('#preview-status').textContent.includes('更新済み'),{timeout:10000});
 console.log('Preview ready:',await page.$eval('#preview-status',e=>e.textContent));
 await fs.mkdir('tmp/editor',{recursive:true});await page.screenshot({path:'tmp/editor/editor.png'});
 // Exercise text editing and undo without changing the saved manuscript.
 await page.click('#auto-preview');
 const original=await page.$eval('.title-input',e=>e.value);
 await page.$eval('.title-input',e=>{e.value+=' テスト';e.dispatchEvent(new Event('input',{bubbles:true}));});
 if(!await page.$eval('#save-status',e=>e.textContent.includes('未保存')))throw Error('Dirty status failed');
 await page.click('#undo');if(await page.$eval('.title-input',e=>e.value)!==original)throw Error('Undo failed');
 await page.click('[data-article="chapter-12"]');
 await page.waitForSelector('.pair',{timeout:1000}).catch(()=>{});
 const thumb=await page.$('.image-thumb');await thumb.click();await page.waitForSelector('#image-dialog[open]');
 if(await page.$$eval('.library-item',x=>x.length)!==95)throw Error('Library count failed');
 await page.click('#close-images');
 // Verify the full-book viewer uses the same 68-page publication as PDF export.
 await page.click('#view-book');
 await page.waitForFunction(()=>document.querySelector('#preview-frame').contentDocument?.querySelector('#vivliostyle-total-pages')?.textContent.trim()==='68',{timeout:90000});
 console.log('Whole-book preview: 68 pages');
 await page.click('#view-article');
 await page.click('[data-article="chapter-3"]');
 await page.waitForFunction(()=>document.querySelector('#preview-frame').contentDocument?.body?.dataset.vivliostyleViewerStatus==='complete',{timeout:90000});
 console.log('Browser errors:',JSON.stringify(errors));if(errors.length)throw Error('Browser errors');
 console.log('UI smoke tests passed');
}finally{await browser.close();}
