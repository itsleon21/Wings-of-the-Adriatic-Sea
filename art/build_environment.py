"""Original reusable environment kit, Y up. Rebuild with Blender --background --python art/build_environment.py."""
import bpy, bmesh, math, os, random, sys
from mathutils import Vector, Matrix
BASE=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
scene=bpy.context.scene;scene.gravity=(0,-9.81,0)
def material(name,c):
 m=bpy.data.materials.new(name);m.diffuse_color=(*c,1);m.use_nodes=True;m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(*c,1);m.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.85;return m
cream=material('Limewashed plaster',(.79,.71,.52));ochre=material('Ochre plaster',(.68,.46,.25));ivory=material('Limestone trim',(.91,.83,.64));roof=material('Terracotta tiles',(.43,.115,.055));rooflight=material('Sunlit terracotta',(.56,.20,.10));green=material('Beige painted joinery',(.65,.55,.38));dark=material('Recessed windows',(.035,.065,.055));wood=material('Weathered walnut',(.19,.13,.075));pine=material('Pine foliage',(.025,.07,.028));pinelight=material('Sunlit needles',(.06,.12,.045));stone=material('Limestone',(.5,.49,.40));glass=material('Lantern glass',(.36,.53,.46));metal=material('Aged bronze',(.17,.15,.10))
def group(name,x):
 o=bpy.data.objects.new(name,None);scene.collection.objects.link(o);o.location.x=x;return o
def finish(o,name,m,parent):
 o.name=name;o.parent=parent;o.data.materials.append(m);return o
cube_source=bpy.data.meshes.new('Shared unit cube source')
cube_source.from_pydata([(-.5,-.5,-.5),(.5,-.5,-.5),(.5,.5,-.5),(-.5,.5,-.5),(-.5,-.5,.5),(.5,-.5,.5),(.5,.5,.5),(-.5,.5,.5)],[],[(0,3,2,1),(4,5,6,7),(0,1,5,4),(3,7,6,2),(0,4,7,3),(1,2,6,5)])
cube_source.update()
def box(name,p,s,m,parent,bevel=0):
 # Direct datablock creation avoids rebuilding the entire dependency graph for
 # every small sill, tile and rafter during offline generation.
 data=cube_source.copy();o=bpy.data.objects.new(name,data);scene.collection.objects.link(o);o.location=p;o.scale=s;finish(o,name,m,parent)
 if bevel:
  for vertex in data.vertices:vertex.co=Vector((vertex.co.x*s[0],vertex.co.y*s[1],vertex.co.z*s[2]))
  o.scale=(1,1,1);a=o.modifiers.new('Soft worn corners','BEVEL');a.width=bevel;a.segments=1
 return o

def mesh(name,v,f,m,parent):
 data=bpy.data.meshes.new(name);data.from_pydata(v,[],f);data.update();o=bpy.data.objects.new(name,data);scene.collection.objects.link(o);return finish(o,name,m,parent)
def cylinder(name,p,r,depth,m,parent,vertices=12):
 bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=r,depth=depth,location=p,rotation=(-math.pi/2,0,0));return finish(bpy.context.object,name,m,parent)
def house(name,x,wall):
 g=group(name,x);box('Masonry',(0,0,0),(1,1,1),wall,g,.015);box('Stone foundation',(0,-.44,0),(1.035,.16,1.035),stone,g)
 v=[(-.57,.5,-.57),(.57,.5,-.57),(0,.91,-.57),(-.57,.5,.57),(.57,.5,.57),(0,.91,.57)]
 mesh('Gabled roof',v,[(0,1,2),(3,5,4),(0,2,5,3),(1,4,5,2)],roof,g)
 for side in [-1,1]:
  for row in range(6):
   for col in range(5):
    a=.065+row*.086;tile=box('Clay roof tile',(side*a,.905-a*.72,-.44+col*.22),(.1,.026,.214),rooflight if (row+col)%3==0 else roof,g);tile.rotation_euler[2]=-side*.62
  for floor in [-.2,.23]:
   for xx in [-.26,.26]:
    box('Window frame',(xx,floor,side*.512),(.205,.245,.025),ivory,g)
    box('Window recess',(xx,floor,side*.53),(.15,.2,.02),dark,g)
    for shutter in [-1,1]:box('Shutter',(xx+shutter*.117,floor,side*.54),(.064,.22,.024),green,g)
    box('Window sill',(xx,floor-.135,side*.54),(.25,.025,.08),ivory,g)
 box('Door recess',(0,-.3,.525),(.19,.4,.03),dark,g);box('Wooden door',(0,-.3,.545),(.15,.36,.025),wood,g)
 box('Doorstep',(0,-.48,.6),(.28,.04,.25),stone,g);box('Chimney',(.28,.83,-.28),(.1,.3,.12),wall,g);box('Chimney cap',(.28,.99,-.28),(.13,.04,.15),ivory,g)
 return g
house('HouseCream',0,cream);house('HouseOchre',3,ochre)
g=group('Warehouse',6);box('Warehouse walls',(0,5,0),(24,10,15),cream,g,.2);mesh('Warehouse roof',[(-13,10,-8),(13,10,-8),(0,15,-8),(-13,10,8),(13,10,8),(0,15,8)],[(0,2,5,3),(1,4,5,2),(0,1,2),(3,5,4)],roof,g)
for x in [-7,0,7]:box('Loading door',(x,3,7.55),(4.5,6,.2),wood,g);box('Door lintel',(x,6.3,7.7),(5.4,.5,.6),ivory,g)
for x in range(-11,12,2):box('Roof seam',(x,12.5-abs(x)*.19,0),(.11,.08,16),rooflight,g)
# Lighthouse uses real-meter dimensions.
g=group('Lighthouse',9);cylinder('Base plinth',(0,3,0),20,6,stone,g,24)
for y,r,h in [(7,11,4),(29,9,40),(51,8.5,4),(56,10.3,3),(63,6.5,11)]:cylinder('Tower section',(0,y,0),r,h,glass if y==63 else ivory,g,24)
for i in range(12):
 a=i/12*math.tau;box('Lantern mullion',(math.cos(a)*6.5,63,math.sin(a)*6.5),(.45,11,.45),metal,g)
 a=i/12*math.tau;cylinder('Balcony pillar',(math.cos(a)*9.3,58,math.sin(a)*9.3),.24,3,metal,g,8)
bpy.ops.mesh.primitive_torus_add(major_radius=9.3,minor_radius=.22,major_segments=24,minor_segments=6,location=(0,59.5,0),rotation=(-math.pi/2,0,0));finish(bpy.context.object,'Balcony rail',metal,g)
bpy.ops.mesh.primitive_cone_add(vertices=24,radius1=10,radius2=0,depth=10,location=(0,73,0),rotation=(-math.pi/2,0,0));finish(bpy.context.object,'Lantern roof',roof,g)
for y in [15,30,44]:box('Tower window',(0,y,9.01),(2.5,4,.2),green,g)
box('Tower door',(0,7,11.1),(3.5,6,.3),wood,g)
# Crown is normalized for existing instancing transforms.
g=group('PineCrown',12)
for y,r,h in [(.23,1,.6),(.47,.78,.59),(.7,.5,.6)]:
 bpy.ops.mesh.primitive_cone_add(vertices=7,radius1=r,radius2=.02,depth=h,location=(0,y,0),rotation=(-math.pi/2,0,0));o=finish(bpy.context.object,'Pine branch tier',pine if y<.4 else pinelight,g)
# Distinct olive crowns for harbor edges.
g=group('OliveTree',15);cylinder('Olive trunk',(0,.35,0),.045,.7,wood,g,7)
for i in range(4):
 a=i/4*math.tau;bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=1,location=(math.cos(a)*.27,.65,math.sin(a)*.27));o=finish(bpy.context.object,'Olive foliage',pinelight,g);o.scale=(.53,.31,.53)
g=group('CoastalRock',18);bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2,radius=1);o=finish(bpy.context.object,'Eroded limestone',stone,g);rng=random.Random(32)
for v in o.data.vertices:
 v.co*=.85+rng.random()*.3;v.co.y=math.floor(v.co.y*8)/8
# Small fishing boat with a shaped hull, cabin, mast and gunwale.
g=group('FishingBoat',24)
rings=[(-6,.08),(-5,1.6),(-2,2),(2,1.9),(5,1.2),(5.8,.6)];v=[];f=[]
for z,w in rings:v.extend([(-w,1,z),(w,1,z),(w*.65,-.6,z),(-w*.65,-.6,z)])
for i in range(len(rings)-1):
 for j in range(4):f.append((i*4+j,i*4+(j+1)%4,(i+1)*4+(j+1)%4,(i+1)*4+j))
f.extend([(0,3,2,1),tuple((len(rings)-1)*4+j for j in range(4))]);mesh('Fishing hull',v,f,green,g)
box('Wooden deck',(0,.83,.5),(3.4,.15,8),wood,g);box('Cabin',(0,1.8,1.1),(2.3,2,2.8),ivory,g);box('Cabin roof',(0,2.9,1.1),(2.7,.25,3.2),roof,g);box('Cabin window',(0,2.05,-.32),(1.6,.7,.08),glass,g)
cylinder('Mast',(0,3.4,-2.4),.095,6.2,wood,g,8)
for x in [-1.85,1.85]:box('Gunwale',(x,1.1,0),(.14,.2,7),ivory,g)
# Normalized Adriatic village families. The runtime scales these exact modules in meters.
material_cache_glass=material('Muted sky reflected glass',(.065,.12,.135))
rose=material('Faded coral plaster',(.72,.46,.34));sand=material('Warm sand plaster',(.81,.73,.55));chalk=material('Pale coastal plaster',(.80,.79,.68));sage=material('Warm beige shutters',(.65,.55,.38));awn=material('Ochre canvas awning',(.67,.42,.20));roofdark=material('Weathered burnt clay',(.34,.095,.045))
def plinth(g,x=0,z=0,w=1,d=1):box('Rough stone plinth',(x,-.46,z),(w,.08,d),stone,g)
def wallblock(g,x,z,w,d,top,m):
 box('Plastered masonry',(x,(top-.5)/2,z),(w,top+.5,d),m,g,.005)
 # Projecting eaves cast a continuous shadow across each principal facade.
 box('Lime cornice',(x,top-.023,z),(w+.026,.038,d+.026),ivory,g)
 box('Cornice drip edge',(x,top+.002,z),(w+.049,.017,d+.049),stone,g)
 if g.name in ['HouseTownhouse','HouseVilla','HouseArcade']:
  for side in [-1,1]:
   for i in range(5):
    length=.074 if i%2 else .11
    box('Dressed corner stone',(x+side*(w-length)*.5,-.38+i*(top+.31)/5,z+d*.5),(length,.072,.031),chalk,g)

window_openings=[]
def window(g,x,y,z,w=.18,h=.23,shutters=True):
 window_openings.append((g,x,y,z,w,h))
 for side in [-1,1]:
  box('Solid window jamb',(x+side*(w/2+.010),y,z-.022),(.020,h+.04,.075),ivory,g)
 for edge in [-1,1]:
  box('Window head and sill reveal',(x,y+edge*(h/2+.010),z-.022),(w,.020,.075),ivory,g)
 box('Deep shaded window',(x,y,z-.054),(w,h,.008),dark,g)
 box('Window mullion',(x,y,z-.030),(.013,h,.012),wood,g)
 box('Window transom',(x,y+h*.12,z-.027),(w,.012,.012),wood,g)
 pane=material_cache_glass
 box('Subtle reflected sky in window',(x,y,z-.041),(w*.94,h*.94,.004),pane,g)

 if shutters:
  for side in[-1,1]:
   sx=x+side*(w*.5+.045)
   box('Open painted shutter',(sx,y,z+.018),(.060,h+.008,.025),sage,g)
   for row in[-1,0,1]:
    yy=y+row*h*.28
    mesh('Carved shutter louvre',[(sx-.024,yy-.006,z+.034),(sx+.024,yy-.006,z+.034),(sx+.024,yy+.006,z+.039),(sx-.024,yy+.006,z+.039)],[(0,1,2,3)],green,g)
 box('Projecting sill',(x,y-h*.5-.025,z+.022),(w+.10,.026,.06),ivory,g)
def door(g,x,z,top=.0,w=.19):
 box('Recessed doorway',(x,(top-.48)/2,z),(w+.05,top+.48,.018),dark,g)
 box('Weathered plank door',(x,(top-.48)/2,z+.013),(w,top+.45,.018),wood,g)
 box('Door lintel',(x,top+.016,z+.018),(w+.085,.035,.045),ivory,g)
 for t in[.25,.72]:box('Recessed timber door panel',(x,-.47+(top+.44)*t,z+.026),(w*.70,(top+.44)*.30,.008),wood,g)
 box('Aged brass door latch',(x+w*.31,-.25,z+.035),(.012,.025,.012),metal,g)
def gable(g,x,z,w,d,eave=.5,ridge=.87,axis='z',m=roof,offset=0):
 # A ridge shifted from the center breaks the perfect repeated roof silhouette.
 def p(xx,yy,zz):return(x+xx,yy,z+zz) if axis=='z' else(x+zz,yy,z+xx)
 v=[p(-w/2,eave,-d/2),p(w/2,eave,-d/2),p(offset,ridge,-d/2),p(-w/2,eave,d/2),p(w/2,eave,d/2),p(offset,ridge,d/2)]
 # A closed roof shell gives the eaves a visible underside and real thickness.
 v += [p(-w/2,eave-.018,-d/2),p(w/2,eave-.018,-d/2),p(-w/2,eave-.018,d/2),p(w/2,eave-.018,d/2)]
 faces=[(6,7,1,2,0),(8,3,5,4,9),(0,2,5,3),(1,4,5,2),(6,8,9,7),(6,0,3,8),(7,9,4,1)]
 mesh('Solid clay roof and eave returns',v,faces,m,g)
 for side in [-1,1]:
  beam=box('Continuous timber eave',p(side*w/2,eave-.024,0),(.022,.027,d) if axis=='z' else (d,.027,.022),wood,g)
  for i in range(8):
   zz=-d*.44+i*d*.88/7
   box('Exposed rafter end',p(side*(w/2-.028),eave-.041,zz),(.072,.025,.020) if axis=='z' else (.020,.025,.072),wood,g)
 for side in[-1,1]:
  reach=w/2-side*offset
  for row in range(1,6):
   t=row/6;xx=offset+side*reach*t;yy=ridge+(eave-ridge)*t+.009
   pos=p(xx,yy,0);s=(.018,.012,d*.98) if axis=='z' else(d*.98,.012,.018)
   box('Long weathered tile course',pos,s,rooflight if row%3==0 else roofdark,g)
 pos=p(offset,ridge+.012,0);s=(.034,.025,d*1.02) if axis=='z' else(d*1.02,.025,.034)
 box('Ridge cap tiles',pos,s,rooflight,g)
 for cap in range(12):
  a0=-d*.51+cap*d*1.02/12;a1=a0+d*1.02/12*.96;verts=[]
  for zz in[a0,a1]:
   for k in range(5):
    theta=k*math.pi/4
    verts.append(p(offset+math.cos(theta)*.023,ridge+.017+math.sin(theta)*.018,zz))
  faces=[(k,k+1,k+6,k+5) for k in range(4)]
  mesh('Individual curved ridge tile',verts,faces,rooflight if cap%4 else roofdark,g)
def hip(g,x,z,w,d,eave=.44,ridge=.79,m=roof):
 v=[(x-w/2,eave,z-d/2),(x+w/2,eave,z-d/2),(x+w/2,eave,z+d/2),(x-w/2,eave,z+d/2),(x,ridge,z-d*.20),(x,ridge,z+d*.20)]
 mesh('Four pitched hipped tile roof',v,[(0,1,4),(1,2,5,4),(2,3,5),(3,0,4,5)],m,g)
 box('Hipped roof ridge',(x,ridge+.012,z),(.035,.022,d*.44),rooflight,g)
 for side in[-1,1]:
  for i in range(1,6):
   t=i/6;box('Hip roof tile course',(x+side*w*.5*t,ridge+(eave-ridge)*t+.008,z),(.018,.012,d*(.4+.55*t)),roofdark if i%2 else rooflight,g)
def chimney(g,x,z,bottom=.48,top=1.02,m=chalk):
 box('Rendered chimney',(x,(bottom+top)/2,z),(.085,top-bottom,.095),m,g)
 box('Chimney stone cap',(x,top+.018,z),(.125,.036,.13),ivory,g)
 cylinder('Chimney pot',(x,top+.075,z),.025,.09,roofdark,g,8)
def rail(g,x,z,w,y=.15,depth=.14):
 box('Balcony stone slab',(x,y-.10,z),(w,.047,depth),stone,g)
 for side in[-1,1]:box('Balcony end rail',(x+side*(w/2-.014),y+.035,z),(.025,.028,depth),wood,g)
 box('Balcony top rail',(x,y+.035,z+depth*.5),(w,.03,.025),wood,g)
 for i in range(7):box('Balcony slim baluster',(x-w*.46+i*w*.92/6,y-.025,z+depth*.5),(.011,.12,.012),metal,g)
def arch(g,x,base,z,w=.27,h=.40):
 r=w/2;cy=base+h-r;band=.034;depth=.055
 for side in[-1,1]:box('Loggia stone column',(x+side*(r+band/2),(base+cy)/2,z),(band,cy-base,depth),ivory,g)
 # The loggia is a real opening between columns, with a curved extruded arch overhead.
 verts=[];faces=[];steps=10
 for i in range(steps+1):
  a=i/steps*math.pi
  for rr in[r,r+band]:
   for zz in[-depth/2,depth/2]:verts.append((x+math.cos(a)*rr,cy+math.sin(a)*rr,z+zz))
 for i in range(steps):
  n=i*4;k=(i+1)*4;faces.extend([(n,k,k+1,n+1),(n+2,n+3,k+3,k+2),(n,n+2,k+2,k),(n+1,k+1,k+3,n+3)])
 faces.extend([(0,1,3,2),(steps*4,steps*4+2,steps*4+3,steps*4+1)])
 mesh('Open stone loggia arch',verts,faces,ivory,g)

# Low fishermen's cottage: offset ridge, shallow porch, worn timber and chimney.
g=group('HouseFisher',30);wallblock(g,-.035,-.035,.93,.88,.23,sand);plinth(g,-.035,-.035,.98,.94)
gable(g,-.035,-.035,1.07,1.03,.23,.62,offset=-.08,m=roofdark)
for x in[-.27,.20]:window(g,x,-.035,.416,.16,.21)
door(g,-.04,.423,-.11,.15)
box('Shallow fisher porch',(-.035,-.285,.50),(.56,.034,.24),wood,g)
for x in[-.29,.22]:box('Porch timber post',(x,-.21,.58),(.027,.52,.027),wood,g)
awning=box('Fisher canvas shelter',(-.035,.06,.535),(.58,.025,.19),awn,g);awning.rotation_euler[0]=-.14
chimney(g,.23,-.24,.36,.76,sand)
box('Boat shed side shelf',(-.48,-.25,-.1),(.10,.045,.36),wood,g)

# Taller narrow townhouse: three storeys, bay-front balcony and cross-gabled dormer.
g=group('HouseTownhouse',33);wallblock(g,0,0,.84,.94,.58,rose);plinth(g,0,0,.90,1.0)
gable(g,0,0,.98,1.08,.58,.95,offset=.035)
for yy in[-.27,.08,.42]:
 for xx in[-.22,.22]:window(g,xx,yy,.481,.14,.21)
door(g,0,.49,-.06,.15);rail(g,0,.565,.64,.05,.16)
# A front-facing little cross gable changes the skyline without enlarging the footprint.
box('Dormer cheek',(0,.61,.29),(.32,.22,.32),rose,g)
gable(g,0,.29,.38,.38,.72,.94,axis='x',m=roofdark)
window(g,0,.65,.455,.11,.14,False);chimney(g,-.27,-.27,.63,.93,rose)

# Harbor arcade shop: three genuine arches shelter a ground-floor loggia.
g=group('HouseArcade',36);wallblock(g,0,-.085,1.0,.77,.48,ochre);plinth(g,0,.0,1.065,1.07)
# Upper floor projects over the colonnade while the shaded walkway remains open below.
box('Upper loggia frontage',(0,.29,.45),(1.0,.38,.16),ochre,g)
box('Shop floor',(0,-.46,.44),(1.03,.08,.30),stone,g)
for xx in[-.34,0,.34]:arch(g,xx,-.42,.56,.255,.43)
for xx in[-.27,.27]:window(g,xx,.30,.544,.16,.20)
door(g,-.27,.31,-.08,.18)
box('Shop shadow recess',(.20,-.23,.31),(.36,.35,.018),dark,g)
box('Shop timber sign',(.20,.005,.345),(.38,.058,.025),wood,g)
gable(g,0,-.005,1.13,1.16,.49,.81,offset=-.025)
box('Loggia cornice',(0,.495,.55),(1.07,.045,.075),ivory,g)
chimney(g,-.35,-.24,.52,.90,ochre)

# Villa: four-pitched roof and an airy portico, lower roof silhouette than a townhouse.
g=group('HouseVilla',39);wallblock(g,0,-.055,1.0,.86,.39,chalk);plinth(g,0,-.01,1.06,1.0)
hip(g,0,-.03,1.14,1.10,.41,.76)
for yy in[-.22,.16]:
 for xx in[-.28,.28]:window(g,xx,yy,.389,.17,.21)
door(g,0,.389,-.045,.17)
box('Portico stone canopy',(0,-.06,.51),(.43,.045,.25),ivory,g)
for xx in[-.18,.18]:box('Portico square column',(xx,-.26,.58),(.035,.38,.035),ivory,g)
for i in range(3):box('Villa entrance step',(0,-.4825+i*.045,.52+i*.028),(.46-i*.06,.035,.16),stone,g)
chimney(g,.30,-.21,.49,.84,chalk)

# Wide, low harbor workshop with an attached lean-to, plank loading door and roof vent.
g=group('HouseWorkshop',42);wallblock(g,-.10,0,.80,.95,.14,cream);plinth(g,0,0,1.12,1.03)
gable(g,-.10,0,.92,1.08,.15,.48,m=roofdark,offset=.06)
wallblock(g,.42,-.02,.28,.90,-.045,wood)
mesh('Lean-to tiled shed roof',[(.25,.20,-.52),(.61,.015,-.52),(.61,.015,.51),(.25,.20,.51)],[(0,1,2,3)],roof,g)
box('Workshop loading door',(-.10,-.24,.487),(.48,.43,.026),wood,g)
for xx in[-.27,-.10,.07]:box('Loading door plank reveal',(xx,-.24,.504),(.012,.43,.012),dark,g)
box('Workshop door lintel',(-.10,.0,.51),(.57,.045,.055),ivory,g)
window(g,-.37,-.12,.487,.11,.16,False)
box('Long side workshop window',(.568,-.17,-.09),(.026,.16,.42),dark,g)
box('Roof ventilator',(-.10,.40,-.10),(.24,.12,.32),wood,g)
hip(g,-.10,-.10,.29,.37,.46,.55,m=roofdark)
box('Workshop loading platform',(-.10,-.46,.56),(.65,.055,.16),wood,g)

# Asymmetric L-house: long front range, cross roof wing and an open roof terrace.
g=group('HouseTerrace',45);wallblock(g,-.22,0,.56,1.0,.44,sand);wallblock(g,.28,-.26,.44,.48,.25,chalk)
plinth(g,-.22,0,.61,1.06);plinth(g,.28,-.26,.48,.54)
gable(g,-.22,0,.69,1.13,.45,.85,offset=-.035)
gable(g,.22,-.26,.60,.66,.26,.56,axis='x',m=roofdark)
box('Open terrace slab',(.29,.0,.27),(.47,.045,.47),stone,g)
# Stone parapets leave a readable courtyard recess rather than a third solid block.
box('Terrace front parapet',(.29,.075,.495),(.48,.14,.035),ivory,g)
box('Terrace side parapet',(.51,.075,.27),(.035,.14,.47),ivory,g)
for xx in[-.36,-.10]:window(g,xx,.18,.514,.12,.20)
door(g,-.23,.515,-.08,.16)
window(g,.28,.065,-.007,.14,.17,False)
chimney(g,-.35,-.28,.49,.92,sand)
box('Terrace pergola crossbeam',(.29,.30,.29),(.45,.027,.028),wood,g)
for xx in[.09,.49]:box('Pergola slender post',(xx,.13,.29),(.023,.34,.023),wood,g)

# Hvar-inspired public loggia: open colonnade, recessed rear hall and a low hipped roof.
g=group('HouseLoggia',48);plinth(g,0,0,1.13,1.02)
wallblock(g,0,-.27,1.05,.39,.33,chalk)
box('Loggia raised stone floor',(0,-.45,.10),(1.09,.10,.88),ivory,g)
for xx in[-.40,-.13,.14,.41]:arch(g,xx,-.40,.47,.22,.64)
for xx in[-.40,-.13,.14,.41]:window(g,xx,-.04,-.062,.12,.25,False)
box('Continuous loggia entablature',(0,.28,.47),(1.13,.10,.10),ivory,g)
hip(g,0,0,1.20,1.12,.34,.64,roofdark)
for xx in[-.51,.51]:box('Side arcade pier',(xx,-.08,.08),(.07,.72,.80),chalk,g)
for i in range(3):box('Public hall entrance steps',(0,-.488+i*.026,.56-i*.025),(.62,.022,.075),stone,g)
# Narrow three-storey palazzo: projecting central balcony, rusticated base and a true hipped crown.
g=group('HousePalazzo',51);plinth(g,0,0,.92,1.0)
wallblock(g,0,-.02,.85,.94,.62,chalk)
box('Rusticated ground storey',(0,-.33,-.02),(.87,.31,.96),sand,g)
for y in[-.40,-.30,-.20]:box('Stone base horizontal course',(0,y,.466),(.87,.012,.016),ivory,g)
for y in[-.05,.28]:
 for xx in[-.27,0,.27]:window(g,xx,y,.46,.13,.23)
for y in[.10,.45]:box('Palazzo floor string course',(0,y,.46),(.90,.027,.049),ivory,g)
door(g,0,.475,-.15,.19);rail(g,0,.55,.34,.18,.17)
hip(g,0,-.02,1.02,1.08,.64,.94)
chimney(g,-.29,-.24,.67,.925)
# Naval boatyard: two unequal gables, a large timber slip door and a glazed clerestory.
g=group('HouseBoatyard',54);plinth(g,0,0,1.12,1.02)
wallblock(g,-.18,0,.67,.95,.22,stone);wallblock(g,.35,-.05,.36,.85,.04,ochre)
gable(g,-.18,0,.77,1.08,.23,.69,m=roofdark)
gable(g,.35,-.05,.43,.97,.05,.38,m=roof)
box('Tall recessed boat shed opening',(-.18,-.13,.487),(.47,.63,.018),dark,g)
for xx in[-.30,-.06]:
 box('Sliding walnut boat shed door',(xx,-.14,.505),(.22,.60,.024),wood,g)
 for j in range(4):box('Shed door vertical batten',(xx-.075+j*.05,-.14,.522),(.008,.58,.013),metal,g)
box('Slip door iron overhead track',(-.18,.20,.52),(.60,.025,.037),metal,g)
window(g,-.18,.39,.51,.19,.14,False)
window(g,.35,-.14,.385,.17,.17,False)
for z in[-.30,0,.30]:box('Boatyard side buttress',(-.53,-.15,z),(.05,.69,.075),ivory,g)

# Working mill-house: tapered stone tower, attached miller's home, furled canvas at rest.
g=group('HouseMill',57);plinth(g,0,0,1.15,1.02)
wallblock(g,-.23,-.05,.62,.83,.17,chalk);gable(g,-.23,-.05,.73,.94,.18,.48,m=roofdark)
cylinder('Mill house tapered stone tower',(.28,.035,0),.28,1.07,chalk,g,16)
cylinder('Mill tower limestone base',(.28,-.455,0),.32,.09,stone,g,16)
bpy.ops.mesh.primitive_cone_add(vertices=16,radius1=.34,radius2=0,depth=.37,location=(.28,.755,0),rotation=(-math.pi/2,0,0));finish(bpy.context.object,'Mill conical clay cap',roof,g)
door(g,-.24,.38,-.14,.17);window(g,-.24,-.03,.39,.15,.18)
window(g,.28,.12,.285,.11,.16,False)
# Resting timber sail frame; canvas is rolled on alternate spars.
for i in range(4):
 a=i*math.pi/2+.30;c=math.cos(a);ss=math.sin(a)
 for t in [.12,.25,.31]:
  o=box('Mill resting sail spar',(.28+c*t,.43+ss*t,.35),(.14,.015,.018),wood,g);o.rotation_euler.z=a
 if i%2==0:
  o=box('Furled linen on sail',(.28+c*.29,.43+ss*.29,.37),(.19,.038,.025),awn,g);o.rotation_euler.z=a
# Two additional mill-house silhouettes: taller round tower and square stone tower.
for name,xx in [('HouseMillTall',60),('HouseMillSquare',63)]:
 source=bpy.data.objects['HouseMill'];g=group(name,xx)
 for obj in source.children_recursive:
  copy=obj.copy();copy.data=obj.data.copy();scene.collection.objects.link(copy);copy.parent=g
  if name=='HouseMillTall':
   if obj.name.startswith('Mill house tapered stone tower'):copy.scale.z*=1.10;copy.location.y+=.0535
   if obj.name.startswith('Mill conical clay cap'):copy.location.y+=.107;copy.data.materials.clear();copy.data.materials.append(rooflight)
  else:
   if obj.name.startswith('Mill house tapered stone tower') or obj.name.startswith('Mill conical clay cap'):
    radius=.22 if obj.name.startswith('Mill house') else .30
    for v in copy.data.vertices:
     extent=max(abs(v.co.x),abs(v.co.y))
     if extent>.001:v.co.x=v.co.x/extent*radius;v.co.y=v.co.y/extent*radius
   if obj.name.startswith('Mill conical clay cap'):copy.data.materials.clear();copy.data.materials.append(roofdark)
# Grain warehouse with large shutters, loading doors and a roof hoist.
g=group('HouseGranary',66);plinth(g,0,0,1.12,1.04);wallblock(g,0,0,1.03,.96,.40,sand);gable(g,0,0,1.18,1.10,.41,.83,m=roofdark)
for x in[-.30,.30]:
 door(g,x,.49,-.04,.22);window(g,x,.20,.49,.15,.19,False)
box('Grain loading loft hatch',(0,.54,.557),(.19,.22,.025),wood,g)
box('Loft timber hoist beam',(0,.70,.57),(.035,.04,.16),wood,g)
for x in[-.45,.45]:box('Grain shed corner pier',(x,-.02,.494),(.052,.82,.045),stone,g)
# Public covered market: open stone arches and recessed shutters, broad hipped roof.
g=group('HouseMarketHall',69);plinth(g,0,0,1.15,1.04);wallblock(g,0,-.29,1.05,.38,.32,chalk)
box('Market hall raised floor',(0,-.455,.03),(1.10,.09,.94),ivory,g)
for x in[-.40,-.13,.14,.41]:arch(g,x,-.40,.48,.22,.65)
box('Market hall entablature',(0,.28,.48),(1.16,.09,.10),ivory,g);hip(g,0,0,1.23,1.14,.34,.74,m=rooflight)
for x in[-.48,.48]:box('Market hall masonry side',(x,-.10,.07),(.07,.70,.76),sand,g)
for x in[-.34,0,.34]:window(g,x,-.04,-.09,.15,.25,False)
# Cut shallow real openings in the host masonry before cavity baking. Each host
# receives one joined cutter batch. Reveal jambs and recessed glass stay separate.
bpy.context.view_layer.update()
host_cuts={}
for g,x,y,z,w,h in window_openings:
 for host in g.children_recursive:
  if host.type!='MESH' or not any(token in host.name for token in ['Plastered masonry','Upper loggia frontage','Dormer cheek']):continue
  corners=[host.matrix_local @ Vector(corner) for corner in host.bound_box]
  lo=[min(v[k] for v in corners) for k in range(3)];hi=[max(v[k] for v in corners) for k in range(3)]
  if lo[0]<x-w*.45 and hi[0]>x+w*.45 and lo[1]<y-h*.40 and hi[1]>y+h*.40 and abs(hi[2]-z)<.045:
   cut=box('Temporary window cutter',(x,y,z-.026),(w,h,.15),dark,g)
   host_cuts.setdefault(host,[]).append(cut);break
for host,cutters in host_cuts.items():
 bpy.ops.object.select_all(action='DESELECT')
 for cutter in cutters:cutter.select_set(True)
 bpy.context.view_layer.objects.active=cutters[0];bpy.ops.object.join();cutter=bpy.context.object
 bpy.context.view_layer.objects.active=host
 mod=host.modifiers.new('Real recessed window openings','BOOLEAN');mod.operation='DIFFERENCE';mod.solver='EXACT';mod.object=cutter
 bpy.ops.object.modifier_apply(modifier=mod.name);bpy.data.objects.remove(cutter,do_unlink=True)
print('ARCHITECTURE_WINDOW_HOSTS',len(host_cuts),flush=True)
# Consistent outward face normals on the newly built architectural shells.
for module_name in ['HouseFisher','HouseTownhouse','HouseArcade','HouseVilla','HouseWorkshop','HouseTerrace','HouseLoggia','HousePalazzo','HouseBoatyard','HouseMill','HouseMillTall','HouseMillSquare','HouseGranary','HouseMarketHall']:
 for obj in bpy.data.objects[module_name].children_recursive:
  if obj.type=='MESH':
   bm=bmesh.new();bm.from_mesh(obj.data);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(obj.data);bm.free()
# Bake short-range sky visibility into vertex colors for indirect light only.
# One BVH per module includes eaves, window surrounds and arcades.
from mathutils.bvhtree import BVHTree
bpy.context.view_layer.update()
for name in ['HouseCream','HouseOchre','HouseFisher','HouseTownhouse','HouseArcade','HouseVilla','HouseWorkshop','HouseTerrace','HouseLoggia','HousePalazzo','HouseBoatyard','HouseMill','HouseMillTall','HouseMillSquare','HouseGranary','HouseMarketHall']:
 objects=[obj for obj in bpy.data.objects[name].children_recursive if obj.type=='MESH']
 vertices=[];polygons=[]
 for obj in objects:
  offset=len(vertices)
  vertices.extend([obj.matrix_world @ v.co for v in obj.data.vertices])
  polygons.extend([tuple(offset+i for i in f.vertices) for f in obj.data.polygons])
 tree=BVHTree.FromPolygons(vertices,polygons)
 for obj in objects:
  color=obj.data.color_attributes.new(name='Surface visibility',type='FLOAT_COLOR',domain='CORNER')
  obj.data.color_attributes.active_color=color
  normal_matrix=obj.matrix_world.to_3x3().inverted().transposed()
  minimum=1.
  for polygon in obj.data.polygons:
   n=(normal_matrix @ polygon.normal).normalized()
   tangent=n.cross(Vector((0,1,0)))
   if tangent.length<.01:tangent=n.cross(Vector((1,0,0)))
   tangent.normalize();bitangent=n.cross(tangent)
   for loop_index in polygon.loop_indices:
    vertex=obj.data.vertices[obj.data.loops[loop_index].vertex_index]
    sample=vertex.co.lerp(polygon.center,.32)
    origin=obj.matrix_world @ sample+n*.001
    blocked=0.
    for i in range(8):
     angle=i*math.tau/8
     direction=(n*.55+tangent*math.cos(angle)*.84+bitangent*math.sin(angle)*.84).normalized()
     hit,_,_,distance=tree.ray_cast(origin,direction,.42)
     if hit is not None:blocked+=1-distance/.42
    ao=max(.36,1-blocked/8)
    color.data[loop_index].color=(ao,ao,ao,1)
    minimum=min(minimum,ao)
  if minimum<.9:print('Baked cavity',name,obj.name,round(minimum,3),flush=True)
# Apply modifiers and export every module with its own parent.
for o in list(scene.objects):
 if o.type=='MESH':
  bpy.context.view_layer.objects.active=o
  for mod in list(o.modifiers):bpy.ops.object.modifier_apply(modifier=mod.name)
os.makedirs(os.path.join(BASE,'public','models'),exist_ok=True)
bpy.ops.export_scene.gltf(filepath=os.path.join(BASE,'public','models','environment.glb'),export_format='GLB',export_yup=False,export_apply=True,export_vertex_color='ACTIVE')
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(BASE,'art','environment.blend'),compress=True)
print('RED_WINGS_ENVIRONMENT_COMPLETE')

# Optional source-derived contact sheet; presentation objects are added only after asset export/save.
if '--render-lineup' in sys.argv:
 names=['HouseFisher','HouseTownhouse','HouseArcade','HouseVilla','HouseWorkshop','HouseTerrace']
 for obj in scene.objects:obj.hide_render=True
 for i,name in enumerate(names):
  root=bpy.data.objects[name];root.location=(i*1.66-4.15,0,0)
  root.hide_render=False
  for child in root.children_recursive:child.hide_render=False
 floor_mat=material('Presentation warm paper',(.66,.69,.66))
 bpy.ops.mesh.primitive_plane_add(size=200,location=(0,-.513,0),rotation=(-math.pi/2,0,0));floor=bpy.context.object;floor.data.materials.append(floor_mat)
 def aim(obj,target):
  forward=(Vector(target)-obj.location).normalized();right=forward.cross(Vector((0,1,0))).normalized();up=right.cross(forward)
  obj.rotation_euler=Matrix((right,up,-forward)).transposed().to_euler()
 bpy.ops.object.camera_add(location=(4.4,5.0,12.2));camera=bpy.context.object;aim(camera,(0,.1,0));camera.data.type='ORTHO';camera.data.ortho_scale=11.9;scene.camera=camera
 bpy.ops.object.light_add(type='AREA',location=(-3,7,5));key=bpy.context.object;key.data.energy=1250;key.data.shape='DISK';key.data.size=6;aim(key,(0,0,0))
 scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.65,.78,.88,1);scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.3
 scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=40;scene.cycles.use_denoising=True
 scene.render.resolution_x=1600;scene.render.resolution_y=760;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG'
 scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast';scene.view_settings.exposure=.2
 directory=os.path.join(BASE,'art','environment_views');os.makedirs(directory,exist_ok=True);scene.render.filepath=os.path.join(directory,'village_lineup.png')
 bpy.ops.render.render(write_still=True)
 print('VILLAGE_LINEUP_COMPLETE')
