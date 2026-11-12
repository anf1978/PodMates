const { chromium } = require('/opt/npm-tools/node_modules/playwright');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});
for(const loc of ['ja-JP','en-US']){const c=await b.newContext({locale:loc,viewport:{width:390,height:800}});const pg=await c.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
await pg.route(/^https?:\/\/(?!file)/,r=>r.abort());await pg.goto('file:///home/claude/index.html');await pg.waitForTimeout(1500);
console.log(loc,await pg.$eval('#jaHint',e=>getComputedStyle(e).display),errs.length);
if(loc==='ja-JP'){await pg.screenshot({path:'ja.png'});await pg.click('#jaHintClose');console.log(await pg.$eval('#jaHint',e=>getComputedStyle(e).display));}}
await b.close();})();
