// ====== Pengaturan dasar ======
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const W = canvas.width, H = canvas.height;

// Sprite alien (8x8), 2 frame animasi
const SPRITES = {
  squid: [
    ["00011000","00111100","01111110","11011011","11111111","00100100","01011010","10100101"],
    ["00011000","00111100","01111110","11011011","11111111","01011010","10000001","01000010"]
  ],
  crab: [
    ["00100100","10100101","11111111","11011011","11111111","01111110","00100100","01000010"],
    ["00100100","00100100","01111110","11011011","11111111","11111111","10100101","00100100"]
  ]
};
const PIXEL = 3;                 // ukuran 1 pixel sprite
const ALIEN_SIZE = 8 * PIXEL;    // 24 px
const COLS = 9, ROWS = 5;

// ====== Variabel game ======
let state = "start";             // start | play | paused | over
let score = 0, lives = 3, level = 1;
let hiScore = 0;
try { hiScore = Number(localStorage.getItem("si_hi")) || 0; } catch (e) {}

let player, bullets, enemyBullets, aliens, shields, particles, ufo;
let alienDir, alienFrame, alienTimer, shootTimer, ufoTimer, lastShot, invuln;
const keys = { left: false, right: false, fire: false };

// Bintang latar
const stars = Array.from({ length: 60 }, () => ({
  x: Math.random() * W, y: Math.random() * H, s: Math.random() * 1.5 + 0.5
}));

// ====== Inisialisasi ======
function startGame() {
  score = 0; lives = 3; level = 1;
  player = { x: W / 2 - 15, y: H - 50, w: 30, h: 16, speed: 300 };
  bullets = []; enemyBullets = []; particles = [];
  lastShot = 0; invuln = 0; ufo = null;
  ufoTimer = 15000 + Math.random() * 10000;
  initWave();
  initShields();
  state = "play";
}

function initWave() {
  aliens = [];
  const startY = 80 + Math.min(level - 1, 5) * 12;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      aliens.push({
        x: 40 + c * 40, y: startY + r * 32, col: c, row: r, alive: true,
        type: r === 0 ? "squid" : "crab",
        color: r === 0 ? "#ff4fd8" : (r < 3 ? "#4fd8ff" : "#39ff14"),
        points: r === 0 ? 30 : (r < 3 ? 20 : 10)
      });
    }
  }
  alienDir = 1; alienFrame = 0; alienTimer = 0; shootTimer = 0;
  enemyBullets = [];
}

function initShields() {
  shields = [];
  const pattern = [
    "0011111100",
    "0111111110",
    "1111111111",
    "1111111111",
    "1110000111"
  ];
  const size = 5;
  for (let i = 0; i < 4; i++) {
    const bx = 56 + i * 106, by = H - 130;
    pattern.forEach((row, r) => {
      for (let c = 0; c < row.length; c++) {
        if (row[c] === "1") shields.push({ x: bx + c * size, y: by + r * size, w: size, h: size });
      }
    });
  }
}

// ====== Fungsi bantu ======
function hit(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
function alienRect(a) { return { x: a.x, y: a.y, w: ALIEN_SIZE, h: ALIEN_SIZE }; }

function explode(x, y, color) {
  for (let i = 0; i < 14; i++) {
    const ang = Math.random() * Math.PI * 2, sp = 40 + Math.random() * 120;
    particles.push({ x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, life: 500, color });
  }
}

function addScore(n) {
  score += n;
  if (score > hiScore) {
    hiScore = score;
    try { localStorage.setItem("si_hi", hiScore); } catch (e) {}
  }
}

function gameOver() {
  state = "over";
  explode(player.x + player.w / 2, player.y + 8, "#ffffff");
}

// ====== Update ======
function update(dt) {
  const now = performance.now();

  // Gerak pemain
  player.x += (keys.right - keys.left) * player.speed * dt / 1000;
  player.x = Math.max(8, Math.min(W - player.w - 8, player.x));
  if (invuln > 0) invuln -= dt;

  // Tembak
  if (keys.fire && now - lastShot > 400) {
    bullets.push({ x: player.x + player.w / 2 - 2, y: player.y - 12, w: 4, h: 12 });
    lastShot = now;
  }

  // Peluru pemain
  bullets.forEach(b => b.y -= 520 * dt / 1000);
  bullets = bullets.filter(b => b.y + b.h > 0);

  // Gerak alien (per langkah)
  const alive = aliens.filter(a => a.alive);
  const interval = Math.max(30, 8 * alive.length + 30) * Math.pow(0.9, level - 1);
  alienTimer += dt;
  if (alienTimer >= interval) {
    alienTimer = 0;
    alienFrame = 1 - alienFrame;
    const minX = Math.min(...alive.map(a => a.x));
    const maxX = Math.max(...alive.map(a => a.x)) + ALIEN_SIZE;
    if ((alienDir > 0 && maxX + 8 > W - 8) || (alienDir < 0 && minX - 8 < 8)) {
      alive.forEach(a => a.y += 16);
      alienDir = -alienDir;
    } else {
      alive.forEach(a => a.x += 8 * alienDir);
    }
  }

  // Alien menembak (dari alien paling bawah di tiap kolom)
  shootTimer += dt;
  if (shootTimer > Math.max(450, 1200 - level * 100)) {
    shootTimer = 0;
    const col = alive[Math.floor(Math.random() * alive.length)].col;
    const shooter = alive.filter(a => a.col === col).sort((a, b) => b.row - a.row)[0];
    enemyBullets.push({ x: shooter.x + ALIEN_SIZE / 2 - 2, y: shooter.y + ALIEN_SIZE, w: 4, h: 10 });
  }
  enemyBullets.forEach(b => b.y += (220 + level * 15) * dt / 1000);
  enemyBullets = enemyBullets.filter(b => b.y < H);

  // UFO bonus
  ufoTimer -= dt;
  if (!ufo && ufoTimer <= 0) {
    const fromLeft = Math.random() < 0.5;
    ufo = { x: fromLeft ? -36 : W, y: 44, w: 36, h: 14, vx: fromLeft ? 100 : -100,
            points: [50, 100, 150, 300][Math.floor(Math.random() * 4)] };
    ufoTimer = 15000 + Math.random() * 10000;
  }
  if (ufo) {
    ufo.x += ufo.vx * dt / 1000;
    if (ufo.x < -40 || ufo.x > W + 4) ufo = null;
  }

  // Tabrakan: peluru pemain
  for (const b of bullets) {
    for (const a of alive) {
      if (a.alive && !b.dead && hit(b, alienRect(a))) {
        a.alive = false; b.dead = true;
        addScore(a.points);
        explode(a.x + 12, a.y + 12, a.color);
      }
    }
    if (ufo && !b.dead && hit(b, ufo)) {
      addScore(ufo.points); explode(ufo.x + 18, ufo.y + 7, "#ff3b3b");
      ufo = null; b.dead = true;
    }
    if (!b.dead) {
      const i = shields.findIndex(s => hit(b, s));
      if (i >= 0) { shields.splice(i, 1); b.dead = true; }
    }
  }
  bullets = bullets.filter(b => !b.dead);

  // Tabrakan: peluru alien
  for (const b of enemyBullets) {
    const i = shields.findIndex(s => hit(b, s));
    if (i >= 0) { shields.splice(i, 1); b.dead = true; continue; }
    if (invuln <= 0 && hit(b, player)) {
      b.dead = true; lives--;
      explode(player.x + player.w / 2, player.y + 8, "#39ff14");
      invuln = 1500;
      if (lives <= 0) { gameOver(); }
    }
  }
  enemyBullets = enemyBullets.filter(b => !b.dead);

  // Alien merusak perisai & mencapai pemain
  for (const a of aliens) {
    if (!a.alive) continue;
    shields = shields.filter(s => !hit(alienRect(a), s));
    if (a.y + ALIEN_SIZE >= player.y) { lives = 0; gameOver(); }
  }

  // Gelombang selesai
  if (state === "play" && aliens.every(a => !a.alive)) {
    level++;
    initWave();
    bullets = [];
  }
}

// ====== Gambar ======
function drawSprite(rows, x, y, color) {
  ctx.fillStyle = color;
  rows.forEach((row, r) => {
    for (let c = 0; c < row.length; c++) {
      if (row[c] === "1") ctx.fillRect(x + c * PIXEL, y + r * PIXEL, PIXEL, PIXEL);
    }
  });
}

function drawShip(x, y, w, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y + 10, w, 6);
  ctx.fillRect(x + w * 0.2, y + 5, w * 0.6, 6);
  ctx.fillRect(x + w / 2 - 2, y, 4, 6);
}

function centerText(text, y, size, color) {
  ctx.fillStyle = color; ctx.font = "bold " + size + "px 'Courier New', monospace";
  ctx.textAlign = "center"; ctx.fillText(text, W / 2, y);
}

function draw(dt) {
  ctx.fillStyle = "#000000";   // latar hitam digambar langsung
  ctx.fillRect(0, 0, W, H);

  // Bintang
  ctx.fillStyle = "#556";
  stars.forEach(s => {
    s.y += 8 * s.s * dt / 1000; if (s.y > H) s.y = 0;
    ctx.fillRect(s.x, s.y, s.s, s.s);
  });

  if (state !== "start") {
    // Perisai
    ctx.fillStyle = "#39ff14";
    shields.forEach(s => ctx.fillRect(s.x, s.y, s.w, s.h));

    // Alien
    aliens.forEach(a => { if (a.alive) drawSprite(SPRITES[a.type][alienFrame], a.x, a.y, a.color); });

    // UFO
    if (ufo) {
      ctx.fillStyle = "#ff3b3b";
      ctx.fillRect(ufo.x + 8, ufo.y, 20, 5);
      ctx.fillRect(ufo.x, ufo.y + 5, 36, 6);
      ctx.fillRect(ufo.x + 6, ufo.y + 11, 6, 3);
      ctx.fillRect(ufo.x + 24, ufo.y + 11, 6, 3);
    }

    // Pemain (berkedip saat kebal)
    if (state !== "over" && (invuln <= 0 || Math.floor(invuln / 100) % 2 === 0)) {
      drawShip(player.x, player.y, player.w, "#39ff14");
    }

    // Peluru
    ctx.fillStyle = "#00e5ff";
    bullets.forEach(b => ctx.fillRect(b.x, b.y, b.w, b.h));
    ctx.fillStyle = "#ffcc00";
    enemyBullets.forEach(b => ctx.fillRect(b.x, b.y, b.w, b.h));

    // Partikel ledakan
    particles.forEach(p => {
      p.x += p.vx * dt / 1000; p.y += p.vy * dt / 1000; p.life -= dt;
      ctx.globalAlpha = Math.max(0, p.life / 500);
      ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, 3, 3);
    });
    ctx.globalAlpha = 1;
    particles = particles.filter(p => p.life > 0);

    // HUD
    ctx.font = "14px 'Courier New', monospace"; ctx.fillStyle = "#fff";
    ctx.textAlign = "left";  ctx.fillText("SCORE " + score, 10, 20);
    ctx.textAlign = "center"; ctx.fillText("HI " + hiScore, W / 2, 20);
    ctx.textAlign = "right"; ctx.fillText("LEVEL " + level, W - 10, 20);
    ctx.textAlign = "left";  ctx.fillText("LIVES", 10, H - 8);
    for (let i = 0; i < lives; i++) drawShip(70 + i * 28, H - 22, 20, "#39ff14");
    ctx.fillStyle = "#39ff14"; ctx.fillRect(0, H - 30, W, 1);
  }

  if (state === "start") {
    centerText("SPACE INVADERS", 240, 32, "#39ff14");
    centerText("Tekan ENTER / SPASI / ketuk layar", 290, 14, "#fff");
    centerText("untuk mulai", 312, 14, "#fff");
    centerText("HI SCORE: " + hiScore, 360, 14, "#ffcc00");
  } else if (state === "paused") {
    centerText("JEDA", 300, 32, "#ffcc00");
    centerText("Tekan P untuk lanjut", 330, 14, "#fff");
  } else if (state === "over") {
    centerText("GAME OVER", 280, 36, "#ff3b3b");
    centerText("Skor: " + score, 320, 18, "#fff");
    centerText("Tekan ENTER / ketuk layar untuk main lagi", 360, 13, "#fff");
  }
}

// ====== Loop utama ======
let last = 0;
function loop(ts) {
  const dt = Math.min(50, ts - last); last = ts;
  if (state === "play") update(dt);
  draw(dt);
  requestAnimationFrame(loop);
}

// ====== Kontrol ======
document.addEventListener("keydown", e => {
  if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " "].includes(e.key)) e.preventDefault();
  if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") keys.left = true;
  if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") keys.right = true;
  if (e.key === " ") { keys.fire = true; if (state === "start") startGame(); }
  if (e.key === "Enter" && (state === "start" || state === "over")) startGame();
  if ((e.key === "p" || e.key === "P") && (state === "play" || state === "paused")) {
    state = state === "play" ? "paused" : "play";
  }
});
document.addEventListener("keyup", e => {
  if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") keys.left = false;
  if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") keys.right = false;
  if (e.key === " ") keys.fire = false;
});

// Tombol sentuh (HP) + ketuk layar untuk mulai
function bindButton(id, key) {
  const el = document.getElementById(id);
  const on = e => { e.preventDefault(); keys[key] = true; if (key === "fire" && (state === "start" || state === "over")) startGame(); };
  const off = e => { e.preventDefault(); keys[key] = false; };
  el.addEventListener("pointerdown", on);
  el.addEventListener("pointerup", off);
  el.addEventListener("pointerleave", off);
  el.addEventListener("pointercancel", off);
}
bindButton("btnLeft", "left");
bindButton("btnRight", "right");
bindButton("btnFire", "fire");
canvas.addEventListener("pointerdown", () => { if (state === "start" || state === "over") startGame(); });

requestAnimationFrame(loop);