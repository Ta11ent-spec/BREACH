// Fictional demo fixtures and deterministic match generator. NEVER production player data.
export const OUR = 'NOVA UNIT';
export const players = [
  {id:'vex',name:'VEX',tag:'Vexx.NOVA',real:'Alex Morgan',role:'IGL / FLEX',specialty:'Shot calling & utility',initials:'VX',color:'#ff8e5e',mains:['Ace','Mira','Buck'],number:'01'},
  {id:'ghost',name:'GHOST',tag:'Ghost.NOVA',real:'Jordan Blake',role:'ENTRY FRAGGER',specialty:'Opening duels & map control',initials:'GH',color:'#73baf8',mains:['Ash','Jäger','Iana'],number:'02'},
  {id:'rook',name:'ROOK',tag:'Rook.NOVA',real:'Sam Rivera',role:'ANCHOR / SUPPORT',specialty:'Site setup & executes',initials:'RK',color:'#eeb578',mains:['Smoke','Thermite','Mute'],number:'03'},
  {id:'echo',name:'ECHO',tag:'Echo.NOVA',real:'Taylor Brooks',role:'FLEX / INTEL',specialty:'Information & flank watch',initials:'EC',color:'#bf95fb',mains:['Zero','Valkyrie','Solis'],number:'04'},
  {id:'blitz',name:'BLITZ',tag:'Blitz.NOVA',real:'Casey Bennett',role:'SECOND ENTRY',specialty:'Trades & site pressure',initials:'BZ',color:'#f47f94',mains:['Zofia','Azami','Sledge'],number:'05'}
];
export const enemies = ['BLKOUT','CIPHER','RAZOR','ONYX','SPECTRE'];
export const maps = [
  {id:'clubhouse',name:'Clubhouse',code:'CLB',site:'CCTV / Cash',type:'Tactical compound',color:'#c19684'},
  {id:'oregon',name:'Oregon',code:'ORG',site:'Laundry / Supply',type:'Industrial farmhouse',color:'#cda57d'},
  {id:'bank',name:'Bank',code:'BNK',site:'Lockers / CCTV',type:'Urban high-rise',color:'#8caddc'},
  {id:'chalet',name:'Chalet',code:'CHL',site:'Wine / Snowmobile',type:'Alpine residence',color:'#c0a3d8'},
  {id:'kafe',name:'Kafe Dostoyevsky',code:'KFE',site:'Kitchen / Service',type:'Downtown landmark',color:'#e1aa7c'},
  {id:'border',name:'Border',code:'BRD',site:'Armory / Archives',type:'Border checkpoint',color:'#8bb6a9'}
];
export const operators = [
 {name:'Ace',side:'ATK',role:'Hard breach',pick:74,win:64,kd:1.48,color:'#63b7d3'},
 {name:'Ash',side:'ATK',role:'Entry',pick:69,win:58,kd:1.63,color:'#d1a37c'},
 {name:'Buck',side:'ATK',role:'Soft breach',pick:57,win:61,kd:1.39,color:'#cda492'},
 {name:'Iana',side:'ATK',role:'Intel / entry',pick:53,win:56,kd:1.31,color:'#b7afea'},
 {name:'Thermite',side:'ATK',role:'Hard breach',pick:49,win:63,kd:1.14,color:'#e6ae7b'},
 {name:'Zofia',side:'ATK',role:'Flex / entry',pick:44,win:55,kd:1.20,color:'#dba9a3'},
 {name:'Zero',side:'ATK',role:'Intel',pick:39,win:59,kd:1.27,color:'#a2bcb4'},
 {name:'Sledge',side:'ATK',role:'Soft breach',pick:33,win:54,kd:1.22,color:'#c4a090'},
 {name:'Mira',side:'DEF',role:'Anchor / intel',pick:72,win:69,kd:1.24,color:'#d9a3bc'},
 {name:'Jäger',side:'DEF',role:'Anti-projectile',pick:68,win:62,kd:1.47,color:'#c6b780'},
 {name:'Smoke',side:'DEF',role:'Area denial',pick:61,win:65,kd:1.18,color:'#86ba94'},
 {name:'Valkyrie',side:'DEF',role:'Intel / roam',pick:59,win:63,kd:1.31,color:'#90b9ce'},
 {name:'Azami',side:'DEF',role:'Setup / denial',pick:56,win:60,kd:1.44,color:'#cda8c9'},
 {name:'Mute',side:'DEF',role:'Anti-intel',pick:48,win:62,kd:1.08,color:'#d1afa0'},
 {name:'Solis',side:'DEF',role:'Roam / intel',pick:43,win:57,kd:1.26,color:'#bdb1df'},
 {name:'Wamai',side:'DEF',role:'Anti-projectile',pick:37,win:59,kd:1.22,color:'#c2c7cc'}
];
export const fixtures = [
 ['MX-2084','2026-10-12','Clubhouse','NIGHTSHIFT',7,5,'Ranked'],
 ['MX-2083','2026-10-11','Oregon','BLACKSITE',7,4,'Ranked'],
 ['MX-2082','2026-10-10','Bank','VORTEX',4,7,'Ranked'],
 ['MX-2081','2026-10-09','Chalet','ECLIPSE',7,3,'Scrim'],
 ['MX-2080','2026-10-08','Kafe Dostoyevsky','REVENANT',7,5,'Ranked'],
 ['MX-2079','2026-10-06','Border','HAVOC',5,7,'Scrim'],
 ['MX-2078','2026-10-05','Clubhouse','ONYX CREW',7,4,'Ranked'],
 ['MX-2077','2026-10-03','Oregon','BLACKSITE',7,2,'Ranked'],
 ['MX-2076','2026-09-30','Chalet','AFTERMATH',5,7,'Ranked'],
 ['MX-2075','2026-09-27','Bank','VEIL',7,5,'Scrim'],
 ['MX-2074','2026-09-25','Kafe Dostoyevsky','SPECTRAL',7,4,'Ranked'],
 ['MX-2073','2026-09-22','Border','CIPHER',3,7,'Ranked'],
 ['MX-2072','2026-09-19','Oregon','OVERWATCH',7,5,'Scrim'],
 ['MX-2071','2026-09-16','Clubhouse','VOID',4,7,'Ranked'],
 ['MX-2070','2026-09-13','Chalet','ECLIPSE',7,2,'Ranked'],
 ['MX-2069','2026-09-10','Bank','NIGHTSHIFT',7,5,'Ranked']
];
function rng(seed:number) { let s=seed >>> 0; return () => {s=(1664525*s+1013904223)>>>0; return s/4294967296;}; }
function pick<T>(a:T[],r:()=>number):T { return a[Math.floor(r()*a.length)]; }
function makeMatches(){
 const r=rng(281023);
 return fixtures.map((f:any,fi:number)=>{
  const [id,date,mapName,opponent,us,them,mode]=f;
  const total=us+them, result=us>them?'WIN':'LOSS';
  let outcomes:Array<'WIN'|'LOSS'>=[];
  for(let i=0;i<us;i++)outcomes.push('WIN');
  for(let i=0;i<them;i++)outcomes.push('LOSS');
  for(let i=outcomes.length-2;i>0;i--){let j=Math.floor(r()*(i+1));[outcomes[i],outcomes[j]]=[outcomes[j],outcomes[i]];}
  const wanted=outcomes.indexOf(result); outcomes.splice(wanted,1); outcomes.push(result);
  const rounds=outcomes.map((outcome:any,ri:number)=>{
    const side=(ri<6?(fi%2?'DEF':'ATK'):(ri<12?(fi%2?'ATK':'DEF'):(ri%2?'DEF':'ATK')));
    const site=ri%3===0?'CCTV / Cash':ri%3===1?'Church / Arsenal':'Gym / Bedroom';
    const won=outcome==='WIN';
    let stats=players.map((p,pi)=>({id:p.id,operator:pick(operators.filter(o=>o.side===side),r).name,kills:0,deaths:0,assists:0,damage:0,headshots:0,entry:0,plants:0,survived:true,kost:false}));
    const eventCount=won?4+Math.floor(r()*2):2+Math.floor(r()*3);
    const deathCount=won?1+Math.floor(r()*3):4+Math.floor(r()*2);
    const killEvents:any[]=[];
    const foePool=[...enemies],allyPool=[...players.map(p=>p.id)];
    for(let k=0;k<eventCount && foePool.length;k++){
      const idx=Math.floor(r()*foePool.length), victim=foePool.splice(idx,1)[0], killer=pick(players,r), headshot=r()>.44;
      const s=stats.find(z=>z.id===killer.id); if(s){s.kills++;s.damage+=78+Math.floor(r()*90);if(headshot)s.headshots++;if(k===0)s.entry=1;}
      killEvents.push({id:`${id}-${ri}-k${k}`,type:'kill',time:171-Math.floor((k+1)*145/(eventCount+1)),actor:killer.name,target:victim,detail:headshot?'HEADSHOT':'ELIMINATION',team:'us'});
    }
    for(let k=0;k<deathCount && allyPool.length;k++){
      const idx=Math.floor(r()*allyPool.length), victim=allyPool.splice(idx,1)[0], killer=pick(enemies,r);
      const s=stats.find(z=>z.id===victim); if(s){s.deaths=1;s.survived=false;}
      killEvents.push({id:`${id}-${ri}-d${k}`,type:'death',time:151-Math.floor((k+1)*113/(deathCount+1)),actor:killer,target:players.find(p=>p.id===victim)?.name,detail:r()>.5?'HEADSHOT':'ELIMINATION',team:'enemy'});
    }
    stats.forEach(s=>{s.assists=Math.floor(r()*1.8);s.damage+=18+Math.floor(r()*100);s.kost=!!(s.kills||s.assists||s.survived);});
    const planter=pick(stats,r);
    let events:any[]=[{id:`${id}-${ri}-start`,type:'round',time:180,actor:'ROUND START',target:'',detail:`${side==='ATK'?'ATTACK':'DEFENSE'} • ${site}`,team:'neutral'},...killEvents];
    if(won && side==='ATK' && r()>.52){planter.plants=1;events.push({id:`${id}-${ri}-plant`,type:'objective',time:35,actor:players.find(p=>p.id===planter.id)?.name,target:'',detail:'DEFUSER PLANTED',team:'us'});}
    events.push({id:`${id}-${ri}-end`,type:'end',time:0,actor:won?'ROUND WON':'ROUND LOST',target:'',detail:won?'OBJECTIVE SECURED':'OPPONENTS SECURED ROUND',team:won?'us':'enemy'});
    events.sort((a,b)=>b.time-a.time);
    return {number:ri+1,outcome,side,site,duration:180-Math.floor(r()*66),stats,events};
  });
  const aggregated=players.map(p=>{const ss=rounds.map(x=>x.stats.find(s=>s.id===p.id));return {id:p.id,kills:ss.reduce((a,s)=>a+(s?.kills||0),0),deaths:ss.reduce((a,s)=>a+(s?.deaths||0),0),assists:ss.reduce((a,s)=>a+(s?.assists||0),0),damage:ss.reduce((a,s)=>a+(s?.damage||0),0),headshots:ss.reduce((a,s)=>a+(s?.headshots||0),0),kost:ss.filter(s=>s?.kost).length,entries:ss.reduce((a,s)=>a+(s?.entry||0),0),plants:ss.reduce((a,s)=>a+(s?.plants||0),0)};});
  return {id,date,map:mapName,opponent,us,them,mode,result,rounds,aggregated,duration:`${32+Math.floor(r()*17)}m`,ranked:mode==='Ranked'};
 });
}
export const matches=makeMatches();
