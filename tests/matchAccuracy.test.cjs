const {test}=require('node:test');
const assert=require('node:assert/strict');
const ts=require('typescript');
const fs=require('node:fs');
const path=require('node:path');
function loadTs(file){
  const full=path.resolve(__dirname,'..',file);
  const code=fs.readFileSync(full,'utf8');
  const output=ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
  const module={exports:{}};
  const localRequire=name=>name.startsWith('.')?loadTs(path.relative(path.resolve(__dirname,'..'),path.resolve(path.dirname(full),name+'.ts'))):require(name);
  new Function('module','exports','require',output)(module,module.exports,localRequire);
  return module.exports;
}
const {resolveMatchReport,matchCsv,getRoundPerspective}=loadTs('src/data/matchAnalytics.ts');
function report(slot=1){
  const match={matchId:'m1',playedAt:'2026-10-12T12:00:00Z',mapName:'Chalet',mapId:2,matchType:'Ranked',gameMode:'Bomb',recordingProfileId:'rec',isCompleteMatch:true,roundCount:3};
  const rounds=[1,2,3].map(roundNumber=>({roundId:'r'+roundNumber,matchId:'m1',roundNumber,site:'Site',recordedAt:match.playedAt}));
  const outcomes=[true,false,true];
  const teams=rounds.flatMap((round,i)=>[
    {roundId:round.roundId,teamSlot:slot,side:i===1?'Defense':'Attack',won:outcomes[i],scoreAfter:i===0?1:i===1?1:2},
    {roundId:round.roundId,teamSlot:1-slot,side:i===1?'Attack':'Defense',won:!outcomes[i],scoreAfter:i===0?0:1}
  ]);
  const appearances=rounds.flatMap((round,i)=>[
    {roundId:round.roundId,matchId:'m1',roundNumber:round.roundNumber,playerId:'A',username:'Alice',teamIndex:slot,operatorName:'ASH',kills:i+1,died:i===1,assists:0,headshots:1,damageDealt:100,damageTaken:25},
    {roundId:round.roundId,matchId:'m1',roundNumber:round.roundNumber,playerId:'T',username:'Teammate',teamIndex:slot,operatorName:'ACE',kills:4,died:false,assists:2,headshots:0,damageDealt:150,damageTaken:0},
    {roundId:round.roundId,matchId:'m1',roundNumber:round.roundNumber,playerId:'B',username:'Bob',teamIndex:1-slot,operatorName:'MIRA',kills:5,died:true,assists:2,headshots:2,damageDealt:500,damageTaken:100}
  ]);
  return {match,rounds,teams,appearances,events:[]};
}
const player={mode:'player',members:['A']};

test('report follows either replay team index and limits totals to selected players',()=>{
  for(const slot of [0,1]){
    const view=resolveMatchReport(report(slot),player);
    assert.equal(view.resolved.slot,slot);
    assert.equal(view.resolved.outcome,'WIN');
    assert.equal(view.metrics.kills,6);
    assert.equal(view.metrics.deaths,1);
    assert.equal(view.metrics.kd,'6.00');
    assert.equal(view.metrics.hs,50);
    assert.equal(view.metrics.attackWins,2);
    assert.equal(view.metrics.defenseWins,0);
    assert.equal(view.teammates.length,2);
    assert.equal(view.opponents.length,1);
    assert.equal(view.opponents[0].playerId,'B');
    assert.equal(view.selectedStats[0].playerId,'A');
    assert.equal(view.trackedRoundCount,3);
    assert.equal(getRoundPerspective(view,'r2').won,false);
  }
});

test('squad totals sum only its selected players, with each round counted once',()=>{
  const view=resolveMatchReport(report(),{mode:'team',members:['A','T']});
  assert.equal(view.metrics.kills,18);
  assert.equal(view.metrics.assists,6);
  assert.equal(view.metrics.roundWins,2);
  assert.equal(view.metrics.roundLosses,1);
  assert.equal(view.trackedRoundCount,3);
  assert.equal(view.rounds[0].selectedPresent,2);
  assert.equal(view.rounds[0].metrics.kills,5);
});

test('opposing squad members and unknown side data never resolve to slot zero',()=>{
  const conflicting=resolveMatchReport(report(),{mode:'team',members:['A','B']});
  assert.equal(conflicting.resolved,null);
  assert.match(conflicting.reason,/conflicting/);
  assert.equal(conflicting.metrics.kills,null);
  assert.equal(conflicting.selectedStats.length,0);
  const source=report();
  source.appearances.find(row=>row.playerId==='A').teamIndex=null;
  const unknown=resolveMatchReport(source,player);
  assert.equal(unknown.resolved,null);
  assert.equal(unknown.rounds[0].won,null);
});

test('missing measurements retain known subtotals without measured zero or invented rates',()=>{
  const source=report();
  const row=source.appearances.find(row=>row.playerId==='A');
  row.kills=null;row.died=null;row.assists=null;row.headshots=null;row.damageDealt=null;
  const view=resolveMatchReport(source,player);
  assert.equal(view.metrics.kills,null);
  assert.equal(view.metrics.deaths,null);
  assert.equal(view.metrics.assists,null);
  assert.equal(view.metrics.headshots,null);
  assert.equal(view.metrics.damageDealt,null);
  assert.equal(view.metrics.kd,null);
  assert.equal(view.metrics.hs,null);
  assert.equal(view.metrics.knownTotals.kills,5);
  assert.equal(view.metrics.knownTotals.deaths,1);
  assert.equal(view.metrics.coverage.kills,2);
  assert.equal(view.selectedStats[0].kills,null);
  assert.equal(view.rounds[0].metrics.kills,null);
  assert.equal(view.opponents[0].kills,15);
});

test('unknown outcomes remain in round explorer and are excluded from outcome rate denominators',()=>{
  const source=report();
  source.teams.filter(team=>team.roundId==='r1').forEach(team=>team.won=null);
  source.teams.filter(team=>team.roundId==='r1').forEach(team=>team.scoreAfter=null);
  const view=resolveMatchReport(source,player);
  assert.equal(view.resolved.outcome,'UNKNOWN');
  assert.equal(view.rounds.length,3);
  assert.equal(view.rounds[0].outcome,'UNKNOWN');
  assert.equal(view.rounds[0].scoreAfter,null);
  assert.equal(view.metrics.unknownRounds,1);
  assert.equal(view.metrics.roundWins,1);
  assert.equal(view.metrics.roundLosses,1);
  assert.equal(view.metrics.attackRounds,1);
  assert.equal(view.trackedRoundCount,3);
});

test('incomplete matches are undecided and absent rounds do not contribute personal totals',()=>{
  const source=report();
  source.match.isCompleteMatch=false;
  source.appearances=source.appearances.filter(row=>!(row.playerId==='A'&&row.roundId==='r3'));
  const view=resolveMatchReport(source,player);
  assert.equal(view.resolved.outcome,'UNKNOWN');
  assert.equal(view.rounds.length,3);
  assert.equal(view.trackedRoundCount,2);
  assert.equal(view.rounds[2].participated,false);
  assert.equal(view.metrics.roundWins,1);
  assert.equal(view.metrics.kills,3);
  assert.equal(view.rounds[2].metrics.kills,null);
});

test('unknown player IDs leave report unscoped rather than choosing an unrelated player',()=>{
  const view=resolveMatchReport(report(),{mode:'player',members:['MISSING']});
  assert.equal(view.resolved,null);
  assert.match(view.reason,/did not appear/);
  assert.equal(view.trackedRoundCount,0);
  assert.equal(view.metrics.kd,null);
  assert.equal(view.teammates.length,0);
  assert.equal(view.opponents.length,0);
});

test('events classify from exact round player IDs and preserve recorded sequence',()=>{
  const source=report();
  const event=(id,sequence,actor,target)=>({eventId:id,roundId:'r1',roundNumber:1,eventSequence:sequence,eventType:'Kill',actorPlayerId:actor,targetPlayerId:target,actorUsername:'Alice',targetUsername:'Bob',timeRemainingSeconds:10,isHeadshot:false,weaponId:null});
  source.events=[event('opponent',3,'B','A'),event('unknown',4,null,'B'),event('selected',1,'A','B'),event('friendly-fire',2,'T','A')];
  const events=resolveMatchReport(source,player).rounds[0].events;
  assert.deepEqual(events.map(e=>e.eventSequence),[1,2,3,4]);
  assert.deepEqual(events.map(e=>e.kind),['kill','friendly-fire','death','other']);
  assert.equal(events[0].actorAffiliation,'selected');
  assert.equal(events[3].actorAffiliation,'unknown');
});

test('invalid headshot counts cannot produce a rate over 100 percent',()=>{
  const source=report();
  source.appearances.find(row=>row.playerId==='A').headshots=10;
  assert.equal(resolveMatchReport(source,player).metrics.hs,null);
});

test('CSV exports only provided filtered matches and escapes imported labels',()=>{
  const match=resolveMatchReport(report(),player).resolved;
  const csv=matchCsv([{...match,mapName:'=HYPERLINK("bad")'}]);
  assert.equal(csv.split('\r\n').length,2);
  assert.ok(csv.includes('"\'=HYPERLINK(""bad"")"'));
  assert.ok(csv.includes('"WIN"'));
  assert.equal(matchCsv([]).split('\r\n').length,1);
});
