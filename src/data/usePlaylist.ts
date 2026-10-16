import {useEffect,useState} from 'react';
import type {Playlist} from './playlists';
const key=()=> 'breach-playlist-v1:'+sessionStorage.getItem('breach_workspace');
function read():Playlist{const p=sessionStorage.getItem(key());return p==='unranked'||p==='casual'||p==='other'?p:'ranked';}
export function usePlaylist(){
 const [playlist,setPlaylist]=useState<Playlist>(read);
 useEffect(()=>{const sync=()=>setPlaylist(read());window.addEventListener('breach-playlist-change',sync);return()=>window.removeEventListener('breach-playlist-change',sync);},[]);
 return [playlist,(value:Playlist)=>{sessionStorage.setItem(key(),value);setPlaylist(value);window.dispatchEvent(new Event('breach-playlist-change'));}] as const;
}
