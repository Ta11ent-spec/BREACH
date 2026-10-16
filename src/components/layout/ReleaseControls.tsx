export const VERSION='1.1.1';
export function ReleaseControls(){
 return <div className="release-controls"><details><summary>V{VERSION} · PATCH NOTES ▾</summary><ul><li>Shared map and bombsite linking with owner corrections.</li><li>Team filters require every selected teammate.</li><li>Orange/red accent and light/dark themes.</li><li>Ten-player manual matches: five per team.</li><li>Select existing players or add new names.</li><li>Round-by-round stats or final scoreboard entry.</li><li>Map and bombsite selectors.</li><li>K/D sorting in Match Center and scoreboards.</li><li>Shared manual stats and Combined by default.</li></ul></details></div>;
}
