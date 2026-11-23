const smooth=(a:number,b:number,v:number)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t);};

/** Metre-scale drainage on the outer headland, excluded from the landing bay. */
export function harborRelief(x:number,z:number,height:number,radius:number){
 const mask=smooth(70,150,Math.abs(x))*smooth(12,32,height)*(1-smooth(-155,-55,z))*smooth(.48,.72,radius)*(1-smooth(.96,1.04,radius));
 if(mask===0)return 0;
 const bend=x+13*Math.sin(z*.023)+5*Math.sin(z*.061);
 const drainage=Math.pow(.5+.5*Math.sin(bend*.067+Math.sin(z*.019)),6);
 const bedding=2.1*Math.sin(x*.041+z*.027)+1.3*Math.sin(z*.082-x*.018);
 return mask*(bedding-drainage*(5+smooth(20,90,height)*6));
}

/** Coast sectors in metres about the base. South-facing working quay and the
 * separately modelled breakwater are outside the outer-coast blend. */
function windwardSector(x:number,z:number){
 return (1-smooth(-140,85,z))*(1-.55*smooth(110,410,x));
}

export function harborOuterShore(x:number,z:number,radius:number,height:number,inland:number){
 const outer=smooth(.68,.84,radius)*(1-smooth(1.014,1.075,radius));
 const outsideBasin=smooth(30,80,inland)*(1-smooth(128,218,z));
 const exposure=windwardSector(x,z);
 // Retreating upper cliff behind a lower wave-cut bench. The two profiles
 // share a coherent bedding direction while individual buttresses vary.
 const bedding=.013*Math.sin(x*.028+z*.017)+.008*Math.sin(z*.071-x*.033);
 const cliff=-24+34*(1-smooth(.982+bedding,1.029+bedding,radius))
  +35*(1-smooth(.878+bedding,.959+bedding,radius))
  +18*(1-smooth(.795+bedding,.872+bedding,radius));
 const lee=-24+38*(1-smooth(.86+bedding,1.056+bedding,radius))
  +19*(1-smooth(.75,.89,radius));
 return height+(lee+(cliff-lee)*exposure-height)*outer*outsideBasin;
}

/** Large land-cover shapes shared by ground colour and vegetation placement. */
export function harborGroundCover(x:number,z:number){
 const ridge=Math.exp(-(((x+166)/151)**2+((z+202)/101)**2));
 const woodland=Math.exp(-(((x-125)/180)**2+((z+169)/137)**2));
 const orchard=Math.exp(-(((x-235)/113)**2+((z+18)/76)**2));
 const clearing=Math.exp(-(((x+17)/116)**2+((z+40)/83)**2));
 return {
  grove:smooth(.17,.67,Math.max(ridge,woodland,orchard*.72)*(1-.86*clearing)),
  limestone:windwardSector(x,z),
  orchard:smooth(.28,.70,orchard),
 };
}

/** Low woodland between the terraced windmill quarters. Coordinates are local metres. */
export function townGroundCover(x:number,z:number){
 const westernSlope=Math.exp(-(((x+350)/192)**2+((z-115)/170)**2));
 const northernSlope=Math.exp(-(((x-237)/192)**2+((z-248)/137)**2));
 const orchard=Math.exp(-(((x-450)/121)**2+((z+20)/95)**2));
 return {
  grove:smooth(.18,.78,Math.max(westernSlope,northernSlope,orchard*.74)),
  limestone:0,
  orchard:smooth(.26,.78,orchard),
 };
}
