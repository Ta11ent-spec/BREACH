export function nfmt(n:number,dec=0){return Number(n||0).toFixed(dec);}
export function pct(a:number,b:number){ return b ? Math.round(100*a/b):0; }
export function shortDate(str:string) {return new Date(str+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'}).toUpperCase();}
export function fullDate(str:string) {return new Date(str+'T12:00:00').toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'});}
export function csvEscape(v:any){const s=String(v??'');return /[",\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;}
