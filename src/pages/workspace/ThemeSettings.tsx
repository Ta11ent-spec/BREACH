import {useState} from 'react';

export function ThemeSettings(){
 const [theme,setTheme]=useState(()=>document.documentElement.dataset.theme||'dark');
 function choose(next:'light'|'dark'){
  document.documentElement.dataset.theme=next;
  setTheme(next);
  try{localStorage.setItem('breach-theme',next);}catch{}
 }
 return <section className="panel account-appearance">
  <div className="panel-head"><h3>Appearance</h3></div>
  <div className="workspace-body">
   <p className="workspace-muted">Choose your theme. Your choice is saved in this browser.</p>
   <div className="segmented" role="group" aria-label="Color theme">
    <button type="button" className={theme==='light'?'active':''} aria-pressed={theme==='light'} onClick={()=>choose('light')}>Light mode</button>
    <button type="button" className={theme==='dark'?'active':''} aria-pressed={theme==='dark'} onClick={()=>choose('dark')}>Dark mode</button>
   </div>
  </div>
 </section>;
}
