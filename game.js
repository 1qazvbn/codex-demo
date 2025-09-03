const WIDTH = 1280;
const HEIGHT = 720;
const GRAVITY = 0.5;
const MOVE_SPEED = 5;
const JUMP_FORCE = 12;
const FRICTION = 0.8;

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const keys = {};
window.addEventListener('keydown', (e) => {
  keys[e.key.toLowerCase()] = true;
});
window.addEventListener('keyup', (e) => {
  keys[e.key.toLowerCase()] = false;
});

function rectIntersect(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

class Camera {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.target = null;
  }
  follow(target) {
    this.target = target;
  }
  update() {
    if (this.target) {
      const tx = this.target.x + this.target.width / 2 - WIDTH / 2;
      const ty = this.target.y + this.target.height / 2 - HEIGHT / 2;
      this.x += (tx - this.x) * 0.1;
      this.y += (ty - this.y) * 0.1;
    }
  }
}

class Sprite {
  constructor(x, y, width, height) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
  }
  update() {}
  draw(ctx) {}
}

class SpriteFromSVG extends Sprite {
  constructor(x, y, width, height, svg) {
    super(x, y, width, height);
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    this.img = new Image();
    this.img.src = URL.createObjectURL(blob);
  }
  draw(ctx) {
    if (!this.img) return;
    ctx.drawImage(this.img, this.x, this.y, this.width, this.height);
  }
}

class Layer {
  constructor(parallax = 1) {
    this.parallax = parallax;
    this.sprites = [];
    this.customDraw = null;
  }
  add(sprite) {
    this.sprites.push(sprite);
  }
  setCustomDraw(fn) {
    this.customDraw = fn;
  }
  update(dt) {
    for (const s of this.sprites) s.update(dt);
  }
  draw(ctx, camera, renderer) {
    ctx.save();
    ctx.translate(-camera.x * this.parallax, -camera.y * this.parallax);
    if (this.customDraw) this.customDraw(ctx, renderer);
    for (const s of this.sprites) s.draw(ctx, renderer);
    ctx.restore();
  }
}

class Renderer {
  constructor(ctx) {
    this.ctx = ctx;
    this.layers = [];
    this.safeMode = false;
    this._last = performance.now();
    this._fps = 60;
  }
  addLayer(layer) {
    this.layers.push(layer);
  }
  update(dt) {
    const now = performance.now();
    const fps = 1000 / (now - this._last);
    this._fps = fps * 0.05 + this._fps * 0.95;
    this._last = now;
    this.safeMode = this._fps < 40;
    for (const l of this.layers) l.update(dt);
  }
  draw(camera) {
    for (const l of this.layers) l.draw(this.ctx, camera, this);
  }
  drawHUD(collected, total, win) {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = '#fff';
    ctx.font = '20px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`Coins: ${collected}/${total}`, 20, 30);
    ctx.fillText('WASD/Arrows to move, Space to jump', 20, 60);
    if (win) {
      ctx.textAlign = 'center';
      ctx.fillText('You win!', WIDTH / 2, HEIGHT / 2);
    }
    ctx.restore();
  }
}

function drawRoundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fill();
}

class Player extends Sprite {
  constructor(x, y) {
    super(x, y, 40, 40);
    this.startX = x;
    this.startY = y;
    this.dir = 1;
    this.breath = 0;
    this.scaleX = 1;
    this.scaleY = 1;
    this.disableInput = false;
    this.respawnTimer = 0;
  }
  reset() {
    this.x = this.startX;
    this.y = this.startY;
    this.vx = 0;
    this.vy = 0;
    this.onGround = false;
    this.disableInput = false;
    this.respawnTimer = 0;
  }
  update(platforms, enemies) {
    const left = keys['a'] || keys['arrowleft'];
    const right = keys['d'] || keys['arrowright'];
    const jump = keys['w'] || keys['arrowup'] || keys[' '];

    if (!this.disableInput) {
      if (left) {
        this.vx = -MOVE_SPEED;
        this.dir = -1;
      } else if (right) {
        this.vx = MOVE_SPEED;
        this.dir = 1;
      } else {
        this.vx *= FRICTION;
      }
    } else {
      this.vx *= FRICTION;
    }

    this.vy += GRAVITY;

    if (jump && this.onGround && !this.disableInput) {
      this.vy = -JUMP_FORCE;
      this.onGround = false;
      this.scaleX = 1.2;
      this.scaleY = 0.8;
    }

    this.x += this.vx;
    for (const p of platforms) {
      if (rectIntersect(this, p)) {
        if (this.vx > 0) this.x = p.x - this.width;
        if (this.vx < 0) this.x = p.x + p.width;
        this.vx = 0;
      }
    }

    const wasGround = this.onGround;
    this.y += this.vy;
    this.onGround = false;
    for (const p of platforms) {
      if (rectIntersect(this, p)) {
        if (this.vy > 0) {
          this.y = p.y - this.height;
          this.onGround = true;
        }
        if (this.vy < 0) this.y = p.y + p.height;
        this.vy = 0;
      }
    }
    if (!wasGround && this.onGround) {
      this.scaleX = 0.8;
      this.scaleY = 1.2;
    }

    for (const e of enemies) {
      if (rectIntersect(this, e) && this.respawnTimer === 0) {
        const dir = this.x < e.x ? -1 : 1;
        this.vx = -dir * 8;
        this.vy = -8;
        this.disableInput = true;
        this.respawnTimer = 60;
      }
    }

    if (this.respawnTimer > 0) {
      this.respawnTimer--;
      if (this.respawnTimer === 0) this.reset();
    }

    if (this.y > HEIGHT) {
      this.reset();
    }

    this.scaleX += (1 - this.scaleX) * 0.1;
    this.scaleY += (1 - this.scaleY) * 0.1;
    this.breath += 0.05;
  }
  draw(ctx) {
    const breath = 1 + 0.02 * Math.sin(this.breath);
    ctx.save();
    ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
    ctx.scale(this.dir * this.scaleX * breath, this.scaleY * breath);
    ctx.fillStyle = '#3c3';
    drawRoundRect(ctx, -this.width / 2, -this.height / 2, this.width, this.height, 10);

    ctx.fillStyle = '#000';
    const eyeOffset = this.dir * 4;
    ctx.fillRect(-this.width * 0.15 + eyeOffset, -this.height * 0.1, 6, 6);
    ctx.fillRect(this.width * 0.15 - 6 + eyeOffset, -this.height * 0.1, 6, 6);

    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(eyeOffset / 2, this.height * 0.1, this.width * 0.25, 0, Math.PI);
    ctx.stroke();
    ctx.restore();
  }
}

class Enemy extends Sprite {
  constructor(x, y, width, height, minX, maxX, speed = 2) {
    super(x, y, width, height);
    this.baseY = y;
    this.minX = minX;
    this.maxX = maxX;
    this.vx = speed;
    this.breath = 0;
    this.eyeOpen = true;
    this.blinkTimer = Math.random() * 120 + 60;
  }
  update() {
    this.x += this.vx;
    if (this.x < this.minX || this.x + this.width > this.maxX) {
      this.vx *= -1;
    }
    this.breath += 0.05;
    this.y = this.baseY + Math.sin(this.breath) * 4;
    this.blinkTimer--;
    if (this.blinkTimer <= 0) {
      this.eyeOpen = !this.eyeOpen;
      this.blinkTimer = this.eyeOpen ? Math.random() * 120 + 60 : 10;
    }
  }
  draw(ctx, renderer) {
    const scale = 1 + 0.02 * Math.sin(this.breath);
    ctx.save();
    ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
    ctx.scale((this.vx > 0 ? 1 : -1) * scale, scale);
    ctx.fillStyle = '#f33';
    drawRoundRect(ctx, -this.width / 2, -this.height / 2, this.width, this.height, 10);
    ctx.fillStyle = '#000';
    if (renderer.safeMode || this.eyeOpen) {
      ctx.fillRect(-this.width * 0.15, -this.height * 0.1, 6, 6);
      ctx.fillRect(this.width * 0.15 - 6, -this.height * 0.1, 6, 6);
    } else {
      ctx.fillRect(-this.width * 0.15, -this.height * 0.1 + 2, 6, 2);
      ctx.fillRect(this.width * 0.15 - 6, -this.height * 0.1 + 2, 6, 2);
    }
    ctx.restore();
  }
}

class Coin extends SpriteFromSVG {
  constructor(x, y, size = 20) {
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 40 40'>
      <defs>
        <linearGradient id='g' x1='0' x2='0' y1='0' y2='1'>
          <stop offset='0' stop-color='#ffe66d'/>
          <stop offset='1' stop-color='#ffce00'/>
        </linearGradient>
      </defs>
      <circle cx='20' cy='20' r='18' fill='url(#g)'/>
      <circle cx='14' cy='14' r='6' fill='rgba(255,255,255,0.6)'/>
    </svg>`;
    super(x, y, size, size, svg);
    this.phase = Math.random() * Math.PI * 2;
    this.collected = false;
  }
  update() {
    this.phase += 0.1;
  }
  draw(ctx, renderer) {
    if (this.collected) return;
    const wobble = Math.sin(this.phase) * 5;
    ctx.save();
    ctx.translate(this.x + this.width / 2, this.y + this.height / 2 + wobble);
    const scale = 0.9 + 0.1 * Math.sin(this.phase * 2);
    ctx.scale(scale, scale);
    if (renderer.safeMode) {
      ctx.fillStyle = '#ffd700';
      ctx.beginPath();
      ctx.arc(0, 0, this.width / 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      super.draw(ctx);
    }
    ctx.restore();
  }
  collect(player) {
    if (this.collected) return false;
    if (rectIntersect({ x: this.x, y: this.y, width: this.width, height: this.height }, player)) {
      this.collected = true;
      return true;
    }
    return false;
  }
}

class Platform extends Sprite {
  constructor(x, y, width, height = 32) {
    super(x, y, width, height);
  }
  draw(ctx, renderer) {
    const tileW = 48;
    for (let i = 0; i < this.width; i += tileW) {
      const w = Math.min(tileW, this.width - i);
      const x = this.x + i;
      let grad = ctx.createLinearGradient(0, this.y, 0, this.y + this.height);
      if (!renderer.safeMode) {
        grad.addColorStop(0, '#a66e2c');
        grad.addColorStop(1, '#5b3b1a');
      } else {
        grad.addColorStop(0, '#8b5a2b');
        grad.addColorStop(1, '#8b5a2b');
      }
      ctx.fillStyle = grad;
      ctx.fillRect(x, this.y + 8, w, this.height - 8);

      grad = ctx.createLinearGradient(0, this.y, 0, this.y + 8);
      grad.addColorStop(0, '#3fc33f');
      grad.addColorStop(1, '#2c9c2c');
      ctx.fillStyle = grad;
      ctx.fillRect(x, this.y, w, 8);

      ctx.fillStyle = '#28a428';
      ctx.beginPath();
      for (let t = 0; t < w; t += 8) {
        ctx.moveTo(x + t, this.y + 8);
        ctx.lineTo(x + t + 4, this.y + 12);
        ctx.lineTo(x + t + 8, this.y + 8);
      }
      ctx.fill();
    }
  }
}

class Cloud extends SpriteFromSVG {
  constructor(x, y, speed = 0.2) {
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='80' height='50' viewBox='0 0 80 50'>
      <circle cx='25' cy='25' r='20' fill='white'/>
      <circle cx='50' cy='20' r='20' fill='white'/>
      <circle cx='60' cy='30' r='20' fill='white'/>
      <circle cx='35' cy='30' r='20' fill='white'/>
    </svg>`;
    super(x, y, 80, 50, svg);
    this.speed = speed;
  }
  update() {
    this.x += this.speed;
    if (this.x > WIDTH + 50) this.x = -100;
  }
}

const camera = new Camera();
const renderer = new Renderer(ctx);

const skyLayer = new Layer(0);
skyLayer.setCustomDraw((ctx) => {
  const sky = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  sky.addColorStop(0, '#87ceeb');
  sky.addColorStop(1, '#e0f6ff');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
});

const hillLayer = new Layer(0.3);
let hillOffset = 0;
hillLayer.setCustomDraw((ctx) => {
  hillOffset = (hillOffset - 0.2) % WIDTH;
  ctx.fillStyle = '#6b8e6b';
  const o = hillOffset;
  ctx.beginPath();
  ctx.moveTo(o - 200, HEIGHT);
  ctx.quadraticCurveTo(o - 100, HEIGHT - 200, o + 100, HEIGHT - 200);
  ctx.quadraticCurveTo(o + 300, HEIGHT - 200, o + 400, HEIGHT);
  ctx.lineTo(o + 600, HEIGHT);
  ctx.quadraticCurveTo(o + 700, HEIGHT - 150, o + 900, HEIGHT - 150);
  ctx.quadraticCurveTo(o + 1100, HEIGHT - 150, o + 1200, HEIGHT);
  ctx.lineTo(o - 200, HEIGHT);
  ctx.fill();
});

const cloudLayer = new Layer(0.5);
cloudLayer.add(new Cloud(200, 120, 0.3));
cloudLayer.add(new Cloud(800, 80, 0.2));
cloudLayer.add(new Cloud(400, 160, 0.25));

const worldLayer = new Layer(1);

const player = new Player(100, 600);
const platforms = [
  new Platform(0, 680, 1280),
  new Platform(200, 560, 200),
  new Platform(450, 440, 200),
  new Platform(700, 320, 200),
  new Platform(950, 200, 200),
];
const coins = [
  new Coin(100, 640),
  new Coin(280, 520),
  new Coin(530, 400),
  new Coin(780, 280),
  new Coin(1030, 160),
];
const enemies = [new Enemy(600, 640, 40, 40, 500, 1200, 2)];

for (const p of platforms) worldLayer.add(p);
for (const c of coins) worldLayer.add(c);
for (const e of enemies) worldLayer.add(e);
worldLayer.add(player);

renderer.addLayer(skyLayer);
renderer.addLayer(hillLayer);
renderer.addLayer(cloudLayer);
renderer.addLayer(worldLayer);

camera.follow(player);

const totalCoins = coins.length;
let collected = 0;
let win = false;

function update() {
  player.update(platforms, enemies);
  for (const e of enemies) e.update();
  for (const c of coins) {
    c.update();
    if (c.collect(player)) {
      collected++;
      if (collected === totalCoins) win = true;
    }
  }
  camera.update();
  renderer.update();
}

function draw() {
  renderer.draw(camera);
  renderer.drawHUD(collected, totalCoins, win);
}

let lastTime = 0;
function loop(timestamp) {
  const dt = timestamp - lastTime;
  lastTime = timestamp;
  update(dt / 16.67);
  draw();
  requestAnimationFrame(loop);
}

function resize() {
  const scale = Math.min(window.innerWidth / WIDTH, window.innerHeight / HEIGHT);
  canvas.style.transform = `translate(-50%, -50%) scale(${scale})`;
}

window.addEventListener('resize', resize);
resize();
requestAnimationFrame(loop);
