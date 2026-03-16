const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const scoreEl = document.getElementById("score");
const bestEl = document.getElementById("best");
const speedEl = document.getElementById("speed");
const statusEl = document.getElementById("status");
const touchButtons = document.querySelectorAll(".touch-btn");

const W = canvas.width;
const H = canvas.height;
const SOFA = {
  x: 90,
  y: H - 96,
  w: W - 180,
  h: 46,
};
const FLOOR = SOFA.y;
const LEVEL_2_SCORE = 120;
const LEVEL_3_SCORE = 260;
const LEVEL_4_SCORE = 420;
const BOSS_SCORE = 620;

const state = {
  running: false,
  gameOver: false,
  paused: false,
  score: 0,
  best: Number(localStorage.getItem("booba_best") || 0),
  speed: 320,
  elapsed: 0,
  lastSpawnIn: 0,
  deathReason: "",
  level: 1,
  announcedLevel: 1,
  bossActive: false,
  bossStarted: false,
  bossCooldown: 0,
  bossWarning: null,
  bossHp: 5,
  bossMaxHp: 5,
  bossShotCounter: 0,
  bossNextSpecialAt: 0,
  victory: false,
  levelPulse: 0,
  lastSpiderIn: 0,
  lives: 3,
  maxLives: 3,
  invulnTimer: 0,
  bossExploding: false,
  bossExplodeTimer: 0,
  bossExplodeBurstIn: 0,
};

const booba = {
  x: 190,
  y: FLOOR,
  w: 86,
  h: 104,
  vy: 0,
  gravity: 2200,
  jumpPower: 860,
  moveSpeed: 370,
  ducking: false,
  movingLeft: false,
  movingRight: false,
  facing: 1,
};

const obstacles = [];
const spiders = [];
const warnings = [];
const bossShots = [];
const bossOrbs = [];
const explosions = [];
const boobaSprite = new Image();
let boobaSpriteReady = false;
boobaSprite.src = "assets/booba.png";
boobaSprite.onload = () => {
  boobaSpriteReady = true;
};
const boobaIdleSprite = new Image();
let boobaIdleSpriteReady = false;
boobaIdleSprite.src = "assets/Booba_idle.webp";
boobaIdleSprite.onload = () => {
  boobaIdleSpriteReady = true;
};
const boobaJumpSprite = new Image();
let boobaJumpSpriteReady = false;
boobaJumpSprite.src = "assets/booba_jump.png";
boobaJumpSprite.onload = () => {
  boobaJumpSpriteReady = true;
};
const boobaWalkSprite = new Image();
let boobaWalkSpriteReady = false;
boobaWalkSprite.src = "assets/booba_walk.png";
boobaWalkSprite.onload = () => {
  boobaWalkSpriteReady = true;
};
const boobaCrouchSprite = new Image();
let boobaCrouchSpriteReady = false;
boobaCrouchSprite.src = "assets/booba_crawl.png";
boobaCrouchSprite.onload = () => {
  boobaCrouchSpriteReady = true;
};
const spriteTrimCache = new Map();
const spriteFrameOverrides = {
  booba_idle: { x: 0.08, y: 0.02, w: 0.84, h: 0.96 },
  booba_walk: { x: 0.18, y: 0.1, w: 0.64, h: 0.84 },
  booba_jump: { x: 0.16, y: 0.08, w: 0.68, h: 0.86 },
  booba_crouch: { x: 0.06, y: 0.12, w: 0.88, h: 0.78 },
};

const rand = (min, max) => Math.random() * (max - min) + min;
const randInt = (min, max) => Math.floor(rand(min, max + 1));

function getTrimmedFrame(image, cacheKey) {
  if (!image || !image.width || !image.height) return null;
  if (spriteTrimCache.has(cacheKey)) return spriteTrimCache.get(cacheKey);

  const override = spriteFrameOverrides[cacheKey];
  if (override) {
    const frame = {
      sx: Math.floor(image.width * override.x),
      sy: Math.floor(image.height * override.y),
      sw: Math.max(1, Math.floor(image.width * override.w)),
      sh: Math.max(1, Math.floor(image.height * override.h)),
    };
    spriteTrimCache.set(cacheKey, frame);
    return frame;
  }

  const c = document.createElement("canvas");
  c.width = image.width;
  c.height = image.height;
  const g = c.getContext("2d", { willReadFrequently: true });
  if (!g) {
    const fallback = { sx: 0, sy: 0, sw: c.width, sh: c.height };
    spriteTrimCache.set(cacheKey, fallback);
    return fallback;
  }
  try {
    g.drawImage(image, 0, 0);
  } catch {
    const fallback = { sx: 0, sy: 0, sw: c.width, sh: c.height };
    spriteTrimCache.set(cacheKey, fallback);
    return fallback;
  }
  let data;
  try {
    data = g.getImageData(0, 0, c.width, c.height).data;
  } catch {
    const fallback = { sx: 0, sy: 0, sw: c.width, sh: c.height };
    spriteTrimCache.set(cacheKey, fallback);
    return fallback;
  }

  let minX = c.width;
  let minY = c.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < c.height; y++) {
    for (let x = 0; x < c.width; x++) {
      const a = data[(y * c.width + x) * 4 + 3];
      if (a > 8) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  const frame =
    maxX >= minX && maxY >= minY
      ? { sx: minX, sy: minY, sw: maxX - minX + 1, sh: maxY - minY + 1 }
      : { sx: 0, sy: 0, sw: c.width, sh: c.height };
  spriteTrimCache.set(cacheKey, frame);
  return frame;
}

function reset() {
  state.running = true;
  state.gameOver = false;
  state.paused = false;
  state.score = 0;
  state.speed = 320;
  state.elapsed = 0;
  state.deathReason = "";
  state.level = 1;
  state.announcedLevel = 1;
  state.bossActive = false;
  state.bossStarted = false;
  state.bossCooldown = 0;
  state.bossWarning = null;
  state.bossHp = 5;
  state.bossMaxHp = 5;
  state.bossShotCounter = 0;
  state.bossNextSpecialAt = randInt(3, 5);
  state.victory = false;
  state.levelPulse = 0;
  state.lastSpiderIn = rand(5.2, 8.4);
  state.lives = 3;
  state.maxLives = 3;
  state.invulnTimer = 0;
  state.bossExploding = false;
  state.bossExplodeTimer = 0;
  state.bossExplodeBurstIn = 0;
  state.lastSpawnIn = rand(0.75, 1.2);
  booba.x = SOFA.x + SOFA.w * 0.14;
  booba.y = FLOOR;
  booba.vy = 0;
  booba.ducking = false;
  booba.movingLeft = false;
  booba.movingRight = false;
  booba.facing = 1;
  obstacles.length = 0;
  spiders.length = 0;
  warnings.length = 0;
  bossShots.length = 0;
  bossOrbs.length = 0;
  explosions.length = 0;
  statusEl.textContent = "Беги!";
}

function spawnSpider() {
  const fromRight = Math.random() < 0.5;
  const w = rand(58, 72);
  const h = rand(30, 40);
  const dir = fromRight ? -1 : 1;
  const edgeInset = 16;
  const landX = fromRight ? SOFA.x + SOFA.w - w - edgeInset : SOFA.x + edgeInset;
  const startX = fromRight ? SOFA.x + SOFA.w + 20 : SOFA.x - w - 20;
  const startY = H + 26;
  const enterTime = rand(0.52, 0.7);
  spiders.push({
    x: startX,
    y: startY,
    w,
    h,
    dir,
    speed: rand(84, 118),
    mode: "enter",
    prep: 0,
    vy: (FLOOR - startY - 0.5 * 1800 * enterTime * enterTime) / enterTime,
    vx: (landX - startX) / enterTime,
    jumpCooldown: 0,
    jumpTargetX: 0,
    jumpedAtBooba: false,
    enteringDone: false,
    exitStarted: false,
  });
}

function currentBoobaBox() {
  const h = booba.ducking ? booba.h * 0.58 : booba.h;
  return {
    x: booba.x + 12,
    y: booba.y - h,
    w: booba.w - 24,
    h,
  };
}

function spawnObstacle(rules, speedMult) {
  if (rules.front && Math.random() < 0.26) {
    spawnFrontWarning();
    return;
  }
  spawnSideObstacle(rules, speedMult);
}

function chooseSidePattern() {
  const typeRoll = Math.random();
  let pattern = "linear";
  if (typeRoll > 0.66) pattern = "sine";
  if (typeRoll > 0.87) pattern = "arc";
  return pattern;
}

function chooseMotionPattern() {
  const roll = Math.random();
  if (roll > 0.84) return "boomerang";
  if (roll > 0.62) return "pause";
  return "normal";
}

function createBaseObstacle(pattern, speedMult = 1) {
  return {
    w: rand(64, 110),
    h: rand(34, 56),
    speed: state.speed * speedMult * rand(0.82, 1.34),
    phase: rand(0, Math.PI * 2),
    amp: rand(16, 70),
    time: 0,
    pattern,
    fingers: Array.from({ length: 5 }, () => rand(0.6, 1.08)),
    dirX: -1,
    dirY: 0,
  };
}

function spawnSideObstacle(rules, speedMult = 1) {
  const pattern = chooseSidePattern();
  const baseY = pattern === "linear" ? rand(FLOOR - 70, FLOOR - 22) : rand(FLOOR - 130, FLOOR - 25);
  let fromRight = true;
  if (rules.left && rules.right) fromRight = Math.random() < 0.5;
  else if (rules.left) fromRight = false;
  const o = createBaseObstacle(pattern, speedMult);
  const sideDir = fromRight ? -1 : 1;

  o.baseY = baseY;
  o.y = baseY;
  o.vx = sideDir * o.speed;
  o.x = fromRight ? W + rand(10, 120) : -o.w - rand(10, 120);
  o.dirX = sideDir;
  o.dirY = 0;
  o.entry = fromRight ? "right" : "left";
  o.sideDir = sideDir;
  o.motion = chooseMotionPattern();
  o.pauseAt = rand(0.45, 1.2);
  o.pauseFor = rand(0.16, 0.45);
  o.pauseTimer = 0;
  o.pauseDone = false;
  o.reverseAt = rand(0.4, 1.1);
  o.reversePause = rand(0.08, 0.22);
  o.reverseTimer = 0;
  o.reverseDone = false;
  o.reversing = false;

  obstacles.push(o);
}

function spawnFrontWarning() {
  const targetX = SOFA.x + SOFA.w * rand(0.3, 0.7);
  const targetY = rand(FLOOR - 95, FLOOR - 30);
  warnings.push({
    x: targetX,
    y: targetY,
    time: 0,
    delay: rand(0.45, 0.85),
  });
}

function spawnFrontObstacle(targetX, targetY) {
  const o = createBaseObstacle("front", 1);
  o.baseW = rand(56, 84);
  o.baseH = rand(30, 46);
  o.w = o.baseW * 0.25;
  o.h = o.baseH * 0.25;
  o.x = targetX - o.w / 2;
  o.y = targetY - o.h / 2;
  o.centerX = targetX;
  o.centerY = targetY;
  o.grow = rand(1.5, 2.1);
  o.vx = 0;
  o.baseY = targetY;
  o.depthLife = rand(0.8, 1.15);
  o.dirX = 0;
  o.dirY = 1;
  o.entry = "front";
  obstacles.push(o);
}

function intersects(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function isBoobaSupported() {
  const centerX = booba.x + booba.w / 2;
  return centerX >= SOFA.x + 4 && centerX <= SOFA.x + SOFA.w - 4;
}

function getLevelByScore(score) {
  if (score >= LEVEL_4_SCORE) return 4;
  if (score >= LEVEL_3_SCORE) return 3;
  if (score >= LEVEL_2_SCORE) return 2;
  return 1;
}

function getSpawnRules() {
  if (state.level === 1) return { left: false, right: true, front: false, speedMult: 1 };
  if (state.level === 2) return { left: true, right: true, front: false, speedMult: 1 };
  if (state.level === 3) return { left: true, right: true, front: true, speedMult: 1 };
  return { left: true, right: true, front: true, speedMult: 1.35 };
}

function updateLevelProgress() {
  state.level = getLevelByScore(state.score);
  if (state.level > state.announcedLevel) {
    state.announcedLevel = state.level;
    state.levelPulse = 1;
    statusEl.textContent = `Уровень ${state.level}!`;
  }
}

function startBoss() {
  state.bossActive = true;
  state.bossStarted = true;
  state.bossExploding = false;
  state.bossExplodeTimer = 0;
  state.bossExplodeBurstIn = 0;
  state.bossCooldown = 0.8;
  state.bossWarning = null;
  state.bossHp = state.bossMaxHp;
  state.bossShotCounter = 0;
  state.bossNextSpecialAt = randInt(3, 5);
  obstacles.length = 0;
  spiders.length = 0;
  warnings.length = 0;
  bossShots.length = 0;
  bossOrbs.length = 0;
  statusEl.textContent = "БОСС: автомат вышел на позицию!";
}

function finishVictory() {
  state.running = false;
  state.gameOver = true;
  state.victory = true;
  state.bossActive = false;
  state.bossStarted = false;
  state.bossExploding = false;
  state.bossWarning = null;
  spiders.length = 0;
  bossShots.length = 0;
  bossOrbs.length = 0;
  state.deathReason = "Босс повержен! Победа!";
  state.best = Math.max(state.best, Math.floor(state.score));
  localStorage.setItem("booba_best", String(state.best));
  statusEl.textContent = "Босс повержен! Нажми Пробел для новой игры.";
}

function startBossExplosion() {
  state.bossActive = false;
  state.bossExploding = true;
  state.bossExplodeTimer = 1.05;
  state.bossExplodeBurstIn = 0;
  state.bossWarning = null;
  obstacles.length = 0;
  warnings.length = 0;
  spiders.length = 0;
  bossShots.length = 0;
  bossOrbs.length = 0;
  statusEl.textContent = "Босс взрывается...";
}

function circleIntersectsRect(c, r) {
  const px = Math.max(r.x, Math.min(c.x, r.x + r.w));
  const py = Math.max(r.y, Math.min(c.y, r.y + r.h));
  const dx = c.x - px;
  const dy = c.y - py;
  return dx * dx + dy * dy <= c.r * c.r;
}

function circleIntersectsCircle(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const rr = a.r + b.r;
  return dx * dx + dy * dy <= rr * rr;
}

function spawnExplosion(x, y, color = "255,170,70", life = 0.38) {
  explosions.push({ x, y, time: 0, life, color });
}

function getBossBodyRect() {
  return { x: W - 210, y: 52, w: 170, h: 106 };
}

function getMuzzlePoint() {
  return { x: W - 150, y: 88 };
}

function makeSpecialOrbWarningTarget() {
  return {
    x: SOFA.x + rand(46, SOFA.w - 46),
    y: FLOOR - 10,
  };
}

function throwExistingRestingOrbAway() {
  for (const orb of bossOrbs) {
    if (orb.mode === "resting") {
      orb.mode = "falling";
      orb.vx = rand(-80, 80);
      orb.vy = 180;
      return;
    }
  }
}

function spawnNormalBossShot(target) {
  const muzzle = getMuzzlePoint();
  const dx = target.x - muzzle.x;
  const dy = target.y - muzzle.y;
  const d = Math.hypot(dx, dy) || 1;
  const speed = 610;
  bossShots.push({
    x: muzzle.x,
    y: muzzle.y,
    vx: (dx / d) * speed,
    vy: (dy / d) * speed,
    r: 9,
  });
}

function spawnSpecialBossOrb(target) {
  const muzzle = getMuzzlePoint();
  const dx = target.x - muzzle.x;
  const dy = target.y - muzzle.y;
  const d = Math.hypot(dx, dy) || 1;
  const speed = 600;
  bossOrbs.push({
    x: muzzle.x,
    y: muzzle.y,
    vx: (dx / d) * speed,
    vy: (dy / d) * speed,
    r: 12,
    mode: "incoming",
    color: "#66d4ff",
    speed: 760,
  });
}

function updateBossOrbs(dt, boobaBox, moveDir) {
  const bossRect = getBossBodyRect();
  const bossCenter = { x: bossRect.x + bossRect.w * 0.5, y: bossRect.y + bossRect.h * 0.5 };

  for (let i = bossOrbs.length - 1; i >= 0; i--) {
    const orb = bossOrbs[i];

    if (orb.mode === "incoming") {
      orb.x += orb.vx * dt;
      orb.y += orb.vy * dt;
    } else if (orb.mode === "falling") {
      orb.vy += 980 * dt;
      orb.x += orb.vx * dt;
      orb.y += orb.vy * dt;
    } else if (orb.mode === "kicked") {
      const dx = bossCenter.x - orb.x;
      const dy = bossCenter.y - orb.y;
      const d = Math.hypot(dx, dy) || 1;
      const speed = orb.speed || 760;
      orb.vx = (dx / d) * speed;
      orb.vy = (dy / d) * speed;
      orb.x += orb.vx * dt;
      orb.y += orb.vy * dt;
    }

    if (orb.mode === "incoming") {
      if (circleIntersectsRect(orb, boobaBox)) {
        spawnExplosion(orb.x, orb.y, "120,210,255", 0.42);
        hurtBooba("Босс попал в Бубу!");
        return;
      }

      const onSofa = orb.x >= SOFA.x + 8 && orb.x <= SOFA.x + SOFA.w - 8;
      if (onSofa && orb.y + orb.r >= FLOOR) {
        orb.y = FLOOR - orb.r;
        orb.vx = 0;
        orb.vy = 0;
        orb.mode = "resting";
      }
    } else if (orb.mode === "resting") {
      const touch = circleIntersectsRect(orb, boobaBox);
      if (touch && moveDir !== 0) {
        orb.mode = "kicked";
        orb.vx = 0;
        orb.vy = 0;
        orb.speed = 820;
      }
    } else if (orb.mode === "kicked") {
      if (circleIntersectsRect(orb, bossRect)) {
        spawnExplosion(orb.x, orb.y, "255,120,60", 0.5);
        state.bossHp -= 1;
        bossOrbs.splice(i, 1);
        statusEl.textContent = `Попадание по боссу! Осталось: ${Math.max(0, state.bossHp)}`;
        if (state.bossHp <= 0) {
          startBossExplosion();
          return;
        }
        continue;
      }
    }

    if (orb.mode === "falling" && orb.y - orb.r > H + 40) {
      bossOrbs.splice(i, 1);
      continue;
    }

    if ((orb.mode === "incoming" || orb.mode === "kicked") && orb.y - orb.r > H + 40) {
      bossOrbs.splice(i, 1);
      continue;
    }

    if (orb.x < -80 || orb.x > W + 80) {
      if (orb.mode !== "resting") {
        bossOrbs.splice(i, 1);
      }
    }
  }
}

function updateBoss(dt, boobaBox) {
  if (!state.bossActive) return;

  if (state.bossWarning) {
    state.bossWarning.time += dt;
    if (state.bossWarning.time >= state.bossWarning.delay) {
      if (state.bossWarning.special) spawnSpecialBossOrb(state.bossWarning.target);
      else spawnNormalBossShot(state.bossWarning.target);
      state.bossWarning = null;
    }
  } else {
    state.bossCooldown -= dt;
    if (state.bossCooldown <= 0) {
      state.bossShotCounter += 1;
      const special = state.bossShotCounter >= state.bossNextSpecialAt;
      if (special) {
        throwExistingRestingOrbAway();
        state.bossNextSpecialAt = state.bossShotCounter + randInt(3, 5);
      }
      state.bossWarning = {
        time: 0,
        delay: special ? rand(0.55, 0.85) : rand(0.45, 0.7),
        special,
        target: special
          ? makeSpecialOrbWarningTarget()
          : {
              x: booba.x + booba.w / 2 + rand(-20, 20),
              y: booba.y - booba.h * rand(0.2, 0.7),
            },
      };
      state.bossCooldown = rand(0.85, 1.3);
    }
  }

  for (let i = bossShots.length - 1; i >= 0; i--) {
    const s = bossShots[i];
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    if (circleIntersectsRect(s, boobaBox)) {
      spawnExplosion(s.x, s.y, "255,145,70", 0.42);
      hurtBooba("Босс попал в Бубу!");
      return;
    }
    if (s.x < -30 || s.x > W + 30 || s.y < -30 || s.y > H + 30) {
      bossShots.splice(i, 1);
    }
  }

  const moveDir = Number(booba.movingRight) - Number(booba.movingLeft);
  updateBossOrbs(dt, boobaBox, moveDir);
}

function update(dt) {
  if (!state.running) return;
  if (state.paused) return;

  state.elapsed += dt;
  state.levelPulse = Math.max(0, state.levelPulse - dt * 2.2);
  state.invulnTimer = Math.max(0, state.invulnTimer - dt);
  state.score += dt * 10;
  state.speed += dt * 2.8;
  for (let i = explosions.length - 1; i >= 0; i--) {
    const e = explosions[i];
    e.time += dt;
    if (e.time >= e.life) explosions.splice(i, 1);
  }

  if (state.bossExploding) {
    state.bossExplodeTimer -= dt;
    state.bossExplodeBurstIn -= dt;
    if (state.bossExplodeBurstIn <= 0) {
      const r = getBossBodyRect();
      spawnExplosion(rand(r.x + 10, r.x + r.w - 10), rand(r.y + 6, r.y + r.h - 6), "255,130,70", 0.55);
      spawnExplosion(rand(r.x + 6, r.x + r.w - 6), rand(r.y + 4, r.y + r.h - 4), "255,220,130", 0.42);
      state.bossExplodeBurstIn = rand(0.04, 0.09);
    }
    if (state.bossExplodeTimer <= 0) {
      state.bossStarted = false;
      finishVictory();
    }
    return;
  }
  updateLevelProgress();

  if (state.level === 4 && !state.bossStarted && state.score >= BOSS_SCORE) {
    startBoss();
  }

  state.lastSpawnIn -= dt;
  const rules = getSpawnRules();
  if (!state.bossActive && state.lastSpawnIn <= 0) {
    spawnObstacle(rules, rules.speedMult);
    const paceBase = Math.max(0.36, 1.08 - state.elapsed * 0.012);
    const pace = state.level === 4 ? paceBase * 0.78 : paceBase;
    state.lastSpawnIn = rand(pace, pace + 0.62);
  }
  if (!state.bossActive && state.level >= 4) {
    state.lastSpiderIn -= dt;
    if (state.lastSpiderIn <= 0) {
      if (Math.random() < 0.72) spawnSpider();
      state.lastSpiderIn = rand(6.2, 10.4);
    }
  }

  for (let i = warnings.length - 1; i >= 0; i--) {
    const w = warnings[i];
    w.time += dt;
    if (w.time >= w.delay) {
      spawnFrontObstacle(w.x, w.y);
      warnings.splice(i, 1);
    }
  }

  const moveDir = Number(booba.movingRight) - Number(booba.movingLeft);
  booba.x += moveDir * booba.moveSpeed * dt;
  if (moveDir !== 0) booba.facing = moveDir > 0 ? 1 : -1;

  const isOnSofaHorizontally = isBoobaSupported();

  booba.vy += booba.gravity * dt;
  booba.y += booba.vy * dt;

  if (isOnSofaHorizontally && booba.y > FLOOR) {
    booba.y = FLOOR;
    booba.vy = 0;
  }

  if (!isOnSofaHorizontally && booba.y - booba.h > H + 20) {
    hurtBooba("Буба упал с дивана!");
    return;
  }

  const box = currentBoobaBox();
  updateBoss(dt, box);
  if (!state.running) return;

  for (let i = spiders.length - 1; i >= 0; i--) {
    const s = spiders[i];
    s.jumpCooldown = Math.max(0, s.jumpCooldown - dt);

    if (s.mode === "enter") {
      s.vy += 1800 * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      if (s.y >= FLOOR) {
        s.y = FLOOR;
        s.vy = 0;
        s.vx = 0;
        s.mode = "crawl";
        s.enteringDone = true;
        s.jumpCooldown = 0.35;
      }
    } else if (s.mode === "crawl") {
      s.x += s.dir * s.speed * dt;
      const dist = Math.abs(booba.x + booba.w * 0.5 - (s.x + s.w * 0.5));
      if (!s.jumpedAtBooba && dist <= 170 && s.jumpCooldown <= 0) {
        s.mode = "prepare";
        s.prep = 0.5;
      } else {
        const leftEdge = s.x <= SOFA.x - 4;
        const rightEdge = s.x + s.w >= SOFA.x + SOFA.w + 4;
        if ((s.dir < 0 && leftEdge) || (s.dir > 0 && rightEdge)) {
          s.mode = "exit";
          s.exitStarted = true;
          s.vy = -360;
          s.vx = s.dir * (s.speed * 1.05);
        }
      }
    } else if (s.mode === "prepare") {
      s.prep -= dt;
      if (s.prep <= 0) {
        const targetX = booba.x + booba.w * 0.5;
        const jumpTime = 0.72;
        s.jumpTargetX = targetX;
        s.vy = -560;
        s.vx = (targetX - (s.x + s.w * 0.5)) / jumpTime;
        s.mode = "jump";
        s.jumpedAtBooba = true;
      }
    } else if (s.mode === "jump") {
      s.vy += 1700 * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      if (s.y >= FLOOR) {
        s.y = FLOOR;
        s.vy = 0;
        s.vx = 0;
        s.mode = "crawl";
        s.jumpCooldown = 999;
      }
    } else if (s.mode === "exit") {
      s.vy += 1900 * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      const outsideX = s.x + s.w < SOFA.x - 90 || s.x > SOFA.x + SOFA.w + 90;
      if (outsideX && s.y - s.h > H + 30) {
        spiders.splice(i, 1);
        continue;
      }
    }

    const spiderHit = {
      x: s.x + 8,
      y: s.y - s.h + 4,
      w: s.w - 16,
      h: s.h - 6,
    };
    if (intersects(box, spiderHit)) {
      hurtBooba("Паук запрыгнул на Бубу!");
      return;
    }

    if (s.mode !== "exit" && (s.x + s.w < SOFA.x - 80 || s.x > SOFA.x + SOFA.w + 80)) {
      spiders.splice(i, 1);
    }
  }

  for (let i = obstacles.length - 1; i >= 0; i--) {
    const o = obstacles[i];
    const prevX = o.x;
    const prevY = o.y;
    o.time += dt;

    if (o.pattern === "front") {
      const scale = 0.25 + o.time * o.grow;
      o.w = o.baseW * scale;
      o.h = o.baseH * scale;
      o.x = o.centerX - o.w / 2;
      o.y = o.centerY - o.h / 2;
      o.dirX = 0;
      o.dirY = 1;
    } else {
      if (o.motion === "pause") {
        if (!o.pauseDone && o.time >= o.pauseAt) {
          if (o.pauseTimer < o.pauseFor) {
            o.pauseTimer += dt;
            o.vx = 0;
          } else {
            o.pauseDone = true;
            o.vx = o.sideDir * o.speed * 1.18;
          }
        }
      } else if (o.motion === "boomerang") {
        if (!o.reverseDone && o.time >= o.reverseAt) {
          o.reverseDone = true;
          o.reversing = true;
          o.vx = 0;
        }
        if (o.reversing) {
          o.reverseTimer += dt;
          if (o.reverseTimer >= o.reversePause) {
            o.reversing = false;
            o.vx = -o.sideDir * o.speed * rand(0.9, 1.14);
          }
        }
      }

      o.x += o.vx * dt;
      if (o.pattern === "sine") {
        o.y = o.baseY + Math.sin(o.time * 3 + o.phase) * o.amp;
      } else if (o.pattern === "arc") {
        o.y = o.baseY - Math.sin(Math.min(Math.PI, o.time * 2.3)) * (o.amp + 14);
      }
    }

    const dx = o.x - prevX;
    const dy = o.y - prevY;
    const len = Math.hypot(dx, dy);
    if (len > 0.001) {
      o.dirX = dx / len;
      o.dirY = dy / len;
    }

    const hit = {
      x: o.x + 8,
      y: o.y + 4,
      w: o.w - 16,
      h: o.h - 8,
    };

    if (intersects(box, hit)) {
      hurtBooba("Хваталки поймали Бубу!");
      return;
    }

    if (o.pattern === "front" && o.time > o.depthLife) {
      obstacles.splice(i, 1);
      continue;
    }

    if (o.x + o.w < -40 || o.x > W + 40) {
      obstacles.splice(i, 1);
    }
  }
}

function finishGame(reason) {
  state.running = false;
  state.gameOver = true;
  state.victory = false;
  state.deathReason = reason;
  state.best = Math.max(state.best, Math.floor(state.score));
  localStorage.setItem("booba_best", String(state.best));
  statusEl.textContent = `${reason} Нажми Пробел для рестарта.`;
}

function hurtBooba(reason) {
  if (!state.running || state.invulnTimer > 0) return;

  state.lives -= 1;
  if (state.lives <= 0) {
    finishGame(reason);
    return;
  }

  state.invulnTimer = 1.2;
  booba.x = SOFA.x + SOFA.w * 0.14;
  booba.y = FLOOR;
  booba.vy = 0;
  booba.ducking = false;
  booba.movingLeft = false;
  booba.movingRight = false;
  obstacles.length = 0;
  warnings.length = 0;
  spiders.length = 0;
  bossShots.length = 0;
  bossOrbs.length = 0;
  statusEl.textContent = `Минус жизнь! Осталось: ${state.lives}`;
}

function drawSofa() {
  const seatY = SOFA.y;
  ctx.fillStyle = "#4b7f9d";
  roundRect(SOFA.x, seatY, SOFA.w, SOFA.h, 14, true);
  ctx.fillStyle = "#32566a";
  roundRect(SOFA.x, seatY + SOFA.h - 8, SOFA.w, 16, 7, true);

  ctx.save();
  roundRect(SOFA.x, seatY, SOFA.w, SOFA.h, 14);
  ctx.clip();
  for (let x = SOFA.x; x <= SOFA.x + SOFA.w - 62; x += 70) {
    ctx.fillStyle = x % 140 === 0 ? "#3b6981" : "#416f88";
    ctx.fillRect(x + 6, seatY + 4, 56, 38);
  }
  ctx.restore();

  const legY = seatY + SOFA.h + 8;
  const legW = 18;
  const legH = 18;
  const legsX = [SOFA.x + 20, SOFA.x + SOFA.w * 0.33, SOFA.x + SOFA.w * 0.66, SOFA.x + SOFA.w - 40];
  ctx.fillStyle = "#8f6f4b";
  for (const lx of legsX) {
    roundRect(lx, legY, legW, legH, 4, true);
    ctx.fillStyle = "rgba(40, 26, 13, 0.25)";
    roundRect(lx - 4, legY + legH + 2, legW + 8, 6, 3, true);
    ctx.fillStyle = "#8f6f4b";
  }
}

function drawBooba() {
  if (state.invulnTimer > 0 && Math.floor(state.invulnTimer * 16) % 2 === 0) {
    return;
  }
  if (booba.ducking) {
    drawBoobaCrouch();
    return;
  }
  const isMoving = booba.movingLeft !== booba.movingRight;
  const onGround = booba.y >= FLOOR - 1;
  if (!onGround && boobaJumpSpriteReady) {
    drawBoobaJumpSprite();
    return;
  }
  if (isMoving && onGround && boobaWalkSpriteReady) {
    drawBoobaWalkSprite();
    return;
  }
  if (!isMoving && onGround && boobaIdleSpriteReady) {
    drawBoobaIdleSprite();
    return;
  }
  if (boobaSpriteReady) {
    drawBoobaSprite();
    return;
  }
  drawBoobaFallback();
}

function drawBoobaJumpSprite() {
  const h = booba.h;
  const frame = getTrimmedFrame(boobaJumpSprite, "booba_jump");
  const sw = frame.sw;
  const sh = frame.sh;
  const aspect = sw / sh;
  const spriteH = h * 1.5;
  const spriteW = spriteH * aspect;
  const x = booba.x + (booba.w - spriteW) / 2;
  const y = booba.y - spriteH + 2;

  ctx.save();
  if (booba.facing < 0) {
    ctx.translate(x + spriteW / 2, 0);
    ctx.scale(-1, 1);
    ctx.translate(-(x + spriteW / 2), 0);
  }
  ctx.drawImage(boobaJumpSprite, frame.sx, frame.sy, frame.sw, frame.sh, x, y, spriteW, spriteH);
  ctx.restore();
}

function drawBoobaIdleSprite() {
  const h = booba.h;
  const frame = getTrimmedFrame(boobaIdleSprite, "booba_idle");
  const sw = frame.sw;
  const sh = frame.sh;
  const aspect = sw / sh;
  const spriteH = h * 1.52;
  const spriteW = spriteH * aspect;
  const x = booba.x + (booba.w - spriteW) / 2;
  const y = booba.y - spriteH + 2;

  ctx.save();
  if (booba.facing < 0) {
    ctx.translate(x + spriteW / 2, 0);
    ctx.scale(-1, 1);
    ctx.translate(-(x + spriteW / 2), 0);
  }
  ctx.drawImage(boobaIdleSprite, frame.sx, frame.sy, frame.sw, frame.sh, x, y, spriteW, spriteH);
  ctx.restore();
}

function drawBoobaWalkSprite() {
  const h = booba.h;
  const frame = getTrimmedFrame(boobaWalkSprite, "booba_walk");
  const sw = frame.sw;
  const sh = frame.sh;
  const aspect = sw / sh;
  const spriteH = h * 1.5;
  const spriteW = spriteH * aspect;
  const x = booba.x + (booba.w - spriteW) / 2;
  const y = booba.y - spriteH + 12;

  ctx.save();
  if (booba.facing < 0) {
    ctx.translate(x + spriteW / 2, 0);
    ctx.scale(-1, 1);
    ctx.translate(-(x + spriteW / 2), 0);
  }
  ctx.drawImage(boobaWalkSprite, frame.sx, frame.sy, frame.sw, frame.sh, x, y, spriteW, spriteH);
  ctx.restore();
}

function drawBoobaSprite() {
  const h = booba.h;
  const frame = getTrimmedFrame(boobaSprite, "booba_base");
  const sw = frame.sw;
  const sh = frame.sh;
  const aspect = sw / sh;
  const spriteH = h * 1.52;
  const spriteW = spriteH * aspect;
  const x = booba.x + (booba.w - spriteW) / 2;
  const y = booba.y - spriteH + 2;

  ctx.save();
  if (booba.facing < 0) {
    ctx.translate(x + spriteW / 2, 0);
    ctx.scale(-1, 1);
    ctx.translate(-(x + spriteW / 2), 0);
  }
  ctx.drawImage(boobaSprite, frame.sx, frame.sy, frame.sw, frame.sh, x, y, spriteW, spriteH);
  ctx.restore();
}

function drawBoobaFallback() {
  const h = booba.h;
  const yTop = booba.y - h;
  const cx = booba.x + booba.w / 2;

  ctx.fillStyle = "#fffdf8";
  ctx.beginPath();
  ctx.ellipse(cx, yTop + h * 0.6, booba.w * 0.46, h * 0.43, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx, yTop + h * 0.34, booba.w * 0.38, h * 0.28, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#e7a38d";
  ctx.beginPath();
  ctx.moveTo(cx - booba.w * 0.34, yTop + h * 0.28);
  ctx.lineTo(cx - booba.w * 0.57, yTop + h * 0.2);
  ctx.lineTo(cx - booba.w * 0.39, yTop + h * 0.42);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx + booba.w * 0.34, yTop + h * 0.28);
  ctx.lineTo(cx + booba.w * 0.57, yTop + h * 0.2);
  ctx.lineTo(cx + booba.w * 0.39, yTop + h * 0.42);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#f5f5f5";
  ctx.beginPath();
  ctx.ellipse(cx - booba.w * 0.14, yTop + h * 0.22, booba.w * 0.12, h * 0.14, -0.2, 0, Math.PI * 2);
  ctx.ellipse(cx + booba.w * 0.14, yTop + h * 0.22, booba.w * 0.12, h * 0.14, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#4d87ea";
  ctx.beginPath();
  ctx.arc(cx - booba.w * 0.14, yTop + h * 0.23, 8, 0, Math.PI * 2);
  ctx.arc(cx + booba.w * 0.14, yTop + h * 0.23, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#0e2b5a";
  ctx.beginPath();
  ctx.arc(cx - booba.w * 0.14, yTop + h * 0.23, 4, 0, Math.PI * 2);
  ctx.arc(cx + booba.w * 0.14, yTop + h * 0.23, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#e8a489";
  ctx.beginPath();
  ctx.ellipse(cx, yTop + h * 0.37, booba.w * 0.18, h * 0.1, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#de8a76";
  roundRect(cx - booba.w * 0.24, yTop + h * 0.48, booba.w * 0.48, h * 0.16, 10, true);
  ctx.fillStyle = "#ffffff";
  roundRect(cx - booba.w * 0.2, yTop + h * 0.49, booba.w * 0.4, h * 0.09, 6, true);
}

function drawBoobaCrouch() {
  if (boobaCrouchSpriteReady) {
    drawBoobaCrouchSprite();
    return;
  }
  drawBoobaCrouchFallback();
}

function drawBoobaCrouchSprite() {
  const frame = getTrimmedFrame(boobaCrouchSprite, "booba_crouch");
  const aspect = frame.sw / frame.sh;
  const spriteH = booba.h * 1.05;
  const spriteW = spriteH * aspect;
  const x = booba.x + booba.w / 2 - spriteW * 0.48;
  const y = booba.y - spriteH + 11;

  ctx.save();
  if (booba.facing < 0) {
    const pivotX = booba.x + booba.w / 2;
    ctx.translate(pivotX, 0);
    ctx.scale(-1, 1);
    ctx.translate(-pivotX, 0);
  }
  ctx.drawImage(boobaCrouchSprite, frame.sx, frame.sy, frame.sw, frame.sh, x, y, spriteW, spriteH);
  ctx.restore();
}

function drawBoobaCrouchFallback() {
  const facingLeft = booba.facing < 0;
  const groundY = booba.y;
  const bodyW = booba.w * 1.08;
  const bodyH = booba.h * 0.42;
  const bodyX = booba.x - booba.w * 0.06;
  const bodyY = groundY - bodyH - 8;
  const headR = bodyH * 0.34;

  ctx.save();
  if (facingLeft) {
    const pivotX = booba.x + booba.w / 2;
    ctx.translate(pivotX, 0);
    ctx.scale(-1, 1);
    ctx.translate(-pivotX, 0);
  }

  ctx.fillStyle = "#dfd7cb";
  const legXs = [bodyX + 8, bodyX + bodyW * 0.32, bodyX + bodyW * 0.62, bodyX + bodyW - 16];
  for (const lx of legXs) {
    roundRect(lx, bodyY + bodyH - 4, 12, 16, 5, true);
    ctx.fillStyle = "#e5aa8e";
    ctx.beginPath();
    ctx.ellipse(lx + 6, groundY - 2, 11, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#dfd7cb";
  }

  ctx.fillStyle = "#f7f4ee";
  ctx.beginPath();
  ctx.ellipse(bodyX + bodyW * 0.48, bodyY + bodyH * 0.58, bodyW * 0.46, bodyH * 0.52, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(bodyX + bodyW * 0.3, bodyY + bodyH * 0.52, bodyW * 0.18, bodyH * 0.3, 0.2, 0, Math.PI * 2);
  ctx.fill();

  const headX = bodyX + bodyW * 0.82;
  const headY = bodyY + bodyH * 0.26;
  ctx.beginPath();
  ctx.ellipse(headX, headY, headR * 1.1, headR * 0.9, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#e7a38d";
  ctx.beginPath();
  ctx.moveTo(headX - headR * 0.9, headY - headR * 0.2);
  ctx.lineTo(headX - headR * 1.5, headY - headR * 0.45);
  ctx.lineTo(headX - headR * 1.05, headY + headR * 0.25);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(headX + headR * 0.9, headY - headR * 0.2);
  ctx.lineTo(headX + headR * 1.5, headY - headR * 0.45);
  ctx.lineTo(headX + headR * 1.05, headY + headR * 0.25);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#4d87ea";
  ctx.beginPath();
  ctx.arc(headX - headR * 0.34, headY - headR * 0.2, 4, 0, Math.PI * 2);
  ctx.arc(headX + headR * 0.34, headY - headR * 0.2, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#112b5a";
  ctx.beginPath();
  ctx.arc(headX - headR * 0.34, headY - headR * 0.2, 2, 0, Math.PI * 2);
  ctx.arc(headX + headR * 0.34, headY - headR * 0.2, 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#e8a489";
  ctx.beginPath();
  ctx.ellipse(headX, headY + headR * 0.12, headR * 0.45, headR * 0.28, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#de8a76";
  roundRect(headX - headR * 0.5, headY + headR * 0.28, headR, headR * 0.34, 5, true);

  ctx.restore();
}

function drawObstacle(o) {
  const dirX = o.dirX ?? -1;
  const dirY = o.dirY ?? 0;
  const perpX = -dirY;
  const perpY = dirX;
  const squeeze = 0.5 + 0.5 * Math.sin(o.time * 8 + o.phase);
  const ang = Math.atan2(dirY, dirX);
  const handW = o.w;
  const handH = o.h;
  const cx = o.x + o.w / 2;
  const cy = o.y + o.h / 2;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(ang);

  const wristLen = handW * 0.52;
  const palmLen = handW * 0.52;
  const palmH = handH * 0.92;
  const fingerBaseX = palmLen * 0.16;
  const spread = palmH * (0.16 + 0.08 * squeeze);

  const skin = "#e2aa95";
  const skinDark = "#cc8f7a";
  const nail = "#f6d5cc";

  // Wrist / forearm.
  ctx.fillStyle = skinDark;
  roundRect(-wristLen - palmLen * 0.4, -palmH * 0.45, wristLen, palmH * 0.9, palmH * 0.24, true);

  // Palm.
  ctx.fillStyle = skin;
  roundRect(-palmLen * 0.45, -palmH * 0.5, palmLen, palmH, palmH * 0.32, true);

  // Four main fingers.
  for (let i = 0; i < 4; i++) {
    const lane = (i - 1.5) * spread;
    const baseY = lane;
    const maxLen = palmLen * (0.52 + o.fingers[i] * 0.35);
    const minLen = maxLen * 0.52;
    const len = minLen + (maxLen - minLen) * squeeze;
    const fingerT = palmH * 0.19 - i * palmH * 0.018;
    const bend = (1 - squeeze) * palmH * 0.08;

    ctx.fillStyle = skin;
    roundRect(fingerBaseX, baseY - fingerT / 2 + bend, len * 0.66, fingerT, fingerT / 2, true);
    roundRect(fingerBaseX + len * 0.56, baseY - fingerT * 0.48 + bend * 1.2, len * 0.44, fingerT * 0.96, fingerT / 2, true);
    ctx.fillStyle = nail;
    ctx.beginPath();
    ctx.ellipse(fingerBaseX + len * 0.98, baseY + bend * 1.15, fingerT * 0.2, fingerT * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Thumb.
  const thumbBaseX = palmLen * 0.02;
  const thumbBaseY = palmH * 0.33;
  const thumbLen = palmLen * (0.52 + squeeze * 0.25);
  const thumbT = palmH * 0.22;
  ctx.save();
  ctx.translate(thumbBaseX, thumbBaseY);
  ctx.rotate(0.72 - squeeze * 0.35);
  ctx.fillStyle = skin;
  roundRect(0, -thumbT / 2, thumbLen * 0.75, thumbT, thumbT / 2, true);
  roundRect(thumbLen * 0.68, -thumbT * 0.42, thumbLen * 0.42, thumbT * 0.84, thumbT / 2, true);
  ctx.fillStyle = nail;
  ctx.beginPath();
  ctx.ellipse(thumbLen * 1.06, 0, thumbT * 0.18, thumbT * 0.27, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Knuckle crease.
  ctx.strokeStyle = "rgba(168, 112, 94, 0.45)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(fingerBaseX - palmLen * 0.2, -palmH * 0.34);
  ctx.lineTo(fingerBaseX - palmLen * 0.2, palmH * 0.34);
  ctx.stroke();

  ctx.restore();
}

function drawSpider(s) {
  const prepWindow = 0.5;
  const prepProgress = s.mode === "prepare" ? Math.min(1, Math.max(0, 1 - s.prep / prepWindow)) : 0;
  const crouchPulse = prepProgress > 0 ? Math.sin(prepProgress * Math.PI) : 0;
  const squashY = 1 - crouchPulse * 0.32;
  const squashX = 1 + crouchPulse * 0.22;

  const cx = s.x + s.w * 0.5;
  const cy = s.y - s.h * 0.45 + crouchPulse * 6;
  const dir = s.dir || 1;
  const bodyW = s.w * 0.48;
  const bodyH = s.h * 0.42;
  const headR = s.h * 0.18;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(dir, 1);
  ctx.scale(squashX, squashY);

  ctx.strokeStyle = "#2a231b";
  ctx.lineWidth = 2;
  for (let i = 0; i < 4; i++) {
    const y = -bodyH * 0.15 + i * (bodyH * 0.2);
    ctx.beginPath();
    ctx.moveTo(-bodyW * 0.2, y);
    ctx.lineTo(-bodyW - 10, y - 8 + i * 2);
    ctx.lineTo(-bodyW - 17, y + 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(bodyW * 0.2, y);
    ctx.lineTo(bodyW + 10, y - 8 + i * 2);
    ctx.lineTo(bodyW + 17, y + 2);
    ctx.stroke();
  }

  ctx.fillStyle = "#3a2f25";
  ctx.beginPath();
  ctx.ellipse(0, 0, bodyW, bodyH, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#47372a";
  ctx.beginPath();
  ctx.ellipse(bodyW * 0.78, 0, headR, headR * 0.95, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#d22f2f";
  ctx.beginPath();
  ctx.arc(bodyW * 0.88, -headR * 0.25, 2.2, 0, Math.PI * 2);
  ctx.arc(bodyW * 0.88, headR * 0.25, 2.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawExplosions() {
  for (const e of explosions) {
    const t = Math.min(1, e.time / e.life);
    const r1 = 10 + t * 26;
    const r2 = 4 + t * 18;
    const alpha = 1 - t;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = `rgba(${e.color}, ${0.5 * alpha})`;
    ctx.beginPath();
    ctx.arc(e.x, e.y, r1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(255, 245, 210, ${0.9 * alpha})`;
    ctx.beginPath();
    ctx.arc(e.x, e.y, r2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawWarnings() {
  for (const w of warnings) {
    const t = Math.min(1, w.time / w.delay);
    const pulse = 0.5 + 0.5 * Math.sin(w.time * 18);
    const radius = 14 + pulse * 7 + t * 10;
    ctx.save();
    ctx.strokeStyle = `rgba(210, 50, 35, ${0.35 + 0.55 * (1 - t)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(w.x, w.y, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(w.x - 8, w.y);
    ctx.lineTo(w.x + 8, w.y);
    ctx.moveTo(w.x, w.y - 8);
    ctx.lineTo(w.x, w.y + 8);
    ctx.stroke();
    ctx.restore();
  }
}

function drawBoss() {
  if (!state.bossActive && !state.bossStarted) return;
  const bossRect = getBossBodyRect();
  const shakeX = state.bossExploding ? rand(-6, 6) : 0;
  const shakeY = state.bossExploding ? rand(-4, 4) : 0;
  const x = bossRect.x + shakeX;
  const y = 32 + shakeY;
  const w = bossRect.w;
  const h = 126;

  ctx.fillStyle = "#66707a";
  roundRect(x, y + 20, w, h - 20, 14, true);
  ctx.fillStyle = "#4d555d";
  roundRect(x + 10, y + 30, w - 20, h - 38, 10, true);

  const muzzle = getMuzzlePoint();
  const targetX = state.bossWarning ? state.bossWarning.target.x : booba.x + booba.w / 2;
  const targetY = state.bossWarning ? state.bossWarning.target.y : booba.y - booba.h * 0.4;
  const ang = Math.atan2(targetY - muzzle.y, targetX - muzzle.x);

  ctx.save();
  ctx.translate(muzzle.x, muzzle.y);
  ctx.rotate(ang);
  ctx.fillStyle = "#8894a0";
  roundRect(-14, -12, 44, 24, 10, true);
  ctx.fillStyle = "#2f3840";
  roundRect(20, -7, 52, 14, 6, true);
  ctx.restore();

  if (state.bossWarning) {
    const t = 0.5 + 0.5 * Math.sin(state.elapsed * 24);
    const isSpecial = Boolean(state.bossWarning.special);
    const color = isSpecial ? "30, 180, 255" : "220, 35, 35";
    ctx.strokeStyle = `rgba(${color}, ${0.35 + t * 0.4})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(muzzle.x, muzzle.y);
    ctx.lineTo(state.bossWarning.target.x, state.bossWarning.target.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(state.bossWarning.target.x, state.bossWarning.target.y, 11 + t * 5, 0, Math.PI * 2);
    ctx.stroke();
  }

  if (state.bossStarted) {
    const barW = 210;
    const barH = 14;
    const barX = W - barW - 18;
    const barY = 14;
    const hpRatio = Math.max(0, state.bossHp / state.bossMaxHp);
    ctx.fillStyle = "rgba(32, 32, 32, 0.5)";
    roundRect(barX, barY, barW, barH, 6, true);
    ctx.fillStyle = "#e04f3e";
    roundRect(barX + 2, barY + 2, (barW - 4) * hpRatio, barH - 4, 4, true);
    ctx.fillStyle = "#2d2014";
    ctx.font = "700 12px Trebuchet MS";
    ctx.fillText("БОСС", barX + 8, barY + 11);
  }
}

function drawBossShots() {
  for (const s of bossShots) {
    const glow = 0.5 + 0.5 * Math.sin(state.elapsed * 20 + s.x * 0.02);
    ctx.fillStyle = "#ffcc66";
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `rgba(255,80,20,${0.5 + glow * 0.4})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r + 3, 0, Math.PI * 2);
    ctx.stroke();
  }

  for (const orb of bossOrbs) {
    const glow = 0.5 + 0.5 * Math.sin(state.elapsed * 15 + orb.x * 0.02);
    ctx.fillStyle = orb.color || "#66d4ff";
    ctx.beginPath();
    ctx.arc(orb.x, orb.y, orb.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `rgba(20, 115, 180, ${0.5 + glow * 0.35})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(orb.x, orb.y, orb.r + 3, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawBackground() {
  ctx.clearRect(0, 0, W, H);

  ctx.fillStyle = "#efe5d3";
  for (let i = 0; i < 9; i++) {
    const offset = (state.elapsed * 20 + i * 120) % (W + 140);
    ctx.fillRect(W - offset, 46 + (i % 3) * 24, 90, 10);
  }

  ctx.strokeStyle = "#e3d3bb";
  for (let i = 0; i < W; i += 100) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + 30, SOFA.y);
    ctx.stroke();
  }
}

function drawHudOverlay() {
  scoreEl.textContent = String(Math.floor(state.score));
  bestEl.textContent = String(state.best);
  speedEl.textContent = `${(state.speed / 320).toFixed(1)}x`;

  if (!state.running && !state.gameOver) {
    centerText("Нажми Пробел, чтобы начать", H / 2 - 30);
  }

  if (state.gameOver) {
    centerText(state.deathReason || "Игра окончена", H / 2 - 36);
    centerText("Пробел — рестарт", H / 2 + 2);
  }

  if (state.paused && state.running && !state.gameOver) {
    centerText("Пауза", H / 2 - 20);
    centerText("P или Esc — продолжить", H / 2 + 16);
  }
}

function drawLevelBanner() {
  const pulse = state.levelPulse;
  const scale = 1 + pulse * 1.15;
  const x = W / 2;
  const y = 44;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
  ctx.font = "900 24px Trebuchet MS";
  ctx.fillText("УРОВЕНЬ", 0, -14);

  ctx.fillStyle = "rgba(43, 30, 18, 0.95)";
  ctx.strokeStyle = "rgba(255, 243, 214, 0.9)";
  ctx.lineWidth = 3;
  ctx.font = "900 44px Trebuchet MS";
  const num = String(state.level);
  ctx.strokeText(num, 0, 22);
  ctx.fillText(num, 0, 22);
  ctx.restore();
}

function drawLives() {
  const size = 20;
  const gap = 10;
  const total = state.maxLives;
  const startX = W - 28 - (size * 2 + gap) * total + (size * 2 + gap);
  const y = 42;
  for (let i = 0; i < total; i++) {
    const filled = i < state.lives;
    const x = startX + i * (size * 2 + gap);
    drawHeart(x, y, size, filled);
  }
}

function drawHeart(x, y, s, filled) {
  ctx.save();
  ctx.fillStyle = filled ? "#e44957" : "rgba(180, 120, 120, 0.35)";
  ctx.strokeStyle = "rgba(70,35,35,0.45)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.45);
  ctx.bezierCurveTo(x - s * 0.55, y - s * 0.05, x - s * 0.35, y - s * 0.65, x, y - s * 0.35);
  ctx.bezierCurveTo(x + s * 0.35, y - s * 0.65, x + s * 0.55, y - s * 0.05, x, y + s * 0.45);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function centerText(text, y) {
  ctx.fillStyle = "rgba(0,0,0,0.72)";
  ctx.font = "700 34px Trebuchet MS";
  const w = ctx.measureText(text).width;
  ctx.fillText(text, (W - w) / 2, y);
}

function roundRect(x, y, w, h, r, fill = false) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
  if (fill) ctx.fill();
}

function render() {
  drawBackground();
  drawBoss();
  drawSofa();
  drawWarnings();

  for (const o of obstacles) drawObstacle(o);
  for (const s of spiders) drawSpider(s);
  drawBossShots();
  drawExplosions();
  drawBooba();
  drawLevelBanner();
  drawLives();
  drawHudOverlay();
}

let last = performance.now();
function loop(now) {
  const dt = Math.min((now - last) / 1000, 0.033);
  last = now;

  update(dt);
  render();

  requestAnimationFrame(loop);
}

function jump() {
  if (state.paused) return;
  if (!state.running) {
    reset();
    return;
  }
  if (booba.y >= FLOOR - 1 && isBoobaSupported()) {
    booba.vy = -booba.jumpPower;
  }
}

function setDuck(value) {
  booba.ducking = value && booba.y >= FLOOR - 1;
}

function togglePause() {
  if (!state.running || state.gameOver) return;
  state.paused = !state.paused;
  if (state.paused) {
    booba.movingLeft = false;
    booba.movingRight = false;
    booba.ducking = false;
    statusEl.textContent = "Пауза. Нажми P или Esc, чтобы продолжить.";
  } else {
    statusEl.textContent = "Беги!";
  }
}

window.addEventListener("keydown", (e) => {
  if (["KeyP", "Escape"].includes(e.code)) {
    e.preventDefault();
    togglePause();
    return;
  }
  if (state.paused) return;
  if (["Space", "ArrowUp", "KeyW"].includes(e.code)) {
    e.preventDefault();
    jump();
  }
  if (["ArrowLeft", "KeyA"].includes(e.code)) {
    e.preventDefault();
    booba.movingLeft = true;
  }
  if (["ArrowRight", "KeyD"].includes(e.code)) {
    e.preventDefault();
    booba.movingRight = true;
  }
  if (["ArrowDown", "KeyS"].includes(e.code)) {
    e.preventDefault();
    setDuck(true);
  }
});

window.addEventListener("keyup", (e) => {
  if (["ArrowLeft", "KeyA"].includes(e.code)) {
    e.preventDefault();
    booba.movingLeft = false;
  }
  if (["ArrowRight", "KeyD"].includes(e.code)) {
    e.preventDefault();
    booba.movingRight = false;
  }
  if (["ArrowDown", "KeyS"].includes(e.code)) {
    e.preventDefault();
    setDuck(false);
  }
});

canvas.addEventListener("pointerdown", () => jump());

for (const btn of touchButtons) {
  const action = btn.dataset.action;
  if (!action) continue;

  btn.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    if (action === "left") booba.movingLeft = true;
    if (action === "right") booba.movingRight = true;
    if (action === "duck") setDuck(true);
    if (action === "jump") jump();
    if (action === "pause") togglePause();
  });

  btn.addEventListener("pointerup", (e) => {
    e.preventDefault();
    if (action === "left") booba.movingLeft = false;
    if (action === "right") booba.movingRight = false;
    if (action === "duck") setDuck(false);
  });

  btn.addEventListener("pointercancel", () => {
    if (action === "left") booba.movingLeft = false;
    if (action === "right") booba.movingRight = false;
    if (action === "duck") setDuck(false);
  });

  btn.addEventListener("pointerleave", () => {
    if (action === "left") booba.movingLeft = false;
    if (action === "right") booba.movingRight = false;
    if (action === "duck") setDuck(false);
  });
}

bestEl.textContent = String(state.best);
requestAnimationFrame(loop);
