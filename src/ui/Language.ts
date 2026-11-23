export type Language='zh'|'en';
const words:Record<string,string>={
'接水地速过高':'Too fast over the water','选择迎风进近方向，降低对水速度，再重新对准开放水域。':'Approach into the wind and reduce your speed over the water before lining up again.',
'风车小镇':'Windmill Town','风车磨坊':'Windmills & granaries','石塔住宅':'Stone mill houses','临港粮仓':'Harbour granaries',
'正在准备飞机与群岛…':'Preparing aircraft & islands…',
"桨轴转速":"Prop RPM","升降率":"Climb rate",
'主菜单':'Main menu','出发菜单':'Departure menu','海风、群岛与自由。':'Sea breeze. Islands. Freedom.','群岛图鉴':'Island atlas','选择飞机':'Choose aircraft',

"飞行手册":"Pilot’s handbook","水上飞行操作参考":"Seaplane operating notes","驾驶操作":"Flight controls","水面降落":"Water landing","飞行设置":"Flight settings","从海面出发":"Taking off","观察与航行":"Navigation & views","常用按键":"Key controls","进近参考":"Approach limits","开始进近":"Begin approach","进近下降率":"Approach descent","机翼倾斜":"Maximum bank","收油，建立缓降":"Reduce power & descend","近水，放平机头":"Flare above the water","直线滑行，低速靠泊":"Slow down & moor","画面品质":"Picture quality","直接选择画质":"Select quality","精细":"Fine","声音与环境":"Sound & environment","驾驶舱抖动":"Cockpit vibration","反转 W / S 俯仰":"Invert W / S pitch","自动昼夜（现实1分钟＝游戏1小时）":"Automatic day cycle (24 minutes)","自动变化天气":"Automatic weather","Esc 返回飞行":"Esc · Return to flight","km/h · 建议空速":"km/h · Approach airspeed","选择无船只、礁石与栈桥的开阔水面。尽量迎着风向进场，先对齐航向，再收油下降。":"Choose open water clear of boats, rocks and jetties. Approach into the wind when possible, align your heading, then reduce power.","速度过高、倾斜过大或下降过快时，放平机翼、加油复飞，绕开障碍后重新进近。":"If you are too fast, banked or descending too quickly, level the wings and add power to go around. Clear obstacles before trying again.","下降且距水面 ≤50 m 时自动提示，L 可随时手动开关。":"Guidance opens automatically while descending within 50 m of water. L toggles it manually.","按 C 切换视角。驾驶舱中拖动鼠标观察，按 V 回正。按 J 接取委托，循罗盘和发光信标前进。":"C changes view. Drag to look around in the cockpit, V to recenter. J opens jobs. Follow the compass and glowing beacons.","R 返回港口。P 摄影。I 反转 W / S 俯仰。":"R returns to harbor. P opens photo mode. I inverts W / S pitch.","安全高度与空速下，空格＋A / D 连续翻滚，松开后回正。":"At a safe altitude and airspeed, hold Space + A / D to roll. Release to recover.","海拔 ≥180 m、空速 ≥306 km/h，平飞后按 X 筋斗，Z 殷麦曼转向。":"Above 180 m and 306 km/h, level off, then X for a loop or Z for an Immelmann.","手动时刻和天气可在飞行界面右上方调整。":"Set time and weather in the upper-right flight controls.","低于18 km/h、距泊位35 m内":"Below 18 km/h, within 35 m","按 F 系泊。再按 F 解缆。":" Press F to moor. Press F again to cast off.","抬头 / 低头":"Pitch up / down","左 / 右滚转":"Roll left / right","左 / 右偏航":"Yaw left / right","加油 / 收油":"Power up / down","驾驶舱回正":"Recenter cockpit","暂停 / 关闭说明":"Pause / close guide",

'重飞 · 继续任务 ↗':'Fly again · Resume mission ↗','已复飞 · 任务进度已保留，重新进近':'Airborne again · Approach the same mission target','着水失败 · 已复飞，继续当前任务':'Landing failed · Airborne again, mission resumed','已重飞 · 继续当前任务':'Airborne again · Resume mission','重飞后继续当前阶段':'Resume the current stage after recovery','重飞 · 保持原航向 ↗':'Fly again · Keep heading ↗','已重飞 · 保持原航向继续飞行':'Airborne again · Continue on your original heading','距水面50米以内下降飞行时自动显示着水指导':'Landing guidance opens automatically when descending within 50 m of the water',
'平稳转弯辅助':'Smooth turn assist','渐进键盘响应、自动协调转弯与轻微升力补偿':'Progressive keys, coordinated turns and gentle lift assistance','返回进门侧':'Return to gate entry',
'漏过航门 · 跟随航向指引绕回进门侧':'Gate missed · Follow the heading marker back to the entry side','按住 Shift 滑跑，再抬头起飞':'Hold Shift, then raise the nose to take off','保持油门，抬头离水后穿过起点':'Keep power, lift off, then cross the start',
'高度偏低 · 轻抬机头，先保持安全高度':'Too low · Gently raise the nose for clearance','直线加速 · 对准当前航门':'Accelerate on the straight · Aim for the active gate','过门后右转':'Turn right after the gate','过门后左转':'Turn left after the gate','过门后直行':'Continue straight after the gate','建议 ':'Suggested ','轻收油门':'Ease the throttle','R 随时重赛 · 完赛后 Enter 再赛':'R restarts · Enter retries after finishing',

'隐藏 / 显示界面':'Hide / show interface',
'亚 德 里 亚 海 之 翼':'WINGS OF THE ADRIATIC','亚德里亚海':'Wings of the Adriatic','之翼':'Seaplane adventures',
'把海面当作跑道，向阳光中的群岛出发。':'The sea is your runway. Fly toward the sun.',
'选择一双翅膀，写下今天的航行日志。':'Choose your wings. Begin today’s flying journal.',
'选择一双翅膀，写下自己的航线。':'Choose your wings. Find your own horizon.',
'群岛图鉴 · 主岛与岛礁':'Island atlas · Islands and reefs','当前座驾':'YOUR AIRCRAFT','架可选':'aircraft available','巡航约':'Cruise approx.',
'开始飞行':'Start flying','进入机库':'Open hangar','机库':'Hangar','飞行指南':'Flight guide','晴 · 轻风 · 自由飞行':'Clear skies · Light wind · Free flight',
'红翼一号':'Red Wing One','战斗飞艇':'flying boat','马基':'Macchi','港口基地':'Home Harbor','海岸小镇':'Coastal Town','灯塔岛':'Lighthouse Island','灯塔外海':'Lighthouse waters','隐秘海湾':'Hidden Cove','花园酒店岛':'Garden Hotel Island','珊瑚小岛':'Coral Island','松林岛':'Pine Island','西风礁':'Westwind Reef','琥珀礁':'Amber Reef','双岩礁':'Twin Rocks','港湾出口':'Harbor exit','返航海面':'Return leg','港口终点':'Harbor finish','群岛外海':'Open sea',
'工具':'Tools','环境':'Environment','环岛游览':'Island tour','时刻':'Time','天气':'Weather','晴天':'Clear','多云':'Cloudy','雨天':'Rain','多雾':'Fog','晨':'Dawn','午':'Noon','昏':'Dusk','夜':'Night',
'航向':'Heading','航点':'Waypoint','竞赛':'Race','委托':'Commission','外海观察点':'Observation point','空速':'Airspeed','海拔':'Altitude','油门':'Throttle',
'自由漫游':'Free flight','水面待机':'On water','水面滑跑':'Takeoff run','空中巡航':'Airborne','着水减速':'Landing','飞行中断':'Flight interrupted','返回港口':'Return to harbor','水面降落指导':'Water landing guidance',
'远距追尾':'Wide chase','追尾':'Chase','侧方':'Side','俯瞰':'Overhead','驾驶舱':'Cockpit','摄像机':'Camera','视角':'View','航图':'Chart','群岛':'Archipelago','操作指南':'Controls','着水指导':'Landing guide','声音 开':'Sound on','声音 关':'Sound off','暂停':'Pause','继续飞行':'Resume flight','返回机库换机':'Change aircraft','航行手册':'Pilot journal','摄影':'Photo','航行日志':'Flight journal',
'开始环岛挑战':'Start island challenge','返回港口开启环岛挑战':'Return to harbor to start','重新挑战':'Restart challenge','再次挑战':'Try again','航线完成，飞得漂亮。':'Route complete. Nicely flown.','这次航行，稍作休息。':'Take a break and try again.','飞近黄色箭头即可打卡，沿途欣赏群岛风景。':'Fly near each yellow arrow to check in and explore the islands.','从港湾起飞，沿海岸寻找灯塔。':'Take off from the harbor and follow the coast to the lighthouse.','从港湾起飞，游览全部主岛。':'Take off from the harbor and visit every main island.','风景会等你。':'The view can wait.','重新出发，也很好。':'Ready for another flight?','飞行与挑战计时已暂停。':'Flight and challenge timing are paused.','返回港口，重新开始这段航程。':'Return to harbor and start a new flight.',
'建议空速':'Approach speed','距浪面':'Above waves','当前':'Current','下降率':'Descent rate','下降':'Descending','爬升':'Climbing','机翼接近水平':'Wings level','请放平机翼':'Level the wings','前方为水域':'Clear water ahead','留意岸线 / 障碍':'Watch shoreline / obstacles','机翼放平 · 收油 · 轻柔接水':'Wings level · Reduce throttle · Touch down gently','收油减速':'Reduce throttle to slow down','空速偏低 · 轻补油门':'Low airspeed · Add gentle throttle','准备水面进近':'Prepare for water landing','接水前':'Before touchdown','空速偏高':'Airspeed too high','下降过快':'Descending too fast',
'靠泊':'Moor','离泊':'Cast off','已系泊':'Moored','栈桥':'jetty','按':'Press','关闭航图':'Close chart','飞行继续':'Flight continues','关闭':'Close','展开航图':'Open chart','展开 / 收起着水指导':'Toggle landing guide','展开':'Open','收起':'Hide','切换':'Switch','视线回正':'Recenter view','增加 / 降低油门':'Increase / decrease throttle','连续翻滚':'Continuous roll','空格':'Space','垂直筋斗':'Loop','殷麦曼转向':'Immelmann','机动翻滚':'Rolling','音量':'Volume','画质':'Quality','自动（推荐）':'Auto (recommended)','精致':'High','平衡':'Balanced','流畅':'Performance','驾驶与视角':'Flight and views','飞行偏好':'Preferences','让第一段飞行，轻松一点。':'Your first flight, made easier.',
'起终点':'Start / finish','转向航门':'Turning gate','施耐德纪念赛 / 群岛竞速':'Schneider tribute / Archipelago race','出发航门':'Departure gate','灯塔外海终点':'Lighthouse finish','海上航门':'Sea gate','获胜':'wins','退赛':'Retired','名':'Place','绿灯同时起跑 · 首架到终点即结束':'Start together · First to finish wins','最后冲刺 · 对准终点航门':'Final sprint · Aim for the finish gate','下一航门':'Next gate','穿过起点后开始计时':'Cross the start gate to begin timing','首次完赛后解锁':'Unlock after your first finish','个人最佳幽灵':'Personal best ghost','结束比赛，继续游览':'Leave race and explore','重新比赛':'Restart race','本机最佳':'Personal best','起飞，前往计时起点':'Take off and fly to the start',
'双浮筒':'Twin floats','同轴对转':'Contra-rotating propellers','竞速特技':'Racing / aerobatics','单翼':'Monoplane','双翼':'Biplane','慢速观光':'Leisurely sightseeing','灵活机动':'Agile handling',
};
Object.assign(words,{
 '飞行仪表与操作':'Flight instruments and controls','飞行工具':'Flight tools','切换声音':'Toggle sound','声音':'Sound','收起降落指导':'Hide landing guide','关闭航行手册':'Close pilot journal',
 '迅捷 · 灵活 · 特技飞行':'Fast · Agile · Aerobatic','双翼 · 平缓 · 慢速观光':'Biplane · Gentle · Sightseeing',
 '朱红单翼飞行艇。响应敏捷，适合高速掠海与翻滚机动。':'A red monoplane flying boat with agile handling for fast coastal flying and rolls.',
 '浅灰色布面双翼与木质船身。巡航更慢，操控平缓，适合细看群岛风景。':'Light gray fabric wings and a wooden hull. Slow cruise and gentle handling for island sightseeing.',
 '意大利低翼水上竞速飞机。双浮筒、同轴对转双桨与黄铜散热蒙皮，适合疾速掠海与游戏特技飞行。':'An Italian low-wing racing seaplane with twin floats, contra-rotating propellers and brass radiators.',
 '不执行特技翻滚。':' Aerobatic rolls are not available.',
 '切换摄像机视角':'Cycle camera view','驾驶舱视线回正':'Recenter cockpit view','暂停 / 继续':'Pause / resume',
 '群岛飞行场景':'Island flight scene','航向、坐标与目标导航':'Heading, coordinates and target navigation','关闭操作指南':'Close flight guide','关闭航图':'Close chart',
 '水面降落参考':'Water landing reference','群岛航图与飞机位置':'Island chart and aircraft position','FLIGHT ATLAS / 航行地图':'FLIGHT ATLAS / NAVIGATION CHART',
 '接近栈桥外侧，减速至18 km/h以下':'Approach outside the jetty and slow below 18 km/h','平均':'Mean',
 '来一场海上竞速？':'Ready for a race over the sea?','进入比赛机库':'Open racing hangar','继续飞行游览':'Continue exploring','再赛一次':'Race again',
 '可随时继续游览。比赛是游戏中的纪念赛，飞机性能为游戏调校。':'You can continue exploring at any time. This is a tribute race with game-tuned aircraft performance.',
 '留住这一刻':'Capture the moment','保存 PNG':'Save PNG','隐藏工具栏 · Tab恢复':'Hide toolbar · Tab to restore','返回飞行':'Return to flight',
 '岛屿与委托':'Islands and commissions','纪念涂装':'Souvenir liveries','最近的航程':'Recent flights','航行手册':'Pilot journal',
 '已完成':'Completed','接取委托':'Accept commission','取消委托':'Cancel commission','使用中':'Selected','已解锁':'Unlocked','未解锁':'Locked',
 '比赛完成！':'Race complete!','比赛中断':'Race interrupted','烟花为你绽放 · 可继续自由飞行':'Enjoy the fireworks · Keep flying freely',
 '淡青色线框 · 本机型最佳航迹':'Pale cyan wireframe · Personal best flight path','准备':'Ready','领先':'Ahead','落后':'Behind',
 '目标在正前方':'Target straight ahead','向左转向目标':'Turn left toward target','向右转向目标':'Turn right toward target','目标位于刻度标记处':'Target at compass marker','方位':'Bearing',
 '已返回港口，准备下一段航程':'Back at the harbor, ready for another flight','全岛游览已开始 · 跟随金色航环飞临各岛':'Archipelago tour started · Follow the golden gates to every island',
 '航点通过 · 下一个：':'Gate cleared · Next: ','环岛航线已完成！':'Island route complete!','已就绪 · 按住 Shift 滑跑起飞':'Ready · Hold Shift to accelerate for takeoff',
 '按住':'Hold','加油门，达到':'Increase throttle; at','后按':'then press','抬头起飞':'pitch up to take off','航点通过':'Gate cleared',
 '俯仰':'Pitch','转弯':'Turn','翻滚':'Roll','松开':'Release','与方向键，机翼自动回正':'and direction keys to level the wings','机动进行中':'Maneuver in progress',
 '分钟':'minutes','米':'m','秒':'s','第':'','圈':'lap','段':'sector','当前浏览器':'this browser','参考':'reference',
});
const entries=Object.entries(words).sort((a,b)=>b[0].length-a[0].length);
export function english(text:string){
 if(!/[\u3400-\u9fff]/.test(text))return text;
 const trim=text.trim();
 if(trim.startsWith('按住 Shift 滑跑'))return 'Hold Shift to accelerate. At about ';
 if(trim.startsWith('km/h 时轻按 W'))return 'km/h, gently pitch up with W. Release W after lift-off to settle into level flight.';
 if(trim.startsWith('距浪面 '))return trim.replace(/距浪面 (.+) m，用 Ctrl 收油到建议空速。轻点 S，下降率控制在 (.+) m\/s 以内。/,'At $1 m above the waves, use Ctrl to reduce power into the approach speed band. Tap S to descend, keeping descent at or below $2 m/s.');
 if(/^最后 [0-9]+ m 松开 S/.test(trim))return trim.replace(/最后 (.+) m 松开 S，轻点 W。机翼保持水平，把下降率减至/,'At $1 m, release S and gently pitch up with W. Keep the wings level and reduce descent to ');
 if(/^[0-9.]+ m\/s 以下$/.test(trim))return trim.replace('m/s 以下','m/s or less');
 if(trim==='，让船体或浮筒轻触水面。')return ', letting the hull or floats touch gently.';
 if(trim.startsWith('着水后收油，保持直线减速。'))return 'After touchdown, reduce power and slow in a straight line. Approach from open water, ';

 if(trim.startsWith('珊瑚岛施耐德纪念赛'))return 'Coral Island Schneider tribute: choose an S.6, Gloster VI or M.67 in the racing hangar. Three aircraft launch together and race through the gates to the lighthouse finish. The first arrival ends the race. Recommended altitude: 150–300 m. Fireworks follow the finish.';
 if(trim.startsWith('适用于红翼'))return 'Recolors the painted surfaces of Red Wing One and MC.72. M5 retains its wooden hull and fabric wings.';
 if(trim.startsWith('记录保存在'))return 'Saved in this browser. Accept a commission at its departure jetty, then moor at the destination to deliver. Resetting, crashing or changing aircraft cancels an unfinished commission.';
 if(trim.startsWith('。保持机翼'))return ' Keep the wings level and gently pitch down. Keep descent below ' + (trim.match(/[0-9.]+/)?.[0]??'2') + ' m/s. ';
 if(trim.startsWith('松开')&&trim.includes('把下降率减至'))return 'Release pitch-down, gently pitch up, and reduce descent below ';
 if(trim.startsWith('以内。若速度'))return ' maximum. If speed, bank or descent is unsafe, level off, add throttle and go around.';
 if(trim.startsWith('以内。'))return ' maximum.';
 if(trim==='最后')return 'Final ';
 if(trim.includes('已系泊 · 按'))return 'Moored · Press F to cast off, then add throttle to leave the jetty';

 if(trim.startsWith('按住 Shift 加油门，在水面滑跑'))return 'Hold Shift to accelerate on the water, then hold the pitch-up key to lift off. Release it after takeoff to settle into level flight.';
 if(trim.startsWith('MC.72 辅助特技'))return 'MC.72 aerobatics: climb above 180 m and reach 306 km/h. Level off, then press X for a loop or Z for an Immelmann. Throttle remains available. Stay clear of islands and obstacles.';
 if(trim.startsWith('着水前先收油'))return 'Reduce throttle and descend gently. Level the wings before touching down. C cycles cameras. Drag to look around in the cockpit; V recenters. Approach a jetty from open water, below 18 km/h and within 35 m, then press F to moor or cast off.';
 if(trim.startsWith('先在距浪面'))return 'Choose open water and begin a gentle descent. Use Ctrl to reduce throttle. Follow the aircraft-specific approach speed and descent limits shown in the landing guide (L).';
 if(trim.startsWith('最后')&&trim.includes('米'))return 'Near the wave surface, release pitch-down and gently raise the nose to flare. If speed, bank or descent is unsafe, add power and go around.';
 if(trim.startsWith('低空减速或下降时'))return 'The landing guide appears during low approaches. Press L to open or close it. Check the waves, shoreline, vessels and jetties before landing.';
 if(trim.includes('执行完整翻滚，松开后自动回正'))return 'At a safe altitude and sufficient airspeed, hold Space + A/D to roll. Release to recover. Inverted flight loses altitude; climb before practicing.';
 if(trim.includes('自动昼夜'))return ' Automatic day/night cycle (1 real minute = 1 game hour)';
 if(trim.includes('自动变化天气'))return ' Automatic weather (changes after 3–6 minutes of flight)';
 if(trim.includes('同时反转上下方向键'))return ' Invert pitch (W/S and arrow keys; shortcut I)';
 if(trim.includes('轻微震动'))return ' Gentle camera movement (disable for a steadier view)';
 let result=text;for(const [zh,en] of entries)result=result.split(zh).join(en);
 return result;
}
export function installLanguage(app:HTMLElement){
 let language:Language='zh';try{language=localStorage.getItem('adriatic.language')==='en'?'en':'zh';}catch{}
 const label=document.createElement('label');label.className='language-selector';label.innerHTML='<span>语言 / Language</span><select aria-label="语言 / Language"><option value="zh">中文</option><option value="en">English</option></select>';
 app.querySelector('.top-actions')!.append(label);const select=label.querySelector('select')!;select.value=language;
 const originals=new WeakMap<Node,{source:string;rendered:string}>(),attributes=new WeakMap<Element,Map<string,{source:string;rendered:string}>>();
 const update=()=>{observer.disconnect();document.documentElement.lang=language==='zh'?'zh-CN':'en';document.body.dataset.language=language;
  const walker=document.createTreeWalker(app,NodeFilter.SHOW_TEXT);let node:Node|null;
  while((node=walker.nextNode())){if(node.parentElement?.closest('.language-selector,script,style'))continue;const current=node.textContent??'',old=originals.get(node),source=old&&current===old.rendered?old.source:current;const rendered=language==='en'?english(source):source;if(current!==rendered)node.textContent=rendered;originals.set(node,{source,rendered});}
  app.querySelectorAll('[aria-label],[title]').forEach(el=>{if(el.closest('.language-selector'))return;let map=attributes.get(el);if(!map){map=new Map();attributes.set(el,map);}for(const name of ['aria-label','title']){const current=el.getAttribute(name);if(current===null)continue;const old=map.get(name),source=old&&current===old.rendered?old.source:current,rendered=language==='en'?english(source):source;if(current!==rendered)el.setAttribute(name,rendered);map.set(name,{source,rendered});}});
  observer.observe(app,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['aria-label','title']});
 };
 let queued=false;const observer=new MutationObserver(()=>{if(!queued){queued=true;queueMicrotask(()=>{queued=false;update();});}});
 select.addEventListener('change',()=>{language=select.value==='en'?'en':'zh';try{localStorage.setItem('adriatic.language',language);}catch{}select.blur();update();});update();
 return()=>observer.disconnect();
}
