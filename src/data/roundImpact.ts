import {blankImpact,type ImpactField} from './impact';
import type {ManualPlayerStats} from './manualMatches';
export const partialSelection='__partial';
export const noneSelection='__none';
export function roundSelection(rows:ManualPlayerStats[],field:ImpactField|'clutches'){
 const values=rows.flatMap(r=>field==='clutches'?Array.from({length:5},(_,x)=>({id:JSON.stringify([r.playerId,x+1]),value:r.impact?.clutches[x]})):[{id:r.playerId,value:r.impact?.[field]}]);
 if(values.every(v=>v.value==null))return '';
 if(values.some(v=>v.value==null||!Number.isInteger(v.value)||v.value!<0||v.value!>1))return partialSelection;
 const positive=values.filter(v=>v.value===1);
 return positive.length===0?noneSelection:positive.length===1?positive[0].id:partialSelection;
}
export function setRoundSelection(rows:ManualPlayerStats[],field:ImpactField|'clutches',selection:string):ManualPlayerStats[]{
 if(selection===partialSelection)return rows;
 const clutch=field==='clutches'&&selection&&selection!==noneSelection?JSON.parse(selection) as [string,number]:null;
 return rows.map(row=>{const impact={...(row.impact??blankImpact())};
  if(field==='clutches')impact.clutches=Array.from({length:5},(_,x)=>selection===''?null:clutch?.[0]===row.playerId&&clutch[1]===x+1?1:0);
  else impact[field]=selection===''?null:selection===row.playerId?1:0;
  return {...row,impact};
 });
}
