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
const {analyzeMaps}=loadTs('src/data/mapAnalytics.ts');
const {resolveMap,displayMapLabel,setMapEvidence,setMapLinks}=loadTs('src/data/mapCatalog.ts');
const now=Date.parse('2026-10-14T12:00:00Z');
function fixture(){
  const match={matchId:'m',playedAt:'2026-10-12T12:00:00Z',mapName:'ClubHouseY10',mapId:407193663917,roundCount:3,isCompleteMatch:true};
  const rounds=[1,2,3].flatMap(roundNumber=>[0,1].map(teamSlot=>({roundId:'r'+roundNumber,matchId:'m',roundNumber,teamSlot,side:(roundNumber===2)===(teamSlot===1)?'Defense':'Attack',won:teamSlot===1?roundNumber!==2:roundNumber===2,site:roundNumber===3?'Site B':'Site A'})));
  const appearances=[1,2,3].flatMap(roundNumber=>[{roundId:'r'+roundNumber,matchId:'m',playerId:'a',teamIndex:1,kills:1,died:false,assists:0,headshots:0},{roundId:'r'+roundNumber,matchId:'m',playerId:'b',teamIndex:1,kills:1,died:false,assists:0,headshots:0},{roundId:'r'+roundNumber,matchId:'m',playerId:'enemy',teamIndex:0,kills:5,died:true,assists:0,headshots:0}]);
  return {matches:[match],rounds,appearances,players:[{playerId:'a',username:'Alice'},{playerId:'b',username:'Bob'},{playerId:'enemy',username:'Opponent'}]};
}
const player={mode:'player',members:['a']};
test('map outcomes follow either selected team index and never slot zero by default',()=>{
  const [a]=analyzeMaps(fixture(),player,'ALL',now).maps;
  const [b]=analyzeMaps(fixture(),{mode:'player',members:['enemy']},'ALL',now).maps;
  assert.equal(a.matchWins,1);assert.equal(a.winRate,67);assert.equal(b.matchLosses,1);assert.equal(b.winRate,33);
  assert.equal(a.attackRounds,2);assert.equal(a.attackWins,2);assert.equal(a.defenseRounds,1);assert.equal(a.defenseWins,0);
});
test('multiple participating roster members count a round and site once',()=>{
  const [map]=analyzeMaps(fixture(),{mode:'team',members:['a','b']},'ALL',now).maps;
  assert.equal(map.rounds,3);assert.equal(map.sites[0].rounds,2);assert.equal(map.sites[0].winRate,50);assert.equal(map.sites[1].winRate,100);
});
test('personal site samples include only rounds that player participated in',()=>{
  const data=fixture();data.appearances=data.appearances.filter(a=>a.playerId!=='a'||a.roundId==='r2');
  const [map]=analyzeMaps(data,player,'ALL',now).maps;
  assert.equal(map.rounds,1);assert.equal(map.losses,1);assert.equal(map.sites.length,1);assert.equal(map.sites[0].name,'Site A');
  assert.equal(map.matchWins,1);assert.equal(map.attackRounds,0);
});
test('unknown round results remain in tracked counts and out of rate denominators',()=>{
  const data=fixture();data.rounds.find(r=>r.roundId==='r2'&&r.teamSlot===1).won=null;
  const [map]=analyzeMaps(data,player,'ALL',now).maps;
  assert.equal(map.rounds,3);assert.equal(map.unknown,1);assert.equal(map.winRate,100);assert.equal(map.matchWinRate,null);assert.equal(map.unverifiedMatches,1);
  assert.equal(map.sites[0].unknown,1);assert.equal(map.sites[0].winRate,100);
});
test('unknown site or side remains explicit without a fabricated objective',()=>{
  const data=fixture();for(const r of data.rounds){r.site=null;r.side=null;r.won=null;}
  const [map]=analyzeMaps(data,player,'ALL',now).maps;
  assert.equal(map.sites[0].name,'Site not recorded');assert.equal(map.sites[0].winRate,null);assert.equal(map.attackRounds,0);assert.equal(map.unknown,3);
});
test('ambiguous squads and missing roster members produce no misleading map sample',()=>{
  assert.equal(analyzeMaps(fixture(),{mode:'team',members:['a','enemy']},'ALL',now).ambiguousMatches,1);
  assert.equal(analyzeMaps(fixture(),{mode:'team',members:['missing']},'ALL',now).maps.length,0);
});
test('map versions share overall totals while preserving original IDs',()=>{
  const data=fixture();data.matches.push({...data.matches[0],matchId:'old',mapId:837214085,playedAt:'2026-09-01T12:00:00Z'});
  data.rounds.push(...data.rounds.map(r=>({...r,matchId:'old',roundId:'old'+r.roundId})));
  data.appearances.push(...data.appearances.map(a=>({...a,matchId:'old',roundId:'old'+a.roundId})));
  assert.equal(analyzeMaps(data,player,'7D',now).maps.length,1);
  const maps=analyzeMaps(data,player,'ALL',now).maps;assert.equal(maps.length,1);assert.equal(maps[0].matches.length,2);assert.deepEqual(new Set(maps[0].matches.map(m=>m.mapId)),new Set([407193663917,837214085]));
});
test('known parser names are readable and catalog IDs resolve missing names',()=>{
  assert.equal(displayMapLabel('KafeDostoyevskyY10',413845419788),'Kafe Dostoyevsky');
  assert.equal(displayMapLabel('Map(407193663917)',407193663917),'Club House');
  assert.equal(resolveMap(null,413779563590).source,'catalog');assert.equal(displayMapLabel('Future Map',999),'Future Map');
});
test('bombsite evidence resolves unknown IDs into the same canonical map as manual entries',()=>{
  setMapEvidence({matches:[{matchId:'a',mapId:999}],rounds:[{matchId:'a',site:'2F Aviator Room, 2F Games Room'}]});
  const villa=resolveMap(null,999);assert.equal(villa.name,'Villa');assert.equal(villa.source,'inferred');assert.match(villa.evidence,/Aviator/);
  assert.equal(villa.key,resolveMap('Villa',null).key);
  assert.equal(resolveMap(null,998).source,'unknown');
  setMapEvidence({matches:[],rounds:[]});
});
test('missing, partial, or conflicting evidence does not guess a map',()=>{
  const matches=[{matchId:'a',mapId:999},{matchId:'b',mapId:999},{matchId:'c',mapId:998}];
  setMapEvidence({matches,rounds:[{matchId:'a',site:'2F Aviator Room / Games Room'},{matchId:'b',site:'2F Hookah Lounge / Billiards Room'},{matchId:'c',site:'Kitchen'}]});
  assert.equal(resolveMap(null,999).source,'unknown');assert.equal(resolveMap(null,998).source,'unknown');
  setMapEvidence({matches:[],rounds:[]});
});
test('manual corrections and known IDs win over automatic evidence; removing override restores inference',()=>{
  const data={matches:[{matchId:'a',mapId:999},{matchId:'b',mapId:407193663917}],rounds:[{matchId:'a',site:'2F Games Room / 2F Aviator Room'},{matchId:'b',site:'2F Games Room / 2F Aviator Room'}]};
  setMapEvidence(data);assert.equal(resolveMap(null,407193663917).name,'Club House');
  setMapLinks({revision:1,maps:[{collectorId:'999',map:'Chalet'}],sites:[]});assert.equal(resolveMap(null,999).name,'Chalet');assert.equal(resolveMap(null,999).source,'linked');
  setMapLinks({revision:2,maps:[],sites:[]});setMapEvidence(data);assert.equal(resolveMap(null,999).name,'Villa');
  setMapEvidence({matches:[],rounds:[]});
});
test('ambiguous approved aliases stay unresolved and evidence refresh removes stale inference',()=>{
  setMapLinks({revision:1,maps:[],sites:[{map:'Villa',alias:'Shared A / Shared B',site:'A'},{map:'Coastline',alias:'Shared A / Shared B',site:'B'}]});
  const matches=[{matchId:'a',mapId:999}];setMapEvidence({matches,rounds:[{matchId:'a',site:'Shared A / Shared B'}]});assert.equal(resolveMap(null,999).source,'unknown');
  setMapLinks({revision:2,maps:[],sites:[]});setMapEvidence({matches,rounds:[{matchId:'a',site:'2F Aviator Room / Games Room'}]});assert.equal(resolveMap(null,999).source,'inferred');
  setMapEvidence({matches,rounds:[]});assert.equal(resolveMap(null,999).source,'unknown');
});
