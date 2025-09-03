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

class Player {
  constructor(x, y) {
    this.startX = x;
    this.startY = y;
    this.width = 40;
    this.height = 40;
    this.dir = 1;
    this.breath = 0;
    this.scaleX = 1;
    this.scaleY = 1;
    this.disableInput = false;
    this.respawnTimer = 0;
    this.reset();
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
    ctx.fillRect(-this.width * 0.15, -this.height * 0.1, 6, 6);
    ctx.fillRect(this.width * 0.15 - 6, -this.height * 0.1, 6, 6);

    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, this.height * 0.1, this.width * 0.25, 0, Math.PI);
    ctx.stroke();
    ctx.restore();
  }
}

class Platform {
  constructor(x, y, width, height = 32) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
  }

  draw(ctx) {
    const tileW = 48;
    for (let i = 0; i < this.width; i += tileW) {
      const w = Math.min(tileW, this.width - i);
      const x = this.x + i;
      ctx.fillStyle = '#8b5a2b';
      ctx.fillRect(x, this.y + 8, w, this.height - 8);
      ctx.fillStyle = '#2ecc40';
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

class Coin {
  constructor(x, y, size = 20) {
    this.x = x;
    this.y = y;
    this.size = size;
    this.collected = false;
    this.phase = Math.random() * Math.PI * 2;
  }

  update() {
    this.phase += 0.1;
  }

  draw(ctx) {
    if (this.collected) return;
    const wobble = Math.sin(this.phase) * 5;
    ctx.save();
    ctx.translate(this.x + this.size / 2, this.y + this.size / 2 + wobble);
    const scale = 0.9 + 0.1 * Math.sin(this.phase * 2);
    ctx.scale(scale, scale);
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    ctx.arc(0, 0, this.size / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.beginPath();
    ctx.arc(-this.size * 0.2, -this.size * 0.2, this.size * 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  collect(player) {
    if (this.collected) return false;
    if (
      rectIntersect(
        { x: this.x, y: this.y, width: this.size, height: this.size },
        player,
      )
    ) {
      this.collected = true;
      return true;
    }
    return false;
  }
}

class Enemy {
  constructor(x, y, width, height, minX, maxX, speed = 2) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
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
    this.blinkTimer--;
    if (this.blinkTimer <= 0) {
      this.eyeOpen = !this.eyeOpen;
      this.blinkTimer = this.eyeOpen
        ? Math.random() * 120 + 60
        : 10;
    }
  }

  draw(ctx) {
    const scale = 1 + 0.02 * Math.sin(this.breath);
    ctx.save();
    ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
    ctx.scale((this.vx > 0 ? 1 : -1) * scale, scale);
    ctx.fillStyle = '#f33';
    drawRoundRect(ctx, -this.width / 2, -this.height / 2, this.width, this.height, 10);
    ctx.fillStyle = '#000';
    if (this.eyeOpen) {
      ctx.fillRect(-this.width * 0.15, -this.height * 0.1, 6, 6);
      ctx.fillRect(this.width * 0.15 - 6, -this.height * 0.1, 6, 6);
    } else {
      ctx.fillRect(-this.width * 0.15, -this.height * 0.1 + 2, 6, 2);
      ctx.fillRect(this.width * 0.15 - 6, -this.height * 0.1 + 2, 6, 2);
    }
    ctx.restore();
  }
}

class Renderer {
  constructor(ctx) {
    this.ctx = ctx;
    this.hillOffset = 0;
    this.clouds = [
      { x: 200, y: 120, speed: 0.3 },
      { x: 800, y: 80, speed: 0.2 },
    ];
  }

  update() {
    this.hillOffset = (this.hillOffset - 0.2) % WIDTH;
    for (const c of this.clouds) {
      c.x += c.speed;
      if (c.x > WIDTH + 50) c.x = -50;
    }
  }

  drawBackground() {
    const ctx = this.ctx;
    const sky = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    sky.addColorStop(0, '#87ceeb');
    sky.addColorStop(1, '#e0f6ff');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    ctx.fillStyle = '#6b8e6b';
    const o = this.hillOffset;
    ctx.beginPath();
    ctx.moveTo(o - 200, HEIGHT);
    ctx.quadraticCurveTo(o - 100, HEIGHT - 200, o + 100, HEIGHT - 200);
    ctx.quadraticCurveTo(o + 300, HEIGHT - 200, o + 400, HEIGHT);
    ctx.lineTo(o + 600, HEIGHT);
    ctx.quadraticCurveTo(o + 700, HEIGHT - 150, o + 900, HEIGHT - 150);
    ctx.quadraticCurveTo(o + 1100, HEIGHT - 150, o + 1200, HEIGHT);
    ctx.lineTo(o - 200, HEIGHT);
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    for (const c of this.clouds) {
      ctx.beginPath();
      ctx.arc(c.x, c.y, 30, 0, Math.PI * 2);
      ctx.arc(c.x + 25, c.y + 10, 25, 0, Math.PI * 2);
      ctx.arc(c.x - 25, c.y + 10, 25, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawHUD(collected, total, win) {
    const ctx = this.ctx;
    ctx.fillStyle = '#fff';
    ctx.font = '20px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`Coins: ${collected}/${total}`, 20, 30);
    ctx.fillText('WASD/Arrows to move, Space to jump', 20, 60);
    if (win) {
      ctx.textAlign = 'center';
      ctx.fillText('You win!', WIDTH / 2, HEIGHT / 2);
    }
  }
}

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
const renderer = new Renderer(ctx);

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
  renderer.update();
}

function draw() {
  renderer.drawBackground();
  for (const p of platforms) p.draw(ctx);
  for (const c of coins) c.draw(ctx);
  for (const e of enemies) e.draw(ctx);
  player.draw(ctx);
  renderer.drawHUD(collected, totalCoins, win);
}

function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

function resize() {
  const scale = Math.min(
    window.innerWidth / WIDTH,
    window.innerHeight / HEIGHT,
  );
  canvas.style.transform = `translate(-50%, -50%) scale(${scale})`;
}

window.addEventListener('resize', resize);
resize();
loop();
