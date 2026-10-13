import { players, maps, matches } from './demoData';
import { pct } from '../lib/format';

export const getPlayer=(id:string)=>players.find(p=>p.id===id)||players[0];
export function aggregate(selected:any[]){
 const wins=selected.filter(m=>m.result==='WIN').length;
 const allrounds=selected.reduce((sum,m)=>sum+m.rounds.length,0);
 const stats=players.map(p=>{
  const s=selected.map(m=>m.aggregated.find((a:any)=>a.id===p.id));
  return { ...p, kills:s.reduce((x,a)=>x+(a?.kills||0),0),deaths:s.reduce((x,a)=>x+(a?.deaths||0),0),assists:s.reduce((x,a)=>x+(a?.assists||0),0),damage:s.reduce((x,a)=>x+(a?.damage||0),0),headshots:s.reduce((x,a)=>x+(a?.headshots||0),0),kost:s.reduce((x,a)=>x+(a?.kost||0),0),entries:s.reduce((x,a)=>x+(a?.entries||0),0),plants:s.reduce((x,a)=>x+(a?.plants||0),0),rounds:allrounds};
 });
 const kills=stats.reduce((a,s)=>a+s.kills,0), deaths=stats.reduce((a,s)=>a+s.deaths,0), hs=stats.reduce((a,s)=>a+s.headshots,0);
 const all=selected.flatMap(m=>m.rounds), attack=all.filter(r=>r.side==='ATK'), defense=all.filter(r=>r.side==='DEF');
 return {wins,losses:selected.length-wins,rate:pct(wins,selected.length),kills,deaths,kd:kills/Math.max(deaths,1),hs:pct(hs,kills),kost:pct(stats.reduce((a,s)=>a+s.kost,0),allrounds*5),attack:pct(attack.filter(r=>r.outcome==='WIN').length,attack.length),defense:pct(defense.filter(r=>r.outcome==='WIN').length,defense.length),rounds:allrounds,stats};
}
export function getMap(n:string){return maps.find(m=>m.name===n)||maps[0];}
export function roundScore(rounds:any[],upto:number){const rs=rounds.slice(0,upto);return [rs.filter(r=>r.outcome==='WIN').length,rs.filter(r=>r.outcome==='LOSS').length];}
export function getRange(period:string){ return period==='7D'?matches.slice(0,6):period==='30D'?matches.slice(0,12):matches; }
