export const impactFields=['openingKills','openingDeaths','openingTeamkills','openingTeamkillDeaths','openingOtherDeaths'] as const;
export type ImpactField=typeof impactFields[number];
export type Impact={version:1;openingKills:number|null;openingDeaths:number|null;openingTeamkills:number|null;openingTeamkillDeaths:number|null;openingOtherDeaths:number|null;clutches:(number|null)[]};
export const blankImpact=():Impact=>({version:1,openingKills:null,openingDeaths:null,openingTeamkills:null,openingTeamkillDeaths:null,openingOtherDeaths:null,clutches:[null,null,null,null,null]});
export const impactLabels:Record<ImpactField,string>={openingKills:'Opening kills (enemy)',openingDeaths:'Opening deaths (enemy)',openingTeamkills:'Opening teamkills',openingTeamkillDeaths:'Opening teamkill deaths',openingOtherDeaths:'Opening other deaths'};
export function impactErrors(x:Impact|null|undefined,rounds:number,kills:number|null,deaths:number|null,wins?:number|null):string[]{
 if(!x)return [];
 if(x.version!==1||!Array.isArray(x.clutches)||x.clutches.length!==5||[...impactFields.map(f=>x[f]),...x.clutches].some(n=>n!=null&&(!Number.isInteger(n)||n<0||n>rounds)))return ['Opening/clutch counts must be whole numbers within the round count.'];
 if(kills!=null&&(x.openingKills??0)+(x.openingTeamkills??0)>kills||deaths!=null&&(x.openingDeaths??0)+(x.openingTeamkillDeaths??0)+(x.openingOtherDeaths??0)>deaths)return ['Opening counts exceed recorded kills or deaths.'];
 const clutches=x.clutches.reduce<number>((n,v)=>n+(v??0),0);if(clutches>rounds||wins!=null&&clutches>wins)return ['Clutch wins exceed won rounds.'];
 return [];
}
export function impactGroupErrors(rows:{team:number;impact?:Impact|null}[],rounds:number):string[]{
 if(impactFields.some(f=>rows.reduce((n,r)=>n+(r.impact?.[f]??0),0)>rounds)||rows.reduce((n,r)=>n+(r.impact?.clutches.reduce<number>((n,v)=>n+(v??0),0)??0),0)>rounds)return ['Too many opening events or clutch wins.'];
 if(rows.reduce((n,r)=>n+(r.impact?.openingTeamkills??0)+(r.impact?.openingOtherDeaths??0),0)>rounds)return ['Opening teamkill and other death cannot both be the first elimination.'];
 for(const [kill,death,friendly] of [['openingKills','openingDeaths',false],['openingTeamkills','openingTeamkillDeaths',true]] as const){
  if(rows.every(r=>r.impact?.[kill]!=null&&r.impact?.[death]!=null)&&rows.reduce((n,r)=>n+r.impact![kill]!,0)!==rows.reduce((n,r)=>n+r.impact![death]!,0))return ['Opening killers and victims must balance.'];
  if(rounds===1){const a=rows.filter(r=>r.impact?.[kill]===1),b=rows.filter(r=>r.impact?.[death]===1);if(a.length===1&&b.length===1&&(a[0].team===b[0].team)!==friendly)return ['Check opening event teams.'];}
 }
 return [];
}
export function impactTotals(rows:{impact?:Impact|null;roundsRepresented?:number}[]){
 const rounds=rows.reduce((n,r)=>n+(r.roundsRepresented??1),0);
 const measure=(get:(i:Impact)=>number|null)=>{let value=0,covered=0;for(const r of rows){const v=r.impact?.version===1?get(r.impact):null;if(v!=null){value+=v;covered+=r.roundsRepresented??1;}}return {value:covered?value:null,covered};};
 return {rounds,fields:Object.fromEntries(impactFields.map(f=>[f,measure(i=>i[f])])) as Record<ImpactField,{value:number|null;covered:number}>,clutches:Array.from({length:5},(_,k)=>measure(i=>i.clutches[k]??null))};
}
