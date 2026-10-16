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
const {analyzeOperators,sortOperators}=loadTs('src/data/operatorAnalytics.ts');
const now=Date.parse('2026-10-14T12:00:00Z');
const perspective={mode:'player',members:['a']};
function fixture(){
  const matches=[{matchId:'m',playedAt:'2026-10-12T12:00:00Z',roundCount:3,isCompleteMatch:true}];
  const rounds=[1,2,3].flatMap(n=>[0,1].map(slot=>({roundId:'r'+n,matchId:'m',roundNumber:n,teamSlot:slot,side:(n===3)===(slot===1)?'Defense':'Attack',won:slot===1?n!==2:n===2})));
  const appearances=[1,2,3].flatMap(n=>[{roundId:'r'+n,matchId:'m',playerId:'a',teamIndex:1,kills:n,died:n===2,assists:1,headshots:1,operatorName:n===3?'Mute':'Ash'},{roundId:'r'+n,matchId:'m',playerId:'b',teamIndex:1,kills:1,died:false,assists:0,headshots:0,operatorName:n===3?'Mute':'Ace'},{roundId:'r'+n,matchId:'m',playerId:'enemy',teamIndex:0,kills:10,died:true,assists:0,headshots:5,operatorName:'Ash'}]);
  return {matches,rounds,appearances,players:[{playerId:'a',username:'Alice'},{playerId:'b',username:'Bob'},{playerId:'enemy',username:'Opponent'}]};
}
test('operator samples isolate selected participants on either team index',()=>{
  const a=analyzeOperators(fixture(),perspective,'ALL',now);
  const ash=a.operators.find(o=>o.name==='Ash');
  assert.equal(ash.picks,2);assert.equal(ash.totals.kills,3);assert.equal(ash.totals.kd,'3.00');assert.equal(ash.winRate,50);assert.equal(ash.side,'ATK');
  const enemy=analyzeOperators(fixture(),{mode:'player',members:['enemy']},'ALL',now);
  assert.equal(enemy.operators.reduce((sum,o)=>sum+o.totals.kills,0),30);assert.equal(enemy.sideSamples.DEF,2);
});
test('pick-share denominators use selected player appearances on the same recorded side',()=>{
  const view=analyzeOperators(fixture(),{mode:'team',members:['a','b']},'ALL',now);
  const ash=view.operators.find(o=>o.name==='Ash'),mute=view.operators.find(o=>o.name==='Mute');
  assert.equal(view.sideSamples.ATK,4);assert.equal(ash.pickShare,50);assert.equal(mute.pickShare,100);
  assert.equal(mute.picks,2);assert.equal(mute.rounds,1);assert.equal(mute.wins,1);assert.equal(mute.players.length,2);assert.equal(mute.totals.kills,4);
});
test('unknown outcomes stay in usage samples but not win-rate denominators',()=>{
  const data=fixture();data.rounds.find(r=>r.roundId==='r2'&&r.teamSlot===1).won=null;
  const ash=analyzeOperators(data,perspective,'ALL',now).operators.find(o=>o.name==='Ash');
  assert.equal(ash.picks,2);assert.equal(ash.unknown,1);assert.equal(ash.winRate,100);assert.equal(ash.matches[0].outcome,'UNKNOWN');
});
test('missing measurements invalidate only the affected totals and rates',()=>{
  const data=fixture();data.appearances[0].kills=null;data.appearances[0].assists=null;data.appearances[0].died=null;
  const ash=analyzeOperators(data,perspective,'ALL',now).operators.find(o=>o.name==='Ash');
  assert.equal(ash.totals.kills,null);assert.equal(ash.totals.kd,null);assert.equal(ash.totals.assists,null);assert.equal(ash.totals.hs,null);assert.equal(ash.winRate,50);
});
test('unknown operators remain in the denominator and unknown sides are not guessed',()=>{
  const data=fixture();data.appearances[0].operatorName=null;data.rounds.filter(r=>r.roundId==='r3').forEach(r=>r.side=null);
  const view=analyzeOperators(data,perspective,'ALL',now);
  assert.equal(view.operators.find(o=>o.name==='Unknown operator').pickShare,50);
  assert.equal(view.operators.find(o=>o.name==='Ash').pickShare,50);
  assert.equal(view.operators.find(o=>o.name==='Mute').side,'UNKNOWN');assert.equal(view.sideSamples.UNKNOWN,1);
});
test('the same operator on different recorded sides keeps separate records',()=>{
  const data=fixture();data.appearances.forEach(a=>{if(a.playerId==='a')a.operatorName='Ash';});
  const view=analyzeOperators(data,perspective,'ALL',now);
  assert.equal(view.operators.length,2);assert.notEqual(view.operators[0].key,view.operators[1].key);
});
test('ambiguous squads and absent members cannot include unrelated operator stats',()=>{
  assert.equal(analyzeOperators(fixture(),{mode:'team',members:['a','enemy']},'ALL',now).ambiguousMatches,1);
  assert.equal(analyzeOperators(fixture(),{mode:'team',members:['a','enemy']},'ALL',now).operators.length,0);
  assert.equal(analyzeOperators(fixture(),{mode:'player',members:['missing']},'ALL',now).operators.length,0);
});
test('date ranges exclude old appearances and incomplete games retain known round outcomes',()=>{
  const data=fixture();data.matches[0].playedAt='2026-09-01T12:00:00Z';data.matches[0].isCompleteMatch=false;
  assert.equal(analyzeOperators(data,perspective,'30D',now).operators.length,0);
  const all=analyzeOperators(data,perspective,'ALL',now);assert.equal(all.operators.length,2);assert.equal(all.operators[0].matches[0].outcome,'UNKNOWN');
  assert.equal(all.operators.find(o=>o.name==='Ash').winRate,50);
});
test('sorting handles infinite, unavailable and zero ratios without changing source order',()=>{
  const list=analyzeOperators(fixture(),perspective,'ALL',now).operators;
  list[0].totals.kd=null;list[1].totals.kd='∞';
  assert.equal(sortOperators(list,'kd')[0].name,'Mute');assert.equal(list[0].name,'Ash');
  list[1].totals.kd='0.00';assert.equal(sortOperators(list,'kd')[0].name,'Mute');
});

test('map filter unifies canonical map aliases and excludes other-map facts',()=>{
 const {filterOperatorMap}=loadTs('src/data/operatorAnalytics.ts');
 const data=fixture();data.matches[0].mapName='ClubHouse';
 const other=fixture();other.matches.forEach(m=>{m.matchId='other';m.mapName='Bank';});
 other.rounds.forEach(r=>{r.matchId='other';r.roundId='other-'+r.roundId;});
 other.appearances.forEach(a=>{a.matchId='other';a.roundId='other-'+a.roundId;a.kills=50;});
 const combined={...data,matches:[...data.matches,...other.matches],rounds:[...data.rounds,...other.rounds],appearances:[...data.appearances,...other.appearances]};
 const {resolveMap}=loadTs('src/data/mapCatalog.ts');
 const filtered=filterOperatorMap(combined,resolveMap('Club House',null).key);
 assert.equal(filtered.matches.length,1);
 assert.deepEqual(analyzeOperators(filtered,perspective,'ALL',now),analyzeOperators(data,perspective,'ALL',now));
 assert.equal(filterOperatorMap(combined,'').matches.length,2);
 assert.equal(analyzeOperators(filterOperatorMap(combined,'missing'),perspective,'ALL',now).operators.length,0);
});
