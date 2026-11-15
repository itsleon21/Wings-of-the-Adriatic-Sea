import {allLandforms} from '../world/WorldConfig.ts';
export interface JobStop {name:string;island:string;altitude:number;minKmh?:number;maxKmh?:number}
export interface AviationJob {id:string;from:string;to:string;title:string;detail:string;via?:string;aircraft?:string;stops?:JobStop[];limit?:number}
const stop=(island:string,name:string,altitude=150,minKmh?:number,maxKmh?:number):JobStop=>({island,name,altitude,minKmh,maxKmh});
export const aircraftJobs:AviationJob[]=[
 {id:'rw-supply',aircraft:'redwing',from:'harbor',to:'lighthouse',title:'守灯人的急需补给',detail:'从港口带上补给，飞过灯塔外海确认点，最后在灯塔栈桥靠泊交付。',stops:[stop('lighthouse','灯塔补给确认点',140)]},
 {id:'rw-patrol',aircraft:'redwing',from:'harbor',to:'harbor',title:'隐湾海岸巡护',detail:'巡查松林岛和隐秘海湾的外海，依次飞近两个巡护点，再回港提交记录。',stops:[stop('pine','松林外海巡护',160),stop('cove','隐湾巡护',130)]},
 {id:'rw-mail',aircraft:'redwing',from:'harbor',to:'town',title:'限时特快邮航',detail:'空中用时6分钟内，经过珊瑚岛检查点，再飞往小镇栈桥交付邮袋。',limit:360,stops:[stop('coral','邮航检查点',170)]},
 {id:'m5-garden',aircraft:'m5',from:'hotel',to:'hotel',title:'酒店与珊瑚海短途游',detail:'接上酒店旅客，依次游览珊瑚岛和小镇外海，再返回酒店送客；观景点空速不超过150 km/h。',stops:[stop('coral','珊瑚浅海观景',120,0,150),stop('town','小镇全景',180,0,150)]},
 {id:'m5-coast',aircraft:'m5',from:'hotel',to:'lighthouse',title:'灯塔海岸观光线',detail:'带访客经过小镇海岸、灯塔外海，在灯塔岛靠泊下客；观景点空速不超过150 km/h。',stops:[stop('town','红瓦小镇',160,0,150),stop('lighthouse','灯塔海岸',180,0,150)]},
 {id:'m5-nature',aircraft:'m5',from:'hotel',to:'hotel',title:'松林隐湾自然之旅',detail:'依次观赏松林岛与隐秘海湾，在观景点保持150 km/h以下，再返回酒店。',stops:[stop('pine','松林远眺',210,0,150),stop('cove','隐湾风光',130,0,150)]},
 {id:'mc-sprint',aircraft:'mc72',from:'coral',to:'lighthouse',title:'灯塔疾速冲刺',detail:'空中用时3分钟内，依次通过珊瑚和灯塔外海检查点，过点速度至少300 km/h，最后在灯塔靠泊。',limit:180,stops:[stop('coral','冲刺测速点',160,300),stop('lighthouse','终段测速点',190,300)]},
 {id:'mc-slalom',aircraft:'mc72',from:'coral',to:'coral',title:'群岛穿梭计时',detail:'空中用时5分钟内，依次飞过小镇、松林、珊瑚三个检查点，再返回珊瑚栈桥。',limit:300,stops:[stop('town','转向点一',200),stop('pine','转向点二',240),stop('coral','转向点三',180)]},
 {id:'mc-climb',aircraft:'mc72',from:'coral',to:'coral',title:'跃升与俯冲训练',detail:'依次通过珊瑚岛450米高点、灯塔外海180米低点、珊瑚岛300米返航点，最后靠泊珊瑚岛。',stops:[stop('coral','跃升高点',450),stop('lighthouse','低空俯冲点',180),stop('coral','返航高点',300)]}
];
export function jobWaypoint(s:JobStop){const d=allLandforms.find(d=>d.id===s.island)!;return{name:s.name,position:{x:d.x+d.rx+350,y:s.altitude,z:d.z}};}
