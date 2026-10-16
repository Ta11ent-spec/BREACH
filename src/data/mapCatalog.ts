import {manualMapNames,manualSites} from './manualSites';
/** Display metadata only. Raw replay IDs and names stay unchanged in SQL Server.
 * Known IDs: r6-dissect/dissect/header.go; see docs/MAP_INTELLIGENCE.md.
 * Unknown IDs can be identified from unambiguous recorded bombsite pairs.
 */
const names: Record<string, string> = {
  ClubHouse: 'Club House', KafeDostoyevsky: 'Kafe Dostoyevsky', PresidentialPlane: 'Presidential Plane',
  HerefordBase: 'Hereford Base', ThemePark: 'Theme Park', EmeraldPlains: 'Emerald Plains',
  NighthavenLabs: 'Nighthaven Labs', StadiumBravo: 'Stadium Bravo', Stadium2020: 'Stadium 2020', BartlettU: 'Bartlett University',
};
const mapIds: Record<string, string> = {
  '837214085': 'ClubHouse', '1378191338': 'KafeDostoyevsky', '1460220617': 'Kanal', '1767965020': 'Yacht',
  '2609218856': 'PresidentialPlane', '2609221242': 'Consulate', '2697268122': 'BartlettU', '42090092951': 'Coastline',
  '53627213396': 'Tower', '88107330328': 'Villa', '126196841359': 'Fortress', '127951053400': 'HerefordBase',
  '199824623654': 'ThemePark', '231702797556': 'Oregon', '237873412352': 'House', '259816839773': 'Chalet',
  '276279025182': 'Skyscraper', '305979357167': 'Border', '329867321446': 'Favela', '355496559878': 'Bank',
  '362605108559': 'Outback', '365284490964': 'EmeraldPlains', '270063334510': 'StadiumBravo',
  '378595635123': 'NighthavenLabs', '379218689149': 'Consulate', '388073319671': 'Lair', '405306299908': 'Stadium2020',
  '413779563590': 'Bank', '407987100456': 'Border', '407558616688': 'Chalet', '407193663917': 'ClubHouse',
  '413845419788': 'KafeDostoyevsky', '417890697769': 'Lair', '418119057546': 'NighthavenLabs', '418126004176': 'Consulate',
};
export type MapLinks = {revision:number; maps:{collectorId:string;map:string}[]; sites:{map:string;alias:string;site:string}[]};
let links:MapLinks={revision:0,maps:[],sites:[]};
export function setMapLinks(next:MapLinks){links=next;}
export const canonicalMaps=[...new Set([...manualMapNames,...Object.values(names),'Bartlett University'])].sort();
const normalized=(s:string)=>s.toLowerCase().replace(/[^a-z0-9]/g,'');
export function canonicalMap(name:string){const base=name.trim().replace(/Y\d+(?:S\d+)?$/i,'');return canonicalMaps.find(n=>normalized(n)===normalized(names[base]??base));}
export type MapIdentity = { key: string; name: string; label: string; source: 'replay' | 'catalog' | 'linked' | 'inferred' | 'unknown'; evidence: string | null };
export function resolveMap(name: string | null | undefined, id: number | string | null | undefined): MapIdentity {
 const raw=name?.trim()??'';
 const linked=id!=null?links.maps.find(m=>m.collectorId===String(id)):undefined;
 const known=id!=null?mapIds[String(id)]:undefined;
 const canonical=linked?.map??(known?canonicalMap(known):undefined)??canonicalMap(raw);
 if(canonical)return {key:'map:'+normalized(canonical),name:canonical,label:canonical,source:linked?'linked':known?'catalog':'replay',evidence:null};
 const inferred=id!=null?automaticMaps.get(String(id)):undefined;
 if(inferred)return {key:'map:'+normalized(inferred.name),name:inferred.name,label:inferred.name,source:'inferred',evidence:inferred.evidence};
 const label=raw&&!/^Map\(\d+\)$/.test(raw)?raw:id!=null?`Unresolved map  /  ${id}`:'Unknown map';
 return {key:id!=null?String(id):raw?'name:'+raw:'unknown',name:label,label,source:'unknown',evidence:null};
}
export const displayMapLabel = (name:string|null|undefined,id:number|string|null|undefined)=>resolveMap(name,id).label;
// Normalize spelling and an omitted repeated floor only; never guess room synonyms.
const siteKey=(value:string)=>{const parts=value.trim().split(/\s*[/,]\s*/);const floor=parts[0]?.match(/^(B|[1-9]F)\s+/i)?.[1];return parts.map(p=>normalized(floor&&!/^(B|[1-9]F)\s+/i.test(p)?floor+' '+p:p)).sort().join('/');};
export function resolveSite(map:string,site:string|null|undefined){
 if(!site?.trim())return 'Site not recorded';
 const canonical=canonicalMap(map)??map;
 const linked=links.sites.find(s=>s.map===canonical&&siteKey(s.alias)===siteKey(site));
 if(linked)return linked.site;
 return (manualSites[canonical]??[]).find(s=>siteKey(s)===siteKey(site))??site.trim();
}

export function linkedSites(map:string){return [...new Set(links.sites.filter(s=>s.map===map).map(s=>s.site))];}

// Evidence is rebuilt from the unfiltered shared replay overview, never player/date scope.
const automaticMaps=new Map<string,{name:string;evidence:string}>();
export function setMapEvidence(data:{matches:{matchId:string;mapId:number|string|null}[];rounds:{matchId:string;site?:string|null}[]}){
 automaticMaps.clear();
 const byMatch=new Map(data.matches.filter(m=>m.mapId!=null).map(m=>[m.matchId,String(m.mapId)]));
 const byId=new Map<string,Set<string>>();
 for(const r of data.rounds){const id=byMatch.get(r.matchId);if(id&&r.site?.trim()){const sites=byId.get(id)??new Set<string>();sites.add(r.site.trim());byId.set(id,sites);}}
 const index=new Map<string,Set<string>>();
 for(const [map,sites] of Object.entries(manualSites))for(const site of sites){const key=siteKey(site);const maps=index.get(key)??new Set<string>();maps.add(map);index.set(key,maps);}
 // Only aliases explicitly approved through the admin linking controls are trusted.
 for(const alias of links.sites){const key=siteKey(alias.alias);const maps=index.get(key)??new Set<string>();maps.add(alias.map);index.set(key,maps);}
 for(const [id,sites] of byId){
  let candidates:Set<string>|undefined;const evidence:string[]=[];
  for(const site of sites){const found=index.get(siteKey(site));if(!found)continue;evidence.push(site);candidates=candidates===undefined?new Set(found):new Set([...candidates].filter(m=>found.has(m)));}
  if(candidates?.size===1)automaticMaps.set(id,{name:[...candidates][0],evidence:'Automatically identified from recorded bombsites: '+evidence.join('; ')});
 }
}
