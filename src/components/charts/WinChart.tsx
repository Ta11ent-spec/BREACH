import { shortDate } from '../../lib/format';

export function WinChart({matches:ms}:any){
 const chronological=[...ms].reverse();const points=chronological.map((m:any,i:number)=>({x:38+(i*548)/Math.max(chronological.length-1,1),y:164-(chronological.slice(0,i+1).filter((t:any)=>t.result==='WIN').length/(i+1))*125}));
 const line=points.map((p:any,i:number)=>(i?'L':'M')+p.x+' '+p.y).join(' ');const area=line+` L${points[points.length-1]?.x||580} 181 L38 181 Z`;
 return <div className="linechart"><svg viewBox="0 0 620 220" preserveAspectRatio="none" role="img" aria-label="Cumulative match win rate trend">
  <defs><linearGradient id="chartShade" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ff9061" stopOpacity=".25"/><stop offset="100%" stopColor="#ff9061" stopOpacity="0"/></linearGradient></defs>
  {[42,88,134,180].map((y,i)=><g key={i}><line x1="38" y1={y} x2="590" y2={y} stroke="#26313a" strokeDasharray="4 6"/><text x="0" y={y+4} fill="#76818d" fontSize="11" fontFamily="monospace">{90-i*20}%</text></g>)}
  <path d={area} fill="url(#chartShade)"/><path d={line} fill="none" stroke="#ff9061" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
  {points.map((p:any,i:number)=><circle key={i} cx={p.x} cy={p.y} r={i===points.length-1?5:2.5} fill="#ff9061" stroke="#0b1217" strokeWidth="2"/>)}
  {chronological.filter((_:any,i:number)=>i===0||i===Math.floor(chronological.length/2)||i===chronological.length-1).map((m:any,i:number)=><text key={i} x={38+(chronological.indexOf(m)*548)/Math.max(chronological.length-1,1)} y="212" textAnchor="middle" fill="#77828b" fontSize="11" fontFamily="monospace">{shortDate(m.date)}</text>)}
 </svg></div>;
}
