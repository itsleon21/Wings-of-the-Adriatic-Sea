/** Direction of travel of the prevailing northwesterly wind in world coordinates. */
export const marineWindDirection={x:.56,z:Math.sqrt(1-.56**2)};

/** Weather presets carry a normalized intensity. Flight uses metres per second. */
export function marineWindSpeed(strength:number,gust=0){
 return Math.min(13,Math.max(0,strength)*9+Math.max(0,gust)*3.5);
}
