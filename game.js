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

/**
 * Player controlled character.
 * @class
 */
class Player {
  constructor(x, y) {
    this.startX = x;
    this.startY = y;
    this.width = 40;
    this.height = 40;
    this.reset();
  }

  reset() {
    this.x = this.startX;
    this.y = this.startY;
    this.vx = 0;
    this.vy = 0;
    this.onGround = false;
  }

  /**
   * Update player physics and handle collisions.
   * @param {Platform[]} platforms
   * @param {Enemy[]} enemies
   */
  update(platforms, enemies) {
    const left = keys['a'] || keys['arrowleft'];
    const right = keys['d'] || keys['arrowright'];
    const jump = keys['w'] || keys['arrowup'] || keys[' '];

    if (left) this.vx = -MOVE_SPEED;
    else if (right) this.vx = MOVE_SPEED;
    else this.vx *= FRICTION;

    this.vy += GRAVITY;

    if (jump && this.onGround) {
      this.vy = -JUMP_FORCE;
      this.onGround = false;
    }

    this.x += this.vx;
    for (const p of platforms) {
      if (rectIntersect(this, p)) {
        if (this.vx > 0) this.x = p.x - this.width;
        if (this.vx < 0) this.x = p.x + p.width;
        this.vx = 0;
      }
    }

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

    for (const e of enemies) {
      if (rectIntersect(this, e)) {
        this.reset();
      }
    }

    if (this.y > HEIGHT) {
      this.reset();
    }
  }

  draw(ctx) {
    ctx.fillStyle = '#0f0';
    ctx.fillRect(this.x, this.y, this.width, this.height);
  }
}

/**
 * Static platform.
 * @class
 */
class Platform {
  constructor(x, y, width, height) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
  }

  draw(ctx) {
    ctx.fillStyle = '#555';
    ctx.fillRect(this.x, this.y, this.width, this.height);
  }
}

/**
 * Collectible coin.
 * @class
 */
class Coin {
  constructor(x, y, size = 20) {
    this.x = x;
    this.y = y;
    this.width = size;
    this.height = size;
    this.collected = false;
  }

  draw(ctx) {
    if (this.collected) return;
    ctx.fillStyle = 'gold';
    ctx.fillRect(this.x, this.y, this.width, this.height);
  }

  /**
   * Check collection by player.
   * @param {Player} player
   * @returns {boolean}
   */
  collect(player) {
    if (this.collected) return false;
    if (rectIntersect(this, player)) {
      this.collected = true;
      return true;
    }
    return false;
  }
}

/**
 * Simple horizontal moving enemy.
 * @class
 */
class Enemy {
  constructor(x, y, width, height, minX, maxX, speed = 2) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.minX = minX;
    this.maxX = maxX;
    this.speed = speed;
    this.vx = speed;
  }

  update() {
    this.x += this.vx;
    if (this.x < this.minX || this.x + this.width > this.maxX) {
      this.vx *= -1;
    }
  }

  draw(ctx) {
    ctx.fillStyle = 'red';
    ctx.fillRect(this.x, this.y, this.width, this.height);
  }
}

const player = new Player(100, 600);
const platforms = [
  new Platform(0, 680, 400, 40),
  new Platform(600, 680, 680, 40),
  new Platform(200, 500, 200, 20),
  new Platform(500, 400, 200, 20),
  new Platform(900, 300, 200, 20),
];
const coins = [
  new Coin(50, 640),
  new Coin(220, 460),
  new Coin(520, 360),
  new Coin(920, 260),
  new Coin(1100, 640),
];
const enemies = [new Enemy(650, 640, 40, 40, 600, 1200, 2)];

const totalCoins = coins.length;
let collected = 0;
let win = false;

function update() {
  player.update(platforms, enemies);
  for (const e of enemies) e.update();
  for (const c of coins) {
    if (c.collect(player)) {
      collected++;
      if (collected === totalCoins) win = true;
    }
  }
}

function draw() {
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  for (const p of platforms) p.draw(ctx);
  for (const c of coins) c.draw(ctx);
  for (const e of enemies) e.draw(ctx);
  player.draw(ctx);

  ctx.fillStyle = '#fff';
  ctx.font = '20px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`Coins: ${collected}/${totalCoins}`, 20, 30);
  ctx.fillText('WASD/Arrows to move, Space to jump', 20, 60);
  if (win) {
    ctx.textAlign = 'center';
    ctx.fillText('You win!', WIDTH / 2, HEIGHT / 2);
  }
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
