import * as T from 'three';import {random} from './WorldConfig.ts';
/** Deterministic eroded silhouettes: offset peaks, broken headlands and a submerged skirt. */
export function distantIslandGeometry(seed:number){const rng=random(seed),phase=rng()*6.28,leanX=rng()*.7-.35,leanZ=rng()*.6-.3,positions:number[]=[],indices:number[]=[];const radial=40,rings=11;
 for(let ring=0;ring<=rings;ring++)for(let j=0;j<=radial;j++){const a=j/radial*Math.PI*2,r=ring/rings,coast=1+.18*Math.sin(a*3+phase)+.10*Math.cos(a*5-phase)+.045*Math.sin(a*11+phase*2),x=Math.cos(a)*r*coast,z=Math.sin(a)*r*coast;const peaks=Math.exp(-((x-leanX)**2/.20+(z-leanZ)**2/.40))+.6*Math.exp(-((x+.42)**2/.11+(z-.18)**2/.18));const y=ring===rings?-.22:(.15+peaks*.85)*(1-r*r)+.035*Math.sin(x*19+phase)*Math.cos(z*16);positions.push(x,y,z);}
 for(let r=0;r<rings;r++)for(let j=0;j<radial;j++){const a=r*(radial+1)+j,b=a+radial+1;indices.push(a,b,a+1,b,b+1,a+1);}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();return g;
}
