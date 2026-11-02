import * as THREE from 'three';
import { initScene } from './scene.js';
import { initMaohou, initKite, initMask } from './games.js';
/* 一日一巷 · 胡同里的时间遗产
 * 一张胡同图，滚动 = 时间流逝；镜头沿胡同由东（晨）向西（夜）飞行，换光不换图。
 */
(() => {
'use strict';

const $ = s => document.querySelector(s);
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = t => t * t * (3 - 2 * t);

const MAP_W = 6336, MAP_H = 2688;

/* ---------------- 章节（时间节点） ---------------- */
const STOPS = [
  { h: 5.5,  label: '拂晓', name: '胡同苏醒', sub: '鸽哨划过灰瓦，胡同从东头醒来', cx: .86, cy: .5,  z: 1.0 },
  { h: 6.75, label: '清晨', name: '早点摊',   sub: '蒸笼掀开，豆汁焦圈的热气',     cx: .79, cy: .6,  z: 2.2 },
  { h: 8.5,  label: '清晨', name: '毛猴',     sub: '蝉蜕与辛夷，捏出一个市井北京', cx: .66, cy: .55, z: 2.3 },
  { h: 12,   label: '正午', name: '四合院',   sub: '槐荫、鸟笼、空竹声',           cx: .5,  cy: .54, z: 1.9 },
  { h: 15,   label: '午后', name: '沙燕',     sub: '一只风筝，飞在院墙之上',       cx: .35, cy: .45, z: 2.0 },
  { h: 18,   label: '黄昏', name: '戏楼',     sub: '锣鼓点起，夕阳落在飞檐',       cx: .13, cy: .45, z: 2.1 },
  { h: 19.5, label: '入夜', name: '脸谱',     sub: '红忠、黑直、白奸，一笔一性情', cx: .15, cy: .5,  z: 2.5 },
  { h: 23,   label: '深夜', name: '门牌',     sub: '灯笼亮起，这条胡同记住了你',   cx: .42, cy: .5,  z: 1.0 }
];
const N = STOPS.length;

/* ---------------- 热点 ---------------- */
const SPOTS = [
  { id: 'breakfast', x: .78, y: .63, from: 5, to: 11, label: '早点摊', img: 'breakfast',
    kicker: '清晨 · 06:45', title: '早点摊',
    text: ['天还没亮透，胡同口的蒸笼已经冒气了。豆汁儿、焦圈、炸油条、糖葫芦——北京人的一天，从一碗热乎的开始。',
           '<span class="tag">豆汁儿</span><span class="tag">焦圈</span><span class="tag">糖葫芦</span><span class="tag">吆喝声</span>'] },
  { id: 'store', x: .91, y: .62, from: 5, to: 24, label: '小卖部',
    kicker: '胡同口 · 全天', title: '小卖部',
    text: ['玻璃柜里的北冰洋、大白兔、弹球和沙包，是几代胡同孩子共同的记忆。',
           '<span class="tag">北冰洋</span><span class="tag">弹球</span><span class="tag">沙包</span>'] },
  { id: 'maohou', x: .65, y: .55, from: 7, to: 11, heritage: true, label: '非遗 · 北京毛猴', img: 'maohou',
    kicker: '非遗 · 清晨 08:30', title: '北京毛猴',
    text: ['毛猴起源于清末北京，以蝉蜕为头和四肢、辛夷（玉兰花骨朵）为身子，用白芨胶粘合而成。',
           '小小一只毛猴，拉洋车、卖糖葫芦、剃头、说书……把老北京的市井百态全装进了方寸之间。',
           '<span class="tag">蝉蜕</span><span class="tag">辛夷</span><span class="tag">白芨</span>'],
    game: 'maohou' },
  { id: 'yard', x: .5, y: .52, from: 10, to: 14, label: '四合院', img: 'courtyard',
    kicker: '正午 · 12:00', title: '四合院',
    text: ['天棚鱼缸石榴树，先生肥狗胖丫头。院里的大槐树下挂着鸟笼，石桌上放着空竹，窗台上蹲着一只兔儿爷。',
           '<span class="tag">鸟笼</span><span class="tag">空竹</span><span class="tag">兔儿爷</span>'] },
  { id: 'kite', x: .35, y: .44, from: 13, to: 17, heritage: true, label: '非遗 · 沙燕风筝', img: 'courtyard',
    kicker: '非遗 · 午后 15:00', title: '沙燕风筝',
    text: ['北京风筝以“沙燕”最具代表性：膀宽、尾分叉，形似春燕。胖沙燕、瘦沙燕、比翼燕，各有寓意。',
           '扎、糊、绘、放，号称风筝四艺。绘的时候讲究对称、色彩浓烈，蝙蝠、寿桃、牡丹都是常见纹样。',
           '<span class="tag">扎</span><span class="tag">糊</span><span class="tag">绘</span><span class="tag">放</span>'],
    game: 'kite' },
  { id: 'pigeon', x: .3, y: .7, from: 5, to: 18, label: '鸽哨',
    kicker: '胡同上空', title: '鸽哨',
    text: ['“嗡——”一群鸽子掠过屋脊，鸽哨在风里响。这是老北京天空的声音。'] },
  { id: 'opera', x: .12, y: .4, from: 16, to: 21, label: '戏楼', img: 'opera',
    kicker: '黄昏 · 18:00', title: '戏楼',
    text: ['夕阳斜照在飞檐上，后台已经开始上妆。锣鼓、京胡、水袖——一出戏，要从傍晚唱到掌灯。',
           '<span class="tag">锣鼓</span><span class="tag">京胡</span><span class="tag">水袖</span>'] },
  { id: 'mask', x: .16, y: .5, from: 17.5, to: 22, heritage: true, label: '非遗 · 京剧脸谱', img: 'opera',
    kicker: '非遗 · 入夜 19:30', title: '京剧脸谱',
    text: ['脸谱是京剧的“性格说明书”：红色忠勇、黑色刚直、白色奸诈、黄色骁勇、蓝色桀骜、金银多为神怪。',
           '同一个角色在不同戏里，脸谱也一笔不差地传承下来。',
           '<span class="tag">红·忠勇</span><span class="tag">黑·刚直</span><span class="tag">白·奸诈</span>'],
    game: 'mask' },
  { id: 'gate', x: .5, y: .63, from: 21, to: 24, heritage: true, label: '领取你的门牌',
    finale: true }
];

const LAMPS = [
  [.12,.6],[.32,.62],[.5,.63],[.65,.64],[.78,.62],[.91,.61],
  [.12,.4,1],[.09,.45],[.16,.45],[.2,.68],[.4,.62],[.68,.73],[.83,.6],[.88,.72],[.24,.55]
];
const STEAM = [[.775,.6],[.785,.6],[.795,.61]];

/* ---------------- DOM 构建（3D 版） ---------------- */
const spotsEl = $('#hotspots');
SPOTS.forEach(s => {
  const b = document.createElement('button');
  b.className = 'spot' + (s.heritage ? ' heritage' : '');
  b.innerHTML = `<span class="lbl">${s.label}</span>`;
  b.addEventListener('click', e => { e.stopPropagation(); openSpot(s); });
  s.el = b;
  spotsEl.appendChild(b);
});

const tl = $('#timeline');
const bar = document.createElement('i'); bar.className = 'bar'; tl.appendChild(bar);
STOPS.forEach((s, i) => {
  const b = document.createElement('button');
  b.className = 'tl';
  b.innerHTML = `<small>${fmt(s.h)}</small>${s.label} · ${s.name}`;
  b.addEventListener('click', () => goTo(i));
  s.tl = b; tl.appendChild(b);
});
const ml = $('#menuList');
STOPS.forEach((s, i) => {
  const li = document.createElement('li');
  li.innerHTML = `<small>${fmt(s.h)} · ${s.label}</small>${s.name}`;
  li.addEventListener('click', () => { $('#menu').classList.remove('open'); goTo(i); });
  ml.appendChild(li);
});
function fmt(h) { const t = Math.round(h * 60), hh = Math.floor(t / 60) % 24, mm = t % 60; return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`; }

const S3 = initScene($('#gl'));
setTimeout(() => $('#loading').classList.add('done'), 300);

/* ---------------- 星空 ---------------- */
const stars = $('#stars'), sctx = stars.getContext('2d');
let starPts = [];
function buildStars() {
  stars.width = innerWidth; stars.height = innerHeight;
  starPts = Array.from({ length: 160 }, () => ({ x: Math.random() * innerWidth, y: Math.random() * innerHeight * .45, r: Math.random() * 1.3 + .3, p: Math.random() * 6 }));
}
function drawStars(t) {
  sctx.clearRect(0, 0, stars.width, stars.height);
  for (const s of starPts) {
    sctx.globalAlpha = .4 + .6 * Math.abs(Math.sin(t / 1400 + s.p));
    sctx.fillStyle = '#fff6dc';
    sctx.beginPath(); sctx.arc(s.x, s.y, s.r, 0, 7); sctx.fill();
  }
}

/* ---------------- 滚动 → 进度 ---------------- */
let introAlive = true, introP = 0;
let target = 0, prog = 0, overview = false, ovT = 0;
let mouseX = 0, mouseY = 0, mx = 0, my = 0;
const maxScroll = () => document.documentElement.scrollHeight - innerHeight;
addEventListener('scroll', () => { target = clamp(scrollY / maxScroll()) * (N - 1); $('#scrollHint').classList.add('hide'); }, { passive: true });
addEventListener('mousemove', e => { mouseX = e.clientX / innerWidth - .5; mouseY = e.clientY / innerHeight - .5; });
function goTo(i) { overview = false; scrollTo({ top: i / (N - 1) * maxScroll(), behavior: 'smooth' }); }
/* 一滑一站：滚轮/触控板/滑动一次就飞到下一个时间点，不用使劲滚 */
let snapLock = 0, wAcc = 0, wT = 0;
const curStop = () => Math.round(clamp(scrollY / maxScroll()) * (N - 1));
const blocked = e => !introAlive && (document.body.classList.contains('locked') || (e && e.target.closest && e.target.closest('#panel,#game,#menu,#finale')));
function step(d) {
  const now = performance.now(); if (now < snapLock) return;
  const i = clamp(curStop() + d, 0, N - 1); if (i === curStop()) return;
  snapLock = now + 1000; goTo(i);
}
addEventListener('wheel', e => {
  if (introAlive || blocked(e)) return;
  e.preventDefault();
  const now = performance.now(); if (now - wT > 250) wAcc = 0; wT = now;
  wAcc += e.deltaY;
  if (Math.abs(wAcc) > 25) { step(Math.sign(wAcc)); wAcc = 0; }
}, { passive: false });
let sy0 = null;
addEventListener('touchstart', e => { sy0 = e.touches[0].clientY; }, { passive: true });
addEventListener('touchmove', e => { if (!introAlive && !blocked(e)) e.preventDefault(); }, { passive: false });
addEventListener('touchend', e => { if (sy0 === null || introAlive || blocked(e)) return; const d = sy0 - e.changedTouches[0].clientY; if (Math.abs(d) > 30) step(Math.sign(d)); sy0 = null; });
addEventListener('keydown', e => { if (introAlive || blocked()) return;
  if (['ArrowDown', 'PageDown', ' ', 'ArrowRight'].includes(e.key)) { e.preventDefault(); step(1); }
  if (['ArrowUp', 'PageUp', 'ArrowLeft'].includes(e.key)) { e.preventDefault(); step(-1); } });
addEventListener('keydown', e => {
  if (document.body.classList.contains('locked')) return;
  const cur = Math.round(prog);
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); goTo(Math.min(N - 1, cur + 1)); }
  if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); goTo(Math.max(0, cur - 1)); }
});

// 每段之间：前 18% 和后 18% 停留在节点上，中间飞行
function segEase(p) {
  const i = Math.min(N - 2, Math.floor(p)), t = p - i;
  return [i, smooth(clamp((t - .18) / .64))];
}

/* ---------------- 章节大字 ---------------- */
let shownStop = -1;
const chTime = $('.ch-time'), chTitle = $('.ch-title'), chSub = $('.ch-sub');
function showChapter(i) {
  if (i === shownStop) return;
  shownStop = i;
  chTitle.classList.remove('show'); chSub.classList.remove('show');
  if (i < 0) { chTime.textContent = ''; return; }
  const s = STOPS[i];
  setTimeout(() => {
    if (shownStop !== i) return;
    chTime.textContent = `${fmt(s.h)} · ${s.label}`;
    chTitle.innerHTML = [...s.name].map((c, k) => `<span style="transition-delay:${k * 120}ms">${c}</span>`).join('');
    chSub.textContent = s.sub;
    requestAnimationFrame(() => requestAnimationFrame(() => { chTitle.classList.add('show'); chSub.classList.add('show'); }));
  }, 260);
}

/* ---------------- 主循环（3D 版） ---------------- */
const haze = $('#haze'), moon = $('#moon'), veil = $('#veil');
function frame(now) {
  prog += (target - prog) * .055;
  if (Math.abs(target - prog) < .002) prog = target;
  mx += (mouseX - mx) * .05; my += (mouseY - my) * .05;
  ovT += ((overview ? 1 : 0) - ovT) * .06;

  const ip = Math.min(N - 2, Math.floor(prog)), it = prog - ip;
  const h = lerp(STOPS[ip].h, STOPS[ip + 1].h, it);

  const r = S3.update({ prog, h, ovT, mx, my, now, intro: introAlive ? 1 - introP : 0 });

  haze.style.opacity = h < 8 ? clamp((8 - h) / 3) * .55 : 0;
  // 交叉溶解时加一层晨雾纸色，盖住 2D/3D 的细节差异
  const fv = introAlive ? smooth(clamp((introP - .28) / .5)) : 1;
  veil.style.opacity = (Math.sin(fv * Math.PI) * .5 + (1 - fv) * .15 + (introAlive ? 0 : 0)).toFixed(3);
  const so = clamp((h - 20) / 1.5);
  $('#stars').style.opacity = so;
  if (so > .01) drawStars(now);
  document.body.classList.toggle('night', r.night > .5);

  // 月亮：投影月光方向
  const mp = S3.projectDir(new THREE.Vector3(-.5, .55, -.65));
  moon.style.opacity = mp.visible ? clamp((h - 19.6) / 1.2) : 0;
  moon.style.left = mp.x + 'px'; moon.style.top = Math.max(60, mp.y) + 'px';

  $('#clockTime').textContent = fmt(h);
  $('#clockLabel').textContent = h < 6 ? '拂晓' : h < 10 ? '清晨' : h < 14 ? '正午' : h < 17 ? '午后' : h < 19 ? '黄昏' : h < 21 ? '入夜' : '深夜';
  bar.style.width = (prog / (N - 1) * 100) + '%';
  const near = Math.round(prog);
  STOPS.forEach((s, k) => s.tl.classList.toggle('on', k === near));
  const atStop = Math.abs(prog - near) < .14 && ovT < .3 && !introAlive;
  showChapter(atStop ? near : -1);

  // 热点：3D 锚点投影到屏幕
  SPOTS.forEach(s => {
    const a = S3.anchors[s.id];
    const on = (h >= s.from && h <= s.to) || ovT > .5;
    const p = S3.project(a);
    const show = on && p.visible && p.depth < 260 && !introAlive;
    s.el.classList.toggle('hidden', !show);
    s.el.style.left = p.x + 'px'; s.el.style.top = p.y + 'px';
    s.el.classList.toggle('near', show && atStop && p.depth < 60);
  });

  requestAnimationFrame(frame);
}

/* ---------------- 飞鸟 ---------------- */
function spawnBirds() {
  if (!document.body.classList.contains('night') && !document.body.classList.contains('locked')) {
    const n = 4 + (Math.random() * 5 | 0), top = 10 + Math.random() * 25, dur = 14 + Math.random() * 8;
    for (let k = 0; k < n; k++) {
      const b = document.createElement('div');
      b.className = 'bird';
      b.style.left = (100 + k * 2 + Math.random() * 4) + 'vw';
      b.style.top = (top + Math.random() * 6) + 'vh';
      b.style.animationDuration = dur + 's';
      b.innerHTML = '<svg viewBox="0 0 22 10"><path d="M1 6 Q6 0 11 6 Q16 0 21 6" fill="none" stroke="#3a342c" stroke-width="1.6"/></svg>';
      $('#birds').appendChild(b);
      setTimeout(() => b.remove(), dur * 1000);
    }
  }
  setTimeout(spawnBirds, 9000 + Math.random() * 9000);
}

/* ---------------- 面板 ---------------- */
const collected = new Set();
function openSpot(s) {
  if (s.finale) return openFinale();
  $('#panelKicker').textContent = s.kicker;
  $('#panelTitle').textContent = s.title;
  $('#panelText').innerHTML = s.text.map(t => `<p>${t}</p>`).join('');
  const pi = $('.panel-img');
  if (s.img) { pi.style.display = ''; $('#panelImg').src = `./img/${s.img}.webp`; } else pi.style.display = 'none';
  const act = $('#panelActions'); act.innerHTML = '';
  if (s.game) {
    const g = document.createElement('button'); g.className = 'btn';
    g.textContent = { maohou: '捏一只立体毛猴', kite: '绘一只沙燕 · 放上天', mask: '对镜勾脸谱（可用摄像头）' }[s.game];
    if (collected.has(s.game)) g.textContent += ' · 已盖印';
    g.onclick = () => { closePanel(); openGame(s.game); };
    act.appendChild(g);
  }
  const c = document.createElement('button'); c.className = 'btn ghost'; c.textContent = '继续逛';
  c.onclick = closePanel; act.appendChild(c);
  $('#panel').classList.add('open');
}
function closePanel() { $('#panel').classList.remove('open'); }
$('#panelClose').onclick = closePanel;
$('#gl').addEventListener('click', closePanel);

function toast(t) { const el = $('#toast'); el.textContent = t; el.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove("show"), 3600); }

/* ---------------- 互动：通用 ---------------- */
let curGame = null, gameState = {};
const PAL = [
  ['#c23a2b', '朱砂'], ['#2f5d8a', '石青'], ['#e0ad3a', '藤黄'], ['#3f7d5c', '松绿'],
  ['#2b2724', '墨'], ['#f4ece0', '粉白'], ['#9b5a33', '赭石'], ['#c9a227', '泥金']
];
function openGame(kind) {
  if (gameState.dispose) gameState.dispose();
  curGame = kind;
  document.body.classList.add('locked');
  const meta = {
    maohou: ['非遗 · 北京毛猴', '捏 一 只 毛 猴', '蝉蜕做头和四肢，辛夷做身子——把零件拖到淡红色的位置'],
    kite: ['非遗 · 沙燕风筝', '绘 燕 · 放 飞', '扎、糊、绘、放：选燕型、贴纹样，再迎着风把它放上天'],
    mask: ['非遗 · 京剧脸谱', '对 镜 勾 脸', '红忠勇 · 黑刚直 · 白奸诈 · 蓝桀骜——听戏文，认角色']
  }[kind];
  $('#gameKicker').textContent = meta[0]; $('#gameTitle').textContent = meta[1]; $('#gameTip').textContent = meta[2];
  $('#gameBody').innerHTML = ''; $('#palette').innerHTML = '';
  $('#game').className = 'open g-' + kind;
  const ui = { tip: t => { const e = $('#gameTip'); e.textContent = t; e.classList.remove('flash'); void e.offsetWidth; e.classList.add('flash'); } };
  gameState = ({ maohou: initMaohou, kite: initKite, mask: initMask })[kind]($('#gameBody'), ui);
}
function closeGame() {
  $('#game').className = ''; document.body.classList.remove('locked'); curGame = null;
  if (gameState.dispose) gameState.dispose(); gameState = {};
}
window.__openGame = openGame; window.__goTo = goTo; window.__done = () => $('#gameDone').click();
$('#gameClose').onclick = closeGame;
$('#gameReset').onclick = () => openGame(curGame);
$('#gameDone').onclick = () => {
  if (!gameState.ok || !gameState.ok()) { toast(gameState.need ? gameState.need() : '还没完成哦'); return; }
  const k = curGame;
  try {
    if (k === 'maohou') S3.addMaohou(gameState.result());
    if (k === 'kite') S3.setKiteTexture(gameState.result());
  } catch (e) { console.warn(e); }
  const cap = gameState.caption ? gameState.caption() : '';
  collected.add(k);
  document.querySelector(`.seal-slot[data-k="${k}"]`).classList.add('on');
  SPOTS.find(s => s.game === k).el.classList.add('done');
  closeGame();
  toast(cap || { maohou: '获得印记 · 猴', kite: '获得印记 · 鸢', mask: '获得印记 · 谱' }[k]);
};

/* ---------------- 结尾：门牌 ---------------- */
function openFinale() {
  const n = collected.size;
  const nums = ['零', '壹', '贰', '叁'];
  $('#plateNo').textContent = nums[n] + '号';
  const d = new Date();
  $('#plateDate').textContent = `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 · 一日一巷`;
  $('#plateSeals').innerHTML = [['maohou', '猴'], ['kite', '鸢'], ['mask', '谱']]
    .map(([k, c]) => `<span class="${collected.has(k) ? '' : 'off'}">${c}</span>`).join('');
  $('#finaleText').innerHTML = n === 3
    ? '清晨的毛猴、午后的沙燕、入夜的脸谱，<br/>都留在了这块门牌上。这条胡同，记住了你。'
    : `你收集了 ${n} / 3 枚非遗印记。<br/>胡同还在，明天再来，把剩下的手艺找回来。`;
  document.body.classList.add('locked');
  $('#finale').classList.add('open');
}
$('#againBtn').onclick = () => { $('#finale').classList.remove('open'); document.body.classList.remove('locked'); scrollTo({ top: 0, behavior: 'smooth' }); };
$('#finaleClose').onclick = () => { $('#finale').classList.remove('open'); document.body.classList.remove('locked'); };

/* ---------------- HUD 按钮 ---------------- */
$('#mapBtn').onclick = () => { overview = !overview; $('#mapBtn').firstChild.textContent = overview ? '返 回' : '全 图'; };
$('#menuBtn').onclick = () => $('#menu').classList.add('open');
$('#menuClose').onclick = () => $('#menu').classList.remove('open');

/* ---------------- 首页：胡同口 ---------------- */
document.body.classList.add('locked');
scrollTo(0, 0);
const intro = $('#intro');
let entering = false, enterT0 = 0, imx = 0, imy = 0, peekP = 0;
const ENTER_MS = 1600;
intro.addEventListener('mousemove', e => { imx = e.clientX / innerWidth - .5; imy = e.clientY / innerHeight - .5; });
function finishIntro() {
  if (!intro.isConnected) return;
  introP = 1; introAlive = false; $('#gl').style.filter = ''; snapLock = performance.now() + 900;
  document.body.classList.remove('locked'); intro.remove();
}
function introLoop(now) {
  if (!intro.isConnected) return;
  // 进入动画按真实时间推进（与帧率无关，电脑卡也不会卡在首页）
  if (entering) { const t = clamp((performance.now() - enterT0) / ENTER_MS); introP = Math.max(peekP, .06 + t * .94 * (2 - t)); }
  else introP += (peekP - introP) * .15;
  const cur = intro.style;
  const ox = parseFloat(cur.getPropertyValue('--mx')) || 0, oy = parseFloat(cur.getPropertyValue('--my')) || 0;
  cur.setProperty('--mx', (ox + (imx - ox) * .06).toFixed(4));
  cur.setProperty('--my', (oy + (imy - oy) * .06).toFixed(4));
  cur.setProperty('--p', introP.toFixed(4));
  // 2D 胡同口与 3D 胡同同视角交叉溶解（由晨雾遮罩过渡，不再用耗性能的模糊滤镜）
  const f = smooth(clamp((introP - .25) / .55));
  cur.opacity = (1 - f).toFixed(3);
  if (entering && introP >= .999) return finishIntro();
  requestAnimationFrame(introLoop);
}
function enter() {
  if (entering || !intro.isConnected) return;
  entering = true; enterT0 = performance.now();
  intro.style.pointerEvents = 'none';           // 立刻放行，不再挡住页面
  document.body.classList.remove('locked');
  setTimeout(finishIntro, ENTER_MS + 600);      // 兜底：无论如何 2 秒后进入
}
// 轻轻一滑 / 一点 / 任意键就进入
intro.addEventListener('wheel', e => { e.preventDefault(); if (Math.abs(e.deltaY) + Math.abs(e.deltaX) > 2) { peekP = .12; enter(); } }, { passive: false });
let ty0 = null;
intro.addEventListener('touchstart', e => { ty0 = e.touches[0].clientY; }, { passive: true });
intro.addEventListener('touchmove', e => { if (ty0 !== null && Math.abs(ty0 - e.touches[0].clientY) > 12) enter(); }, { passive: true });
intro.addEventListener('pointerdown', enter);
intro.addEventListener('click', enter);
addEventListener('keydown', e => { if (intro.isConnected && !entering) enter(); });
// 首页鸽群
(function introBirds() {
  if (!intro.isConnected) return;
  const box = $('#introBirds'), n = 5 + (Math.random() * 5 | 0), top = 18 + Math.random() * 16, dur = 16 + Math.random() * 6;
  for (let k = 0; k < n; k++) {
    const b = document.createElement('div'); b.className = 'bird';
    b.style.left = (100 + k * 2.2 + Math.random() * 3) + 'vw'; b.style.top = (top + Math.random() * 5) + 'vh';
    b.style.animationDuration = dur + 's';
    b.innerHTML = '<svg viewBox="0 0 22 10"><path d="M1 6 Q6 0 11 6 Q16 0 21 6" fill="none" stroke="#3a342c" stroke-width="1.6"/></svg>';
    box.appendChild(b); setTimeout(() => b.remove(), dur * 1000);
  }
  setTimeout(introBirds, 7000 + Math.random() * 5000);
})();
requestAnimationFrame(introLoop);

addEventListener('resize', buildStars);
buildStars();
window.__hutong = { jump: v => { target = prog = v; } };
requestAnimationFrame(frame);
setTimeout(spawnBirds, 4000);
})();
