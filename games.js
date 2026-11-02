import * as THREE from 'three';
/* 一日一巷 · 三项非遗深交互
 *  毛猴：3D 拼装 → 穿小褂 → 选一出市井戏 → 放回胡同工作台
 *  沙燕：选燕型 → 贴寓意纹样（左右自动对称）→ 迎风放飞小游戏 → 风筝回到胡同上空
 *  脸谱：摄像头对镜勾脸（MediaPipe 人脸关键点）→ 听戏文认角色 → 张嘴亮相；无摄像头可用纸面具
 */
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const loadImg = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });

/* ---------------- 声音（WebAudio 合成，无需音频文件） ---------------- */
let AC = null;
function ac() { if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === 'suspended') AC.resume(); return AC; }
export function gong(big = true) {
  try {
    const a = ac(), t = a.currentTime, out = a.createGain();
    out.gain.value = big ? .32 : .18; out.connect(a.destination);
    [1, 1.48, 2.1, 2.76, 3.9].forEach((r, i) => {
      const o = a.createOscillator(), g = a.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime((big ? 180 : 420) * r, t);
      o.frequency.exponentialRampToValueAtTime((big ? 160 : 400) * r, t + 1.5);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(1 / (i + 1), t + .01);
      g.gain.exponentialRampToValueAtTime(.001, t + (big ? 2.4 : .6) / (1 + i * .3));
      o.connect(g); g.connect(out); o.start(t); o.stop(t + 2.6);
    });
  } catch (e) {}
}
function drum() {
  try {
    const a = ac(), t = a.currentTime, len = a.sampleRate * .25, buf = a.createBuffer(1, len, a.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
    s.buffer = buf; f.type = 'lowpass'; f.frequency.value = 900; g.gain.value = .5;
    s.connect(f); f.connect(g); g.connect(a.destination); s.start(t);
  } catch (e) {}
}
function whoosh(v) {
  try {
    const a = ac(), t = a.currentTime, len = a.sampleRate * .6, buf = a.createBuffer(1, len, a.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.sin(i / len * Math.PI);
    const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
    s.buffer = buf; f.type = 'bandpass'; f.frequency.value = 500 + v * 600; g.gain.value = .06 * v;
    s.connect(f); f.connect(g); g.connect(a.destination); s.start(t);
  } catch (e) {}
}

/* 参考资料小卡（真实图片 + 出处） */
function refCard(body, src, title, credit) {
  const r = el('figure', 'ref-card', `<img src="${src}" alt="${title}"><figcaption><b>真实参照 · ${title}</b><small>${credit}</small></figcaption>`);
  r.onclick = () => r.classList.toggle('big');
  body.appendChild(r);
  return r;
}

/* ====================================================================
 *  一、毛猴：3D 拼装
 * ==================================================================== */
const GM = (() => { const d = new Uint8Array([110, 110, 110, 255, 190, 190, 190, 255, 255, 255, 255, 255]); const t = new THREE.DataTexture(d, 3, 1, THREE.RGBAFormat); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t; })();
const inkM = new THREE.LineBasicMaterial({ color: '#2f2a24' });
const toon = (c, o = {}) => new THREE.MeshToonMaterial({ color: c, gradientMap: GM, ...o });
function inked(geo, mat, ang = 35) {
  const m = new THREE.Mesh(geo, mat); m.castShadow = true;
  const e = new THREE.LineSegments(new THREE.EdgesGeometry(geo, ang), inkM); e.raycast = () => {}; m.add(e);
  return m;
}
// 绒毛纹理（辛夷花苞表面的细绒）
const furTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
  x.fillStyle = '#9b8466'; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2600; i++) {
    const px = Math.random() * 256, py = Math.random() * 256, l = 3 + Math.random() * 6, a = -1.2 + Math.random() * .5;
    x.strokeStyle = Math.random() < .5 ? 'rgba(220,205,180,.55)' : 'rgba(90,70,50,.45)'; x.lineWidth = .8;
    x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l); x.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 2); t.colorSpace = THREE.SRGBColorSpace; return t;
})();
const AMBER = '#b8813f', AMBER_D = '#7a4f22';

function mhHead() {
  const g = new THREE.Group();
  const skull = inked(new THREE.SphereGeometry(.42, 18, 14), toon(AMBER)); skull.scale.set(1, .82, .95); g.add(skull);
  // 蝉的复眼（毛猴的“大眼睛”）
  [-1, 1].forEach(s => { const e = inked(new THREE.SphereGeometry(.15, 12, 10), toon('#4a2e16')); e.position.set(s * .33, .06, .2); g.add(e);
    const hl = new THREE.Mesh(new THREE.SphereGeometry(.04, 8, 6), new THREE.MeshBasicMaterial({ color: '#f6e7c8' })); hl.position.set(s * .36, .12, .33); g.add(hl); });
  // 额前的三颗单眼 & 嘴部
  const nose = inked(new THREE.ConeGeometry(.1, .3, 8), toon(AMBER_D)); nose.rotation.x = Math.PI / 2 + .5; nose.position.set(0, -.18, .36); g.add(nose);
  for (let i = 0; i < 5; i++) { const r = inked(new THREE.TorusGeometry(.3 - i * .02, .012, 4, 18, Math.PI), toon(AMBER_D), 80); r.position.set(0, .1 + i * .05, -.05 - i * .03); r.rotation.x = -.3; g.add(r); }
  return g;
}
function mhBody() {
  const pts = [];
  for (let i = 0; i <= 20; i++) { const t = i / 20; pts.push(new THREE.Vector2(Math.sin(t * Math.PI) * .42 * (1 - t * .35) + .02, t * 1.5 - .75)); }
  const geo = new THREE.LatheGeometry(pts, 24);
  const m = inked(geo, toon('#ffffff', { map: furTex }), 50);
  // 花苞的苞片
  const leaf = inked(new THREE.SphereGeometry(.2, 10, 8), toon('#6e5a40')); leaf.scale.set(1.6, .5, 1.6); leaf.position.y = -.72; m.add(leaf);
  return m;
}
function mhLimb(front, side) {
  const g = new THREE.Group(), mat = toon(AMBER), matD = toon(AMBER_D);
  const L1 = front ? .42 : .55, L2 = front ? .38 : .5;
  const a = inked(new THREE.CylinderGeometry(.055, .075, L1, 8), mat); a.position.y = -L1 / 2; g.add(a);
  const knee = new THREE.Group(); knee.position.y = -L1; g.add(knee);
  const b = inked(new THREE.CylinderGeometry(.04, .055, L2, 8), mat); b.position.y = -L2 / 2; knee.add(b);
  knee.rotation.z = side * (front ? .9 : -.35);
  // 蝉前足的锯齿（毛猴的“手”）
  if (front) for (let i = 0; i < 3; i++) { const sp = inked(new THREE.ConeGeometry(.03, .14, 5), matD); sp.position.set(-side * .05, -L2 * (.3 + i * .25), 0); sp.rotation.z = side * 1.9; knee.add(sp); }
  else { const foot = inked(new THREE.ConeGeometry(.06, .18, 6), matD); foot.position.y = -L2 - .05; foot.rotation.z = Math.PI; knee.add(foot); }
  return g;
}
function propTanghulu() {
  const g = new THREE.Group();
  const stick = inked(new THREE.CylinderGeometry(.02, .02, 1.5, 5), toon('#d9c08a')); g.add(stick);
  for (let i = 0; i < 6; i++) { const b = inked(new THREE.SphereGeometry(.11, 12, 10), toon('#c4262a', { emissive: '#3a0000' })); b.position.y = .15 + i * .2; g.add(b); }
  g.position.set(.78, .2, .25); g.rotation.z = -.15;
  return g;
}
function propCart() {
  const g = new THREE.Group(), red = toon('#a5402f'), blk = toon('#2f2b26');
  const seat = inked(new THREE.BoxGeometry(.9, .5, .7), red); seat.position.set(0, .2, -.9); g.add(seat);
  const hood = inked(new THREE.SphereGeometry(.5, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), toon('#2f2b26', { side: THREE.DoubleSide })); hood.scale.set(1, .9, .8); hood.position.set(0, .45, -1.15); g.add(hood);
  [-1, 1].forEach(s => {
    const w = inked(new THREE.TorusGeometry(.42, .04, 6, 20), blk); w.rotation.y = Math.PI / 2; w.position.set(s * .5, -.25, -.95); g.add(w);
    for (let k = 0; k < 6; k++) { const sp = new THREE.Mesh(new THREE.BoxGeometry(.015, .8, .015), blk); sp.rotation.x = k * Math.PI / 6; sp.position.copy(w.position); g.add(sp); }
    const shaft = inked(new THREE.CylinderGeometry(.03, .03, 1.7, 5), toon('#8a6a4c')); shaft.rotation.x = Math.PI / 2 - .25; shaft.position.set(s * .55, .05, -.15); g.add(shaft);
  });
  g.position.y = .1;
  return g;
}
function propCage() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(.32, .32, .6, 14, 1, true), new THREE.MeshBasicMaterial({ color: '#6d5d4e', wireframe: true })); g.add(body);
  const top = inked(new THREE.ConeGeometry(.36, .25, 14), toon('#8a6a4c')); top.position.y = .42; g.add(top);
  const base = inked(new THREE.CylinderGeometry(.34, .34, .06, 14), toon('#8a6a4c')); base.position.y = -.3; g.add(base);
  const bird = inked(new THREE.SphereGeometry(.09, 8, 6), toon('#e0ad3a')); bird.position.y = -.05; g.add(bird);
  const hook = inked(new THREE.TorusGeometry(.08, .015, 4, 10), toon('#2f2b26')); hook.position.y = .6; g.add(hook);
  g.position.set(.95, -.25, .2);
  return g;
}
function propFan() {
  const g = new THREE.Group();
  const fan = inked(new THREE.CircleGeometry(.5, 20, 0, Math.PI * .75), toon('#f1e7d2', { side: THREE.DoubleSide }), 80); fan.rotation.z = Math.PI * .12; g.add(fan);
  const desk = inked(new THREE.BoxGeometry(1.1, .5, .5), toon('#8a6a4c')); desk.position.set(-.85, -.95, .6); g.add(desk);
  const muz = inked(new THREE.BoxGeometry(.22, .08, .12), toon('#3a2a1c')); muz.position.set(-.85, -.66, .65); g.add(muz);
  g.position.set(.75, .35, .3);
  return g;
}
const MH_PROPS = {
  tanghulu: { name: '卖糖葫芦', make: propTanghulu, line: '“冰糖葫芦嘞——”一串红果，挑在胡同口' },
  cart: { name: '拉洋车', make: propCart, line: '老北京的“骆驼祥子”，拉着洋车跑胡同' },
  cage: { name: '遛鸟', make: propCage, line: '清早提笼架鸟，是老北京人的闲情' },
  fan: { name: '说评书', make: propFan, line: '醒木一拍：“话说那……”' }
};
const MH_COLORS = [['#c23a2b', '朱砂'], ['#2f5d8a', '石青'], ['#3f7d5c', '松绿'], ['#e0ad3a', '藤黄'], ['#2b2724', '玄青']];

// 部件定义：在 assembly 局部坐标中的目标位置/旋转
const MH_PARTS = [
  { k: 'body', name: '辛夷 · 身子', make: mhBody, pos: [0, 1.15, 0], rot: [0, 0, 0] },
  { k: 'head', name: '蝉蜕 · 头', make: mhHead, pos: [0, 2.2, .05], rot: [0, 0, 0] },
  { k: 'armL', name: '蝉蜕前足 · 左手', make: () => mhLimb(true, 1), pos: [-.38, 1.6, .05], rot: [0, 0, -.6] },
  { k: 'armR', name: '蝉蜕前足 · 右手', make: () => mhLimb(true, -1), pos: [.38, 1.6, .05], rot: [0, 0, .6] },
  { k: 'legL', name: '蝉蜕后足 · 左脚', make: () => mhLimb(false, 1), pos: [-.2, .5, 0], rot: [0, 0, -.12] },
  { k: 'legR', name: '蝉蜕后足 · 右脚', make: () => mhLimb(false, -1), pos: [.2, .5, 0], rot: [0, 0, .12] }
];

export function buildMaohou(cfg) {
  const g = new THREE.Group();
  MH_PARTS.forEach(p => { const m = p.make(); m.position.fromArray(p.pos); m.rotation.fromArray(p.rot); g.add(m); });
  dress(g, cfg);
  return g;
}
function dress(g, { color, cap, prop } = {}) {
  ['vest', 'cap', 'prop'].forEach(n => { const o = g.getObjectByName(n); if (o) g.remove(o); });
  if (color) {
    const v = inked(new THREE.CylinderGeometry(.43, .47, .75, 22, 1, true, Math.PI * .08, Math.PI * 1.84), toon(color, { side: THREE.DoubleSide }), 60);
    v.name = 'vest'; v.position.set(0, 1.42, 0); v.rotation.y = Math.PI / 2 + Math.PI;
    // 盘扣
    for (let i = 0; i < 3; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(.035, 6, 5), toon('#f4ece0')); b.position.set(.06, -.2 + i * .18, -.45); v.add(b); }
    g.add(v);
  }
  if (cap) {
    const c = new THREE.Group(); c.name = 'cap';
    const bowl = inked(new THREE.SphereGeometry(.36, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), toon('#2b2724')); c.add(bowl);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(.06, 8, 6), toon('#c23a2b')); knob.position.y = .36; c.add(knob);
    c.position.set(0, 2.38, -.02); c.rotation.x = -.15; g.add(c);
  }
  if (prop && MH_PROPS[prop]) { const p = MH_PROPS[prop].make(); p.name = 'prop'; g.add(p); }
}

export function initMaohou(body, ui) {
  const wrap = el('div', 'mh3d'); body.appendChild(wrap);
  const cv = el('canvas'); wrap.appendChild(cv);
  const side = el('div', 'mh-side'); wrap.appendChild(side);
  refCard(body, './img/ref/maohou_ref.jpg', '毛猴的原料：蝉蜕与辛夷', '毛猴技艺视频截图 · 中国新闻社 · Wikimedia Commons · CC BY 3.0');

  const W = () => wrap.clientWidth, H = () => wrap.clientHeight;
  const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setSize(W(), H()); renderer.shadowMap.enabled = true;
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(36, W() / H(), .1, 100); cam.position.set(0, 2.6, 6.4); cam.lookAt(0, 1.2, 0);
  scene.add(new THREE.HemisphereLight('#fff5e6', '#b9a888', 1.1));
  const sun = new THREE.DirectionalLight('#fff1d8', 2.2); sun.position.set(3, 6, 5); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); scene.add(sun);
  // 工作台
  const table = new THREE.Mesh(new THREE.BoxGeometry(9, .3, 4), toon('#9a7652')); table.position.y = -.15; table.receiveShadow = true; scene.add(table);
  const te = new THREE.LineSegments(new THREE.EdgesGeometry(table.geometry), inkM); table.add(te);
  const mat = new THREE.Mesh(new THREE.CircleGeometry(1.1, 32), toon('#e8dcc2')); mat.rotation.x = -Math.PI / 2; mat.position.y = .01; mat.receiveShadow = true; scene.add(mat);

  const asm = new THREE.Group(); scene.add(asm);
  const ghostMat = new THREE.MeshBasicMaterial({ color: '#b8322a', transparent: true, opacity: .12, depthWrite: false });
  const parts = MH_PARTS.map((p, i) => {
    const ghost = p.make(); ghost.traverse(o => { if (o.isMesh) o.material = ghostMat; if (o.isLineSegments) o.visible = false; });
    ghost.position.fromArray(p.pos); ghost.rotation.fromArray(p.rot); asm.add(ghost);
    const m = p.make();
    const limb = i > 1, sd = i % 2 ? 1 : -1;
    const LAY = [[-1.95, .45, .15], [1.95, .45, .15], [-.95, .1, 1.5], [.95, .1, 1.5], [-.55, .1, 1.05], [.55, .1, 1.05]];
    m.position.fromArray(LAY[i]);
    m.rotation.set(limb ? -.2 : .15, limb ? 0 : sd * .5, limb ? sd * 1.57 : .2);
    m.userData = { part: p, ghost, snapped: false, home: m.position.clone() };
    scene.add(m); return m;
  });
  const pickables = () => parts.filter(m => !m.userData.snapped);
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -.6), hit = new THREE.Vector3();
  let drag = null, rotDrag = null, spin = 0, spinV = 0;
  const glue = [];
  function setNdc(e) { const r = cv.getBoundingClientRect(); ndc.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1); ray.setFromCamera(ndc, cam); }
  function rootOf(o) { while (o && !parts.includes(o)) o = o.parent; return o; }
  cv.addEventListener('pointerdown', e => {
    setNdc(e); cv.setPointerCapture(e.pointerId);
    const h = ray.intersectObjects(pickables(), true)[0];
    if (h) { drag = rootOf(h.object); drag.userData.ghost.traverse(o => { if (o.isMesh) o.material = ghostMatHi; }); hint(drag.userData.part.name); }
    else rotDrag = { x: e.clientX, s: spin };
  });
  const ghostMatHi = new THREE.MeshBasicMaterial({ color: '#b8322a', transparent: true, opacity: .35, depthWrite: false });
  cv.addEventListener('pointermove', e => {
    setNdc(e);
    if (drag) { if (ray.ray.intersectPlane(plane, hit)) { drag.position.lerp(hit, .6); drag.rotation.x *= .85; drag.rotation.z = lerp(drag.rotation.z, drag.userData.part.rot[2], .15); drag.rotation.y *= .85; } }
    else if (rotDrag) { spin = rotDrag.s + (e.clientX - rotDrag.x) / 120; }
    else { const h = ray.intersectObjects(pickables(), true)[0]; cv.style.cursor = h ? 'grab' : 'ew-resize'; }
  });
  cv.addEventListener('pointerup', () => {
    if (drag) {
      const d = drag, g = d.userData.ghost; g.traverse(o => { if (o.isMesh) o.material = ghostMat; });
      const tgt = g.getWorldPosition(new THREE.Vector3());
      if (d.position.distanceTo(tgt) < .75) snap(d); else { d.userData.fall = true; }
      drag = null;
    }
    rotDrag = null;
  });
  function snap(m) {
    m.userData.snapped = true; m.userData.ghost.visible = false;
    scene.remove(m); asm.add(m);
    m.userData.anim = { t: 0, from: asm.worldToLocal(m.position.clone()), rf: m.rotation.clone() };
    m.position.copy(m.userData.anim.from);
    for (let i = 0; i < 10; i++) { const s = new THREE.Mesh(new THREE.SphereGeometry(.03, 5, 4), new THREE.MeshBasicMaterial({ color: '#fff6dc', transparent: true })); s.position.fromArray(m.userData.part.pos); s.userData.v = new THREE.Vector3((Math.random() - .5) * 2, Math.random() * 2, (Math.random() - .5) * 2); s.userData.life = 1; asm.add(s); glue.push(s); }
    gong(false);
    const left = parts.filter(p => !p.userData.snapped).length;
    if (left) hint(`白芨胶粘牢了 · 还差 ${left} 个零件`); else stage2();
  }
  // 侧栏
  function hint(t) { ui.tip(t); }
  side.innerHTML = `<p class="mh-step"><b>第一步</b> 拼</p><ul class="mh-list">${MH_PARTS.map(p => `<li data-k="${p.k}">${p.name}</li>`).join('')}</ul><p class="mh-note">拖动零件到淡红色的位置；拖空白处可以转动毛猴</p>`;
  const cfg = { color: null, cap: false, prop: null };
  function stage2() {
    hint('拼好了！给它穿上小褂、选一出市井戏');
    side.innerHTML = `<p class="mh-step"><b>第二步</b> 扮</p>
      <p class="mh-label">小褂颜色</p><div class="mh-sw">${MH_COLORS.map(([c, n]) => `<button data-c="${c}" style="background:${c}"><span>${n}</span></button>`).join('')}</div>
      <label class="mh-cap"><input type="checkbox" id="mhCap"> 戴瓜皮帽</label>
      <p class="mh-label">演一出</p><div class="mh-props">${Object.entries(MH_PROPS).map(([k, v]) => `<button data-p="${k}">${v.name}</button>`).join('')}</div>
      <p class="mh-line" id="mhLine">毛猴的妙处，就是用小虫小花演活老北京的市井百态</p>`;
    side.querySelectorAll('.mh-sw button').forEach(b => b.onclick = () => { side.querySelectorAll('.mh-sw button').forEach(x => x.classList.remove('on')); b.classList.add('on'); cfg.color = b.dataset.c; dress(asm, cfg); });
    side.querySelector('#mhCap').onchange = e => { cfg.cap = e.target.checked; dress(asm, cfg); };
    side.querySelectorAll('.mh-props button').forEach(b => b.onclick = () => {
      side.querySelectorAll('.mh-props button').forEach(x => x.classList.remove('on')); b.classList.add('on'); cfg.prop = b.dataset.p; dress(asm, cfg);
      side.querySelector('#mhLine').textContent = MH_PROPS[cfg.prop].line; drum();
      if (cfg.color) hint(`《${MH_PROPS[cfg.prop].name}》扮好了 · 点“完成 · 盖印”把它放回胡同`);
    });
  }
  // 循环
  let raf, last = performance.now();
  function loop(now) {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    if (!rotDrag) spin += Math.sin(now / 2400) * .0015;
    asm.rotation.y = lerp(asm.rotation.y, spin, .15);
    parts.forEach(m => {
      const u = m.userData;
      if (u.anim) { u.anim.t = Math.min(1, u.anim.t + dt * 3.5); const k = 1 - Math.pow(1 - u.anim.t, 3);
        m.position.lerpVectors(u.anim.from, new THREE.Vector3().fromArray(u.part.pos), k);
        m.rotation.set(lerp(u.anim.rf.x, u.part.rot[0], k), lerp(u.anim.rf.y, u.part.rot[1], k), lerp(u.anim.rf.z, u.part.rot[2], k));
        if (u.anim.t >= 1) u.anim = null; }
      else if (u.fall && m !== drag) { m.position.lerp(u.home, .12); if (m.position.distanceTo(u.home) < .02) u.fall = false; }
      else if (!u.snapped && m !== drag) m.position.y = u.home.y + Math.sin(now / 600 + u.home.x) * .04;
    });
    for (let i = glue.length - 1; i >= 0; i--) { const s = glue[i]; s.userData.life -= dt * 1.6; s.position.addScaledVector(s.userData.v, dt); s.material.opacity = s.userData.life; if (s.userData.life <= 0) { asm.remove(s); glue.splice(i, 1); } }
    side.querySelectorAll('.mh-list li').forEach(li => { const p = parts.find(m => m.userData.part.k === li.dataset.k); li.classList.toggle('done', p.userData.snapped); });
    renderer.render(scene, cam);
  }
  raf = requestAnimationFrame(loop);
  const onResize = () => { renderer.setSize(W(), H()); cam.aspect = W() / H(); cam.updateProjectionMatrix(); };
  addEventListener('resize', onResize);
  window.__mhSnapAll = () => parts.filter(m => !m.userData.snapped).forEach(snap);
  return {
    ok: () => parts.every(m => m.userData.snapped) && cfg.color && cfg.prop,
    need: () => parts.some(m => !m.userData.snapped) ? '还有零件没拼上' : (!cfg.color ? '给毛猴挑件小褂吧' : '选一出市井戏吧'),
    result: () => buildMaohou(cfg),
    caption: () => `获得印记 · 猴 ——《${MH_PROPS[cfg.prop].name}》已放回胡同工作台`,
    dispose: () => { cancelAnimationFrame(raf); removeEventListener('resize', onResize); renderer.dispose(); }
  };
}

/* ====================================================================
 *  二、沙燕：绘 + 放
 * ==================================================================== */
const MOTIFS = {
  bat: { name: '蝙蝠', mean: '“蝠”谐“福”', img: './img/mt_bat.png' },
  peach: { name: '寿桃', mean: '祝寿延年', img: './img/mt_peach.png' },
  peony: { name: '牡丹', mean: '花开富贵', img: './img/mt_peony.png' },
  knot: { name: '盘长', mean: '绵延不断', img: './img/mt_knot.png' }
};
const COMBOS = [
  [['bat', 'peach'], '福寿双全'], [['bat', 'peony'], '福贵双全'], [['peach', 'peony'], '富贵长寿'],
  [['bat', 'knot'], '福运绵长'], [['peony', 'knot'], '富贵绵长'], [['peach', 'knot'], '长寿绵延']
];
const KITE_TYPES = {
  fat: { name: '胖沙燕', note: '膀宽身圆，象征壮年男子', span: 1.0, belly: 1.0, tail: .9 },
  slim: { name: '瘦沙燕', note: '身形修长，象征年轻女子', span: .82, belly: .72, tail: 1.1 },
  child: { name: '小沙燕', note: '圆头短翅，象征孩童', span: .72, belly: .9, tail: .7 }
};
const KITE_COLORS = [['#c23a2b', '朱砂'], ['#2f5d8a', '石青'], ['#3f7d5c', '松绿'], ['#2b2724', '墨']];
// 在单位坐标系中绘制沙燕（中心 0,0；宽 ≈ 2）
function kitePath(ctx, t) {
  const s = t.span, b = t.belly, tl = t.tail;
  ctx.beginPath();
  ctx.moveTo(0, -.78);                                   // 头顶
  ctx.bezierCurveTo(.2 * b, -.78, .26 * b, -.6, .2 * b, -.48);
  ctx.bezierCurveTo(.5 * s, -.56, .85 * s, -.5, 1.0 * s, -.32);   // 上膀
  ctx.bezierCurveTo(1.04 * s, -.18, .9 * s, -.08, .74 * s, -.12);
  ctx.bezierCurveTo(.55 * s, -.14, .4 * b, -.04, .32 * b, .1);     // 下膀回到身子
  ctx.bezierCurveTo(.36 * b, .3, .3 * b, .42, .18 * b, .5);         // 腹
  ctx.lineTo(.42 * tl, .95 * tl + .1);                              // 右尾
  ctx.lineTo(.2 * tl, .9 * tl + .08);
  ctx.lineTo(0, .62);
  ctx.lineTo(-.2 * tl, .9 * tl + .08);
  ctx.lineTo(-.42 * tl, .95 * tl + .1);
  ctx.lineTo(-.18 * b, .5);
  ctx.bezierCurveTo(-.3 * b, .42, -.36 * b, .3, -.32 * b, .1);
  ctx.bezierCurveTo(-.4 * b, -.04, -.55 * s, -.14, -.74 * s, -.12);
  ctx.bezierCurveTo(-.9 * s, -.08, -1.04 * s, -.18, -1.0 * s, -.32);
  ctx.bezierCurveTo(-.85 * s, -.5, -.5 * s, -.56, -.2 * b, -.48);
  ctx.bezierCurveTo(-.26 * b, -.6, -.2 * b, -.78, 0, -.78);
  ctx.closePath();
}
function kiteSlots(t) {
  return {
    chest: { x: 0, y: .16, r: .2 * t.belly + .02 },
    wing: { x: .62 * t.span, y: -.3, r: .15, mirror: true },
    tail: { x: .26 * t.tail, y: .78 * t.tail, r: .1, mirror: true }
  };
}
function drawKite(ctx, t, color, motifs, imgs, k) {
  ctx.save(); ctx.lineJoin = 'round';
  // 底色
  kitePath(ctx, t); ctx.fillStyle = '#f5ecd8'; ctx.fill();
  ctx.save(); kitePath(ctx, t); ctx.clip();
  // 膀条（上膀黑色粗边）+ 膀尖
  ctx.fillStyle = '#26221e';
  [-1, 1].forEach(sd => {
    ctx.beginPath(); ctx.moveTo(sd * .15 * t.belly, -.5); ctx.bezierCurveTo(sd * .5 * t.span, -.6, sd * .86 * t.span, -.52, sd * 1.05 * t.span, -.32);
    ctx.lineTo(sd * .98 * t.span, -.24); ctx.bezierCurveTo(sd * .8 * t.span, -.42, sd * .5 * t.span, -.46, sd * .15 * t.belly, -.38); ctx.fill();
    // 膀上主色色块
    ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(sd * .3 * t.belly, -.36); ctx.bezierCurveTo(sd * .55 * t.span, -.42, sd * .8 * t.span, -.36, sd * .86 * t.span, -.24);
    ctx.bezierCurveTo(sd * .7 * t.span, -.16, sd * .45 * t.span, -.14, sd * .3 * t.belly, -.02); ctx.fill(); ctx.fillStyle = '#26221e';
  });
  // 腹部主色 + 尾巴
  ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(0, .2, .27 * t.belly, .3, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f5ecd8'; ctx.beginPath(); ctx.ellipse(0, .17, .2 * t.belly, .22, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = color; ctx.fillRect(-.6, .62, 1.2, .6);
  ctx.restore();
  // 头：黑色“燕头”+ 白眼圈 + 上挑的燕眉（不画嘴）
  ctx.fillStyle = '#26221e'; ctx.beginPath(); ctx.ellipse(0, -.6, .17 * t.belly, .16, 0, 0, Math.PI * 2); ctx.fill();
  [-1, 1].forEach(sd => {
    ctx.fillStyle = '#f5ecd8'; ctx.beginPath(); ctx.ellipse(sd * .075, -.6, .055, .035, sd * -.35, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#26221e'; ctx.beginPath(); ctx.arc(sd * .08, -.6, .02, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = color; ctx.lineWidth = .018; ctx.beginPath(); ctx.moveTo(sd * .02, -.67); ctx.quadraticCurveTo(sd * .1, -.7, sd * .16, -.64); ctx.stroke();
  });
  ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(-.03, -.53); ctx.lineTo(.03, -.53); ctx.lineTo(0, -.47); ctx.fill();
  // 纹样
  const S = kiteSlots(t);
  Object.entries(motifs).forEach(([slot, m]) => {
    const p = S[slot], im = imgs[m]; if (!im) return;
    const sc = p.r * 2 / Math.max(im.width, im.height);
    [1, ...(p.mirror ? [-1] : [])].forEach(sd => {
      ctx.save(); ctx.translate(p.x * sd, p.y); ctx.scale(sc * sd, sc); ctx.drawImage(im, -im.width / 2, -im.height / 2); ctx.restore();
    });
  });
  // 外轮廓 + 竹骨
  kitePath(ctx, t); ctx.strokeStyle = '#1e1a16'; ctx.lineWidth = .028 / (k || 1) * (k || 1); ctx.stroke();
  ctx.strokeStyle = 'rgba(30,26,22,.35)'; ctx.lineWidth = .01;
  ctx.beginPath(); ctx.moveTo(0, -.78); ctx.lineTo(0, .62); ctx.moveTo(-1 * t.span, -.32); ctx.quadraticCurveTo(0, -.6, 1 * t.span, -.32); ctx.stroke();
  ctx.restore();
}

export function initKite(body, ui) {
  const wrap = el('div', 'kite-wrap'); body.appendChild(wrap);
  refCard(body, './img/ref/kite_photo.jpg', '北京沙燕风筝', 'Fengzheng.JPG · Wikimedia Commons · CC BY-SA 3.0');
  const imgs = {};
  Object.entries(MOTIFS).forEach(([k, v]) => loadImg(v.img).then(i => { imgs[k] = i; redraw(); }));
  const st = { type: 'fat', color: '#c23a2b', motifs: {}, phase: 'paint', flown: false };
  let disposed = false, raf = 0;

  /* ---------- 阶段一：绘 ---------- */
  const paint = el('div', 'kite-paint'); wrap.appendChild(paint);
  const cv = el('canvas'); paint.appendChild(cv);
  const ctx = cv.getContext('2d');
  const tray = el('div', 'kite-tray'); wrap.appendChild(tray);
  tray.innerHTML = `
    <p class="mh-step"><b>第一步</b> 绘</p>
    <p class="mh-label">燕型</p><div class="kt-types">${Object.entries(KITE_TYPES).map(([k, v]) => `<button data-t="${k}" class="${k === 'fat' ? 'on' : ''}">${v.name}</button>`).join('')}</div>
    <p class="kt-note" id="ktNote">${KITE_TYPES.fat.note}</p>
    <p class="mh-label">主色</p><div class="mh-sw">${KITE_COLORS.map(([c, n], i) => `<button data-c="${c}" class="${i ? '' : 'on'}" style="background:${c}"><span>${n}</span></button>`).join('')}</div>
    <p class="mh-label">寓意纹样 · 拖到风筝上（翅膀和尾巴会自动左右对称）</p>
    <div class="kt-motifs">${Object.entries(MOTIFS).map(([k, v]) => `<div class="kt-m" data-m="${k}"><img src="${v.img}" draggable="false"><span>${v.name}<small>${v.mean}</small></span></div>`).join('')}</div>
    <p class="kt-combo" id="ktCombo">胸口放一个主纹样，再配一个，看看能凑出什么吉语</p>
    <button class="btn" id="ktFly" disabled>画好了 · 去放飞 →</button>`;
  tray.querySelectorAll('.kt-types button').forEach(b => b.onclick = () => { tray.querySelectorAll('.kt-types button').forEach(x => x.classList.remove('on')); b.classList.add('on'); st.type = b.dataset.t; tray.querySelector('#ktNote').textContent = KITE_TYPES[st.type].note; redraw(); });
  tray.querySelectorAll('.mh-sw button').forEach(b => b.onclick = () => { tray.querySelectorAll('.mh-sw button').forEach(x => x.classList.remove('on')); b.classList.add('on'); st.color = b.dataset.c; redraw(); });

  let view = { s: 1, ox: 0, oy: 0 };
  function size() {
    const r = paint.getBoundingClientRect(), d = Math.min(devicePixelRatio, 2);
    cv.width = r.width * d; cv.height = r.height * d; cv.style.width = r.width + 'px'; cv.style.height = r.height + 'px';
    view.s = Math.min(r.width / 2.3, r.height / 2.05) * d; view.ox = cv.width / 2; view.oy = cv.height * .47;
  }
  let hover = null;
  function redraw() {
    if (st.phase !== 'paint' || disposed) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.setTransform(view.s, 0, 0, view.s, view.ox, view.oy);
    drawKite(ctx, KITE_TYPES[st.type], st.color, st.motifs, imgs);
    // 空位提示
    const S = kiteSlots(KITE_TYPES[st.type]);
    Object.entries(S).forEach(([k, p]) => {
      if (st.motifs[k] && hover !== k) return;
      [1, ...(p.mirror ? [-1] : [])].forEach(sd => {
        ctx.beginPath(); ctx.arc(p.x * sd, p.y, p.r, 0, Math.PI * 2);
        ctx.setLineDash([.03, .025]); ctx.lineWidth = hover === k ? .012 : .007; ctx.strokeStyle = hover === k ? '#c23a2b' : 'rgba(194,58,43,.55)'; ctx.stroke(); ctx.setLineDash([]);
      });
    });
  }
  function slotAt(cx, cy) {
    const r = cv.getBoundingClientRect(), d = cv.width / r.width;
    const x = ((cx - r.left) * d - view.ox) / view.s, y = ((cy - r.top) * d - view.oy) / view.s;
    const S = kiteSlots(KITE_TYPES[st.type]);
    let best = null, bd = 1e9;
    Object.entries(S).forEach(([k, p]) => [1, ...(p.mirror ? [-1] : [])].forEach(sd => { const dd = Math.hypot(x - p.x * sd, y - p.y); if (dd < p.r + .14 && dd < bd) { bd = dd; best = k; } }));
    return best;
  }
  // 拖拽纹样
  tray.querySelectorAll('.kt-m').forEach(m => {
    m.addEventListener('pointerdown', e => {
      e.preventDefault();
      const ghost = el('img', 'kt-ghost'); ghost.src = m.querySelector('img').src; document.body.appendChild(ghost);
      const move = ev => { ghost.style.left = ev.clientX + 'px'; ghost.style.top = ev.clientY + 'px'; const h = slotAt(ev.clientX, ev.clientY); if (h !== hover) { hover = h; redraw(); } };
      const up = ev => {
        removeEventListener('pointermove', move); removeEventListener('pointerup', up); ghost.remove();
        const s = slotAt(ev.clientX, ev.clientY); hover = null;
        if (s) { st.motifs[s] = m.dataset.m; gong(false); afterPlace(m.dataset.m, s); }
        redraw();
      };
      move(e); addEventListener('pointermove', move); addEventListener('pointerup', up);
    });
  });
  function afterPlace(mk, slot) {
    const names = { chest: '胸口', wing: '双膀', tail: '燕尾' };
    ui.tip(`${names[slot]} · ${MOTIFS[mk].name}：${MOTIFS[mk].mean}`);
    const set = new Set(Object.values(st.motifs));
    const c = COMBOS.find(([a]) => a.every(x => set.has(x)));
    tray.querySelector('#ktCombo').innerHTML = c ? `吉语 · <b>${c[1]}</b>` : '再配一个纹样，凑一句吉语';
    tray.querySelector('#ktFly').disabled = !(st.motifs.chest && Object.keys(st.motifs).length >= 2);
    st.combo = c ? c[1] : null;
  }
  tray.querySelector('#ktFly').onclick = startFly;
  // 导出贴图（给 3D 胡同用）
  function bake() {
    const c = document.createElement('canvas'); c.width = 1024; c.height = 820;
    const x = c.getContext('2d'); x.setTransform(c.width / 2.3, 0, 0, c.width / 2.3, c.width / 2, c.height * .47);
    drawKite(x, KITE_TYPES[st.type], st.color, st.motifs, imgs); return c;
  }

  /* ---------- 阶段二：放 ---------- */
  let fly;
  function startFly() {
    st.phase = 'fly'; st.baked = bake();
    tray.remove(); paint.remove(); wrap.classList.add('flying');
    ui.tip('按住鼠标 / 空格 = 收线（风小时拉一拉让它爬升）；松开 = 放线（大风时松一松，线绷太紧会栽跟头）');
    const fc = el('canvas', 'fly-cv'); wrap.appendChild(fc);
    const hud = el('div', 'fly-hud', `
      <div class="fh-row"><span>风力</span><i class="fh-bar"><b id="fhWind"></b></i></div>
      <div class="fh-row"><span>线力</span><i class="fh-bar warn"><b id="fhTen"></b></i></div>
      <div class="fh-row"><span>稳住</span><i class="fh-bar ok"><b id="fhProg"></b></i></div>
      <p class="fh-tip" id="fhTip">先拉线，让沙燕起飞</p>`);
    wrap.appendChild(hud);
    const fx = fc.getContext('2d');
    let FW, FH; const D = Math.min(devicePixelRatio, 2);
    const fs = () => { const r = wrap.getBoundingClientRect(); FW = fc.width = r.width * D; FH = fc.height = r.height * D; fc.style.width = r.width + 'px'; fc.style.height = r.height + 'px'; };
    fs(); addEventListener('resize', fs);
    fly = { alt: .14, vy: 0, ten: 0, prog: 0, pull: false, t: 0, stall: 0, done: false, gust: 0, gustT: 3, streaks: [], msgT: 0 };
    for (let i = 0; i < 40; i++) fly.streaks.push({ x: Math.random(), y: Math.random() * .7, l: .03 + Math.random() * .06 });
    const down = e => { if (e.type === 'keydown' && e.code !== 'Space') return; if (e.type === 'keydown') e.preventDefault(); fly.pull = true; };
    const up = e => { if (e.type === 'keyup' && e.code !== 'Space') return; fly.pull = false; };
    fc.addEventListener('pointerdown', down); addEventListener('pointerup', up); addEventListener('keydown', down); addEventListener('keyup', up);
    fly.cleanup = () => { removeEventListener('resize', fs); removeEventListener('pointerup', up); removeEventListener('keydown', down); removeEventListener('keyup', up); };
    const ZONE = [.56, .8];
    const tipEl = hud.querySelector('#fhTip');
    const say = (t, hold = 1.6) => { tipEl.textContent = t; fly.msgT = hold; };
    let last = performance.now();
    function step(now) {
      raf = requestAnimationFrame(step);
      const dt = Math.min(.05, (now - last) / 1000); last = now; const f = fly; f.t += dt;
      // 风：缓慢起伏 + 随机阵风
      f.gustT -= dt; if (f.gustT < 0) { f.gust = .35 + Math.random() * .45; f.gustT = 3 + Math.random() * 4; if (!f.done) say('一阵大风！松一松线', 1.2); whoosh(1); }
      f.gust *= Math.pow(.55, dt);
      const wind = clamp(.42 + Math.sin(f.t * .7) * .18 + Math.sin(f.t * 1.9 + 1) * .08 + f.gust, .08, 1.3);
      f.wind = wind;
      if (f.done) f.pull = false;
      const lift = f.stall > 0 ? -.5 : (f.pull ? wind + .3 : wind * .78);
      f.vy += (lift * 1.25 - .55) * dt * 1.6; f.vy *= Math.pow(.25, dt);
      f.alt = clamp(f.alt + f.vy * dt * .55, .06, .96);
      if (f.alt >= .96) f.vy = Math.min(0, f.vy);
      // 线力
      f.ten = clamp(f.ten + (f.pull ? (wind - .58) * 1.3 + .05 : -.8) * dt, 0, 1.05);
      if (f.ten >= 1 && f.stall <= 0) { f.stall = 1.1; f.ten = .2; f.prog = Math.max(0, f.prog - .25); say('线绷得太紧，沙燕栽了个跟头！', 1.8); drum(); }
      f.stall -= dt;
      if (f.alt <= .07 && f.vy < 0) { f.vy = .3; say('差点挂在屋檐上……拉线救一下', 1.4); }
      const inZone = f.alt > ZONE[0] && f.alt < ZONE[1] && f.stall <= 0;
      if (!f.done) {
        if (inZone) f.prog = Math.min(1, f.prog + dt / 6);
        if (f.prog >= 1) { f.done = true; st.flown = true; say('稳了！沙燕飞过了屋脊', 99); gong(true); ui.tip('飞起来了！点“完成 · 盖印”，它会留在胡同的天空里'); }
        else if (f.msgT <= 0) say(f.alt < ZONE[0] ? (f.pull ? '继续收线，往上爬……' : '风小了，拉线让它爬高') : f.alt > ZONE[1] ? '飞太高了，放点线' : '就在这！稳住……', .3);
      }
      f.msgT -= dt;
      hud.querySelector('#fhWind').style.width = wind / 1.3 * 100 + '%';
      hud.querySelector('#fhTen').style.width = f.ten * 100 + '%';
      hud.querySelector('#fhTen').parentNode.classList.toggle('hot', f.ten > .7);
      hud.querySelector('#fhProg').style.width = f.prog * 100 + '%';
      drawFly(fx, FW, FH, f, ZONE, now, inZone);
    }
    raf = requestAnimationFrame(step);
  }
  function drawFly(x, W, H, f, Z, now, inZone) {
    // 天空
    const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#ecd8b6'); g.addColorStop(.75, '#f7ead0'); g.addColorStop(1, '#f2e2c4');
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    // 太阳
    x.fillStyle = 'rgba(255,214,150,.55)'; x.beginPath(); x.arc(W * .82, H * .2, H * .07, 0, Math.PI * 2); x.fill();
    const groundY = H * .86, altY = a => groundY - a * (groundY - H * .06);
    // 目标高度带
    x.fillStyle = inZone ? 'rgba(63,125,92,.16)' : 'rgba(63,125,92,.08)'; x.fillRect(0, altY(Z[1]), W, altY(Z[0]) - altY(Z[1]));
    x.strokeStyle = 'rgba(63,125,92,.4)'; x.setLineDash([8, 8]); x.lineWidth = 1.5;
    [Z[0], Z[1]].forEach(a => { x.beginPath(); x.moveTo(0, altY(a)); x.lineTo(W, altY(a)); x.stroke(); }); x.setLineDash([]);
    x.fillStyle = 'rgba(63,125,92,.8)'; x.font = `${14 * (W / 1000 + .4)}px "Noto Serif SC"`; x.fillText('稳飞区 · 在这里稳住 6 秒', 16, altY(Z[1]) + 22);
    // 风线
    x.strokeStyle = 'rgba(120,100,80,.35)'; x.lineWidth = 1.5;
    f.streaks.forEach(s => { s.x += f.wind * .006; if (s.x > 1.1) { s.x = -.1; s.y = Math.random() * .7; }
      x.beginPath(); x.moveTo(s.x * W, s.y * H); x.lineTo((s.x - s.l * f.wind) * W, s.y * H + Math.sin(now / 300 + s.y * 20) * 2); x.stroke(); });
    // 远处屋脊
    x.fillStyle = '#b9b1a3';
    for (let i = 0; i < 9; i++) { const bx = i * W / 8 - 40, bw = W / 8 + 30, by = groundY - H * (.06 + (i % 3) * .02);
      x.beginPath(); x.moveTo(bx, groundY); x.lineTo(bx, by + 14); x.quadraticCurveTo(bx + bw / 2, by - 8, bx + bw, by + 14); x.lineTo(bx + bw, groundY); x.fill(); }
    x.fillStyle = '#8f8a82'; x.fillRect(0, groundY, W, H - groundY);
    x.strokeStyle = '#3a342c'; x.lineWidth = 2; x.beginPath(); x.moveTo(0, groundY); x.lineTo(W, groundY); x.stroke();
    // 放风筝的人（院墙上的手）
    const hx = W * .14, hy = groundY - 6;
    x.fillStyle = '#3a342c'; x.beginPath(); x.arc(hx, hy - 40, 10, 0, Math.PI * 2); x.fill(); x.fillRect(hx - 6, hy - 30, 12, 30);
    // 线轱辘
    x.save(); x.translate(hx + 16, hy - 22); x.rotate(f.pull ? -now / 80 : now / 200); x.strokeStyle = '#8a6a4c'; x.lineWidth = 3; x.beginPath(); x.arc(0, 0, 9, 0, Math.PI * 2); x.moveTo(-9, 0); x.lineTo(9, 0); x.moveTo(0, -9); x.lineTo(0, 9); x.stroke(); x.restore();
    // 风筝位置
    const kx = W * (.5 + f.wind * .18) + Math.sin(now / 700) * 8, ky = altY(f.alt) + Math.sin(now / 430) * 4;
    // 线（悬链）
    x.strokeStyle = f.ten > .7 ? '#c23a2b' : '#3a342c'; x.lineWidth = f.ten > .7 ? 2 : 1.2;
    const sag = (1 - f.ten) * 80 + 20;
    x.beginPath(); x.moveTo(hx + 16, hy - 22); x.quadraticCurveTo((hx + kx) / 2, (hy + ky) / 2 + sag, kx, ky + 10); x.stroke();
    // 风筝本体
    const kw = Math.min(W, H) * .22, im = st.baked;
    x.save(); x.translate(kx, ky); x.rotate((f.stall > 0 ? Math.sin(now / 60) * .9 : Math.sin(now / 520) * .12) + (f.wind - .5) * .15);
    x.drawImage(im, -kw / 2, -kw * im.height / im.width * .47, kw, kw * im.height / im.width);
    // 飘带
    x.strokeStyle = st.color; x.lineWidth = 3; x.beginPath(); x.moveTo(0, kw * .25);
    for (let i = 1; i < 8; i++) x.lineTo(-i * 8 * f.wind - 4, kw * .25 + i * 9 + Math.sin(now / 120 + i) * 5); x.stroke();
    x.restore();
    if (f.done) { x.fillStyle = '#c23a2b'; x.font = `600 ${28 * (W / 1000 + .4)}px "Noto Serif SC"`; x.textAlign = 'center'; x.fillText(st.combo ? `「${st.combo}」飞上了胡同的天空` : '沙燕飞上了胡同的天空', W / 2, H * .12); x.textAlign = 'left'; }
  }

  requestAnimationFrame(() => { size(); redraw(); });
  const onResize = () => { if (st.phase === 'paint') { size(); redraw(); } };
  addEventListener('resize', onResize);
  return {
    ok: () => st.flown,
    need: () => st.phase === 'paint' ? '先画好沙燕，再去放飞' : '还没稳住呢，让沙燕在稳飞区多待一会儿',
    result: () => st.baked,
    caption: () => `获得印记 · 鸢 ——${st.combo ? '「' + st.combo + '」' : '你的沙燕'}正飞在胡同上空`,
    dispose: () => { disposed = true; cancelAnimationFrame(raf); removeEventListener('resize', onResize); if (fly && fly.cleanup) fly.cleanup(); }
  };
}

/* ====================================================================
 *  三、脸谱：对镜勾脸
 * ==================================================================== */
const ROLES = [
  { k: 'guanyu', name: '关羽', color: '红', img: './img/lp_guanyu.png', eyes: [[.325, .47], [.67, .47]], chin: [.5, .985],
    clue: '赤面长髯，温酒斩华雄、过五关斩六将，忠义千秋——', why: '红色象征忠勇耿直。关羽的“红整脸”几乎是忠义的代名词。' },
  { k: 'zhangfei', name: '张飞', color: '黑白', img: './img/lp_zhangfei.png', eyes: [[.325, .475], [.67, .475]], chin: [.5, .985],
    clue: '豹头环眼，当阳桥头一声吼，喝断桥梁水倒流——', why: '黑色象征刚直勇猛。张飞是“黑十字门脸”，眉间画蝴蝶，粗中带一分喜气。' },
  { k: 'caocao', name: '曹操', color: '白', img: './img/lp_caocao.png', eyes: [[.31, .47], [.69, .47]], chin: [.5, .985],
    clue: '“宁教我负天下人，休教天下人负我”，奸雄多疑——', why: '水白脸象征奸诈多疑。曹操是最典型的“大白脸”，细纹越多越显城府。' },
  { k: 'douerdun', name: '窦尔敦', color: '蓝', img: './img/lp_douerdun.png', eyes: [[.325, .47], [.67, .47]], chin: [.5, .985],
    clue: '盗御马的绿林好汉，性情刚烈、桀骜不驯——', why: '蓝色象征刚强桀骜。窦尔敦的蓝花脸，嘴下还画着一对“护法钩”。' }
];
const FACE_OVAL = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109];
const EYE_A = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246];
const EYE_B = [263, 249, 390, 373, 374, 380, 381, 382, 362, 398, 384, 385, 386, 387, 388, 466];
const LIPS_IN = [78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308, 415, 310, 311, 312, 13, 82, 81, 80, 191];

function affine3(s, d) { // 三点仿射：src → dst，返回 [a,b,c,d,e,f]
  const [[x1, y1], [x2, y2], [x3, y3]] = s, [[u1, v1], [u2, v2], [u3, v3]] = d;
  const den = x1 * (y2 - y3) + x2 * (y3 - y1) + x3 * (y1 - y2);
  const a = (u1 * (y2 - y3) + u2 * (y3 - y1) + u3 * (y1 - y2)) / den;
  const c = (u1 * (x3 - x2) + u2 * (x1 - x3) + u3 * (x2 - x1)) / den;
  const e = (u1 * (x2 * y3 - x3 * y2) + u2 * (x3 * y1 - x1 * y3) + u3 * (x1 * y2 - x2 * y1)) / den;
  const b = (v1 * (y2 - y3) + v2 * (y3 - y1) + v3 * (y1 - y2)) / den;
  const dd = (v1 * (x3 - x2) + v2 * (x1 - x3) + v3 * (x2 - x1)) / den;
  const f = (v1 * (x2 * y3 - x3 * y2) + v2 * (x3 * y1 - x1 * y3) + v3 * (x1 * y2 - x2 * y1)) / den;
  return [a, b, c, dd, e, f];
}

export function initMask(body, ui) {
  const wrap = el('div', 'mask-wrap'); body.appendChild(wrap);
  refCard(body, './img/ref/lianpu_5.jpg', '清代戏曲人物画', 'Office of Great Peace Album of Opera Faces · Wikimedia Commons · CC0');
  const stage = el('div', 'mask-stage'); wrap.appendChild(stage);
  const side = el('div', 'mask-side'); wrap.appendChild(side);
  const cv = el('canvas', 'mask-cv'); stage.appendChild(cv);
  const ctx = cv.getContext('2d');
  const flash = el('div', 'mask-flash'); stage.appendChild(flash);
  const video = el('video'); video.playsInline = true; video.muted = true;
  const imgs = {}; ROLES.forEach(r => loadImg(r.img).then(i => imgs[r.k] = i));
  let mode = null, lm = null, stream = null, raf = 0, disposed = false;
  let cur = null, reveal = 0, correct = new Set(), pose = 0, posed = new Set(), lastFace = null, jaw = 0;
  const order = [...ROLES].sort(() => Math.random() - .5); let qi = 0;

  // 开场：选择模式
  const gate = el('div', 'mask-gate', `
    <p class="mg-big">对 镜 勾 脸</p>
    <p>打开摄像头，脸谱会贴在你的脸上；<br>画面只在你的浏览器里处理，不会上传</p>
    <div class="mg-btns"><button class="btn" id="mgCam">开启摄像头</button><button class="btn ghost" id="mgPaper">不用摄像头 · 用纸面具</button></div>
    <p class="mg-err" id="mgErr"></p>`);
  stage.appendChild(gate);
  gate.querySelector('#mgCam').onclick = startCam;
  gate.querySelector('#mgPaper').onclick = () => startPaper();

  async function startCam() {
    const err = gate.querySelector('#mgErr'); err.textContent = '正在请摄像头上场……';
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 960 }, height: { ideal: 720 } }, audio: false });
      video.srcObject = stream; await video.play();
      err.textContent = '正在加载人脸识别（首次约 10MB）……';
      const { FilesetResolver, FaceLandmarker } = await import('./lib/mp/vision_bundle.mjs');
      const fs = await FilesetResolver.forVisionTasks(new URL('./lib/mp/wasm', location.href).href);
      const opts = d => ({ baseOptions: { modelAssetPath: new URL('./lib/mp/face_landmarker.task', location.href).href, delegate: d }, runningMode: 'VIDEO', numFaces: 1, outputFaceBlendshapes: true });
      try { lm = await FaceLandmarker.createFromOptions(fs, opts('GPU')); } catch (e) { lm = await FaceLandmarker.createFromOptions(fs, opts('CPU')); }
      if (disposed) return;
      mode = 'cam'; gate.remove(); begin();
    } catch (e) {
      console.warn(e);
      if (stream) stream.getTracks().forEach(t => t.stop());
      err.innerHTML = '摄像头没能打开（可能未授权或设备不支持）<br>先用纸面具玩，效果一样能认角色';
      setTimeout(() => !disposed && startPaper(), 1800);
    }
  }
  function startPaper() { if (mode) return; mode = 'paper'; gate.remove(); begin(); }

  function begin() {
    stage.classList.add(mode);
    const vw = mode === 'cam' ? video.videoWidth : 900, vh = mode === 'cam' ? video.videoHeight : 720;
    cv.width = vw; cv.height = vh;
    renderSide(); raf = requestAnimationFrame(loop);
  }
  function renderSide() {
    const r = order[qi % order.length];
    side.innerHTML = `
      <p class="mh-step"><b>听戏文 · 认角色</b>（已认出 ${correct.size}/2）</p>
      <blockquote class="ms-clue">${r.clue}<br><small>该勾哪张脸？</small></blockquote>
      <div class="ms-cards">${ROLES.map(x => `<button data-k="${x.k}"><img src="${x.img}"><span>${x.color}脸</span></button>`).join('')}</div>
      <p class="ms-why" id="msWhy">红忠勇 · 黑刚直 · 白奸诈 · 蓝桀骜</p>
      <div class="ms-act"><button class="btn ghost" id="msNext" style="display:none">下一出 →</button>
      <button class="btn ghost" id="msShot">拍剧照</button>${mode === 'paper' ? '<button class="btn" id="msPose">亮相！</button>' : ''}</div>`;
    side.querySelectorAll('.ms-cards button').forEach(b => b.onclick = () => choose(b, r));
    side.querySelector('#msNext').onclick = () => { qi++; cur = null; reveal = 0; renderSide(); };
    side.querySelector('#msShot').onclick = shot;
    const pb = side.querySelector('#msPose'); if (pb) pb.onclick = liang;
    ui.tip(mode === 'cam' ? '看着镜头 · 读完戏文选一张脸谱，勾好后张嘴“亮相”' : '读完戏文选一张脸谱，勾好后点“亮相”');
  }
  function choose(b, r) {
    if (b.dataset.k === r.k) {
      side.querySelectorAll('.ms-cards button').forEach(x => x.classList.toggle('on', x === b));
      cur = r; reveal = 0; correct.add(r.k); drum();
      side.querySelector('#msWhy').innerHTML = `<b>${r.name}</b> · ${r.why}`;
      side.querySelector('.mh-step').innerHTML = `<b>听戏文 · 认角色</b>（已认出 ${correct.size}/2）`;
      side.querySelector('#msNext').style.display = '';
      ui.tip(mode === 'cam' ? `勾脸中……画好后张大嘴巴“亮相”！` : '勾好了，点“亮相”');
      if (correct.size >= 2) setTimeout(() => !disposed && ui.tip('已认出两位角色，可以“完成 · 盖印”，也可以继续玩'), 2600);
    } else {
      b.classList.add('wrong'); setTimeout(() => b.classList.remove('wrong'), 500);
      const w = ROLES.find(x => x.k === b.dataset.k);
      side.querySelector('#msWhy').innerHTML = `这是<b>${w.name}</b>的${w.color}脸——再想想戏文里的性情`;
    }
  }
  function liang() {
    if (!cur || reveal < .95 || pose > 0) return;
    pose = 1.6; posed.add(cur.k); gong(true); setTimeout(drum, 180); setTimeout(drum, 420);
    flash.classList.remove('go'); void flash.offsetWidth; flash.classList.add('go');
  }
  function shot() {
    const a = document.createElement('a'); a.download = `一日一巷_${cur ? cur.name : '脸谱'}.png`; a.href = cv.toDataURL('image/png'); a.click();
    ui.tip('剧照已保存到下载文件夹');
  }

  // 纸面具模式的“假人脸”关键点（只需要几何）
  function paperFace(t) {
    const W = cv.width, H = cv.height, cx = W / 2 + Math.sin(t / 1600) * 10, cy = H * .52, rx = H * .28, ry = H * .38;
    const oval = FACE_OVAL.map((_, i) => { const a = -Math.PI / 2 + i / FACE_OVAL.length * Math.PI * 2; return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry * (Math.sin(a) > 0 ? 1 : .92)]; });
    return { oval, eyeA: [cx - rx * .37, cy - ry * .08], eyeB: [cx + rx * .37, cy - ry * .08], chin: [cx, cy + ry], eyesA: null, eyesB: null, lips: null };
  }
  function camFace(res) {
    const L = res.faceLandmarks && res.faceLandmarks[0]; if (!L) return null;
    const W = cv.width, H = cv.height, P = i => [L[i].x * W, L[i].y * H];
    const mid = (a, b) => { const p = P(a), q = P(b); return [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]; };
    const bs = res.faceBlendshapes && res.faceBlendshapes[0]; jaw = bs ? (bs.categories.find(c => c.categoryName === 'jawOpen') || {}).score || 0 : 0;
    return { oval: FACE_OVAL.map(P), eyeA: mid(33, 133), eyeB: mid(263, 362), chin: P(152), eyesA: EYE_A.map(P), eyesB: EYE_B.map(P), lips: LIPS_IN.map(P) };
  }
  const poly = (pts, grow = 1, c) => {
    if (!c) { c = [0, 0]; pts.forEach(p => { c[0] += p[0] / pts.length; c[1] += p[1] / pts.length; }); }
    ctx.beginPath(); pts.forEach(([x, y], i) => { const X = c[0] + (x - c[0]) * grow, Y = c[1] + (y - c[1]) * grow; i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); }); ctx.closePath();
  };
  let last = performance.now(), smoothF = null;
  function loop(now) {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    const W = cv.width, H = cv.height;
    let F = null;
    ctx.setTransform(-1, 0, 0, 1, W, 0); // 镜像，像照镜子
    if (mode === 'cam') {
      if (video.readyState >= 2) {
        ctx.drawImage(video, 0, 0, W, H);
        try { const res = lm.detectForVideo(video, now); F = camFace(res); } catch (e) {}
      }
    } else {
      ctx.fillStyle = '#efe4cb'; ctx.fillRect(0, 0, W, H);
      F = paperFace(now);
      poly(F.oval, 1.0); ctx.fillStyle = '#f7efdf'; ctx.fill(); ctx.strokeStyle = '#8a7a64'; ctx.lineWidth = 3; ctx.stroke();
    }
    // 平滑关键点，避免抖动
    if (F) {
      if (smoothF && smoothF.oval.length === F.oval.length) {
        const k = .55, sm = (a, b) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k)];
        F.eyeA = sm(smoothF.eyeA, F.eyeA); F.eyeB = sm(smoothF.eyeB, F.eyeB); F.chin = sm(smoothF.chin, F.chin);
        F.oval = F.oval.map((p, i) => sm(smoothF.oval[i], p));
      }
      smoothF = F; lastFace = now;
    }
    if (F && cur && imgs[cur.k]) {
      reveal = Math.min(1, reveal + dt * .7);
      const im = imgs[cur.k], iw = im.width, ih = im.height;
      const M = affine3([[cur.eyes[0][0] * iw, cur.eyes[0][1] * ih], [cur.eyes[1][0] * iw, cur.eyes[1][1] * ih], [cur.chin[0] * iw, cur.chin[1] * ih]], [F.eyeA, F.eyeB, F.chin]);
      ctx.save();
      // 额头往上扩一点，让脸谱盖到发际
      const up = [F.eyeA[0] / 2 + F.eyeB[0] / 2, F.eyeA[1] / 2 + F.eyeB[1] / 2];
      poly(F.oval.map(([x, y]) => y < up[1] ? [x, up[1] + (y - up[1]) * 1.12] : [x, y]), 1.04); ctx.clip();
      ctx.transform(...M);
      // 勾脸：从额头往下一笔笔画出来
      const rh = ih * reveal;
      ctx.globalAlpha = .93; ctx.drawImage(im, 0, 0, iw, rh, 0, 0, iw, rh);
      if (reveal < 1) { ctx.globalAlpha = 1; ctx.fillStyle = '#c23a2b'; ctx.fillRect(iw * .1, rh - 3, iw * .8, 4); }
      ctx.restore();
      // 保留真实光影
      if (mode === 'cam') {
        ctx.save(); poly(F.oval, 1.0); ctx.clip(); ctx.globalCompositeOperation = 'soft-light'; ctx.globalAlpha = .45; ctx.drawImage(video, 0, 0, W, H); ctx.restore();
        // 露出真眼睛、真嘴巴
        if (reveal > .45 && F.eyesA) { ctx.save(); poly(F.eyesA, 1.15); poly(F.eyesB, 1.15); ctx.clip(); ctx.drawImage(video, 0, 0, W, H); ctx.restore(); }
        if (reveal > .9 && F.lips && jaw > .15) { ctx.save(); poly(F.lips, 1.0); ctx.clip(); ctx.drawImage(video, 0, 0, W, H); ctx.restore(); }
        if (jaw > .45) liang();
      }
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    // 亮相字幕
    if (pose > 0) {
      pose -= dt; const a = clamp(pose / .4);
      ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = '#c23a2b'; ctx.font = `900 ${H * .14}px "Noto Serif SC"`; ctx.textAlign = 'center';
      ctx.fillText('好！', W / 2, H * .2); ctx.font = `600 ${H * .045}px "Noto Serif SC"`; ctx.fillStyle = '#fbefdc';
      ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = 4; const s = `—— ${cur ? cur.name : ''} · 亮相 ——`; ctx.strokeText(s, W / 2, H * .28); ctx.fillText(s, W / 2, H * .28); ctx.restore();
    }
    if (mode === 'cam' && (!lastFace || now - lastFace > 600)) {
      ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(0, H - 50, W, 50); ctx.fillStyle = '#fbefdc'; ctx.font = `${22}px "Noto Serif SC"`; ctx.textAlign = 'center'; ctx.fillText('把脸放进画面中央', W / 2, H - 18); ctx.textAlign = 'left';
    }
    // 戏台边框角花
    ctx.strokeStyle = '#c23a2b'; ctx.lineWidth = 6; const m = 18, L = 60;
    [[m, m, 1, 1], [W - m, m, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1]].forEach(([x, y, sx, sy]) => { ctx.beginPath(); ctx.moveTo(x, y + sy * L); ctx.lineTo(x, y); ctx.lineTo(x + sx * L, y); ctx.stroke(); });
  }
  return {
    ok: () => correct.size >= 2,
    need: () => `再认出 ${2 - correct.size} 位角色吧`,
    caption: () => `获得印记 · 谱 ——你勾过了 ${[...correct].map(k => ROLES.find(r => r.k === k).name).join('、')} 的脸`,
    dispose: () => { disposed = true; cancelAnimationFrame(raf); if (stream) stream.getTracks().forEach(t => t.stop()); try { lm && lm.close(); } catch (e) {} }
  };
}
