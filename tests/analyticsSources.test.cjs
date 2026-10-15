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
