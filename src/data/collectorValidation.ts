/** Small validator for the bundled v1 schema plus referential invariants.
 * This is local file preflight, not an authenticated ingestion service.
 */
type Schema = {type?:string|string[];required?:string[];properties?:Record<string,Schema>;additionalProperties?:boolean;items?:Schema;minItems?:number;maxItems?:number;minLength?:number;maxLength?:number;minimum?:number;maximum?:number;pattern?:string;format?:string;const?:unknown;enum?:unknown[];anyOf?:Schema[];$ref?:string;$defs?:Record<string,Schema>};
export function validateCollectorEnvelope(value:unknown,schema:Schema):string[]{
  const errors:string[]=[];
  const visit=(v:any,s:Schema,path:string,output:string[])=>{
    if(s.$ref){const target=schema.$defs?.[s.$ref.split('/').pop()!];if(!target){output.push(`${path}: unresolved schema reference`);return;}visit(v,target,path,output);return;}
    if(s.anyOf){if(!s.anyOf.some(branch=>{const trial:string[]=[];visit(v,branch,path,trial);return !trial.length;}))output.push(`${path}: invalid value`);return;}
    if('const' in s&&v!==s.const)output.push(`${path}: expected ${String(s.const)}`);
    if(s.enum&&!s.enum.includes(v))output.push(`${path}: value is not allowed`);
    const type=v===null?'null':Array.isArray(v)?'array':typeof v==='number'&&Number.isInteger(v)?'integer':typeof v;
    if(s.type&&!(Array.isArray(s.type)?s.type:[s.type]).some(t=>t===type||t==='number'&&type==='integer')){output.push(`${path}: wrong type`);return;}
    if(typeof v==='string'){
      if(s.minLength!=null&&v.length<s.minLength||s.maxLength!=null&&v.length>s.maxLength)output.push(`${path}: invalid length`);
      if(s.pattern&&!new RegExp(s.pattern).test(v))output.push(`${path}: invalid format`);
      if(s.format==='date-time'&&(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/.test(v)||!Number.isFinite(Date.parse(v))||new Date(v).toISOString().slice(0,19)!==v.slice(0,19)))output.push(`${path}: expected valid UTC timestamp`);
    }
    if(typeof v==='number'&&(!Number.isFinite(v)||s.minimum!=null&&v<s.minimum||s.maximum!=null&&v>s.maximum))output.push(`${path}: number out of range`);
    if(Array.isArray(v)){if(s.minItems!=null&&v.length<s.minItems||s.maxItems!=null&&v.length>s.maxItems)output.push(`${path}: invalid item count`);if(s.items)v.forEach((item,index)=>visit(item,s.items!,`${path}[${index}]`,output));}
    else if(v&&typeof v==='object'){for(const key of s.required??[])if(!Object.prototype.hasOwnProperty.call(v,key))output.push(`${path}.${key}: required`);for(const [key,item] of Object.entries(v)){if(Object.prototype.hasOwnProperty.call(s.properties??{},key))visit(item,s.properties![key],`${path}.${key}`,output);else if(s.additionalProperties===false)output.push(`${path}.${key}: unknown field`);}}
  };
  visit(value,schema,'envelope',errors);
  if(errors.length)return errors.slice(0,50);
  const payload=(value as any).payload,rounds=new Set<string>(),players=new Set<string>(),numbers=new Set<number>(),pairs=new Set<string>(),eventIds=new Set<string>(),sequences=new Set<string>();
  for(const r of payload.rounds){if(rounds.has(r.roundId)||numbers.has(r.number))errors.push('Duplicate round ID or number');rounds.add(r.roundId);numbers.add(r.number);if(new Set(r.teams.map((t:any)=>t.slot)).size!==2)errors.push('Each round requires distinct team slots 0 and 1');const wins=r.teams.map((t:any)=>t.won);if(wins.every((v:any)=>typeof v==='boolean')&&wins[0]===wins[1])errors.push('Round team outcomes contradict each other');}
  for(const p of payload.players){if(players.has(p.playerId))errors.push('Duplicate player ID');players.add(p.playerId);}
  for(const a of payload.appearances){const pair=a.roundId+'|'+a.playerId;if(!rounds.has(a.roundId)||!players.has(a.playerId))errors.push('Appearance references unknown round/player');if(pairs.has(pair))errors.push('Duplicate player appearance');pairs.add(pair);if(a.stats.kills!=null&&a.stats.headshots!=null&&a.stats.headshots>a.stats.kills)errors.push('Headshots exceed recorded kills');}
  for(const e of payload.events){const key=e.roundId+'|'+e.sequence;if(!rounds.has(e.roundId))errors.push('Event references unknown round');if(eventIds.has(e.eventId)||sequences.has(key))errors.push('Duplicate event ID or round sequence');eventIds.add(e.eventId);sequences.add(key);for(const id of [e.actorPlayerId,e.targetPlayerId])if(id!=null&&!players.has(id))errors.push('Event references unknown player');}
  if(payload.match.completion==='complete'&&([...numbers].sort((a,b)=>a-b).some((n,i)=>n!==i+1)||payload.rounds.some((r:any)=>r.teams.some((t:any)=>typeof t.won!=='boolean'))))errors.push('Complete match requires contiguous rounds and known outcomes; server must also verify supported mode completion');
  return errors.slice(0,50);
}
