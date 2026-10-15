const {test}=require('node:test');
const assert=require('node:assert/strict');
const ts=require('typescript');
const fs=require('node:fs');
const path=require('node:path');
function loadTs(file){
  const full=path.resolve(__dirname,'..',file);
  const output=ts.transpileModule(fs.readFileSync(full,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
  const module={exports:{}};
  const localRequire=name=>name.startsWith('.')?loadTs(path.relative(path.resolve(__dirname,'..'),path.resolve(path.dirname(full),name+'.ts'))):require(name);
  new Function('module','exports','require',output)(module,module.exports,localRequire);
  return module.exports;
}

const {manualTotals,manualErrors,newRound,withManualMatches}=loadTs('src/data/manualMatches.ts');
const {analyzePlayers}=loadTs('src/data/playerAnalytics.ts');
const match=()=>({playerId:'p',username:'Player',map:'Clubhouse',mode:'Ranked Bomb',target:4,playedAt:'2026-10-01T00:00:00Z',rounds:Array.from({length:4},()=>({...newRound(),won:true,kills:1,died:false}))});
test('optional blanks remain unknown rather than zero totals',()=>{const totals=manualTotals(match());assert.equal(totals.kills,4);assert.equal(totals.deaths,0);assert.equal(totals.assists,null);});
test('terminal score and complete round results are required',()=>{assert.deepEqual(manualErrors(match()),[]);const p=match();p.rounds.push({...newRound(),won:false});assert.ok(manualErrors(p).some(e=>e.includes('after')));p.rounds=[newRound()];assert.ok(manualErrors(p).length);});
test('impossible headshots and fractional counts are rejected',()=>{const p=match();p.rounds[0].headshots=2;p.rounds[1].kills=1.5;assert.ok(manualErrors(p).length>=2);});
test('manual adapter excludes drafts and preserves replay source',()=>{const base={matches:[],rounds:[],appearances:[],players:[],perspective:'',rosterStorage:''};const records=[{id:'one',status:'draft',payload:match()},{id:'two',status:'submitted',payload:match()}];const data=withManualMatches(base,records);assert.equal(base.matches.length,0);assert.equal(data.matches.length,1);assert.equal(data.matches[0].isCompleteMatch,true);assert.equal(data.matches[0].source,'manual');assert.equal(data.appearances[0].assists,null);const player=analyzePlayers(data,'ALL')[0];assert.equal(player.kills,4);assert.equal(player.winRate,100);assert.equal(player.unverified,0);assert.equal(withManualMatches(data,records).matches.length,1);});
test('ranked overtime and custom first-to formats are validated',()=>{const p=match();p.rounds=[true,false,true,false,true,false,true,false,true].map(won=>({...newRound(),won}));assert.deepEqual(manualErrors(p),[]);p.mode='Custom Bomb';p.target=2;p.rounds=p.rounds.slice(0,3);assert.deepEqual(manualErrors(p),[]);});
