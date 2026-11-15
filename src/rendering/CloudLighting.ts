import type {DaylightValues} from './TimeOfDay.ts';
type RGB=[number,number,number];
const mix=(a:RGB,b:RGB,t:number):RGB=>a.map((v,i)=>v+(b[i]-v)*t) as RGB;
/** Twilight colours change continuously with solar elevation, never at a preset boundary. */
export function cloudPalette(clock:Pick<DaylightValues,'day'|'warm'|'sunset'>){
 const warmth=Math.max(0,Math.min(1,clock.warm*.72)),sunset=Math.max(0,Math.min(1,clock.sunset));
 const lit=mix([1,.78,.40],[1,.63,.36],sunset),shade=mix([.33,.34,.48],[.40,.32,.26],sunset);
 const top=mix([.84,.87,.89],lit,warmth*.86),bottom=mix([.30,.37,.49],shade,warmth*.86);
 const aerial=mix([.39,.54,.69],mix([.68,.48,.29],[.63,.42,.27],sunset),warmth*.75);
 const mist=mix([.84,.88,.93],mix([.95,.77,.51],[.92,.57,.47],sunset),warmth*.68).map(v=>v*(.10+.90*clock.day)) as RGB;
 return{top,bottom,aerial,mist};
}
