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

const {selectSources,sourceLabel}=loadTs('src/data/analyticsSources.ts');
const {analyzeOverview}=loadTs('src/data/overviewAnalytics.ts');
const {analyzeMaps}=loadTs('src/data/mapAnalytics.ts');
const {analyzeOperators}=loadTs('src/data/operatorAnalytics.ts');
const {analyzePlayers}=loadTs('src/data/playerAnalytics.ts');
const {buildInsights,comparePlayers,insightsCsv}=loadTs('src/data/reportAnalytics.ts');
const {manualMatchReport}=loadTs('src/data/manualMatchReport.ts');
const {resolveMatchReport,matchCsv}=loadTs('src/data/matchAnalytics.ts');
const perspective={mode:'player',members:['p']};
const record={id:'one',status:'submitted',payload:{playerId:'p',username:'One',map:'Clubhouse',mode:'Ranked Bomb',playedAt:'2026-10-01T00:00:00Z',rounds:Array.from({length:4},()=>({side:'Attack',operator:'Ash',site:'CCTV',won:true,kills:2,died:false,assists:1,headshots:1,notes:''}))}};
function fixture(){return {matches:[{matchId:'replay',mapId:null,mapName:'Clubhouse',roundCount:1,isCompleteMatch:true,playedAt:'2026-10-01T00:00:00Z'}],rounds:[{roundId:'r',matchId:'replay',roundNumber:1,teamSlot:0,side:'Defense',won:false}],players:[{playerId:'p',username:'One',profileId:null}],appearances:[{roundId:'r',matchId:'replay',playerId:'p',teamIndex:0,kills:1,died:true,assists:0,headshots:0,operatorName:'Mute'}]};}
test('three source modes isolate drafts and do not mutate shared records',()=>{const base=fixture(),draft={...record,id:'draft',status:'draft'};assert.equal(selectSources(base,[record,draft],'replay').matches.length,1);const manual=selectSources(base,[record,draft],'manual');assert.equal(manual.matches.length,1);assert.equal(manual.appearances.length,4);assert.equal(selectSources(base,[record,draft],'combined').matches.length,2);assert.equal(base.matches.length,1);assert.equal(sourceLabel(manual.matches[0]),'MANUAL / UNVERIFIED');});
test('combined sources update overview, players, maps, operators and insights consistently',()=>{const data=selectSources(fixture(),[record],'combined');const view=analyzeOverview(data,perspective,'ALL');assert.equal(view.wins,1);assert.equal(view.losses,1);assert.equal(view.totalKills,9);assert.equal(view.rounds,5);const player=analyzePlayers(data,'ALL')[0];assert.equal(player.kills,9);assert.equal(player.winRate,50);const maps=analyzeMaps(data,perspective,'ALL').maps;assert.equal(maps.length,1);assert.equal(maps[0].matchWinRate,50);assert.equal(maps[0].attackRounds,4);const ops=analyzeOperators(data,perspective,'ALL').operators;assert.equal(ops.find(o=>o.name==='Ash').picks,4);const insights=buildInsights(data,perspective,'ALL',1);assert.equal(insights.totals.kills,9);assert.match(insightsCsv(insights),/Manual \/ unverified/);assert.match(matchCsv(view.matches),/manual \/ unverified/);});
test('manual reports resolve scores and round stats without inventing events or damage',()=>{const report=manualMatchReport(record);const view=resolveMatchReport(report,perspective);assert.equal(view.resolved.outcome,'WIN');assert.equal(view.resolved.source,'manual');assert.equal(view.metrics.kills,8);assert.equal(view.rounds.length,4);assert.equal(report.events.length,0);assert.equal(report.appearances[0].damageDealt,null);assert.equal(report.teams.at(-2).scoreAfter,4);assert.equal(report.teams.at(-1).scoreAfter,0);assert.throws(()=>manualMatchReport({...record,status:'draft'}));});
test('missing manual stats remain unknown when combined with measured replay stats',()=>{const incomplete={...record,payload:{...record.payload,rounds:record.payload.rounds.map(r=>({...r,kills:null,headshots:null}))}};const player=analyzePlayers(selectSources(fixture(),[incomplete],'combined'),'ALL')[0];assert.equal(player.kills,null);assert.equal(player.kd,null);assert.equal(player.headshots,null);});


test('cross-account shared IDs remain distinct in Combined lists and Match Center reports',()=>{
 const a={...record,id:'owner-a:same-local-id'};
 const b={...record,id:'owner-b:same-local-id',payload:{...record.payload,playerId:'friend',username:'Friend'}};
 const data=selectSources(fixture(),[a,b],'combined');
 assert.deepEqual(new Set(data.matches.map(m=>m.matchId)),new Set(['replay','manual:owner-a:same-local-id','manual:owner-b:same-local-id']));
 const friend=analyzePlayers(data,'ALL').find(p=>p.playerId==='friend');
 assert.equal(friend.kills,8);
 const view=analyzeOverview(data,{mode:'player',members:['friend']},'ALL');
 assert.equal(view.matches.length,1);
 assert.equal(view.matches[0].matchId,'manual:owner-b:same-local-id');
 const report=manualMatchReport(b);
 assert.equal(report.match.matchId,view.matches[0].matchId);
 assert.equal(resolveMatchReport(report,{mode:'player',members:['friend']}).metrics.kills,8);
 assert.equal(selectSources(fixture(),[a,b],'replay').matches.length,1);
});

const {compareKd}=loadTs('src/data/kdSort.ts');
function tenPlayerRecord(summaryOnly=false){
 const roster=Array.from({length:10},(_,i)=>({playerId:'manual-player:'+i,username:'Player '+i,teamIndex:i<5?0:1}));
 const p={...record.payload,roster,rounds:record.payload.rounds.map(r=>({...r,players:roster.map(p=>({playerId:p.playerId,operator:p.teamIndex===0?'Ash':'Smoke',kills:p.teamIndex===0?1:0,died:p.teamIndex===1,assists:0,headshots:0}))}))};
 if(summaryOnly){p.rounds=[];p.summary={wins:4,losses:0,players:roster.map(p=>({playerId:p.playerId,kills:p.teamIndex===0?4:0,deaths:p.teamIndex===0?0:4,assists:0,headshots:0}))};}
 return {...record,id:'ten',payload:p};
}
test('ten-player manual match attributes both teams and all stats across analytics',()=>{
 const r=tenPlayerRecord(),data=selectSources(fixture(),[r],'manual');
 assert.equal(data.players.length,10);assert.equal(data.matches.length,1);assert.equal(data.appearances.length,40);
 const players=analyzePlayers(data,'ALL');assert.equal(players[0].wins,1);assert.equal(players[0].kills,4);assert.equal(players[5].losses,1);assert.equal(players[5].deaths,4);
 const report=resolveMatchReport(manualMatchReport(r),{mode:'player',members:['manual-player:5']});
 assert.equal(report.resolved.outcome,'LOSS');assert.equal(report.teammates.length,5);assert.equal(report.opponents.length,5);assert.equal(report.metrics.deaths,4);assert.equal(report.rounds.length,4);
 assert.equal(analyzeMaps(data,{mode:'player',members:['manual-player:5']},'ALL').maps[0].matchLosses,1);
});
test('scoreboard-only entries preserve totals without inventing rounds, sites or operators',()=>{
 const r=tenPlayerRecord(true),data=selectSources(fixture(),[r],'manual'),scope={mode:'player',members:['manual-player:5']};
 assert.equal(data.rounds.length,0);assert.equal(data.appearances.length,10);
 const profile=analyzePlayers(data,'ALL').find(p=>p.playerId==='manual-player:5');assert.equal(profile.deaths,4);assert.equal(profile.rounds,4);assert.equal(profile.kd,'0.00');assert.equal(profile.losses,1);assert.equal(profile.operators.length,0);
 const overview=analyzeOverview(data,scope,'ALL');assert.equal(overview.roundLosses,4);assert.equal(overview.totalDeaths,4);assert.equal(overview.rounds,4);assert.equal(overview.defenseRounds,0);
 const maps=analyzeMaps(data,scope,'ALL').maps;assert.equal(maps[0].rounds,4);assert.equal(maps[0].sites.length,0);
 assert.equal(analyzeOperators(data,scope,'ALL').operators.length,0);
 const report=resolveMatchReport(manualMatchReport(r),scope);assert.equal(report.metrics.deaths,4);assert.equal(report.rounds.length,0);assert.equal(report.trackedRoundCount,4);assert.equal(report.resolved.losses,4);
 const insights=buildInsights(data,scope,'ALL',1);assert.equal(insights.totals.deaths,4);assert.equal(insights.coverage.completeCoverage,100);
});
test('K/D arrows sort numerically, keep unknown last and handle zero deaths',()=>{
 const values=['2.00',null,'∞','0.50','10.00','—'];
 assert.deepEqual([...values].sort((a,b)=>compareKd(a,b,'asc')),['0.50','2.00','10.00','∞',null,'—']);
 assert.deepEqual([...values].sort((a,b)=>compareKd(a,b,'desc')),['∞','10.00','2.00','0.50',null,'—']);
});
