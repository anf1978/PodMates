const fs=require('fs');const { chromium } = require('/opt/npm-tools/node_modules/playwright');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});
const pg=await (await b.newContext()).newPage();await pg.route(/^https?:\/\/(?!file)/,r=>r.abort());
await pg.goto('file:///home/claude/'+(process.argv[2]||'index.html'));await pg.waitForFunction(()=>typeof dbReady!=='undefined'&&dbReady,{timeout:60000});
const out=await pg.evaluate(()=>{const rows=[];
 for(const o of TRY_A_DECK_OPTIONS){
  const a=analyzeOneList(o.decklist,'x',o.commander);
  const m=matchDecklist(parseDecklist(o.decklist).entries,CARD_DB,indexes);
  const mc=m.matched||m.matchedCards||[];
  let r=null;try{r=computeCommanderCentrality(a.agg,mc,a.commanders,a.winCons,o.archetype);}catch(e){}
  rows.push({k:o.key,arch:o.archetype,c:r&&{score:r.score,inv:r.investment.map(i=>[i.key,i.count])}});}
 return rows;});
fs.writeFileSync('cen174.json',JSON.stringify(out));console.log(out.length,out.filter(x=>x.c).length,JSON.stringify(out[5]));await b.close();})();
