const GAME_VERSION = '0.4.3';
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
  RABBIT: {
    fur: '#fff',
    furLight: '#f7f7f7',
    hat: '#555',
    hatDark: '#333',
    innerEar: '#ffb0b0',
    outline: '#000',
  },
};

const RABBIT_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 160">
  <g stroke="${THEME.RABBIT.outline}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
    <!-- hat -->
    <ellipse cx="60" cy="20" rx="50" ry="12" fill="${THEME.RABBIT.hat}" />
    <rect x="30" y="0" width="60" height="40" rx="10" fill="${THEME.RABBIT.hatDark}" />
    <rect x="30" y="15" width="60" height="8" fill="${THEME.RABBIT.hat}" />
    <!-- head -->
    <ellipse cx="60" cy="100" rx="35" ry="40" fill="${THEME.RABBIT.fur}" />
    <ellipse cx="45" cy="100" rx="12" ry="14" fill="${THEME.RABBIT.furLight}" />
    <ellipse cx="75" cy="100" rx="12" ry="14" fill="${THEME.RABBIT.furLight}" />
    <!-- nose -->
    <polygon points="60,110 55,120 65,120" fill="${THEME.RABBIT.innerEar}" />
    <!-- mouth -->
    <path d="M50 122 Q60 128 70 122" fill="none" />
    <!-- eyes -->
    <circle cx="50" cy="90" r="8" fill="#fff" />
    <circle cx="70" cy="90" r="8" fill="#fff" />
    <circle cx="50" cy="90" r="3" fill="#000" />
    <circle cx="70" cy="90" r="3" fill="#000" />
    <!-- whiskers -->
    <path d="M45 115 L20 110 M45 120 L20 120 M75 115 L100 110 M75 120 L100 120" fill="none" />
  </g>
</svg>`;

function getParam(name) {
  return new URLSearchParams(location.search).get(name);
}

const RENDER_MODE = getParam('mode') || 'classic';
const SKIN = getParam('skin') || 'slime';

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

const Easing = {
  easeInOut: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  back: (t) => 1 + --t * t * (3 * t + 1),
  elastic: (t) =>
    t === 0 || t === 1
      ? t
      : Math.pow(2, -10 * t) * Math.sin(((t - 0.075) * 2 * Math.PI) / 0.3) + 1,
};

function tween(obj, prop, to, ms, easing = Easing.easeInOut) {
  const from = obj[prop];
  const start = performance.now();
  return new Promise((resolve) => {
    function step(now) {
      const t = Math.min((now - start) / ms, 1);
      obj[prop] = from + (to - from) * easing(t);
      if (t < 1) requestAnimationFrame(step);
      else resolve();
    }
    requestAnimationFrame(step);
  });
}

const Particles = {
  list: [],
  emit(x, y, count, color) {
    if (renderer && renderer.safe) count = Math.min(count, 5);
    for (let i = 0; i < count; i++) {
      this.list.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 2,
        vy: -Math.random() * 1.5,
        life: 1,
        color,
      });
    }
  },
  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.x += p.vx * 60 * dt;
      p.y += p.vy * 60 * dt;
      p.life -= dt;
      if (p.life <= 0) this.list.splice(i, 1);
    }
  },
  draw(ctx) {
    ctx.save();
    for (const p of this.list) {
      ctx.globalAlpha = Math.max(p.life, 0);
      ctx.fillStyle = p.color || '#fff';
      ctx.fillRect(p.x, p.y, 2, 2);
    }
    ctx.restore();
  },
};

class RendererCartoon {
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
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, p.w, p.h);
    ctx.restore();
  }

  drawCoin(c, t) {
    const ctx = this.ctx;
    const r = c.r || c.w / 2 || 8;
    ctx.save();
    ctx.translate(c.x + r, c.y + r);
    ctx.scale(1 + Math.sin(t * 2) * 0.05, 1);
    const grad = ctx.createRadialGradient(-r * 0.3, -r * 0.3, 1, 0, 0, r);
    grad.addColorStop(0, '#fff');
    grad.addColorStop(0.5, THEME.coinInner);
    grad.addColorStop(1, THEME.coinOuter);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    if (!this.safe) {
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = this.safe ? 1 : 2;
      const a = ((t % 1.2) / 1.2) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.9, a, a + 0.3);
      ctx.stroke();
    }
    ctx.restore();
  }


  drawPlayer(player, t) {
    const ctx = this.ctx;
    const w = player.w,
      h = player.h;
    ctx.save();
    if (!this.safe && Math.abs(player.vx) > MOVE_SPEED * 0.8) {
      ctx.save();
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = THEME.player;
      ctx.beginPath();
      ctx.ellipse(
        player.x + w / 2 - player.vx * 2,
        player.y + h / 2,
        w * 1.2,
        h * 0.6,
        0,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      ctx.restore();
    }
    ctx.translate(player.x + w / 2, player.y + h);
    const breathe = 1 + Math.sin(t * 2) * 0.02;
    const sx = (player.onGround ? 1.05 : 0.95) * breathe;
    const sy = (player.onGround ? 0.95 : 1.05) * breathe;
    ctx.scale(sx * player.face, sy);
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
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.stroke();

    // face
    ctx.fillStyle = '#000';
    const eyeY = -h * 0.6;
    ctx.beginPath();
    ctx.arc(-5, eyeY, 2, 0, Math.PI * 2);
    ctx.arc(5, eyeY, 2, 0, Math.PI * 2);
    ctx.fill();
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

  drawHUD(world, focus) {
    const ctx = this.ctx;
    ctx.fillStyle = THEME.hud;
    ctx.font = '14px monospace';
    const total = world.collected + world.coins.length;
    const lines = [
      'Arrows/A/D to move, Space/W/Up to jump',
      `Coins: ${world.collected}/${total}`,
      `v${GAME_VERSION}`,
    ];
    if (!focus) lines.push('Click canvas to focus');
    lines.forEach((t, i) => ctx.fillText(t, 10, 20 + i * 16));
  }
}

class RabbitPainter {
  constructor() {
    this.bitmap = null;
    if (typeof createImageBitmap === 'function') {
      const blob = new Blob([RABBIT_SVG], { type: 'image/svg+xml' });
      createImageBitmap(blob)
        .then((img) => {
          this.bitmap = img;
        })
        .catch(() => {
          this.bitmap = null;
        });
    }
  }

  _updateEars(player) {
    if (!player._ears) {
      player._ears = {
        L: { angle: 0, vel: 0 },
        R: { angle: 0, vel: 0 },
      };
    }
    const target = -player.vx * 0.05 + (player.vy < 0 ? -player.vy * 0.02 : 0);
    for (const k of ['L', 'R']) {
      const e = player._ears[k];
      e.vel += (target - e.angle) * 0.2;
      e.vel *= 0.8;
      e.angle += e.vel;
    }
  }

  _drawEar(ctx, sign, ear, w, h) {
    ctx.save();
    ctx.translate(sign * w * 0.25, -h);
    ctx.rotate(ear.angle);
    ctx.fillStyle = THEME.RABBIT.fur;
    ctx.beginPath();
    ctx.ellipse(0, -h * 0.5, w * 0.15, h * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = THEME.RABBIT.outline;
    ctx.lineWidth = renderer.safe ? 2 : 3;
    ctx.stroke();
    ctx.fillStyle = THEME.RABBIT.innerEar;
    ctx.beginPath();
    ctx.ellipse(0, -h * 0.5, w * 0.07, h * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  _blink(ctx, player, w, h, t) {
    if (renderer.safe) return;
    if (!player._nextBlink || t > player._nextBlink) {
      player._blinkUntil = t + 0.12;
      player._nextBlink = t + 3 + Math.random() * 2;
    }
    if (player._blinkUntil && t < player._blinkUntil) {
      const eyeY = -h * 0.4;
      const eyeX = w * 0.17;
      ctx.beginPath();
      ctx.moveTo(-eyeX - 2, eyeY);
      ctx.lineTo(-eyeX + 2, eyeY);
      ctx.moveTo(eyeX - 2, eyeY);
      ctx.lineTo(eyeX + 2, eyeY);
      ctx.stroke();
    }
  }

  _drawBase(ctx, w, h) {
    // hat brim
    ctx.fillStyle = THEME.RABBIT.hat;
    ctx.beginPath();
    ctx.ellipse(0, -h + h * 0.2, w * 0.9, h * 0.15, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // crown
    const crownH = h * 0.5;
    const crownW = w * 0.6;
    ctx.fillStyle = THEME.RABBIT.hatDark;
    ctx.beginPath();
    ctx.rect(-crownW / 2, -h - crownH + h * 0.2, crownW, crownH);
    ctx.fill();
    ctx.stroke();

    // band
    ctx.fillStyle = THEME.RABBIT.hat;
    ctx.fillRect(-crownW / 2, -h - crownH + h * 0.4, crownW, h * 0.08);

    // head
    ctx.fillStyle = THEME.RABBIT.fur;
    ctx.beginPath();
    ctx.ellipse(0, -h * 0.3, w * 0.4, h * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // cheeks
    ctx.fillStyle = THEME.RABBIT.furLight;
    ctx.beginPath();
    ctx.ellipse(-w * 0.15, -h * 0.3, w * 0.13, h * 0.12, 0, 0, Math.PI * 2);
    ctx.ellipse(w * 0.15, -h * 0.3, w * 0.13, h * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();

    // nose
    ctx.fillStyle = THEME.RABBIT.innerEar;
    ctx.beginPath();
    ctx.moveTo(0, -h * 0.2);
    ctx.lineTo(-w * 0.05, -h * 0.1);
    ctx.lineTo(w * 0.05, -h * 0.1);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // mouth
    ctx.beginPath();
    ctx.arc(0, -h * 0.05, w * 0.1, 0, Math.PI);
    ctx.stroke();

    // eyes
    const eyeY = -h * 0.4;
    const eyeX = w * 0.17;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(-eyeX, eyeY, w * 0.06, 0, Math.PI * 2);
    ctx.arc(eyeX, eyeY, w * 0.06, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(-eyeX, eyeY, w * 0.02, 0, Math.PI * 2);
    ctx.arc(eyeX, eyeY, w * 0.02, 0, Math.PI * 2);
    ctx.fill();

    // whiskers
    ctx.beginPath();
    ctx.moveTo(-w * 0.05, -h * 0.1);
    ctx.lineTo(-w * 0.25, -h * 0.15);
    ctx.moveTo(-w * 0.05, -h * 0.05);
    ctx.lineTo(-w * 0.25, -h * 0.05);
    ctx.moveTo(w * 0.05, -h * 0.1);
    ctx.lineTo(w * 0.25, -h * 0.15);
    ctx.moveTo(w * 0.05, -h * 0.05);
    ctx.lineTo(w * 0.25, -h * 0.05);
    ctx.stroke();
  }

  draw(ctx, player, camera, t) {
    const w = player.w * 1.1;
    const h = player.h * 1.1;
    this._updateEars(player);

    ctx.save();
    ctx.translate(player.x + player.w / 2, player.y + player.h);

    const breathe = 1 + Math.sin(t * 2) * 0.02;
    let sx = player.onGround ? 1.08 : 0.92;
    let sy = player.onGround ? 0.92 : 1.08;
    sx = Math.min(Math.max(sx, 0.9), 1.1) * breathe;
    sy = Math.min(Math.max(sy, 0.9), 1.1) * breathe;
    ctx.scale(sx * player.face, sy);

    // shadow
    ctx.save();
    ctx.scale(1, 0.3);
    ctx.fillStyle = THEME.shadow;
    ctx.globalAlpha = player.onGround ? 0.3 : 0.1;
    ctx.beginPath();
    ctx.ellipse(0, 0, w * 0.6, h * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // ears behind
    this._drawEar(ctx, -1, player._ears.L, w, h);
    this._drawEar(ctx, 1, player._ears.R, w, h);

    if (this.bitmap) {
      ctx.drawImage(this.bitmap, -w / 2, -h, w, h);
    } else {
      this._drawBase(ctx, w, h);
    }

    this._blink(ctx, player, w, h, t);
    ctx.restore();
  }
}

class RendererClassic {
  constructor(ctx) {
    this.ctx = ctx;
    this.safe = false;
  }
  drawBackground() {
    const ctx = this.ctx;
    ctx.fillStyle = '#87ceeb';
    ctx.fillRect(0, 0, BASE_W, BASE_H);
  }
  drawPlatform(p) {
    const ctx = this.ctx;
    ctx.fillStyle = '#654321';
    ctx.fillRect(p.x, p.y, p.w, p.h);
  }
  drawCoin(c) {
    const ctx = this.ctx;
    const r = c.r || 8;
    ctx.fillStyle = '#ffdd00';
    ctx.beginPath();
    ctx.arc(c.x + r, c.y + r, r, 0, Math.PI * 2);
    ctx.fill();
  }
  drawEnemy(e) {
    const ctx = this.ctx;
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(e.x, e.y, e.w, e.h);
  }
  drawPlayer(player) {
    const ctx = this.ctx;
    ctx.fillStyle = '#3cba54';
    ctx.fillRect(player.x, player.y, player.w, player.h);
  }
  drawHUD(world, focus) {
    const ctx = this.ctx;
    ctx.fillStyle = '#fff';
    ctx.font = '14px monospace';
    const total = world.collected + world.coins.length;
    const lines = [
      'Arrows/A/D to move, Space/W/Up to jump',
      `Coins: ${world.collected}/${total}`,
      `v${GAME_VERSION}`,
    ];
    if (!focus) lines.push('Click canvas to focus');
    lines.forEach((t, i) => ctx.fillText(t, 10, 20 + i * 16));
  }
}

const renderer =
  RENDER_MODE === 'cartoon'
    ? new RendererCartoon(ctx)
    : new RendererClassic(ctx);

const rabbitPainter = RENDER_MODE === 'cartoon' ? new RabbitPainter() : null;

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

const world = { platforms: [], enemies: [], coins: [], player: null, collected: 0 };

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
    this._earAngle = 0;
    this._earVel = 0;
    this._blinkUntil = 0;
    this._nextBlink = 0;
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

class Coin {
  constructor(x, y, r = 8) {
    this.x = x;
    this.y = y;
    this.r = r;
    this.w = this.h = r * 2;
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
  world.coins = [
    new Coin(240, BASE_H - 140),
    new Coin(440, BASE_H - 220),
    new Coin(690, BASE_H - 300),
  ];
  world.collected = 0;
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
let camera = { x: 0, y: 0, shakeX: 0, shakeY: 0 };

let shake = 0;
function addShake(s) {
  shake = Math.max(shake, s);
}
function applyShake() {
  if (shake > 0) {
    camera.shakeX = (Math.random() * 2 - 1) * shake;
    camera.shakeY = (Math.random() * 2 - 1) * shake;
    shake *= 0.9;
    if (shake < 0.5) shake = 0;
  } else {
    camera.shakeX = camera.shakeY = 0;
  }
}

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
  const wasOnGround = player.onGround;
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
        if (!wasOnGround) {
          Particles.emit(player.x + player.w / 2, player.y + player.h, 8, '#999');
          addShake(5);
        }
      } else if (player.vy < 0) {
        player.y = p.y + p.h;
        player.vy = 0;
      }
    }
  }
}

function updateCoins() {
  for (let i = world.coins.length - 1; i >= 0; i--) {
    const c = world.coins[i];
    const px = player.x + player.w / 2;
    const py = player.y + player.h / 2;
    const dx = px - (c.x + c.r);
    const dy = py - (c.y + c.r);
    if (Math.hypot(dx, dy) < c.r + Math.min(player.w, player.h) / 2) {
      world.coins.splice(i, 1);
      world.collected++;
      Particles.emit(c.x + c.r, c.y + c.r, 10, THEME.coinOuter);
      addShake(2);
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
  updateCoins();
  Particles.update(dt);
  updateCamera();
  applyShake();
}

function draw(t) {
  ctx.clearRect(0, 0, BASE_W, BASE_H);
  renderer.drawBackground(camera, t);
  ctx.save();
  ctx.translate(-camera.x + camera.shakeX, -camera.y + camera.shakeY);
  for (const p of asArray(world.platforms)) renderer.drawPlatform(p);
  for (const c of asArray(world.coins)) renderer.drawCoin(c, t);
  for (const e of asArray(world.enemies)) renderer.drawEnemy(e, t);
  if (
    RENDER_MODE === 'cartoon' &&
    SKIN === 'rabbit_svg' &&
    rabbitPainter
  )
    rabbitPainter.draw(ctx, player, camera, t);
  else renderer.drawPlayer(player, t);
  Particles.draw(ctx);
  ctx.restore();
  renderer.drawHUD(world, hasFocus);
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
      renderer.safe = fps < 30;
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
