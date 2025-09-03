const GAME_VERSION = '0.3.0';
const BASE_W = 960,
  BASE_H = 540;
const GRAVITY = 0.6;
const MOVE_SPEED = 6.0;
const JUMP_VELOCITY = -14;
const COYOTE_MS = 100;
const JUMP_BUFFER_MS = 120;
const FRICTION = 0.85;
const DEBUG = true;
const THEME = {
  skyTop: '#8ec5fc',
  skyBottom: '#e0c3fc',
  hill: '#274e13',
  cloud: '#fff',
  platformTop: '#b87333',
  platformBottom: '#5d3a1a',
  grass: '#3cb043',
  coinOuter: '#ffdd00',
  coinInner: '#fff6a3',
  player: '#3cba54',
  enemy: '#e74c3c',
  hud: '#fff',
  shadow: 'rgba(0,0,0,0.2)',
};

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const DPR = window.devicePixelRatio || 1;
canvas.width = BASE_W * DPR;
canvas.height = BASE_H * DPR;
canvas.style.width = BASE_W + 'px';
canvas.style.height = BASE_H + 'px';
ctx.scale(DPR, DPR);

const overlay = document.createElement('div');
overlay.style.position = 'fixed';
overlay.style.top = '0';
overlay.style.left = '0';
overlay.style.width = '100%';
overlay.style.height = '100%';
overlay.style.background = 'rgba(0,0,0,0.8)';
overlay.style.color = '#fff';
overlay.style.display = 'none';
overlay.style.whiteSpace = 'pre-wrap';
overlay.style.fontFamily = 'monospace';
overlay.style.padding = '20px';
document.body.appendChild(overlay);

function showError(err) {
  overlay.textContent = err && err.stack ? err.stack : String(err);
  overlay.style.display = 'block';
}

window.onerror = (msg, src, line, col, err) => {
  showError(err || { message: msg, stack: `${src}:${line}:${col}` });
};
window.addEventListener('unhandledrejection', (e) => showError(e.reason));

class Renderer {
  constructor(ctx) {
    this.ctx = ctx;
    this.safe = false;
  }

  drawBackground(camera, t) {
    const ctx = this.ctx;
    const grad = ctx.createLinearGradient(0, 0, 0, BASE_H);
    grad.addColorStop(0, THEME.skyTop);
    grad.addColorStop(1, THEME.skyBottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, BASE_W, BASE_H);

    // distant hills
    ctx.save();
    ctx.translate(-camera.x * 0.2, -camera.y * 0.2);
    ctx.fillStyle = THEME.hill;
    ctx.beginPath();
    ctx.arc(200, BASE_H, 400, Math.PI, 0);
    ctx.arc(800, BASE_H, 300, Math.PI, 0);
    ctx.lineTo(BASE_W, BASE_H);
    ctx.lineTo(0, BASE_H);
    ctx.fill();
    ctx.restore();

    // clouds
    ctx.save();
    const w = BASE_W;
    const offset = ((t * 20 - camera.x * 0.5) % w) - w;
    ctx.translate(offset, -camera.y * 0.1);
    ctx.fillStyle = THEME.cloud;
    for (let i = 0; i < 3; i++) {
      const x = i * w;
      this._cloud(x + 200, 80);
      this._cloud(x + 600, 130);
    }
    ctx.restore();
  }

  _cloud(x, y) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.arc(x, y, 20, 0, Math.PI * 2);
    ctx.arc(x + 25, y + 10, 25, 0, Math.PI * 2);
    ctx.arc(x + 55, y, 20, 0, Math.PI * 2);
    ctx.fill();
  }

  drawPlatform(p) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(p.x, p.y);
    if (!this.safe) {
      ctx.fillStyle = THEME.shadow;
      ctx.fillRect(0, p.h, p.w, 4);
    }
    const grad = ctx.createLinearGradient(0, 0, 0, p.h);
    grad.addColorStop(0, THEME.platformTop);
    grad.addColorStop(1, THEME.platformBottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, p.w, p.h);
    ctx.fillStyle = THEME.grass;
    ctx.beginPath();
    const step = 8;
    for (let x = 0; x < p.w; x += step) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x + step / 2, -4);
      ctx.lineTo(x + step, 0);
    }
    ctx.fill();
    ctx.restore();
  }

  drawCoin(c, t) {
    const ctx = this.ctx;
    const r = c.r || c.w / 2 || 8;
    ctx.save();
    ctx.translate(c.x + r, c.y + r);
    const sway = Math.sin(t * 2) * 0.1;
    ctx.scale(1 + sway, 1);
    const grad = ctx.createRadialGradient(-r * 0.3, -r * 0.3, 1, 0, 0, r);
    grad.addColorStop(0, THEME.coinInner);
    grad.addColorStop(1, THEME.coinOuter);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawPlayer(player, t) {
    const ctx = this.ctx;
    const w = player.w,
      h = player.h;
    ctx.save();
    ctx.translate(player.x + w / 2, player.y + h);
    const breathe = 1 + Math.sin(t * 2) * 0.02;
    const sx = (player.onGround ? 1.05 : 0.95) * breathe;
    const sy = (player.onGround ? 0.95 : 1.05) * breathe;
    ctx.scale(sx, sy);
    ctx.fillStyle = THEME.player;
    const r = 8;
    ctx.beginPath();
    ctx.moveTo(-w / 2, -h + r);
    ctx.quadraticCurveTo(-w / 2, -h, -w / 2 + r, -h);
    ctx.lineTo(w / 2 - r, -h);
    ctx.quadraticCurveTo(w / 2, -h, w / 2, -h + r);
    ctx.lineTo(w / 2, -r);
    ctx.quadraticCurveTo(w / 2, 0, w / 2 - r, 0);
    ctx.lineTo(-w / 2 + r, 0);
    ctx.quadraticCurveTo(-w / 2, 0, -w / 2, -r);
    ctx.closePath();
    ctx.fill();

    // face
    ctx.translate(player.face * 2, 0);
    ctx.fillStyle = '#000';
    const eyeY = -h * 0.6;
    ctx.beginPath();
    ctx.arc(-5, eyeY, 2, 0, Math.PI * 2);
    ctx.arc(5, eyeY, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, -h * 0.5, 6, 0, Math.PI, false);
    ctx.stroke();
    ctx.restore();
  }

  drawEnemy(e, t) {
    const ctx = this.ctx;
    const w = e.w,
      h = e.h;
    const bounce = Math.sin(t * 3 + e.x) * 2;
    ctx.save();
    ctx.translate(e.x + w / 2, e.y + h + bounce);
    ctx.fillStyle = THEME.enemy;
    const r = 8;
    ctx.beginPath();
    ctx.moveTo(-w / 2, -h + r);
    ctx.quadraticCurveTo(-w / 2, -h, -w / 2 + r, -h);
    ctx.lineTo(w / 2 - r, -h);
    ctx.quadraticCurveTo(w / 2, -h, w / 2, -h + r);
    ctx.lineTo(w / 2, -r);
    ctx.quadraticCurveTo(w / 2, 0, w / 2 - r, 0);
    ctx.lineTo(-w / 2 + r, 0);
    ctx.quadraticCurveTo(-w / 2, 0, -w / 2, -r);
    ctx.closePath();
    ctx.fill();

    let blinking = false;
    if (!this.safe) {
      if (!e._blinkUntil && Math.random() < 0.005) {
        e._blinkUntil = t + 0.15;
      }
      if (e._blinkUntil && t < e._blinkUntil) blinking = true;
      if (e._blinkUntil && t >= e._blinkUntil) e._blinkUntil = 0;
    }
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    if (blinking) {
      ctx.beginPath();
      ctx.moveTo(-5, -h * 0.6);
      ctx.lineTo(-1, -h * 0.6);
      ctx.moveTo(5, -h * 0.6);
      ctx.lineTo(1, -h * 0.6);
      ctx.stroke();
    } else {
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(-5, -h * 0.6, 2, 0, Math.PI * 2);
      ctx.arc(5, -h * 0.6, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  drawHUD(focus) {
    const ctx = this.ctx;
    ctx.fillStyle = THEME.hud;
    ctx.font = '14px monospace';
    const lines = [
      'Arrows/A/D to move, Space/W/Up to jump',
      `v${GAME_VERSION}`,
    ];
    if (!focus) lines.push('Click canvas to focus');
    lines.forEach((t, i) => ctx.fillText(t, 10, 20 + i * 16));
  }
}

const renderer = new Renderer(ctx);

class Input {
  constructor() {
    this.left = false;
    this.right = false;
    this.up = false;
    this.jump = false;
  }
  press(k) {
    this[k] = true;
  }
  release(k) {
    this[k] = false;
  }
}

const input = new Input();
let hasFocus = false;

function handleKey(e, down) {
  let k;
  switch (e.code) {
    case 'ArrowLeft':
    case 'KeyA':
      k = 'left';
      break;
    case 'ArrowRight':
    case 'KeyD':
      k = 'right';
      break;
    case 'ArrowUp':
    case 'KeyW':
      k = 'up';
      break;
    case 'Space':
      k = 'jump';
      break;
    default:
      return;
  }
  if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
  input[down ? 'press' : 'release'](k);
}

window.addEventListener('keydown', (e) => handleKey(e, true));
window.addEventListener('keyup', (e) => handleKey(e, false));

canvas.tabIndex = 0;
canvas.addEventListener('click', () => {
  canvas.focus();
});
canvas.addEventListener('focus', () => {
  hasFocus = true;
});
canvas.addEventListener('blur', () => {
  hasFocus = false;
});

const world = { platforms: [], enemies: [], coins: [], player: null };

function asArray(v) {
  return Array.isArray(v) ? v : [];
}

class Player {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.w = 20;
    this.h = 32;
    this.vx = 0;
    this.vy = 0;
    this.onGround = false;
    this.lastOnGroundAt = 0;
    this.lastJumpPressedAt = -Infinity;
    this.face = 1;
  }
}

class Platform {
  constructor(x, y, w, h) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
  }
}

function initWorld() {
  world.platforms = [
    new Platform(0, BASE_H - 20, 2000, 20),
    new Platform(200, BASE_H - 100, 100, 20),
    new Platform(400, BASE_H - 180, 120, 20),
    new Platform(650, BASE_H - 260, 120, 20),
  ];
  world.enemies = [];
  world.coins = [];
  world.player = new Player();
}

initWorld();

function findSpawnPlatform(world) {
  const quarter = BASE_W / 4;
  const plats = asArray(world.platforms).filter((p) => p.x < quarter);
  if (!plats.length) {
    const ground = new Platform(0, BASE_H - 20, BASE_W, 20);
    world.platforms.push(ground);
    return ground;
  }
  let best = plats[0];
  let bestDist = Math.abs(best.x);
  for (const p of plats) {
    const d = Math.abs(p.x);
    if (d < bestDist) {
      best = p;
      bestDist = d;
    }
  }
  return best;
}

const player = world.player;
let camera = { x: 0, y: 0 };

const spawnPlat = findSpawnPlatform(world);
player.x = spawnPlat.x + 8;
player.y = spawnPlat.y - player.h;
camera.x = player.x + player.w / 2 - BASE_W / 2;
camera.y = player.y + player.h / 2 - BASE_H / 2;

function rectsIntersect(a, b) {
  return (
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
  );
}

let prevJump = false;
function updatePlayer(dt) {
  const now = performance.now();
  player.onGround = false;

  if (input.jump && !prevJump) player.lastJumpPressedAt = now;
  if (!input.jump && prevJump && player.vy < 0) player.vy *= 0.5;
  prevJump = input.jump;

  if (input.left !== input.right) {
    player.vx = input.left ? -MOVE_SPEED : MOVE_SPEED;
    player.face = input.left ? -1 : 1;
  } else {
    player.vx *= FRICTION;
    if (Math.abs(player.vx) < 0.01) player.vx = 0;
  }

  const canJump = player.onGround || now - player.lastOnGroundAt <= COYOTE_MS;
  const wantJump = now - player.lastJumpPressedAt <= JUMP_BUFFER_MS;
  if (canJump && wantJump) {
    player.vy = JUMP_VELOCITY;
    player.onGround = false;
    player.lastJumpPressedAt = -Infinity;
  }

  player.vy += GRAVITY;
  if (player.vy > 20) player.vy = 20;
  if (player.vy < -20) player.vy = -20;

  player.x += player.vx;
  for (const p of asArray(world.platforms)) {
    if (rectsIntersect(player, p)) {
      if (player.vx > 0) player.x = p.x - player.w;
      else if (player.vx < 0) player.x = p.x + p.w;
      player.vx = 0;
    }
  }

  player.y += player.vy;
  for (const p of asArray(world.platforms)) {
    if (rectsIntersect(player, p)) {
      if (player.vy > 0) {
        player.y = p.y - player.h;
        player.vy = 0;
        player.onGround = true;
        player.lastOnGroundAt = now;
      } else if (player.vy < 0) {
        player.y = p.y + p.h;
        player.vy = 0;
      }
    }
  }
}

function updateCamera() {
  const tx = player.x + player.w / 2 - BASE_W / 2;
  const ty = player.y + player.h / 2 - BASE_H / 2;
  camera.x += (tx - camera.x) * 0.1;
  camera.y += (ty - camera.y) * 0.1;
  if (camera.x < 0) camera.x = 0;
  if (camera.y < 0) camera.y = 0;
}

function update(dt) {
  updatePlayer(dt);
  updateCamera();
}

function draw(t) {
  ctx.clearRect(0, 0, BASE_W, BASE_H);
  renderer.drawBackground(camera, t);
  ctx.save();
  ctx.translate(-camera.x, -camera.y);
  for (const p of asArray(world.platforms)) renderer.drawPlatform(p);
  for (const c of asArray(world.coins)) renderer.drawCoin(c, t);
  for (const e of asArray(world.enemies)) renderer.drawEnemy(e, t);
  renderer.drawPlayer(player, t);
  ctx.restore();
  renderer.drawHUD(hasFocus);
}

let last = 0;
let acc = 0;
const dt = 1 / 60;
let fpsTime = 0;
let fpsFrames = 0;
let fps = 60;

function loop(ts) {
  try {
    const seconds = ts / 1000;
    if (!last) last = seconds;
    let frame = seconds - last;
    if (frame > 1) frame = 1;
    last = seconds;
    acc += frame;
    while (acc >= dt) {
      update(dt);
      acc -= dt;
    }
    draw(seconds);
    fpsFrames++;
    const elapsed = ts - fpsTime;
    if (elapsed > 1000) {
      fps = (fpsFrames * 1000) / elapsed;
      if (DEBUG) console.log('fps', Math.round(fps));
      renderer.safe = DEBUG && fps < 30;
      fpsFrames = 0;
      fpsTime = ts;
    }
    requestAnimationFrame(loop);
  } catch (e) {
    showError(e);
  }
}

function resize() {
  const scale = Math.min(
    window.innerWidth / BASE_W,
    window.innerHeight / BASE_H,
  );
  canvas.style.transform = `translate(-50%, -50%) scale(${scale})`;
}

window.addEventListener('resize', resize);
resize();
requestAnimationFrame(loop);
