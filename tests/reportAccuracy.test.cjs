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
const {comparePlayers,compareRate,ratioValue,buildInsights,insightsCsv}=loadTs('src/data/reportAnalytics.ts');
const now=Date.parse('2026-10-14T12:00:00Z');
function fixture(){
  const matches=['m1','m2','m3'].map((matchId,i)=>({matchId,mapId:100+i,mapName:'Map '+i,playedAt:`2026-10-${12-i}T12:00:00Z`,roundCount:1,isCompleteMatch:true}));
  const rounds=matches.flatMap(m=>[0,1].map(teamSlot=>({roundId:m.matchId+'r',matchId:m.matchId,roundNumber:1,teamSlot,side:teamSlot===1?'Attack':'Defense',won:teamSlot===1,site:'Site A'})));
  const row=(id,m,slot,kills)=>({playerId:id,matchId:m,roundId:m+'r',teamIndex:slot,kills,died:slot===0,assists:1,headshots:1,operatorName:slot===1?'Ash':'Mute'});
  const appearances=[row('a','m1',1,2),row('b','m1',0,1),row('a','m2',1,3),row('b','m3',0,4),row('c','m2',1,1)];
  return {matches,rounds,appearances,players:[{playerId:'a',username:'Alice'},{playerId:'b',username:'Bob'},{playerId:'c',username:'Charlie'}]};
}
const perspective={mode:'player',members:['a']};
test('comparison uses both histories in one date range and separates their side results',()=>{
  const result=comparePlayers(fixture(),'a','b','ALL',false,now);
  assert.equal(result.sharedMatches,1);assert.equal(result.a.kills,5);assert.equal(result.b.kills,5);assert.equal(result.a.winRate,100);assert.equal(result.b.winRate,0);
});
test('shared-match comparison restricts both profiles to actual common match IDs',()=>{
  const result=comparePlayers(fixture(),'a','b','ALL',true,now);
  assert.equal(result.a.matchCount,1);assert.equal(result.b.matchCount,1);assert.equal(result.a.kills,2);assert.equal(result.b.kills,1);
  assert.equal(result.a.history[0].match.matchId,result.b.history[0].match.matchId);
});
test('unknown players and self-comparisons fail explicitly',()=>{
  assert.equal(comparePlayers(fixture(),'a','a','ALL',false,now),null);assert.equal(comparePlayers(fixture(),'a','missing','ALL',false,now),null);
});
test('no common matches leaves zero samples and unavailable metrics',()=>{
  const result=comparePlayers(fixture(),'b','c','ALL',true,now);
  assert.equal(result.sharedMatches,0);assert.equal(result.a.rounds,0);assert.equal(result.b.kills,null);
});
test('missing rates never win and equal rates never favor one player',()=>{
  assert.equal(compareRate(null,0),'unavailable');assert.equal(compareRate(50,50),'equal');assert.equal(compareRate(0,10),'b');
  assert.equal(ratioValue('∞'),Infinity);assert.equal(ratioValue('—'),null);assert.equal(ratioValue(null),null);
});
test('reports isolate selected stats, map samples and operator picks',()=>{
  const report=buildInsights(fixture(),perspective,'ALL',1,now);
  assert.equal(report.totals.kills,5);assert.equal(report.roundCount,2);assert.equal(report.maps.length,2);assert.equal(report.participants.length,1);
  assert.equal(report.mostUsed.name,'Ash');assert.equal(report.mostUsed.picks,2);assert.equal(report.coverage.completeCoverage,100);
});
test('reports retain missing totals and measured coverage rather than showing partial zeros',()=>{
  const data=fixture();data.appearances[0].kills=null;
  const report=buildInsights(data,perspective,'ALL',1,now);
  assert.equal(report.totals.kills,null);assert.equal(report.totals.kd,null);assert.equal(report.coverage.completeCoverage,50);assert.equal(report.participants[0].kills,null);
});
test('map review threshold requires verified matches and preserves small samples in matrix',()=>{
  const data=fixture();data.matches[0].isCompleteMatch=false;
  const report=buildInsights(data,perspective,'ALL',2,now);assert.equal(report.weakestMap,null);assert.equal(report.maps.length,2);assert.equal(report.unknownMatches,1);
  const lower=buildInsights(data,perspective,'ALL',1,now);assert.equal(lower.weakestMap.key,'101');
});
test('ambiguous squad matches are excluded consistently from all report sections',()=>{
  const report=buildInsights(fixture(),{mode:'team',members:['a','b']},'ALL',1,now);
  assert.equal(report.overview.ambiguousMatches,1);assert.equal(report.roundCount,2);assert.equal(report.totals.kills,7);assert.equal(report.coverage.samples,2);
});
test('trend compares latest five verified results against previous five without unverified rows',()=>{
  const data=fixture();data.matches=[];data.rounds=[];data.appearances=[];
  for(let i=0;i<11;i++){
    const matchId='m'+i,roundId='r'+i;
    data.matches.push({matchId,playedAt:new Date(now-i*1000).toISOString(),roundCount:1,isCompleteMatch:i!==0});
    data.rounds.push({matchId,roundId,roundNumber:1,teamSlot:1,side:'Attack',won:i<=5});
    data.appearances.push({matchId,roundId,playerId:'a',teamIndex:1,kills:1,died:false,assists:0,headshots:0,operatorName:'Ash'});
  }
  const report=buildInsights(data,perspective,'ALL',1,now);
  assert.equal(report.trend.delta,100);assert.equal(report.trend.recentRate,100);assert.equal(report.trend.priorRate,0);assert.equal(report.trend.recentIds[0],'m1');
  data.matches.pop();assert.equal(buildInsights(data,perspective,'ALL',1,now).trend,null);
});
test('CSV exports selected report data, retains nulls, and neutralizes player-controlled formulas',()=>{
  const data=fixture();data.players[0].username='=DANGEROUS';data.appearances[0].kills=null;
  const csv=insightsCsv(buildInsights(data,perspective,'ALL',1,now));
  assert.match(csv,/'=DANGEROUS/);assert.doesNotMatch(csv,/Bob/);assert.match(csv,/"Kills","","2"/);
});
test('date filtering applies to comparisons and reports',()=>{
  const data=fixture();data.matches.forEach(m=>m.playedAt='2026-08-01T00:00:00Z');
  assert.equal(comparePlayers(data,'a','b','7D',false,now).a.rounds,0);
  const report=buildInsights(data,perspective,'30D',1,now);assert.equal(report.overview.matches.length,0);assert.equal(report.coverage.completeCoverage,null);
});
