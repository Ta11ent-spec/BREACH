import {useEffect,useId,useRef,useState} from 'react';
import type {ReactNode} from 'react';

export function AdvancedSettings({children}:{children:ReactNode}){
 const [open,setOpen]=useState(false);
 const root=useRef<HTMLDivElement>(null);
 const trigger=useRef<HTMLButtonElement>(null);
 const id=useId();
 useEffect(()=>{
  if(!open)return;
  const outside=(event:PointerEvent)=>{if(!root.current?.contains(event.target as Node))setOpen(false);};
  const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){setOpen(false);trigger.current?.focus();}};
  document.addEventListener('pointerdown',outside);
  document.addEventListener('keydown',escape);
  return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape);};
 },[open]);
 return <div className="advanced-settings" ref={root} onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget))setOpen(false);}}>
  <button ref={trigger} type="button" className="advanced-settings-trigger" aria-expanded={open} aria-controls={id} onClick={()=>setOpen(value=>!value)}>ADVANCED SETTINGS</button>
  {open&&<section id={id} className="advanced-settings-popout" aria-label="Advanced statistics settings">
   <div className="advanced-settings-heading"><strong>Advanced settings</strong><button type="button" aria-label="Close advanced settings" onClick={()=>{setOpen(false);trigger.current?.focus();}}>×</button></div>
   {children}
  </section>}
 </div>;
}
