const GAME_VERSION = '0.2.3';
const BASE_W = 960,
  BASE_H = 540;
const GRAVITY = 0.6;
const MOVE_SPEED = 6.0;
const JUMP_VELOCITY = -14;
const COYOTE_MS = 100;
const JUMP_BUFFER_MS = 120;
const FRICTION = 0.85;
const DEBUG = true;

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

function draw() {
  ctx.clearRect(0, 0, BASE_W, BASE_H);
  ctx.save();
  ctx.translate(-camera.x, -camera.y);
  ctx.fillStyle = '#654321';
  for (const p of asArray(world.platforms)) {
    ctx.fillRect(p.x, p.y, p.w, p.h);
  }
  ctx.fillStyle = '#0af';
  ctx.fillRect(player.x, player.y, player.w, player.h);
  ctx.restore();

  ctx.fillStyle = '#fff';
  ctx.font = '14px monospace';
  const lines = ['Arrows/A/D to move, Space/W/Up to jump', `v${GAME_VERSION}`];
  if (!hasFocus) lines.push('Click canvas to focus');
  lines.forEach((t, i) => ctx.fillText(t, 10, 20 + i * 16));
}

let last = 0;
let acc = 0;
const dt = 1 / 60;
let fpsTime = 0;
let fpsFrames = 0;

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
    draw();
    fpsFrames++;
    if (DEBUG && ts - fpsTime > 1000) {
      console.log('fps', fpsFrames);
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
