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
const {analyzePlayers,playerTotals,sortPlayers}=loadTs('src/data/playerAnalytics.ts');
const now=Date.parse('2026-10-14T12:00:00Z');
function fixture(){
  const matches=[{matchId:'m',playedAt:'2026-10-12T12:00:00Z',roundCount:2,isCompleteMatch:true},{matchId:'old',playedAt:'2026-09-01T12:00:00Z',roundCount:1,isCompleteMatch:true}];
  const rounds=[{roundId:'r1',matchId:'m',roundNumber:1,teamSlot:1,won:true,side:'Attack'},{roundId:'r2',matchId:'m',roundNumber:2,teamSlot:1,won:true,side:'Defense'},{roundId:'r1',matchId:'m',roundNumber:1,teamSlot:0,won:false,side:'Defense'},{roundId:'r2',matchId:'m',roundNumber:2,teamSlot:0,won:false,side:'Attack'},{roundId:'r3',matchId:'old',roundNumber:1,teamSlot:1,won:true,side:'Attack'}];
  const appearances=[{roundId:'r1',matchId:'m',playerId:'a',teamIndex:1,kills:2,died:false,assists:1,headshots:1,operatorName:'Ash'},{roundId:'r2',matchId:'m',playerId:'a',teamIndex:1,kills:1,died:true,assists:2,headshots:1,operatorName:'Mute'},{roundId:'r1',matchId:'m',playerId:'b',teamIndex:0,kills:7,died:true,assists:0,headshots:3,operatorName:'Mute'},{roundId:'r3',matchId:'old',playerId:'a',teamIndex:1,kills:10,died:false,assists:0,headshots:5,operatorName:'Ash'}];
  return {matches,rounds,appearances,players:[{playerId:'a',username:'Alice'},{playerId:'b',username:'Bob'},{playerId:'c',username:'No replay'}]};
}
test('personal stats isolate players and resolve the actual replay side',()=>{
  const [a,b]=analyzePlayers(fixture(),'7D',now);
  assert.equal(a.kills,3);assert.equal(a.deaths,1);assert.equal(a.assists,3);assert.equal(a.kd,'3.00');assert.equal(a.hs,67);assert.equal(a.survival,50);
  assert.equal(a.wins,1);assert.equal(a.winRate,100);assert.equal(b.losses,1);assert.equal(b.kills,7);
  assert.equal(a.attackRounds,1);assert.equal(a.defenseWins,1);
});
test('operator totals partition personal appearances without opponent stats',()=>{
  const a=analyzePlayers(fixture(),'ALL',now)[0];
  assert.equal(a.operators[0].name,'Ash');assert.equal(a.operators[0].rounds,2);assert.equal(a.operators[0].kills,12);
  assert.equal(a.operators.reduce((sum,o)=>sum+o.rounds,0),a.rounds);
  assert.equal(a.history[0].stats.kills,3);assert.equal(a.history[1].stats.kills,10);
});
test('partial measurements remain unavailable in totals and derived rates',()=>{
  const data=fixture();data.appearances[0].kills=null;data.appearances[0].died=null;data.appearances[0].assists=null;
  const a=analyzePlayers(data,'7D',now)[0];
  assert.equal(a.kills,null);assert.equal(a.kd,null);assert.equal(a.deaths,null);assert.equal(a.survival,null);assert.equal(a.assists,null);assert.equal(a.hs,null);
  assert.equal(a.history[0].stats.kills,null);
});
test('ambiguous team membership retains personal history with an unverified result',()=>{
  const data=fixture();data.appearances[1].teamIndex=0;
  const a=analyzePlayers(data,'7D',now)[0];
  assert.equal(a.kills,3);assert.equal(a.matchCount,1);assert.equal(a.history.length,1);assert.equal(a.history[0].match.outcome,'UNKNOWN');
  assert.equal(a.winRate,null);assert.equal(a.unknownSideMatches,1);
});
test('incomplete matches never count as wins even with leading recorded score',()=>{
  const data=fixture();data.matches[0].isCompleteMatch=false;
  const a=analyzePlayers(data,'7D',now)[0];assert.equal(a.wins,0);assert.equal(a.unverified,1);assert.equal(a.winRate,null);
});
test('date range excludes future and undated records, ALL preserves them',()=>{
  const data=fixture();data.matches[0].playedAt='2026-10-15T12:00:00Z';data.matches[1].playedAt=null;
  assert.equal(analyzePlayers(data,'30D',now)[0].rounds,0);assert.equal(analyzePlayers(data,'ALL',now)[0].rounds,3);
  assert.equal(analyzePlayers(data,'ALL',now)[2].kills,null);
});
test('zero deaths, invalid headshot totals, and absent samples have explicit rates',()=>{
  const row=fixture().appearances[0];assert.equal(playerTotals([row]).kd,'∞');assert.equal(playerTotals([{...row,kills:0,headshots:0}]).kd,'—');
  assert.equal(playerTotals([{...row,headshots:4}]).hs,null);assert.equal(playerTotals([]).survival,null);
});
test('rank sorting puts missing values last and does not mutate input',()=>{
  const list=analyzePlayers(fixture(),'7D',now);list[0].kd='∞';list[1].kd=null;
  assert.deepEqual(sortPlayers(list,'kd').map(p=>p.playerId),['a','b','c']);
  assert.deepEqual(sortPlayers(list,'kills').map(p=>p.playerId),['b','a','c']);assert.equal(list[0].playerId,'a');
});
