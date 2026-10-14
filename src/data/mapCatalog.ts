/** Display metadata only. Raw replay IDs and names stay unchanged in SQL Server.
 * Known IDs: r6-dissect/dissect/header.go; see docs/MAP_INTELLIGENCE.md.
 * The two site-inferred IDs are explicitly labeled until confirmed by a parser table.
 */
const names: Record<string, string> = {
  ClubHouse: 'Club House', KafeDostoyevsky: 'Kafe Dostoyevsky', PresidentialPlane: 'Presidential Plane',
  HerefordBase: 'Hereford Base', ThemePark: 'Theme Park', EmeraldPlains: 'Emerald Plains',
  NighthavenLabs: 'Nighthaven Labs', StadiumBravo: 'Stadium Bravo', Stadium2020: 'Stadium 2020', BartlettU: 'Bartlett University',
};
const mapIds: Record<string, string> = {
  '837214085': 'ClubHouse', '1378191338': 'KafeDostoyevsky', '1460220617': 'Kanal', '1767965020': 'Yacht',
  '2609218856': 'PresidentialPlane', '2609221242': 'Consulate', '2697268122': 'BartlettU', '42090092951': 'Coastline',
  '53627213396': 'Tower', '88107330328': 'Villa', '126196841359': 'Fortress', '127951053400': 'HerefordBase',
  '199824623654': 'ThemePark', '231702797556': 'Oregon', '237873412352': 'House', '259816839773': 'Chalet',
  '276279025182': 'Skyscraper', '305979357167': 'Border', '329867321446': 'Favela', '355496559878': 'Bank',
  '362605108559': 'Outback', '365284490964': 'EmeraldPlains', '270063334510': 'StadiumBravo',
  '378595635123': 'NighthavenLabs', '379218689149': 'Consulate', '388073319671': 'Lair', '405306299908': 'Stadium2020',
  '413779563590': 'Bank', '407987100456': 'Border', '407558616688': 'Chalet', '407193663917': 'ClubHouse',
  '413845419788': 'KafeDostoyevsky', '417890697769': 'Lair', '418119057546': 'NighthavenLabs', '418126004176': 'Consulate',
};
const siteInferred: Record<string, { name: string; evidence: string }> = {
  '409325881472': { name: 'Villa', evidence: '2F Aviator Room / Games Room and 2F Trophy Room / Statuary Room in the imported replay.' },
  '436375283234': { name: 'Coastline', evidence: '2F Hookah Lounge / Billiards Room and 2F Penthouse / Theater in the imported replay.' },
};
export type MapIdentity = { key: string; name: string; label: string; source: 'replay' | 'catalog' | 'inferred' | 'unknown'; evidence: string | null };
export function resolveMap(name: string | null | undefined, id: number | null | undefined): MapIdentity {
  const raw = name?.trim() ?? '';
  const key = id != null ? String(id) : raw && !/^Map\(\d+\)$/.test(raw) ? `name:${raw}` : 'unknown';
  if (raw && !/^Map\(\d+\)$/.test(raw)) {
    const base = raw.replace(/Y\d+(?:S\d+)?$/, '');
    const display = names[base] ?? base;
    return { key, name: display, label: display, source: 'replay', evidence: null };
  }
  const known = id != null ? mapIds[String(id)] : undefined;
  if (known) return { key, name: names[known] ?? known, label: names[known] ?? known, source: 'catalog', evidence: null };
  const inferred = id != null ? siteInferred[String(id)] : undefined;
  if (inferred) return { key, name: inferred.name, label: `${inferred.name} (site-inferred)`, source: 'inferred', evidence: inferred.evidence };
  const label = id != null ? `Unresolved map · ${id}` : 'Unknown map';
  return { key, name: label, label, source: 'unknown', evidence: null };
}
export const displayMapLabel = (name: string | null | undefined, id: number | null | undefined) => resolveMap(name, id).label;
