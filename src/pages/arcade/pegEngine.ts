export const WIDTH=600, HEIGHT=660;
export type Peg={x:number;y:number;orange:boolean;hit:boolean};
export type Ball={x:number;y:number;vx:number;vy:number;age:number};
export type Game={pegs:Peg[];ball:Ball|null;shots:number;score:number;time:number;level:number;phase:'ready'|'flying'|'won'|'lost';message:string};
export function createGame(level=1,score=0):Game{
 const pegs:Peg[]=[];
 for(let row=0;row<7;row++)for(let col=0;col<9;col++){
  if((row+col+level)%7===0)continue;
  pegs.push({x:65+col*57+(row%2?12:0),y:150+row*55+Math.sin(col*.9+level)*14,orange:(row*9+col+level)%3===0,hit:false});
 }
 return {pegs,ball:null,shots:10,score,time:0,level,phase:'ready',message:'Clear every orange peg. Make the catch for a free ball.'};
}
export const remaining=(g:Game)=>g.pegs.filter(p=>p.orange&&!p.hit).length;
export const bucketX=(g:Game)=>WIDTH/2+Math.sin(g.time*1.1)*225;
export function shoot(g:Game,angle:number){
 if(g.phase!=='ready'||g.shots<=0)return false;
 angle=Math.max(-1.18,Math.min(1.18,angle));g.shots--;g.phase='flying';g.message='Ball in play';
 g.ball={x:300,y:65,vx:Math.sin(angle)*330,vy:Math.cos(angle)*330,age:0};return true;
}
export function finishShot(g:Game,caught:boolean){
 if(caught){g.shots++;g.score+=250;}
 g.ball=null;g.pegs=g.pegs.filter(p=>!p.hit);
 if(!remaining(g)){g.phase='won';g.score+=g.shots*500;g.message='Board cleared!';}
 else if(!g.shots){g.phase='lost';g.message='Out of balls. One more try?';}
 else {g.phase='ready';g.message=caught?'Nice catch! Free ball +250.':'Line up your next shot.';}
}
// Fixed 120 Hz physics; callers cap elapsed time after a suspended tab.
export function step(g:Game,dt:number){
 g.time+=dt;const b=g.ball;if(!b)return;
 b.age+=dt;b.vy+=380*dt;b.x+=b.vx*dt;b.y+=b.vy*dt;
 if(b.x<8){b.x=8;b.vx=Math.abs(b.vx)*.88;}if(b.x>WIDTH-8){b.x=WIDTH-8;b.vx=-Math.abs(b.vx)*.88;}
 if(b.y<8){b.y=8;b.vy=Math.abs(b.vy);}
 for(const p of g.pegs){
  const dx=b.x-p.x,dy=b.y-p.y,d=Math.hypot(dx,dy);if(d>=18)continue;
  const nx=d>0?dx/d:0,ny=d>0?dy/d:-1;
  b.x=p.x+nx*18.1;b.y=p.y+ny*18.1;
  const dot=b.vx*nx+b.vy*ny;if(dot<0){b.vx-=1.78*dot*nx;b.vy-=1.78*dot*ny;}
  if(!p.hit){p.hit=true;g.score+=p.orange?100:25;g.message=p.orange?'Orange cleared +100':'Ricochet +25';}
 }
 // A shot always resolves, even when a ball settles between two pegs.
 if(b.y>=HEIGHT-22||b.age>16)finishShot(g,b.y>=HEIGHT-22&&Math.abs(b.x-bucketX(g))<46);
}
