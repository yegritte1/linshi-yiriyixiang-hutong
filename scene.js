/* 一日一巷 · 3D 胡同场景
 * 程序化生成一条东西向胡同：四合院、门楼、戏楼、早点摊、小卖部、槐树、电线杆、鸽群、风筝。
 * 风格：米色纸面 + 卡通分层光 + 墨线描边，雾气把远景溶进纸里（对标 Chartogne-Taillet）。
 * Tripo AI 模型：把 glb 放进 models/ 并在 MODEL_SLOTS 中登记，会自动替换对应的程序化建筑。
 */
import * as THREE from 'three';
import { GLTFLoader } from './lib/loaders/GLTFLoader.js';

const C = (s) => new THREE.Color(s);
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);

/* ---------- Tripo 模型槽位：文件存在就替换程序化建筑 ---------- */
export const MODEL_SLOTS = {
  opera:     { file: 'models/opera.glb',     pos: [-90, 0, 15],  rotY: Math.PI, size: 16 },
  gate:      { file: 'models/gate.glb',      pos: [-20.25, 0, -4.6], rotY: 0, size: 4.2 },
  siheyuan:  { file: 'models/siheyuan.glb',  pos: [0, 0, -18],   rotY: 0,     size: 30 },
  stall:     { file: 'models/stall.glb',     pos: [96, 0, 7],    rotY: 0,     size: 5 },
  store:     { file: 'models/store.glb',     pos: [108, 0, -7],  rotY: 0,     size: 8 },
  tree:      { file: 'models/tree.glb',      pos: null }
};

/* ---------- 镜头节点（与 main.js 的 STOPS 一一对应） ---------- */
const CAMS = [
  { p: [175, 78, 95],  t: [70, 0, -5] },     // 拂晓 · 东头航拍
  { p: [104, 7.5, 21], t: [95, 2.2, 6] },    // 早点摊
  { p: [88.5, 4.6, -10.5], t: [84, 1.1, -15] }, // 毛猴（东侧院工作台）
  { p: [14, 34, 14],   t: [0, 0, -17] },     // 四合院（俯看院心）
  { p: [2, 11, -6],     t: [-30, 12, 22] },   // 沙燕（胡同里仰看风筝）
  { p: [-74, 9, -4],   t: [-90, 5, 14] },    // 戏楼
  { p: [-102, 4.2, 4],  t: [-104, 2.6, 13] },  // 脸谱（后台）
  { p: [-70, 62, -95], t: [-25, 0, 0] }      // 深夜 · 西头回望
];

/* ---------- 光照关键帧 ---------- */
const LIGHT = [
  { h: 5,    top: '#a9b8c8', hor: '#e6e2da', sun: '#ffd9b0', si: .35, hs: '#b9c6d6', hg: '#c9bfac', hi: 1.0, fn: 30,  ff: 230, lamp: .3, night: 0 },
  { h: 6.5,  top: '#d6cfcb', hor: '#f3e1cf', sun: '#ffd2a0', si: 1.3, hs: '#dcdcd8', hg: '#d8ccb4', hi: .85, fn: 60,  ff: 320, lamp: 0,  night: 0 },
  { h: 9,    top: '#e8e1d0', hor: '#f6eedb', sun: '#fff1d8', si: 1.9, hs: '#efe9dc', hg: '#d8ccb4', hi: .85, fn: 110, ff: 460, lamp: 0,  night: 0 },
  { h: 12,   top: '#ece3cd', hor: '#f8f1e0', sun: '#fff8ea', si: 2.2, hs: '#f2ece0', hg: '#d8ccb4', hi: .9,  fn: 120, ff: 480, lamp: 0,  night: 0 },
  { h: 15,   top: '#ecd8b6', hor: '#f7e6c8', sun: '#ffe2b0', si: 2.0, hs: '#f0e4cc', hg: '#d4c2a2', hi: .85, fn: 110, ff: 460, lamp: 0,  night: 0 },
  { h: 17.5, top: '#e3a274', hor: '#f5c99a', sun: '#ff9a55', si: 1.7, hs: '#f0b890', hg: '#a88a70', hi: .65, fn: 80,  ff: 380, lamp: .25,night: 0 },
  { h: 19,   top: '#5d5478', hor: '#c98a78', sun: '#ff7a50', si: .55, hs: '#7d7090', hg: '#5a4a4a', hi: .5,  fn: 60,  ff: 330, lamp: .85,night: .35 },
  { h: 21,   top: '#121a2d', hor: '#2c3450', sun: '#9fb4e0', si: .45, hs: '#3a4668', hg: '#1c1e28', hi: .45, fn: 50,  ff: 300, lamp: 1,  night: 1 },
  { h: 24,   top: '#0d1424', hor: '#232a42', sun: '#9fb4e0', si: .4,  hs: '#34405e', hg: '#181a22', hi: .42, fn: 50,  ff: 300, lamp: 1,  night: 1 }
];
function lightAt(h) {
  let i = 0;
  while (i < LIGHT.length - 2 && h > LIGHT[i + 1].h) i++;
  const a = LIGHT[i], b = LIGHT[i + 1], t = smooth(clamp((h - a.h) / (b.h - a.h)));
  const out = {};
  for (const k in a) {
    if (k === 'h') continue;
    out[k] = typeof a[k] === 'string' ? C(a[k]).lerp(C(b[k]), t) : lerp(a[k], b[k], t);
  }
  return out;
}

/* ---------- 材质 ---------- */
function gradientMap() {
  const d = new Uint8Array([90, 90, 90, 255, 175, 175, 175, 255, 255, 255, 255, 255]);
  const t = new THREE.DataTexture(d, 3, 1, THREE.RGBAFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true;
  return t;
}
const GM = gradientMap();
const matCache = {};
const M = (hex) => matCache[hex] || (matCache[hex] = new THREE.MeshToonMaterial({ color: hex, gradientMap: GM }));
const PAL = {
  wall: '#cfc6b4', brick: '#a9a49a', roof: '#6f7378', ridge: '#55585c', red: '#9b3b2e', redDoor: '#a5402f',
  wood: '#8a6a4c', ground: '#e8dfca', alley: '#d6cbb2', yard: '#ddd2bc', leaf: '#8f9b7c', leaf2: '#7f8c6f',
  trunk: '#6d5d4e', stone: '#bdb6a8', paper: '#efe6d2', pole: '#6a5f52'
};
const inkMat = new THREE.LineBasicMaterial({ color: '#3a342c', transparent: true, opacity: .85 });
const lanternMat = new THREE.MeshStandardMaterial({ color: '#b8322a', emissive: '#ff7a3a', emissiveIntensity: 0, roughness: .7 });
const windowMat = new THREE.MeshStandardMaterial({ color: '#7a5a3e', emissive: '#ffbf6a', emissiveIntensity: 0, roughness: 1 });

function ink(mesh, angle = 28) {
  const e = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry, angle), inkMat);
  e.raycast = () => {};
  mesh.add(e);
  return mesh;
}
function mesh(geo, color, { shadow = true, edges = true, angle } = {}) {
  const m = new THREE.Mesh(geo, typeof color === 'string' ? M(color) : color);
  if (shadow) { m.castShadow = true; m.receiveShadow = true; }
  if (edges) ink(m, angle);
  return m;
}
function box(w, h, d, color, x = 0, y = 0, z = 0, opt) {
  const m = mesh(new THREE.BoxGeometry(w, h, d), color, opt);
  m.position.set(x, y + h / 2, z);
  return m;
}

/* ---------- 构件 ---------- */
// 坡屋顶：沿 x 方向延伸，屋面略带凹曲线（北方硬山顶）
function roof(w, d, h, o = .6, color = PAL.roof) {
  const g = new THREE.Group();
  const hd = d / 2 + o, L = w + o * 2;
  const s = new THREE.Shape();
  s.moveTo(-hd, -.1);
  s.quadraticCurveTo(-hd * .35, h * .18, 0, h);
  s.quadraticCurveTo(hd * .35, h * .18, hd, -.1);
  s.lineTo(hd, -.45);
  s.quadraticCurveTo(hd * .35, h * .18 - .35, 0, h - .35);
  s.quadraticCurveTo(-hd * .35, h * .18 - .35, -hd, -.45);
  const geo = new THREE.ExtrudeGeometry(s, { depth: L, bevelEnabled: false, curveSegments: 8 });
  geo.translate(0, 0, -L / 2); geo.rotateY(Math.PI / 2);
  g.add(mesh(geo, color, { angle: 35 }));
  // 瓦垄：细线增加手绘感
  const pts = [];
  for (let x = -L / 2 + .5; x < L / 2; x += .55) {
    pts.push(new THREE.Vector3(x, h - .02, 0), new THREE.Vector3(x, h * .3, hd * .72));
    pts.push(new THREE.Vector3(x, h - .02, 0), new THREE.Vector3(x, h * .3, -hd * .72));
  }
  const lg = new THREE.BufferGeometry().setFromPoints(pts);
  const lines = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: '#4a4d52', transparent: true, opacity: .35 }));
  g.add(lines);
  const ridge = box(L, .45, .5, PAL.ridge, 0, h - .2, 0);
  g.add(ridge);
  // 屋脊两端微翘
  [-1, 1].forEach(sx => { const c = box(.5, .8, .55, PAL.ridge, sx * (L / 2 - .25), h - .1, 0); g.add(c); });
  return g;
}
// 房子：正面朝 +z
function house(w, d, wallH = 3.2, roofH = 2.2, { lit = false, color = PAL.wall } = {}) {
  const g = new THREE.Group();
  g.add(box(w, wallH, d, color));
  // 正面：红柱 + 槛窗
  const cols = Math.max(2, Math.round(w / 3.2));
  for (let i = 0; i <= cols; i++) {
    const x = -w / 2 + .25 + i * (w - .5) / cols;
    g.add(box(.28, wallH, .28, PAL.red, x, 0, d / 2 + .1, { edges: false }));
  }
  for (let i = 0; i < cols; i++) {
    const x = -w / 2 + .25 + (i + .5) * (w - .5) / cols;
    const win = new THREE.Mesh(new THREE.BoxGeometry((w - .5) / cols - .6, wallH * .5, .08), lit ? windowMat : M(PAL.wood));
    win.position.set(x, wallH * .55, d / 2 + .06);
    ink(win); g.add(win);
  }
  const r = roof(w, d, roofH);
  r.position.y = wallH;
  g.add(r);
  return g;
}
function wall(len, h = 2.8, color = PAL.brick) {
  const g = new THREE.Group();
  g.add(box(len, h, .5, color));
  const cap = box(len + .2, .35, .9, PAL.ridge, 0, h, 0);
  g.add(cap);
  return g;
}
function lantern(x, y, z, parent) {
  const l = new THREE.Mesh(new THREE.SphereGeometry(.32, 12, 8), lanternMat);
  l.scale.y = 1.25; l.position.set(x, y, z);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(.18, .18, .12, 8), M('#2f2b26'));
  cap.position.y = .42; l.add(cap);
  parent.add(l);
  return l;
}
// 宅门：门楼 + 红门 + 门墩 + 灯笼，正面朝 +z
function gate(withPlate = false) {
  const g = new THREE.Group();
  g.add(box(3.8, 3.4, 3, PAL.wall));
  const door = box(2.2, 2.6, .12, PAL.redDoor, 0, 0, 1.56);
  g.add(door);
  g.add(box(.05, 2.6, .14, '#4a1f18', 0, 0, 1.6, { edges: false }));
  [-.5, .5].forEach(x => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.12, .03, 6, 12), M('#c99a4b'));
    ring.position.set(x * .5, 1.3, 1.65); g.add(ring);
  });
  [-1, 1].forEach(s => {
    const drum = mesh(new THREE.CylinderGeometry(.35, .35, .45, 14), PAL.stone);
    drum.rotation.x = Math.PI / 2; drum.position.set(s * 1.4, .55, 1.9); g.add(drum);
    g.add(box(.8, .3, .7, PAL.stone, s * 1.4, 0, 1.85));
  });
  g.add(box(3.4, .3, 1.2, PAL.stone, 0, 0, 2.1));
  const r = roof(3.8, 3, 1.5, .7);
  r.position.y = 3.4; g.add(r);
  g.userData.lanterns = [lantern(-1.3, 2.75, 1.85, g), lantern(1.3, 2.75, 1.85, g)];
  if (withPlate) {
    const plate = box(.7, .4, .06, '#2b4a72', 1.5, 2.1, 1.55);
    g.add(plate);
  }
  return g;
}
function tree(scale = 1, seed = 1) {
  const g = new THREE.Group();
  const rnd = mulberry(seed);
  const trunk = mesh(new THREE.CylinderGeometry(.35 * scale, .55 * scale, 5 * scale, 7), PAL.trunk);
  trunk.position.y = 2.5 * scale; g.add(trunk);
  for (let i = 0; i < 7; i++) {
    const r = (1.6 + rnd() * 1.4) * scale;
    const c = mesh(new THREE.IcosahedronGeometry(r, 0), i % 2 ? PAL.leaf : PAL.leaf2, { angle: 40 });
    const a = rnd() * Math.PI * 2, d = rnd() * 2.2 * scale;
    c.position.set(Math.cos(a) * d, (5 + rnd() * 2.6) * scale, Math.sin(a) * d);
    c.rotation.set(rnd() * 3, rnd() * 3, 0);
    g.add(c);
  }
  return g;
}
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// 四合院：本地坐标 z=0 为临街，院子向 -z 延伸；门楼在东南角
function siheyuan(seed, { big = false, plate = false, noTree = false } = {}) {
  const g = new THREE.Group();
  const rnd = mulberry(seed);
  const W = big ? 30 : 22, D = big ? 30 : 26;
  const yard = new THREE.Mesh(new THREE.PlaneGeometry(W - 1, D - 1), M(PAL.yard));
  yard.rotation.x = -Math.PI / 2; yard.position.set(0, .02, -D / 2); yard.receiveShadow = true;
  g.add(yard);
  // 倒座房（背向胡同）
  const dz = house(W * .62, 5, 3, 2, {}); dz.rotation.y = Math.PI; dz.position.set(-W * .17, 0, -2.8); g.add(dz);
  // 门楼
  const gt = gate(plate); gt.position.set(W / 2 - 5, 0, -1.5); g.add(gt);
  g.userData.gate = gt;
  // 正房
  const zf = house(W * .7, 6.5, 3.6, 2.6, { lit: true }); zf.position.set(0, 0, -D + 4); g.add(zf);
  // 耳房
  [-1, 1].forEach(s => { const e = house(W * .12, 5, 3, 1.8); e.position.set(s * (W * .35 + W * .06), 0, -D + 3.6); g.add(e); });
  // 厢房
  [-1, 1].forEach(s => { const x = house(9, 5, 3.2, 2.1, { lit: rnd() > .4 }); x.rotation.y = -s * Math.PI / 2; x.position.set(s * (W / 2 - 3.3), 0, -D * .5); g.add(x); });
  // 围墙
  [-1, 1].forEach(s => { const w = wall(D); w.rotation.y = Math.PI / 2; w.position.set(s * (W / 2 - .25), 0, -D / 2); g.add(w); });
  const bw = wall(W); bw.position.set(0, 0, -D + .25); g.add(bw);
  // 院中树 / 鱼缸
  if (!noTree && (rnd() > .25 || big)) { const t = tree(big ? 1.25 : .9 + rnd() * .3, seed * 7); t.position.set((rnd() - .5) * 6, 0, -D * .5 + (rnd() - .5) * 4); g.add(t); g.userData.tree = t; }
  const tank = mesh(new THREE.CylinderGeometry(.9, .7, .8, 14), '#7d7468'); tank.position.set(-3, .4, -D * .42); g.add(tank);
  return g;
}

function operaStage() {
  const g = new THREE.Group();
  g.add(box(16, 1.4, 12, PAL.stone));
  g.add(box(16.4, .2, 12.4, '#8d867a', 0, 1.4, 0));
  // 柱
  [[-6.5, 5], [6.5, 5], [-6.5, -5], [6.5, -5], [-2.2, 5], [2.2, 5]].forEach(([x, z]) => g.add(box(.55, 6, .55, PAL.red, x, 1.6, z)));
  // 后墙
  g.add(box(15, 6, .5, PAL.wall, 0, 1.6, -5.2));
  // 额枋
  g.add(box(14, .9, .5, '#2f5d8a', 0, 6.8, 5));
  g.add(box(4, .7, .2, '#c99a4b', 0, 6.85, 5.3));
  // 重檐
  const r1 = roof(16, 12, 2.4, 1.2); r1.position.y = 7.6; g.add(r1);
  const r2 = roof(11, 7, 2.8, 1); r2.position.y = 10.2; g.add(r2);
  g.add(box(11, 1.4, 7, PAL.wall, 0, 9.0, 0));
  // 翘角
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
    const c = mesh(new THREE.ConeGeometry(.35, 1.6, 6), PAL.ridge);
    c.position.set(sx * 8.9, 8.1, sz * 7); c.rotation.z = -sx * .9; c.rotation.x = sz * .5; g.add(c);
  });
  // 台口帷幔
  g.add(box(13, 1.2, .1, '#a5402f', 0, 5.6, 5.1, { edges: false }));
  g.userData.lanterns = [lantern(-4.5, 5.2, 5.6, g), lantern(4.5, 5.2, 5.6, g), lantern(-7, 5.2, 5.6, g), lantern(7, 5.2, 5.6, g)];
  return g;
}

function breakfastStall() {
  const g = new THREE.Group();
  g.add(box(3.2, 1, 1.6, PAL.wood));
  for (let i = 0; i < 3; i++) {
    const s = mesh(new THREE.CylinderGeometry(.55, .55, .35, 16), '#c9b48a');
    s.position.set(-.8, 1.2 + i * .36, 0); g.add(s);
  }
  const lid = mesh(new THREE.ConeGeometry(.6, .35, 16), '#b9a37a'); lid.position.set(-.8, 2.25, 0); g.add(lid);
  const wok = mesh(new THREE.SphereGeometry(.55, 14, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), '#3a3530'); wok.position.set(.8, 1.4, 0); g.add(wok);
  // 伞
  const pole = mesh(new THREE.CylinderGeometry(.05, .05, 3.6, 6), PAL.pole, { edges: false }); pole.position.set(1.8, 1.8, .6); g.add(pole);
  const um = mesh(new THREE.ConeGeometry(2.4, .9, 12, 1, true), M('#b8322a'), { angle: 10 }); um.material.side = THREE.DoubleSide; um.position.set(1.8, 3.7, .6); g.add(um);
  // 桌凳
  [[-.5, 2.4], [1.6, 2.6]].forEach(([x, z]) => { g.add(box(1.2, .75, .8, PAL.wood, x, 0, z)); g.add(box(.4, .45, .4, PAL.wood, x - .9, 0, z)); g.add(box(.4, .45, .4, PAL.wood, x + .9, 0, z)); });
  // 糖葫芦草把
  const straw = mesh(new THREE.CylinderGeometry(.22, .22, 1, 8), '#c9a75a'); straw.position.set(-2.1, 2.2, .4); g.add(straw);
  const sp = mesh(new THREE.CylinderGeometry(.03, .03, 2.4, 4), PAL.pole, { edges: false }); sp.position.set(-2.1, 1.2, .4); g.add(sp);
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2;
    const st = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, .7, 4), M('#7a5a3e'));
    st.position.set(-2.1 + Math.cos(a) * .3, 2.6, .4 + Math.sin(a) * .3); st.rotation.set(Math.sin(a) * .5, 0, -Math.cos(a) * .5); g.add(st);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(.09, 8, 6), M('#b8322a'));
    ball.position.set(-2.1 + Math.cos(a) * .45, 2.85, .4 + Math.sin(a) * .45); g.add(ball);
  }
  return g;
}
function store() {
  const g = house(8, 5, 3.2, 1.8, { lit: true, color: '#d6cdb9' });
  g.add(box(4.5, .9, .15, '#b8322a', 0, 3.3, 2.65));
  g.add(box(2.4, 1, .9, '#9fb3b8', -1.8, 0, 3));
  return g;
}
function kite() {
  const g = new THREE.Group();
  const s = new THREE.Shape();
  // 沙燕轮廓（简化）
  s.moveTo(0, 1.6); s.quadraticCurveTo(.6, 1.4, .5, .9); s.lineTo(2.6, 1.1); s.quadraticCurveTo(2.9, .4, 2.2, .2);
  s.lineTo(.6, .1); s.lineTo(.9, -1.6); s.lineTo(.2, -.9); s.lineTo(0, -1.2);
  s.lineTo(-.2, -.9); s.lineTo(-.9, -1.6); s.lineTo(-.6, .1); s.lineTo(-2.2, .2);
  s.quadraticCurveTo(-2.9, .4, -2.6, 1.1); s.lineTo(-.5, .9); s.quadraticCurveTo(-.6, 1.4, 0, 1.6);
  const geo = new THREE.ShapeGeometry(s);
  const m = new THREE.Mesh(geo, new THREE.MeshToonMaterial({ color: '#f1e7d2', gradientMap: GM, side: THREE.DoubleSide }));
  ink(m, 1); g.add(m);
  // 彩绘
  const c1 = new THREE.Mesh(new THREE.CircleGeometry(.35, 16), new THREE.MeshBasicMaterial({ color: '#b8322a', side: THREE.DoubleSide }));
  c1.position.set(1.4, .6, .01); g.add(c1);
  const c2 = c1.clone(); c2.position.x = -1.4; g.add(c2);
  const c3 = new THREE.Mesh(new THREE.CircleGeometry(.28, 16), new THREE.MeshBasicMaterial({ color: '#2f5d8a', side: THREE.DoubleSide }));
  c3.position.set(0, .9, .01); g.add(c3);
  g.scale.setScalar(1.3);
  return g;
}

/* ---------- 初始化 ---------- */
export function initScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog('#f6eedb', 100, 450);
  const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, .5, 1500);

  const hemi = new THREE.HemisphereLight('#f2ece0', '#d8ccb4', .9);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff8ea', 2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  Object.assign(sun.shadow.camera, { left: -55, right: 55, top: 55, bottom: -55, near: 1, far: 600 });
  sun.shadow.bias = -.0004; sun.shadow.normalBias = .6;
  scene.add(sun); scene.add(sun.target);

  const world = new THREE.Group(); scene.add(world);
  const procedural = {};

  // 地面 + 胡同路面
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), M(PAL.ground));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; world.add(ground);
  const alley = new THREE.Mesh(new THREE.PlaneGeometry(250, 7), M(PAL.alley));
  alley.rotation.x = -Math.PI / 2; alley.position.y = .015; alley.receiveShadow = true; world.add(alley);
  // 路面石板缝
  const seams = [];
  for (let x = -125; x < 125; x += 1.6) seams.push(new THREE.Vector3(x, .03, -3.5), new THREE.Vector3(x + .2, .03, 3.5));
  world.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(seams), new THREE.LineBasicMaterial({ color: '#b9ad94', transparent: true, opacity: .5 })));

  const lanterns = [];
  const addCourt = (x, side, seed, opt = {}) => {
    const c = siheyuan(seed, opt);
    c.position.set(x, 0, side * 3.6);
    c.rotation.y = side < 0 ? 0 : Math.PI;
    world.add(c);
    lanterns.push(...c.userData.gate.userData.lanterns);
    return c;
  };
  const north = [[84, 3, { noTree: true }], [60, 5], [36, 8], [0, 11, { big: true }], [-26, 13, { plate: true }], [-50, 17], [-74, 19], [-98, 23]];
  const south = [[72, 29], [48, 31], [24, 37], [-2, 41], [-28, 43], [-52, 47]];
  const courts = {};
  north.forEach(([x, s, o]) => courts['n' + x] = addCourt(x, -1, s, o));
  south.forEach(([x, s, o]) => courts['s' + x] = addCourt(x, 1, s, o));
  procedural.siheyuan = courts.n0;

  // 胡同外围的远景屋顶（溶进雾里）
  const rndF = mulberry(99);
  for (let i = 0; i < 70; i++) {
    const x = -160 + rndF() * 320, side = rndF() > .5 ? 1 : -1, z = side * (38 + rndF() * 90);
    const h = house(8 + rndF() * 10, 5 + rndF() * 3, 3, 2);
    h.position.set(x, 0, z); h.rotation.y = rndF() > .5 ? 0 : Math.PI; world.add(h);
  }
  for (let i = 0; i < 40; i++) {
    const t = tree(.9 + rndF() * .6, i + 200);
    const side = rndF() > .5 ? 1 : -1;
    t.position.set(-170 + rndF() * 340, 0, side * (34 + rndF() * 100)); world.add(t);
  }

  // 戏楼（西头南侧）
  const opera = operaStage(); opera.position.set(-90, 0, 15); opera.rotation.y = Math.PI; world.add(opera);
  lanterns.push(...opera.userData.lanterns);
  procedural.opera = opera;
  // 戏班后台
  const back = house(8, 6, 3.2, 2, { lit: true }); back.position.set(-104, 0, 16); back.rotation.y = Math.PI; world.add(back);
  lanterns.push(lantern(-101, 2.8, 12.6, world), lantern(-107, 2.8, 12.6, world));
  // 戏楼前小广场
  const plaza = new THREE.Mesh(new THREE.PlaneGeometry(30, 12), M('#d9cdb3'));
  plaza.rotation.x = -Math.PI / 2; plaza.position.set(-92, .02, 6); plaza.receiveShadow = true; world.add(plaza);

  // 早点摊 / 小卖部（东头）
  const stall = breakfastStall(); stall.position.set(96, 0, 7); world.add(stall); procedural.stall = stall;
  const shop = store(); shop.position.set(108, 0, -7); world.add(shop); procedural.store = shop;
  lanterns.push(lantern(110.5, 3.1, -4.2, world));

  // 胡同两侧大槐树
  [[30, 4.6, 1.3], [64, 4.6, 1.2], [-62, -4.6, 1.3], [102, -4.4, 1.1], [-122, 4.6, 1.2]].forEach(([x, z, s], i) => {
    const t = tree(s, 500 + i); t.position.set(x, 0, z); world.add(t);
  });

  // 电线杆 + 电线
  const poleTops = [];
  for (let x = 116; x > -118; x -= 19) {
    const p = mesh(new THREE.CylinderGeometry(.12, .16, 8, 6), PAL.pole); p.position.set(x, 4, 4.3); world.add(p);
    const arm = box(1.6, .12, .12, PAL.pole, x, 7.3, 4.3); world.add(arm);
    poleTops.push(new THREE.Vector3(x, 7.4, 3.7), new THREE.Vector3(x, 7.4, 4.9));
  }
  const wirePts = [];
  for (let i = 0; i < poleTops.length - 2; i++) {
    const a = poleTops[i], b = poleTops[i + 2];
    for (let k = 0; k < 12; k++) {
      const t0 = k / 12, t1 = (k + 1) / 12;
      const sag = (t) => -Math.sin(t * Math.PI) * 1.1;
      wirePts.push(a.clone().lerp(b, t0).add(new THREE.Vector3(0, sag(t0), 0)), a.clone().lerp(b, t1).add(new THREE.Vector3(0, sag(t1), 0)));
    }
  }
  world.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(wirePts), inkMat));

  // 毛猴工作台（东侧院里，窗下一张桌子）
  const bench = new THREE.Group();
  bench.add(box(3, .9, 1.4, PAL.wood));
  bench.add(box(3.2, .1, 1.6, '#7a5a3e', 0, .9, 0));
  const mkMonkey = (x, z, r) => { const m = new THREE.Group();
    const body = mesh(new THREE.SphereGeometry(.13, 8, 6), '#8a6a4c'); body.scale.y = 1.4; body.position.y = .18; m.add(body);
    const head = mesh(new THREE.SphereGeometry(.09, 8, 6), '#b08a5a'); head.position.y = .38; m.add(head);
    [-1, 1].forEach(sx => { const a = mesh(new THREE.CylinderGeometry(.015, .015, .22, 4), '#6d4f36', { edges: false }); a.position.set(sx * .13, .22, 0); a.rotation.z = sx * .7; m.add(a); });
    m.position.set(x, 1, z); m.rotation.y = r; bench.add(m); return m; };
  mkMonkey(-.9, .2, .3); mkMonkey(-.4, -.1, -.5); mkMonkey(.2, .25, .8);
  // 迷你洋车
  const cart = box(.5, .25, .3, '#a5402f', .9, 1, 0); bench.add(cart);
  [-1, 1].forEach(sz => { const w = mesh(new THREE.TorusGeometry(.16, .025, 6, 12), '#2f2b26', { edges: false }); w.position.set(.9, 1.12, sz * .2); bench.add(w); });
  const lampB = lantern(1.2, 1.9, -.4, bench);
  lanterns.push(lampB);
  bench.position.set(84, 0, -15); world.add(bench);

  // 晾衣绳 + 自行车：胡同生活细节
  const clothesCols = ['#c9d2d6', '#b8322a', '#e8dcc0', '#7d8fa0', '#d9c38a'];
  [[56, -9, 6], [-44, -9, 5], [20, 10, 5]].forEach(([x, z, len], k) => {
    const pts = [new THREE.Vector3(x - len / 2, 2.6, z), new THREE.Vector3(x + len / 2, 2.6, z)];
    world.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), inkMat));
    for (let i = 0; i < 4; i++) { const c = mesh(new THREE.PlaneGeometry(.7, .9), new THREE.MeshToonMaterial({ color: clothesCols[(i + k) % 5], gradientMap: GM, side: THREE.DoubleSide }), { angle: 1 });
      c.position.set(x - len / 2 + .9 + i * (len - 1.8) / 3, 2.1, z); world.add(c); }
  });
  const bike = (x, z, r) => { const b = new THREE.Group(); const wm = M('#2f2b26');
    [-.55, .55].forEach(dx => { const w = new THREE.Mesh(new THREE.TorusGeometry(.33, .03, 6, 16), wm); w.position.set(dx, .35, 0); b.add(w); });
    const f = new THREE.Mesh(new THREE.BoxGeometry(1.1, .05, .05), wm); f.position.y = .62; f.rotation.z = .15; b.add(f);
    const st = new THREE.Mesh(new THREE.BoxGeometry(.05, .4, .05), wm); st.position.set(-.25, .55, 0); b.add(st);
    b.position.set(x, 0, z); b.rotation.y = r; world.add(b); };
  bike(90, -3, .1); bike(40, 3.1, 0); bike(-58, -3, .2); bike(-15, 3, -.1); bike(102, 3, .3);

  // 鸟笼（大院槐树下）
  const cage = new THREE.Group();
  const cageBody = new THREE.Mesh(new THREE.CylinderGeometry(.5, .5, .9, 12, 1, true), new THREE.MeshBasicMaterial({ color: '#6d5d4e', wireframe: true }));
  cage.add(cageBody);
  const cageTop = mesh(new THREE.ConeGeometry(.55, .4, 12), PAL.wood); cageTop.position.y = .65; cage.add(cageTop);
  cage.position.set(1.5, 4.2, -14); world.add(cage);

  // 风筝
  const kiteG = kite(); kiteG.position.set(-30, 22, 14); world.add(kiteG);
  const kiteLineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-30, 22, 14), new THREE.Vector3(-27, 1.2, 20)]);
  world.add(new THREE.Line(kiteLineGeo, inkMat));

  // 鸽群
  const pigeons = [];
  const pg = new THREE.BufferGeometry();
  pg.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, .4, -.9, .1, 0, 0, 0, -.3, 0, 0, .4, .9, .1, 0, 0, 0, -.3], 3));
  pg.computeVertexNormals();
  const pmat = new THREE.MeshBasicMaterial({ color: '#4a443c', side: THREE.DoubleSide });
  for (let i = 0; i < 16; i++) { const p = new THREE.Mesh(pg.clone(), pmat); p.userData = { a: i / 16 * Math.PI * 2 + Math.random() * .3, r: 22 + Math.random() * 6, y: 26 + Math.random() * 4, ph: Math.random() * 6 }; world.add(p); pigeons.push(p); }

  // 早点摊蒸汽
  const steamTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
  const steam = [];
  for (let i = 0; i < 14; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: steamTex, transparent: true, depthWrite: false, opacity: 0 }));
    s.userData.ph = i / 14; world.add(s); steam.push(s);
  }

  // 夜间点光
  const pls = [[95, 3, 8], [109, 3, -3], [-20, 3, -2], [-90, 6, 9], [-104, 3, 11], [0, 3, -2], [60, 3, -2], [-50, 3, 2]].map(([x, y, z]) => {
    const l = new THREE.PointLight('#ffb766', 0, 22, 1.6); l.position.set(x, y, z); scene.add(l); return l;
  });

  /* ---------- Tripo 模型替换 ---------- */
  const loader = new GLTFLoader();
  fetch('models/manifest.json').then(r => r.ok ? r.json() : []).catch(() => []).then(list => list.forEach(key => {
    const slot = MODEL_SLOTS[key];
    if (!slot || !slot.pos) return;
    {
      loader.load(slot.file, (gltf) => {
        const obj = gltf.scene;
        const bb = new THREE.Box3().setFromObject(obj), size = bb.getSize(new THREE.Vector3());
        const s = slot.size / Math.max(size.x, size.z);
        obj.scale.setScalar(s);
        bb.setFromObject(obj); const c = bb.getCenter(new THREE.Vector3());
        obj.position.set(slot.pos[0] - c.x, slot.pos[1] - bb.min.y, slot.pos[2] - c.z);
        obj.rotation.y = slot.rotY || 0;
        obj.traverse(o => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; ink(o, 35); } });
        if (procedural[key]) procedural[key].visible = false;
        world.add(obj);
        console.log('[Tripo] 已载入', slot.file);
      });
    }
  }));

  /* ---------- 锚点（热点 3D 位置） ---------- */
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const anchors = {
    breakfast: V(95, 2.6, 7), store: V(108, 4.4, -4), maohou: V(84, 1.6, -15), yard: V(1.5, 4.2, -14),
    kite: V(-30, 22.5, 14), pigeon: V(40, 27, 0), opera: V(-90, 8, 9), mask: V(-104, 3, 12), gate: V(-20.6, 2.2, -2)
  };

  /* ---------- 更新 ---------- */
  const tmpP = new THREE.Vector3(), tmpT = new THREE.Vector3(), skyEl = document.getElementById('sky');
  let lastNight = -1;
  function update({ prog, h, ovT, mx, my, now }) {
    const n = CAMS.length;
    const i = Math.min(n - 2, Math.floor(prog)), raw = prog - i;
    const e = smooth(clamp((raw - .18) / .64));
    const A = CAMS[i], B = CAMS[i + 1];
    tmpP.set(lerp(A.p[0], B.p[0], e), lerp(A.p[1], B.p[1], e), lerp(A.p[2], B.p[2], e));
    tmpT.set(lerp(A.t[0], B.t[0], e), lerp(A.t[1], B.t[1], e), lerp(A.t[2], B.t[2], e));
    // 飞行途中抬升，像无人机掠过屋顶
    const dist = Math.hypot(A.p[0] - B.p[0], A.p[2] - B.p[2]);
    tmpP.y += Math.sin(e * Math.PI) * Math.min(28, dist * .3);
    // 全图模式
    if (ovT > .001) {
      tmpP.lerp(V(40, 150, 170), ovT); tmpT.lerp(V(0, 0, -5), ovT);
    }
    tmpP.x += mx * 3; tmpP.y -= my * 2;
    camera.position.copy(tmpP); camera.lookAt(tmpT);

    const L = lightAt(h);
    skyEl.style.background = `linear-gradient(180deg, #${L.top.getHexString()} 0%, #${L.hor.getHexString()} 62%, #${L.hor.getHexString()} 100%)`;
    scene.fog.color.copy(L.hor); scene.fog.near = L.fn; scene.fog.far = L.ff;
    hemi.color.copy(L.hs); hemi.groundColor.copy(L.hg); hemi.intensity = L.hi;
    sun.color.copy(L.sun); sun.intensity = L.si;
    // 太阳东升西落；入夜换成月光
    const st = clamp((h - 5) / 14);
    const sunDir = h < 19.4 ? V(Math.cos(st * Math.PI) * 200, Math.sin(st * Math.PI) * 150 + 15, 110) : V(-90, 160, 80);
    sun.position.copy(tmpT).add(sunDir); sun.target.position.copy(tmpT);
    // 墨线：白天深色，夜里反白（像原图反相）
    inkMat.color.set('#3a342c').lerp(C('#d9d1bd'), L.night);
    if (Math.abs(L.night - lastNight) > .01) {
      lastNight = L.night;
      Object.entries(matCache).forEach(([hex, m]) => m.color.set(hex).lerp(C('#1d2333'), L.night * .55));
    }
    lanternMat.emissiveIntensity = L.lamp * 2.2;
    windowMat.emissiveIntensity = L.lamp * 1.4;
    pls.forEach(l => l.intensity = L.lamp * 40);

    // 动画：风筝、鸽子、蒸汽
    kiteG.rotation.z = Math.sin(now / 900) * .12; kiteG.rotation.y = Math.PI + Math.sin(now / 1300) * .25;
    kiteG.position.y = 22 + Math.sin(now / 1100) * .6;
    const day = h > 5.6 && h < 18.5;
    pigeons.forEach(p => {
      const u = p.userData, a = u.a + now / 5200;
      p.visible = day;
      p.position.set(40 + Math.cos(a) * u.r, u.y + Math.sin(now / 700 + u.ph) * .6, Math.sin(a) * u.r * .7);
      p.rotation.y = -a; p.scale.set(1, 1 + Math.sin(now / 90 + u.ph) * .6, 1);
    });
    const so = h < 10.5 ? 1 : clamp(11.5 - h);
    steam.forEach(s => {
      const t = (s.userData.ph + now / 3500) % 1;
      s.position.set(95.2 + Math.sin(t * 6 + s.userData.ph * 9) * .3, 2.3 + t * 3.2, 7);
      s.scale.setScalar(.6 + t * 1.8); s.material.opacity = Math.sin(t * Math.PI) * .75 * so;
    });

    renderer.render(scene, camera);
    return { sunDir, night: L.night };
  }

  const proj = new THREE.Vector3();
  function project(v) {
    proj.copy(v).project(camera);
    const visible = proj.z < 1 && Math.abs(proj.x) < 1.1 && Math.abs(proj.y) < 1.1;
    return { x: (proj.x + 1) / 2 * innerWidth, y: (1 - proj.y) / 2 * innerHeight, visible, depth: camera.position.distanceTo(v) };
  }
  function projectDir(dir) { return project(camera.position.clone().add(dir.clone().normalize().multiplyScalar(800))); }

  addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });

  return { update, project, projectDir, anchors };
}
