const {test}=require('node:test');
const assert=require('node:assert/strict');
const ts=require('typescript'),fs=require('node:fs'),path=require('node:path');
function modules(){const cache=new Map();return function load(file){const full=path.resolve(__dirname,'..',file);if(cache.has(full))return cache.get(full).exports;const m={exports:{}};cache.set(full,m);new Function('module','exports','require',ts.transpileModule(fs.readFileSync(full,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText)(m,m.exports,n=>n.startsWith('.')?load(path.relative(path.resolve(__dirname,'..'),path.resolve(path.dirname(full),n+'.ts'))):require(n));return m.exports;};}
test('manual names, parser aliases and versions share map identity; unresolved IDs stay separate',()=>{
 const load=modules(),c=load('src/data/mapCatalog.ts');
 assert.equal(c.resolveMap('Club House',null).key,c.resolveMap('ClubHouseY10','407193663917').key);
 assert.equal(c.resolveMap(null,'837214085').key,c.resolveMap('Club House',null).key);
 assert.notEqual(c.resolveMap(null,'999').key,c.resolveMap(null,'998').key);
 c.setMapLinks({revision:1,maps:[{collectorId:'999',map:'Club House'}],sites:[]});
 assert.equal(c.resolveMap(null,'999').key,c.resolveMap('Club House',null).key);
 c.setMapLinks({revision:2,maps:[],sites:[]});assert.equal(c.resolveMap(null,'999').source,'unknown');
});
test('site spelling and explicit aliases resolve within one map only',()=>{
 const c=modules()('src/data/mapCatalog.ts');
 assert.equal(c.resolveSite('Bank','B Lockers / CCTV Room'),'B Lockers / B CCTV Room');
 c.setMapLinks({revision:1,maps:[],sites:[{map:'Bank',alias:'Old site',site:'B Lockers / B CCTV Room'}]});
 assert.equal(c.resolveSite('Bank','Old site'),'B Lockers / B CCTV Room');
 assert.equal(c.resolveSite('Chalet','Old site'),'Old site');
 assert.equal(c.resolveSite('Bank',null),'Site not recorded');
});
test('linking regroups recorded stats without modifying original IDs, sites or totals',()=>{
 const load=modules(),c=load('src/data/mapCatalog.ts'),{analyzeMaps}=load('src/data/mapAnalytics.ts');
 const data={matches:[{matchId:'r',mapId:'999',mapName:null,roundCount:1,isCompleteMatch:true},{matchId:'m',mapId:null,mapName:'Bank',roundCount:1,isCompleteMatch:true}],rounds:['r','m'].map(id=>({matchId:id,roundId:id,teamSlot:0,roundNumber:1,won:true,side:'Attack',site:id==='r'?'Old site':'B Lockers / B CCTV Room'})),appearances:['r','m'].map(id=>({matchId:id,roundId:id,playerId:'a',teamIndex:0,kills:2,died:false,headshots:1})),players:[{playerId:'a',username:'A'}]};
 const snapshot=JSON.stringify(data),scope={mode:'player',members:['a']};
 assert.equal(analyzeMaps(data,scope,'ALL').maps.length,2);
 c.setMapLinks({revision:1,maps:[{collectorId:'999',map:'Bank'}],sites:[{map:'Bank',alias:'Old site',site:'B Lockers / B CCTV Room'}]});
 const result=analyzeMaps(data,scope,'ALL');assert.equal(result.maps.length,1);assert.equal(result.maps[0].wins,2);assert.equal(result.maps[0].sites[0].rounds,2);assert.equal(JSON.stringify(data),snapshot);
});
test('team view requires the complete roster on one side, including scoreboard-only matches',()=>{
 const {analyzeOverview}=modules()('src/data/overviewAnalytics.ts');
 const data={matches:['full','partial','opponents'].map(matchId=>({matchId,summaryScore:{wins:7,losses:2},roundCount:9})),rounds:[],players:[],appearances:[['full','a',0],['full','b',0],['partial','a',0],['opponents','a',0],['opponents','b',1]].map(([matchId,playerId,teamIndex])=>({matchId,playerId,teamIndex,roundId:matchId,kills:2,deaths:1,roundsRepresented:9,headshots:1}))};
 const team=analyzeOverview(data,{mode:'team',members:['a','b']},'ALL');assert.deepEqual(team.matches.map(m=>m.matchId),['full']);assert.equal(team.totalKills,4);
 assert.equal(analyzeOverview(data,{mode:'player',members:['a']},'ALL').matches.length,3);
});
