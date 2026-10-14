const {test}=require('node:test');
const assert=require('node:assert/strict');
const ts=require('typescript');
const fs=require('node:fs');
const path=require('node:path');
function loadTs(file){
  const code=fs.readFileSync(path.join(__dirname,'..',file),'utf8');
  const output=ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
  const module={exports:{}};
  new Function('module','exports','require',output)(module,module.exports,require);
  return module.exports;
}
const {analyzeOverview,asPercent}=loadTs('src/data/overviewAnalytics.ts');
const {cleanSquads}=loadTs('src/data/localSquads.ts');
function match(id,n=2){return {matchId:id,playedAt:'2026-10-12T12:00:00Z',mapName:'Chalet',mapId:2,matchType:'Ranked',gameMode:'Bomb',recordingProfileId:'rec',isCompleteMatch:true,roundCount:n};}
function pair(matchId,roundNumber,trackedSlot,side,trackedWon){
  const roundId=`${matchId}-r${roundNumber}`;
  return [
    {roundId,matchId,roundNumber,teamSlot:trackedSlot,side,won:trackedWon},
    {roundId,matchId,roundNumber,teamSlot:1-trackedSlot,side:side==='Attack'?'Defense':'Attack',won:!trackedWon}
  ];
}
function appearance(matchId,roundNumber,playerId,teamIndex,kills=1,died=false,headshots=0){return {roundId:`${matchId}-r${roundNumber}`,matchId,playerId,teamIndex,kills,died,assists:0,headshots,operatorName:'ASH'};}
const data={
  matches:[match('m1'),match('m2'),match('m3')],
  rounds:[...pair('m1',1,1,'Attack',true),...pair('m1',2,1,'Defense',false),...pair('m2',1,0,'Attack',true),...pair('m2',2,0,'Defense',true),...pair('m3',1,0,'Attack',true),...pair('m3',2,0,'Defense',false)],
  appearances:[appearance('m1',1,'A',1,2,false,1),appearance('m1',2,'A',1,1,true,0),
    appearance('m2',1,'A',0,1,false,0),appearance('m2',2,'A',0,0,true,0),
    appearance('m3',1,'A',0,4,false,2),appearance('m3',1,'B',1,3,false,1)],
  players:[{playerId:'A',profileId:'rec',username:'Alice'},{playerId:'B',profileId:'b',username:'Bob'}],
  perspective:'selected-player-or-squad',rosterStorage:'local-browser'
};
test('player perspective follows teamIndex 1 and 0 without counting opponents',()=>{
  const actual=analyzeOverview(data,{mode:'player',members:['A']},'ALL');
  assert.equal(actual.matches.length,3);
  assert.equal(actual.rounds,5); // m3 contains only the round in which A played
  assert.equal(actual.totalKills,8);
  assert.equal(actual.attackWins,3);
  assert.equal(actual.defenseRounds,2);
});
test('squad excludes ambiguous matches with selected members on opposing sides',()=>{
  const actual=analyzeOverview(data,{mode:'team',members:['A','B']},'ALL');
  assert.equal(actual.ambiguousMatches,1);
  assert.equal(actual.matches.length,2);
  assert.equal(actual.wins,1);
  assert.equal(actual.losses,0); // m1 was a 1-1 tie, not a decided loss
  assert.equal(actual.totalKills,4);
  assert.equal(actual.rounds,4);
  assert.equal(actual.attackWins,2);
  assert.equal(actual.attackRounds,2);
  assert.equal(actual.defenseWins,1);
  assert.equal(actual.defenseRounds,2);
  assert.equal(asPercent(actual.attackWins+actual.defenseWins,actual.attackRounds+actual.defenseRounds),75);
});
test('incomplete results are not decided matches',()=>{
  const copy={...data,matches:data.matches.map(m=>({...m,isCompleteMatch:false}))};
  const actual=analyzeOverview(copy,{mode:'player',members:['A']},'ALL');
  assert.equal(actual.decided.length,0);
  assert.equal(actual.rounds,5);
});
test('headshot-rate coverage only uses known headshot kills',()=>{
  const copy={...data,appearances:data.appearances.map(a=>a.roundId==='m1-r1'&&a.playerId==='A'?{...a,headshots:null}:a)};
  const actual=analyzeOverview(copy,{mode:'team',members:['A']},'ALL');
  assert.equal(actual.hsTotalKills,8);
  assert.equal(actual.hsEligibleKills,6);
  assert.equal(actual.hs,Math.round(100*2/6));
});
test('squad roster sanitization limits to five unique IDs',()=>{
  const out=cleanSquads([{id:'s',name:' Squaders ',members:['a','a','b','c','d','e','f']},{id:'s',name:'duplicate',members:[]}]);
  assert.deepEqual(out,[{id:'s',name:'Squaders',members:['a','b','c','d','e']}]);
});
test('donut uses weighted overall wins rather than attack-only percentage',()=>{
  // Example: 26/52 attack rounds and 26/46 defense rounds.
  assert.equal(asPercent(26,52),50);
  assert.equal(asPercent(26,46),57);
  assert.equal(asPercent(26+26,52+46),53);
});
