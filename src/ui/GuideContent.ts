import type {AircraftDefinition} from '../aircraft/AircraftCatalog';
import {landingProfile} from '../aircraft/LandingGuidance';

export function guideMarkup(aircraft:AircraftDefinition,takeoff:number){
 const p=landingProfile(aircraft.id);
 const keys=[['W / S','抬头 / 低头'],['A / D','左 / 右滚转'],['Q / E','左 / 右偏航'],['Shift / Ctrl','加油 / 收油'],['C','切换视角'],['V','驾驶舱回正'],['M','航图'],['J','航行手册'],['L','着水指导'],['F','靠泊 / 离泊'],['U','隐藏界面'],['Esc','暂停 / 关闭说明']];
 return `<dialog id="guide" aria-labelledby="guide-title">
 <header class="pilot-header"><div><small>ADRIATIC AERO CLUB · PILOT’S HANDBOOK</small><h2 id="guide-title">飞行手册</h2></div><div class="pilot-aircraft">${aircraft.name}<span>水上飞行操作参考</span></div><button id="guide-close" aria-label="关闭操作指南">Esc ×</button></header>
 <nav class="pilot-tabs" aria-label="手册章节"><button data-guide-page="flight" aria-pressed="false">驾驶操作</button><button data-guide-page="landing" aria-pressed="true">水面降落</button><button data-guide-page="settings" aria-pressed="false">飞行设置</button></nav>
 <section class="pilot-page" data-page="flight" hidden><div class="pilot-column"><h3>从海面出发</h3><p>按住 Shift 滑跑，空速约 <strong>${takeoff} km/h</strong> 时轻按 W 抬头。离水后松开 W，逐渐恢复平飞。</p><h3>观察与航行</h3><p>按 C 切换视角。驾驶舱中拖动鼠标观察，按 V 回正。按 J 接取委托，循罗盘和发光信标前进。</p><p>R 返回港口。P 摄影。I 反转 W / S 俯仰。</p>${aircraft.tuning.aerobatics?'<p>安全高度与空速下，空格＋A / D 连续翻滚，松开后回正。</p>':''}${aircraft.id==='mc72'?'<p>海拔 ≥180 m、空速 ≥306 km/h，平飞后按 X 筋斗，Z 殷麦曼转向。</p>':''}</div><div class="pilot-column"><h3>常用按键</h3><div class="pilot-keys key-grid">${keys.map(([key,label])=>`<span><kbd>${key}</kbd><b>${label}</b></span>`).join('')}</div></div></section>
 <section class="pilot-page" data-page="landing">
 <div class="pilot-column pilot-approach"><h3>进近参考</h3><div class="pilot-speed"><strong>${p.minKmh}–${p.maxKmh}</strong><span>km/h · 建议空速</span></div><div class="pilot-limits"><div><b>${p.setupMin}–${p.setupMax} m</b><span>开始进近</span></div><div><b>≤${p.maxApproachSink.toFixed(1)} m/s</b><span>进近下降率</span></div><div><b>≤${p.maxBankDegrees}°</b><span>机翼倾斜</span></div></div><p>选择无船只、礁石与栈桥的开阔水面。尽量迎着风向进场，先对齐航向，再收油下降。</p><p class="pilot-warning">速度过高、倾斜过大或下降过快时，放平机翼、加油复飞，绕开障碍后重新进近。</p></div>
 <div class="pilot-column"><ol class="pilot-steps">
 <li><h3>收油，建立缓降</h3><p>距浪面 ${p.setupMin}–${p.setupMax} m，用 Ctrl 收油到建议空速。轻点 S，下降率控制在 ${p.maxApproachSink.toFixed(1)} m/s 以内。</p></li>
 <li><h3>近水，放平机头</h3><p>最后 ${p.flareHeight} m 松开 S，轻点 W。机翼保持水平，把下降率减至 <strong>${p.maxTouchdownSink.toFixed(1)} m/s 以下</strong>，让船体或浮筒轻触水面。</p></li>
 <li><h3>直线滑行，低速靠泊</h3><p>着水后收油，保持直线减速。从栈桥外侧接近，<strong>低于18 km/h、距泊位35 m内</strong>按 F 系泊。再按 F 解缆。</p></li></ol><p class="pilot-note">下降且距水面 ≤50 m 时自动提示，L 可随时手动开关。</p></div></section>
 <section class="pilot-page" data-page="settings" hidden>
 <div class="pilot-column"><h3>画面品质</h3><input id="quality" type="hidden" value="high"><fieldset class="pilot-quality"><legend>直接选择画质</legend>${[['high','精细'],['balanced','平衡'],['performance','流畅'],['auto','自动']].map(([id,label])=>`<label><input type="radio" name="pilot-quality" value="${id}" ${id==='high'?'checked':''}><span>${label}</span></label>`).join('')}</fieldset>
 <label class="pilot-check"><input type="checkbox" id="camera-movement"> 驾驶舱抖动</label><label class="pilot-check"><input type="checkbox" id="pitch-invert"> 反转 W / S 俯仰</label><p id="performance-readout" class="performance-readout"></p></div>
 <div class="pilot-column"><h3>声音与环境</h3><label class="volume-option">音量 <input id="volume" type="range" min="0" max="100" value="42" aria-label="音量"><output id="volume-value">42%</output></label><label class="pilot-check"><input type="checkbox" id="time-auto" checked> 自动昼夜（现实1分钟＝游戏1小时）</label><label class="pilot-check"><input type="checkbox" id="weather-auto" checked> 自动变化天气</label><p>手动时刻和天气可在飞行界面右上方调整。</p></div></section>
 <footer class="pilot-footer"><span>${aircraft.name} · 飞行手册</span><span>Esc 返回飞行</span></footer></dialog>`;
}
