export const qualityPresets={
 high:{name:'精致',resolution:1,cloudScale:.45,shadows:true,reflection:true},
 balanced:{name:'平衡',resolution:.85,cloudScale:.30,shadows:true,reflection:false},
 performance:{name:'流畅',resolution:.7,cloudScale:.20,shadows:false,reflection:false},
} as const;
export type QualityId=keyof typeof qualityPresets;
export function resolveQuality(value:string|null):QualityId{return value==='balanced'||value==='performance'?value:'high';}
