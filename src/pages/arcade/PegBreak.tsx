import {useEffect,useRef,useState} from 'react';
import {WIDTH,HEIGHT,createGame,remaining,bucketX,shoot,step} from './pegEngine';
import './arcade.css';
export function PegBreak(){
 const canvas=useRef<HTMLCanvasElement>(null),game=useRef(createGame()),aim=useRef(0),paused=useRef(false);
 const [hud,setHud]=useState(()=>({...game.current,left:remaining(game.current)})),[pauseUI,setPauseUI]=useState(false),[best,setBest]=useState(()=>{try{return Number(localStorage.getItem('breach-peg-best'))||0;}catch{return 0;}});
 const refresh=()=>setHud({...game.current,left:remaining(game.current)});
 function fire(){if(!paused.current&&shoot(game.current,aim.current))refresh();}
 function restart(next=false){game.current=createGame(next?game.current.level+1:1,next?game.current.score:0);paused.current=false;setPauseUI(false);refresh();}
 useEffect(()=>{
  const el=canvas.current,ctx=el?.getContext('2d');if(!el||!ctx)return;
  let frame=0,last=0,accumulator=0,signature='';
  function draw(){
   if(!ctx)return;const g=game.current;
   const bg=ctx.createLinearGradient(0,0,0,HEIGHT);bg.addColorStop(0,'#12243e');bg.addColorStop(1,'#090f21');ctx.fillStyle=bg;ctx.fillRect(0,0,WIDTH,HEIGHT);
   ctx.fillStyle='#ffffff22';for(let i=0;i<55;i++){ctx.beginPath();ctx.arc((i*137)%WIDTH,(i*97)%HEIGHT,1,0,Math.PI*2);ctx.fill();}
   ctx.strokeStyle='#ffffff09';for(let y=110;y<HEIGHT;y+=55){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(WIDTH,y);ctx.stroke();}
   if(g.phase==='ready'){ctx.setLineDash([4,9]);ctx.strokeStyle='#b8e8ff70';ctx.beginPath();ctx.moveTo(300,65);for(let i=1;i<18;i++){const t=i*.035;ctx.lineTo(300+Math.sin(aim.current)*330*t,65+Math.cos(aim.current)*330*t+190*t*t);}ctx.stroke();ctx.setLineDash([]);}
   ctx.lineWidth=17;ctx.lineCap='round';ctx.strokeStyle='#e6edf8';ctx.beginPath();ctx.moveTo(300,35);ctx.lineTo(300+Math.sin(aim.current)*35,65+Math.cos(aim.current)*20);ctx.stroke();ctx.lineWidth=1;
   for(const p of g.pegs){ctx.shadowBlur=p.hit?18:7;ctx.shadowColor=p.orange?'#ff783d':'#54cfff';ctx.fillStyle=p.hit?'#ffffff':p.orange?'#ff783d':'#42b8eb';ctx.beginPath();ctx.arc(p.x,p.y,10,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;ctx.strokeStyle=p.orange?'#ffe0ad':'#b6f1ff';ctx.stroke();if(p.orange){ctx.fillStyle='#64280e';ctx.fillRect(p.x-3,p.y-3,6,6);}}
   const x=bucketX(g);ctx.strokeStyle='#81efbc';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(x-47,HEIGHT-30);ctx.lineTo(x-40,HEIGHT-8);ctx.lineTo(x+40,HEIGHT-8);ctx.lineTo(x+47,HEIGHT-30);ctx.stroke();ctx.lineWidth=1;
   if(g.ball){ctx.fillStyle='#fff';ctx.shadowColor='#fff';ctx.shadowBlur=16;ctx.beginPath();ctx.arc(g.ball.x,g.ball.y,7,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;}
   if(paused.current||g.phase==='won'||g.phase==='lost'){ctx.fillStyle='#07101bd9';ctx.fillRect(0,0,WIDTH,HEIGHT);ctx.textAlign='center';ctx.fillStyle='#fff';ctx.font='bold 36px system-ui';ctx.fillText(paused.current?'PAUSED':g.phase==='won'?'BOARD CLEARED':'ONE MORE SHOT?',300,310);ctx.font='16px system-ui';ctx.fillStyle='#a4b9cc';ctx.fillText(paused.current?'Resume when you’re ready.':'Use the controls below to play again.',300,350);}
  }
  function loop(now:number){const elapsed=last?Math.min((now-last)/1000,.05):0;last=now;if(!paused.current){accumulator+=elapsed;while(accumulator>=1/120){step(game.current,1/120);accumulator-=1/120;}}
   draw();const g=game.current,key=[g.phase,g.score,g.shots,remaining(g)].join(':');if(key!==signature){signature=key;setHud({...g,left:remaining(g)});if(g.phase==='won'||g.phase==='lost')setBest(old=>{const value=Math.max(old,g.score);try{localStorage.setItem('breach-peg-best',String(value));}catch{}return value;});}frame=requestAnimationFrame(loop);}
  const hide=()=>{if(document.hidden){paused.current=true;setPauseUI(true);}};document.addEventListener('visibilitychange',hide);frame=requestAnimationFrame(loop);
  return()=>{cancelAnimationFrame(frame);document.removeEventListener('visibilitychange',hide);};
 },[]);
 function point(e:React.PointerEvent<HTMLCanvasElement>){const box=e.currentTarget.getBoundingClientRect();const x=(e.clientX-box.left)*WIDTH/box.width,y=(e.clientY-box.top)*HEIGHT/box.height;aim.current=Math.max(-1.18,Math.min(1.18,Math.atan2(x-300,Math.max(25,y-65))));}
 return <div className="page peg-page"><div className="peg-heading"><div><div className="eyebrow">YOU FOUND THE SECRET ROOM</div><h1>PEG / BREAK</h1><p>A little downtime between rounds.</p></div><a className="btn" href="#/account">← BACK TO ACCOUNT</a></div>
 <div className="peg-layout"><section className="peg-machine"><div className="peg-scoreboard"><span>BOARD <b>{hud.level}</b></span><span>BALLS <b>{hud.shots}</b></span><span>ORANGE <b>{hud.left}</b></span><span>SCORE <b>{hud.score.toLocaleString()}</b></span></div>
 <canvas ref={canvas} width={WIDTH} height={HEIGHT} tabIndex={0} aria-label="Peg Break board. Aim with arrow keys and press Space to launch, or aim and click on the board." onPointerMove={point} onPointerDown={e=>{point(e);e.currentTarget.focus();fire();}} onKeyDown={e=>{if(['ArrowLeft','ArrowRight',' ','Enter'].includes(e.key)){e.preventDefault();if(e.key==='ArrowLeft')aim.current=Math.max(-1.18,aim.current-.06);else if(e.key==='ArrowRight')aim.current=Math.min(1.18,aim.current+.06);else if(!e.repeat)fire();}}}/>
 <div className="peg-controls"><button className="btn primary" disabled={hud.phase!=='ready'||pauseUI} onClick={fire}>LAUNCH BALL</button><button className="btn" onClick={()=>{paused.current=!paused.current;setPauseUI(paused.current);}}>{pauseUI?'RESUME':'PAUSE'}</button>{hud.phase==='won'?<button className="btn primary" onClick={()=>restart(true)}>NEXT BOARD →</button>:<button className="btn" onClick={()=>restart()}>NEW GAME</button>}</div>
 <p className="peg-status" role="status">{pauseUI?'Paused':hud.message}</p></section>
 <aside className="peg-guide"><span className="eyebrow">OFF THE RECORD</span><h2>Make every bounce count.</h2><p>Clear all the orange pegs before your ten balls run out. Blue pegs add points and change your path.</p><div className="peg-rule"><i className="orange"/>Orange peg <strong>100 pts</strong></div><div className="peg-rule"><i/>Blue peg <strong>25 pts</strong></div><div className="peg-rule"><i className="catch"/>Bucket catch <strong>FREE BALL</strong></div><p>Move your pointer to aim, then click to launch. On touch screens, tap where you want to aim and shoot. Keyboard: ← → to aim, Space to fire.</p><div className="peg-best">PERSONAL BEST <strong>{best.toLocaleString()}</strong><small>Saved on this browser</small></div><p>Clear a board to unlock the next layout. Spare balls earn a 500-point bonus each.</p><small>An original peg-bouncing mini-game. Just for fun—your match stats are untouched.</small></aside></div></div>;
}
