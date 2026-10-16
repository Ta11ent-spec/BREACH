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
const {blankImpact,impactTotals,impactErrors,impactGroupErrors}=loadTs('src/data/impact.ts');
const {withManualMatches}=loadTs('src/data/manualMatches.ts');
const {manualMatchReport}=loadTs('src/data/manualMatchReport.ts');
test('impact coverage excludes missing data and never merges teamkills with enemy openings',()=>{
 const impact={...blankImpact(),openingKills:1,openingDeaths:0,openingTeamkills:1,clutches:[0,1,0,0,0]};
 const r=impactTotals([{impact},{},{roundsRepresented:4,impact:{...blankImpact(),openingKills:2}}]);
 assert.equal(r.rounds,6);assert.deepEqual(r.fields.openingKills,{value:3,covered:5});assert.deepEqual(r.fields.openingTeamkills,{value:1,covered:1});assert.deepEqual(r.clutches[1],{value:1,covered:1});
 assert.equal(impactTotals([{}]).fields.openingKills.value,null);
});
test('manual impact validation rejects contradictions but permits unknowns',()=>{
 assert.equal(impactErrors(blankImpact(),1,null,null).length,0);
 assert.ok(impactErrors({...blankImpact(),openingKills:1},1,0,null).length);
 assert.ok(impactErrors({...blankImpact(),clutches:[0,0,1,0,0]},1,1,0,0).length);
 assert.ok(impactErrors({...blankImpact(),clutches:[1,1,0,0,0]},1,3,0,1).length);
 assert.ok(impactErrors({...blankImpact(),openingDeaths:0.5},1,2,1).length);
 assert.ok(impactGroupErrors([{team:0,impact:{...blankImpact(),openingKills:1}},{team:0,impact:{...blankImpact(),openingDeaths:1}}],1).length);
});
test('manual round and final scoreboard impact survive analytics and report exports without fake rounds',()=>{
 const impact={...blankImpact(),openingKills:1,clutches:[0,1,0,0,0]};
 const base={matches:[],rounds:[],appearances:[],players:[]};
 const payload={playerId:'a',username:'A',map:'Bank',mode:'Ranked Bomb',playedAt:'2026-10-16T12:00:00Z',rounds:[{side:'Attack',won:true,kills:2,died:false,assists:0,headshots:1,impact}]};
 const rec={id:'x',status:'submitted',payload};
 assert.deepEqual(withManualMatches(base,[rec]).appearances[0].impact,impact);
 assert.deepEqual(manualMatchReport(rec).appearances[0].impact,impact);
 const summary={...rec,payload:{...payload,roster:[{playerId:'a',username:'A',teamIndex:0}],rounds:[],summary:{wins:4,losses:0,players:[{playerId:'a',kills:2,deaths:0,assists:0,headshots:1,impact}]}}};
 const data=withManualMatches(base,[summary]);assert.equal(data.rounds.length,0);assert.equal(data.appearances[0].roundsRepresented,4);assert.deepEqual(data.appearances[0].impact,impact);assert.deepEqual(manualMatchReport(summary).appearances[0].impact,impact);
});
