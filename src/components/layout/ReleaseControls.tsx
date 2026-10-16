import {useState} from 'react';
export const VERSION='1.1.0';
export function ReleaseControls(){
 const [theme,setTheme]=useState(()=>document.documentElement.dataset.theme||'dark');
 function toggle(){const next=theme==='dark'?'light':'dark';document.documentElement.dataset.theme=next;setTheme(next);try{localStorage.setItem('breach-theme',next);}catch{}}
 return <div className="release-controls"><button onClick={toggle} aria-label={`Switch to ${theme==='dark'?'light':'dark'} mode`}>{theme==='dark'?'☀ Light mode':'☾ Dark mode'}</button><details><summary>V{VERSION} · PATCH NOTES ▾</summary><ul><li>Orange/red accent and light/dark themes.</li><li>Ten-player manual matches: five per team.</li><li>Select existing players or add new names.</li><li>Round-by-round stats or final scoreboard entry.</li><li>Map and bombsite selectors.</li><li>K/D sorting in Match Center and scoreboards.</li><li>Shared manual stats and Combined by default.</li></ul></details></div>;
}
