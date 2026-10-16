const {test}=require('node:test');
const assert=require('node:assert/strict');
const ts=require('typescript'),fs=require('node:fs'),path=require('node:path');
function modules(){const cache=new Map();return function load(file){const full=path.resolve(__dirname,'..',file);if(cache.has(full))return cache.get(full).exports;const m={exports:{}};cache.set(full,m);new Function('module','exports','require',ts.transpileModule(fs.readFileSync(full,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText)(m,m.exports,n=>n.startsWith('.')?load(path.relative(path.resolve(__dirname,'..'),path.resolve(path.dirname(full),n+'.ts'))):require(n));return m.exports;};}

test('playlist aliases keep manual and replay records in the same explicit bucket',()=>{
 const {matchPlaylist}=modules()('src/data/playlists.ts');
 for(const [raw,expected] of [['Ranked','ranked'],['Ranked Bomb','ranked'],['Unranked','unranked'],['Standard Bomb','unranked'],['QuickMatch','casual'],['Quick Match','casual'],['Casual Bomb','casual'],['Custom Bomb','other'],[null,'other']])assert.equal(matchPlaylist(raw),expected);
});
test('all analytics receive only the selected playlist; totals and raw data remain intact',()=>{
 const load=modules(),{filterPlaylist}=load('src/data/playlists.ts'),{analyzeOverview}=load('src/data/overviewAnalytics.ts'),{analyzeMaps}=load('src/data/mapAnalytics.ts'),{analyzePlayers}=load('src/data/playerAnalytics.ts'),{analyzeOperators}=load('src/data/operatorAnalytics.ts');
 const types=['Ranked','Standard','QuickMatch','Custom Bomb'];
 const data={matches:types.map((matchType,i)=>({matchId:String(i),matchType,mapName:'Bank',mapId:null,roundCount:1,isCompleteMatch:true})),rounds:types.map((_,i)=>({matchId:String(i),roundId:String(i),roundNumber:1,teamSlot:0,side:'Attack',won:true})),appearances:types.map((_,i)=>({matchId:String(i),roundId:String(i),playerId:'a',teamIndex:0,kills:i+1,died:false,headshots:0,operatorName:'Ash'})),players:[{playerId:'a',username:'A'}]};
 const snapshot=JSON.stringify(data),scope={mode:'player',members:['a']};
 for(const [i,playlist] of ['ranked','unranked','casual','other'].entries()){
  const filtered=filterPlaylist(data,playlist);assert.equal(filtered.matches.length,1);assert.equal(filtered.rounds.length,1);assert.equal(filtered.appearances.length,1);
  assert.equal(analyzeOverview(filtered,scope,'ALL').totalKills,i+1);assert.equal(analyzeMaps(filtered,scope,'ALL').maps[0].matches.length,1);assert.equal(analyzePlayers(filtered,'ALL')[0].kills,i+1);
 }
 assert.equal(JSON.stringify(data),snapshot);
});
test('manual Standard and Casual entries use their own completion limits',()=>{
 const {manualErrors}=modules()('src/data/manualMatches.ts');
 const base={playerId:'a',username:'A',platform:'PC',map:'Bank',target:4,playedAt:'2026-10-01T00:00:00Z',notes:''};
 const round={won:true,side:'Attack',operator:'Ash',site:'',kills:1,died:false,assists:0,headshots:0,notes:''};
 assert.deepEqual(manualErrors({...base,mode:'Casual Bomb',rounds:Array(3).fill(round)}),[]);
 assert.ok(manualErrors({...base,mode:'Ranked Bomb',rounds:Array(3).fill(round)}).length);
 assert.deepEqual(manualErrors({...base,mode:'Standard Bomb',rounds:Array(4).fill(round)}),[]);
 assert.ok(manualErrors({...base,mode:'Casual Bomb',rounds:Array(4).fill(round)}).length);
});
