/** Unknown ratios stay last in either direction; zero-death ratios sort as infinity. */
export function compareKd(a:string|null,b:string|null,direction:'asc'|'desc'){
 const number=(v:string|null)=>v==='∞'?Infinity:v==null||v==='—'?null:Number(v);
 const left=number(a),right=number(b);
 if(left==null)return right==null?0:1;
 if(right==null)return -1;
 if(left===right)return 0;
 return (left<right?-1:1)*(direction==='asc'?1:-1);
}
