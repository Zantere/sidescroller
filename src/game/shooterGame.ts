import {
  Application,
  Assets,
  Container,
  Graphics,
  Sprite,
  Text
} from "pixi.js";

type GameMode = "title" | "playing" | "paused" | "stageclear" | "gameover" | "victory";

export type GameSnapshot = {
  mode: GameMode;
  score: number;
  highScore: number;
  stage: number;
  lives: number;
  shields: number;
  wave: number;
  weaponPower: number;
  missileCount: number;
  combo: number;
  rank: string;
  bossHealth: number;
  bossActive: boolean;
  devMode: boolean;
  audioMuted: boolean;
  message: string;
  runSummary: RunSummary;
};

export type ShooterGame = {
  destroy: () => void;
  handleKeyDown: (event: KeyboardEvent) => void;
  handleKeyUp: (event: KeyboardEvent) => void;
};

export type BossMotionValues = {
  pulse: number;
  sway: number;
  lunge: number;
};

type ActorKind = "enemy" | "playerBullet" | "enemyBullet" | "pickup" | "missile" | "hazard";
type EnemyType = "interceptor" | "artillery" | "skimmer" | "bomber" | "boss";
type PickupType = "spread" | "shield" | "option" | "score" | "missile" | "life";
type HazardType = "asteroid" | "plasma";

export type RunSummary = {
  time: number;
  kills: number;
  bosses: number;
  maxCombo: number;
  pickups: number;
  hazardsDodged: number;
  hazardsHit: number;
  stageReached: number;
  finalRank: string;
  result: "In Progress" | "Game Over" | "Victory";
};

type Actor = {
  kind: ActorKind;
  g: Container;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  hp: number;
  age: number;
  baseY?: number;
  enemyType?: EnemyType;
  attackTimer?: number;
  attackStep?: number;
  value?: number;
  damage?: number;
  maxHp?: number;
  stage?: number;
  pickup?: PickupType;
  hazardType?: HazardType;
  counted?: boolean;
  bossSprite?: Sprite;
  bossAura?: Graphics;
  bossTentacles?: Graphics[];
};

type ExhaustParticle = Graphics & {
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  baseScale: number;
};

type PlayerRig = {
  container: Container;
  body: Sprite;
  engineGlow: Graphics;
  muzzleFlash: Graphics;
  exhaustLayer: Container;
  exhaustPool: ExhaustParticle[];
  bodyBaseScaleX: number;
  bodyBaseScaleY: number;
  exhaustCursor: number;
  bank: number;
  targetBank: number;
  recoil: number;
  enginePulse: number;
  hitFlash: number;
  exhaustTimer: number;
  firing: boolean;
};

const WIDTH = 1280;
const HEIGHT = 720;
const PLAYER_X = 165;
const FINAL_COMMON_WAVE = 5;
const WAVE_ENEMY_TARGET = 10;
const WEAPON_POWER_MAX = 5;
const MISSILE_MAX = 3;
const LIVES_MAX = 5;
const SHIELD_MAX = 1;
const SAVE_KEY = "astra-lance-high-score";
const GAME_ASSETS = [
  "/assets/space-background-concept.png",
  "/assets/sprites/player-ship.png",
  "/assets/sprites/enemy-interceptor.png",
  "/assets/sprites/enemy-artillery.png",
  "/assets/sprites/boss-tentacle.png",
  "/assets/sprites/powerup-spread.png",
  "/assets/sprites/powerup-laser.png",
  "/assets/sprites/powerup-shield.png",
  "/assets/sprites/powerup-option.png",
  "/assets/sprites/powerup-missile.png",
  "/assets/sprites/homing-missile.png",
  "/assets/sprites/stage2-skimmer.png",
  "/assets/sprites/stage2-bomber.png",
  "/assets/sprites/stage2-boss.png",
  "/assets/sprites/shield-field.png",
  "/assets/sprites/point-pickup.png",
  "/assets/sprites/hazard-asteroid.png",
  "/assets/sprites/hazard-plasma-vent.png"
];

export async function createShooterGame(
  mount: HTMLElement,
  onSnapshot: (snapshot: GameSnapshot) => void,
  getDevMode: () => boolean,
  getAudioMuted: () => boolean,
  getBossMotion: () => BossMotionValues
): Promise<ShooterGame> {
  const app = new Application();
  await app.init({
    width: WIDTH,
    height: HEIGHT,
    antialias: true,
    backgroundAlpha: 0,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    autoDensity: true
  });

  mount.prepend(app.canvas);
  await Assets.load(GAME_ASSETS);

  const world = new Container();
  const bg = new Container();
  const actorsLayer = new Container();
  const effectsLayer = new Container();
  app.stage.addChild(bg, world);
  world.addChild(actorsLayer, effectsLayer);

  const keys = new Set<string>();
  const actors: Actor[] = [];
  const stars: Graphics[] = [];
  const playerRig = makePlayerRig();
  const player = playerRig.container;
  const shieldField = makeSprite("/assets/sprites/shield-field.png", 132, PLAYER_X, HEIGHT / 2);
  shieldField.alpha = 0;
  actorsLayer.addChild(shieldField, player);

  let mode: GameMode = "title";
  let score = 0;
  let highScore = Number(localStorage.getItem(SAVE_KEY) || 0);
  let stage = 1;
  let lives = 3;
  let shields = 0;
  let wave = 1;
  let weaponPower = 1;
  let bossHealth = 100;
  let bossActive = false;
  let waveEnemiesSpawned = 0;
  let waveEnemyTarget = getWaveEnemyTarget(wave);
  let shotCooldown = 0;
  let spawnTimer = 0;
  let hazardTimer = 2.6;
  let elapsed = 0;
  let invulnerable = 0;
  let spread = false;
  let option = false;
  let missileCount = 0;
  let missileCooldown = 3;
  let shake = 0;
  let combo = 0;
  let comboTimer = 0;
  let rankScore = 0;
  let waveHitTaken = false;
  let waveStartTime = 0;
  let bossStartTime = 0;
  let lastMessage = "Press Enter to launch";
  let runKills = 0;
  let runBosses = 0;
  let runPickups = 0;
  let hazardsDodged = 0;
  let hazardsHit = 0;
  let maxCombo = 0;
  let runResult: RunSummary["result"] = "In Progress";
  const audio = createAudioSystem(getAudioMuted);

  buildBackground(bg, stars);
  publish();
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(mount);
  resize();

  function makePlayerRig(): PlayerRig {
    const container = new Container();
    container.x = PLAYER_X;
    container.y = HEIGHT / 2;

    const exhaustLayer = new Container();
    const engineGlow = new Graphics()
      .circle(0, 0, 18)
      .fill({ color: 0x55e6ff, alpha: 0.72 })
      .circle(0, 0, 9)
      .fill({ color: 0xffffff, alpha: 0.82 });
    engineGlow.x = -44;
    engineGlow.scale.set(1.35, 0.54);
    engineGlow.alpha = 0.42;

    const body = makeSprite("/assets/sprites/player-ship.png", 92, 0, 0);
    const muzzleFlash = new Graphics()
      .circle(0, 0, 8)
      .fill({ color: 0xc9fbff, alpha: 0.8 })
      .rect(0, -2, 24, 4)
      .fill({ color: 0x55e6ff, alpha: 0.64 });
    muzzleFlash.x = 46;
    muzzleFlash.alpha = 0;

    const exhaustPool: ExhaustParticle[] = [];
    for (let i = 0; i < 42; i += 1) {
      const particle = new Graphics()
        .circle(0, 0, 5)
        .fill({ color: i % 3 === 0 ? 0xffffff : 0x55e6ff, alpha: 0.8 }) as ExhaustParticle;
      particle.visible = false;
      particle.vx = 0;
      particle.vy = 0;
      particle.life = 0;
      particle.maxLife = 0;
      particle.baseScale = 1;
      exhaustPool.push(particle);
      exhaustLayer.addChild(particle);
    }

    container.addChild(exhaustLayer, engineGlow, body, muzzleFlash);
    return {
      container,
      body,
      engineGlow,
      muzzleFlash,
      exhaustLayer,
      exhaustPool,
      bodyBaseScaleX: body.scale.x,
      bodyBaseScaleY: body.scale.y,
      exhaustCursor: 0,
      bank: 0,
      targetBank: 0,
      recoil: 0,
      enginePulse: 0,
      hitFlash: 0,
      exhaustTimer: 0,
      firing: false
    };
  }

  function makeSprite(path: string, width: number, x: number, y: number) {
    const sprite = Sprite.from(path);
    sprite.anchor.set(0.5);
    sprite.width = width;
    sprite.scale.y = sprite.scale.x;
    sprite.x = x;
    sprite.y = y;
    return sprite;
  }

  function resetPlayerRig() {
    playerRig.bank = 0;
    playerRig.targetBank = 0;
    playerRig.recoil = 0;
    playerRig.enginePulse = 0;
    playerRig.hitFlash = 0;
    playerRig.exhaustTimer = 0;
    playerRig.firing = false;
    playerRig.body.x = 0;
    playerRig.body.y = 0;
    playerRig.body.rotation = 0;
    playerRig.body.scale.set(playerRig.bodyBaseScaleX, playerRig.bodyBaseScaleY);
    playerRig.engineGlow.alpha = 0.42;
    playerRig.muzzleFlash.alpha = 0;
    playerRig.exhaustPool.forEach((particle) => {
      particle.visible = false;
      particle.life = 0;
      particle.alpha = 0;
    });
  }

  function buildBackground(layer: Container, starList: Graphics[]) {
    const concept = Sprite.from("/assets/space-background-concept.png");
    concept.width = WIDTH;
    concept.height = HEIGHT;
    concept.alpha = 0.34;
    layer.addChild(concept);

    layer.addChild(
      new Graphics()
        .rect(0, 0, WIDTH, HEIGHT)
        .fill({ color: 0x07111e, alpha: 0.62 })
        .rect(0, HEIGHT * 0.52, WIDTH, HEIGHT * 0.48)
        .fill({ color: 0x1d0f22, alpha: 0.34 })
    );

    for (let i = 0; i < 150; i += 1) {
      const star = new Graphics();
      const r = 1 + Math.random() * 2.2;
      star.circle(0, 0, r).fill({ color: 0xffffff, alpha: 0.25 + Math.random() * 0.6 });
      star.x = Math.random() * WIDTH;
      star.y = Math.random() * HEIGHT;
      star.alpha = 0.3 + Math.random() * 0.7;
      starList.push(star);
      layer.addChild(star);
    }

    for (let i = 0; i < 7; i += 1) {
      const ridge = new Graphics();
      ridge.rect(0, 0, 180 + Math.random() * 180, 18 + Math.random() * 46).fill({
        color: 0x12202f,
        alpha: 0.72
      });
      ridge.x = i * 210 + Math.random() * 80;
      ridge.y = HEIGHT - 74 - Math.random() * 46;
      layer.addChild(ridge);
    }
  }

  function resetRun() {
    actors.splice(0).forEach((actor) => actor.g.destroy());
    score = 0;
    stage = 1;
    lives = 3;
    shields = 0;
    wave = 1;
    weaponPower = 1;
    bossHealth = 100;
    bossActive = false;
    waveEnemiesSpawned = 0;
    waveEnemyTarget = getWaveEnemyTarget(wave);
    shotCooldown = 0;
    spawnTimer = 0;
    hazardTimer = 2.6;
    elapsed = 0;
    invulnerable = 1.4;
    spread = false;
    option = false;
    missileCount = 0;
    missileCooldown = 3;
    shake = 0;
    combo = 0;
    comboTimer = 0;
    rankScore = 0;
    waveHitTaken = false;
    waveStartTime = 0;
    bossStartTime = 0;
    runKills = 0;
    runBosses = 0;
    runPickups = 0;
    hazardsDodged = 0;
    hazardsHit = 0;
    maxCombo = 0;
    runResult = "In Progress";
    player.x = PLAYER_X;
    player.y = HEIGHT / 2;
    resetPlayerRig();
    shieldField.x = player.x;
    shieldField.y = player.y;
    shieldField.alpha = 0;
    mode = "playing";
    lastMessage = "Break through the alien defense line.";
    audio.start();
    audio.play("start");
    publish();
  }

  function publish() {
    onSnapshot({
      mode,
      score,
      highScore,
      stage,
      lives,
      shields,
      wave,
      weaponPower,
      missileCount,
      combo,
      rank: getRank(),
      bossHealth,
      bossActive,
      devMode: getDevMode(),
      audioMuted: getAudioMuted(),
      message: lastMessage,
      runSummary: getRunSummary()
    });
  }

  function getRunSummary(): RunSummary {
    return {
      time: Math.max(0, elapsed),
      kills: runKills,
      bosses: runBosses,
      maxCombo,
      pickups: runPickups,
      hazardsDodged,
      hazardsHit,
      stageReached: stage,
      finalRank: getRank(),
      result: runResult
    };
  }

  function saveScore() {
    if (score > highScore) {
      highScore = score;
      localStorage.setItem(SAVE_KEY, String(highScore));
    }
  }

  function spawnEnemy(y = 90 + Math.random() * (HEIGHT - 180), type: EnemyType = chooseEnemyType()) {
    const isArtillery = type === "artillery";
    const isSkimmer = type === "skimmer";
    const isBomber = type === "bomber";
    const asset = isSkimmer
      ? "/assets/sprites/stage2-skimmer.png"
      : isBomber
        ? "/assets/sprites/stage2-bomber.png"
        : isArtillery
          ? "/assets/sprites/enemy-artillery.png"
          : "/assets/sprites/enemy-interceptor.png";
    const spriteWidth = isBomber ? 100 : isArtillery ? 92 : isSkimmer ? 74 : 68;
    const g = makeSprite(
      asset,
      spriteWidth,
      WIDTH + (isArtillery || isBomber ? 76 : 42),
      y
    );
    addActor({
      kind: "enemy",
      g,
      x: g.x,
      y,
      vx: isBomber ? -76 - wave * 5 : isArtillery ? -88 - wave * 7 : isSkimmer ? -185 - wave * 18 : -210 - wave * 26,
      vy: 0,
      radius: isBomber ? 46 : isArtillery ? 42 : isSkimmer ? 30 : 27,
      hp: isBomber ? 9 + wave : isArtillery ? 7 + Math.floor(wave / 2) : isSkimmer ? 4 + Math.floor(wave / 2) : 2 + Math.floor(wave / 3),
      age: 0,
      baseY: y,
      enemyType: type,
      attackTimer: isBomber ? 1.05 : isArtillery ? 1.2 : 0.65,
      attackStep: 0,
      value: isBomber ? 390 : isArtillery ? 330 : isSkimmer ? 220 : 140,
      stage
    });
  }

  function chooseEnemyType(): EnemyType {
    if (stage === 2) {
      return Math.random() > 0.48 ? "bomber" : "skimmer";
    }
    return Math.random() > 0.62 || wave >= 4 ? "artillery" : "interceptor";
  }

  function spawnBoss() {
    bossActive = true;
    bossHealth = 100;
    bossStartTime = elapsed;
    lastMessage = stage === 1 ? "Boss signal locked." : "Stage 2 boss signal locked.";
    audio.play("boss");
    actors
      .filter((actor) => (actor.kind === "enemy" && actor.enemyType !== "boss") || actor.kind === "hazard")
      .forEach((actor) => {
        actor.hp = 0;
      });
    const maxHp = stage === 1 ? 720 : 1100;
    const bossBundle = makeBossSprite(WIDTH + 210, HEIGHT / 2);
    addActor({
      kind: "enemy",
      g: bossBundle.container,
      x: bossBundle.container.x,
      y: HEIGHT / 2,
      vx: -70,
      vy: 0,
      radius: stage === 1 ? 118 : 132,
      hp: maxHp,
      age: 0,
      baseY: HEIGHT / 2,
      enemyType: "boss",
      attackTimer: 1.15,
      attackStep: 0,
      value: stage === 1 ? 5000 : 8000,
      maxHp,
      stage,
      bossSprite: bossBundle.sprite,
      bossAura: bossBundle.aura,
      bossTentacles: bossBundle.tentacles
    });
    publish();
  }

  function makeBossSprite(x: number, y: number) {
    const container = new Container();
    const aura = new Graphics();
    const tentacles = stage === 1 ? makeBossTentacles() : [];
    const boss = makeSprite(stage === 1 ? "/assets/sprites/boss-tentacle.png" : "/assets/sprites/stage2-boss.png", stage === 1 ? 360 : 410, 0, 0);
    aura.circle(0, 0, stage === 1 ? 122 : 0).fill({ color: 0xd85cff, alpha: stage === 1 ? 0.12 : 0 });
    container.addChild(aura);
    tentacles.forEach((tentacle) => container.addChild(tentacle));
    container.addChild(boss);
    container.x = x;
    container.y = y;
    return { container, sprite: boss, aura, tentacles };
  }

  function makeBossTentacles() {
    return [-1, 1].map((side) =>
      new Graphics()
        .moveTo(-58, side * 52)
        .bezierCurveTo(-118, side * 84, -154, side * 120, -206, side * 94)
        .stroke({ color: 0x9b4dff, width: 10, alpha: 0.42 })
        .moveTo(-60, side * 35)
        .bezierCurveTo(-112, side * 42, -166, side * 70, -226, side * 42)
        .stroke({ color: 0xff5cff, width: 5, alpha: 0.36 })
    );
  }

  function addActor(actor: Actor) {
    actor.g.x = actor.x;
    actor.g.y = actor.y;
    actors.push(actor);
    actorsLayer.addChild(actor.g);
  }

  function spawnBullet(x: number, y: number, vx: number, vy: number, enemy = false) {
    const g = new Graphics();
    g.circle(0, 0, enemy ? 6 : 5).fill(enemy ? 0xffbd5c : 0x55e6ff);
    if (!enemy) {
      g.rect(-7, -2, 16, 4).fill(0xc9fbff);
    }
    addActor({
      kind: enemy ? "enemyBullet" : "playerBullet",
      g,
      x,
      y,
      vx,
      vy,
      radius: enemy ? 7 : 6,
      hp: 1,
      age: 0,
      damage: enemy ? 1 : weaponPower
    });
    if (!enemy) {
      audio.play("shoot");
    }
  }

  function spawnBossOrb(x: number, y: number, vx: number, vy: number) {
    const g = new Graphics();
    g.circle(0, 0, 10).fill(0xd85cff);
    g.circle(0, 0, 4).fill(0xffffff);
    addActor({
      kind: "enemyBullet",
      g,
      x,
      y,
      vx,
      vy,
      radius: 12,
      hp: 1,
      age: 0
    });
  }

  function spawnMine(x: number, y: number, vx: number, vy: number) {
    const g = new Graphics();
    g.circle(0, 0, 11).fill(0xff6a2a);
    g.circle(0, 0, 5).fill(0x2b0b08);
    g.stroke({ color: 0xffbd5c, width: 2, alpha: 0.75 });
    addActor({
      kind: "enemyBullet",
      g,
      x,
      y,
      vx,
      vy,
      radius: 13,
      hp: 1,
      age: 0
    });
  }

  function spawnHazard() {
    if (bossActive) {
      return;
    }
    const type: HazardType = stage === 2 && Math.random() > 0.42 ? "plasma" : "asteroid";
    if (type === "plasma") {
      spawnPlasmaVent();
      return;
    }
    const radius = 28 + Math.random() * 22;
    const g = makeSprite("/assets/sprites/hazard-asteroid.png", radius * 2.8, WIDTH + radius + 24, 72 + Math.random() * (HEIGHT - 144));
    addActor({
      kind: "hazard",
      g,
      x: g.x,
      y: g.y,
      vx: -175 - wave * 13 - stage * 18,
      vy: Math.random() * 58 - 29,
      radius: radius * 0.82,
      hp: 1,
      age: 0,
      hazardType: "asteroid"
    });
  }

  function spawnPlasmaVent() {
    const y = Math.random() > 0.5 ? 70 : HEIGHT - 70;
    const direction = y < HEIGHT / 2 ? 1 : -1;
    const g = makeSprite("/assets/sprites/hazard-plasma-vent.png", 74, WIDTH + 34, y);
    addActor({
      kind: "hazard",
      g,
      x: g.x,
      y: g.y,
      vx: -145 - wave * 10,
      vy: direction * (32 + Math.random() * 28),
      radius: 44,
      hp: 1,
      age: 0,
      hazardType: "plasma"
    });
  }

  function spawnPickup(x: number, y: number, forcedPickup?: PickupType) {
    const types = getAvailablePickupTypes();
    const pickup = forcedPickup && types.includes(forcedPickup) ? forcedPickup : types[Math.floor(Math.random() * types.length)];
    const pickupAssets: Record<PickupType, string> = {
      spread: "/assets/sprites/powerup-spread.png",
      shield: "/assets/sprites/powerup-shield.png",
      option: "/assets/sprites/powerup-option.png",
      score: "/assets/sprites/point-pickup.png",
      missile: "/assets/sprites/powerup-missile.png",
      life: "/assets/sprites/point-pickup.png"
    };
    const pickupAsset = pickupAssets[pickup];
    const g = makeSprite(pickupAsset, 42, x, y);
    addActor({
      kind: "pickup",
      g,
      x,
      y,
      vx: -105,
      vy: Math.random() * 24 - 12,
      radius: 18,
      hp: 1,
      age: 0,
      pickup
    });
  }

  function getAvailablePickupTypes(): PickupType[] {
    const types: PickupType[] = [];
    if (shields < SHIELD_MAX) {
      types.push("shield");
    }
    if (lives < LIVES_MAX) {
      types.push("life");
    }
    if (weaponPower < WEAPON_POWER_MAX) {
      if (!spread) {
        types.push("spread");
      }
      if (!option) {
        types.push("option");
      }
      if (missileCount < MISSILE_MAX) {
        types.push("missile");
      }
    }
    return types.length > 0 ? types : ["score"];
  }

  function spawnHomingMissile() {
    if (missileCount <= 0) {
      return;
    }
    for (let i = 0; i < missileCount; i += 1) {
      const offset = (i - (missileCount - 1) / 2) * 24;
      const g = makeSprite("/assets/sprites/homing-missile.png", 42, player.x + 42, player.y + 18 + offset);
      addActor({
        kind: "missile",
        g,
        x: g.x,
        y: g.y,
        vx: 260,
        vy: offset * 3,
        radius: 13,
        hp: 1,
        age: 0,
        damage: 4
      });
    }
    audio.play("missile");
  }

  function handlePlayerFire(dt: number) {
    shotCooldown -= dt;
    if (!keys.has("Space") || shotCooldown > 0) {
      return;
    }
    shotCooldown = 0.14;
    playerRig.recoil = 1;
    playerRig.enginePulse = Math.max(playerRig.enginePulse, 1);
    spawnBullet(player.x + 36, player.y, 560, 0);
    if (spread) {
      spawnBullet(player.x + 28, player.y - 10, 520, -150);
      spawnBullet(player.x + 28, player.y + 10, 520, 150);
    }
    if (option) {
      spawnBullet(player.x - 24, player.y + 34, 500, 0);
    }
  }

  function handleSecondaryFire(dt: number) {
    if (missileCount <= 0) {
      return;
    }
    missileCooldown -= dt;
    if (missileCooldown <= 0) {
      missileCooldown = 3;
      spawnHomingMissile();
    }
  }

  function handleSpawns(dt: number) {
    elapsed += dt;
    handleHazards(dt);
    if (bossActive) {
      return;
    }

    const commonEnemiesAlive = actors.some((actor) => actor.kind === "enemy" && actor.enemyType !== "boss");
    if (waveEnemiesSpawned >= waveEnemyTarget && !commonEnemiesAlive) {
      if (wave >= FINAL_COMMON_WAVE) {
        spawnBoss();
      } else {
        awardWaveBonuses();
        wave += 1;
        waveEnemiesSpawned = 0;
        waveEnemyTarget = getWaveEnemyTarget(wave);
        spawnTimer = 1;
        waveHitTaken = false;
        waveStartTime = elapsed;
        lastMessage = `Wave ${wave} entering.`;
        publish();
      }
      return;
    }

    if (waveEnemiesSpawned >= waveEnemyTarget) {
      return;
    }

    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      spawnTimer = Math.max(0.28, 0.86 - wave * 0.07);
      spawnEnemy();
      waveEnemiesSpawned += 1;
      if (waveEnemiesSpawned < waveEnemyTarget && (wave > 2 || stage === 2) && Math.random() > 0.32) {
        spawnEnemy(90 + Math.random() * (HEIGHT - 180), stage === 2 ? "skimmer" : "interceptor");
        waveEnemiesSpawned += 1;
      }
    }
  }

  function handleHazards(dt: number) {
    if (mode !== "playing" || bossActive) {
      return;
    }
    hazardTimer -= dt;
    if (hazardTimer <= 0) {
      hazardTimer = Math.max(1.35, 3.3 - wave * 0.22 - stage * 0.28) + Math.random() * 0.9;
      spawnHazard();
      if (stage === 2 && wave >= 3 && Math.random() > 0.68) {
        hazardTimer = Math.min(hazardTimer, 0.72);
      }
    }
  }

  function updateEnemies(dt: number) {
    for (const actor of actors) {
      actor.age += dt;
      if (actor.kind === "enemy") {
        updateEnemyPattern(actor, dt);
      }
    }
  }

  function updateMissiles(dt: number) {
    for (const missile of actors.filter((actor) => actor.kind === "missile")) {
      const target = findNearestEnemy(missile);
      if (target) {
        const dx = target.x - missile.x;
        const dy = target.y - missile.y;
        const len = Math.max(1, Math.hypot(dx, dy));
        const turn = Math.min(1, dt * 4.6);
        const speed = 360;
        missile.vx = lerp(missile.vx, (dx / len) * speed, turn);
        missile.vy = lerp(missile.vy, (dy / len) * speed, turn);
        missile.g.rotation = Math.atan2(missile.vy, missile.vx);
      }
    }
  }

  function findNearestEnemy(source: Actor) {
    let best: Actor | undefined;
    let bestDistance = Infinity;
    for (const enemy of actors) {
      if (enemy.kind !== "enemy") {
        continue;
      }
      const d = distance(source.x, source.y, enemy.x, enemy.y);
      if (d < bestDistance) {
        best = enemy;
        bestDistance = d;
      }
    }
    return best;
  }

  function updateEnemyPattern(actor: Actor, dt: number) {
    actor.attackTimer = (actor.attackTimer || 0) - dt;
    if (actor.enemyType === "interceptor") {
      actor.vy = Math.sin(actor.age * 5.2) * 145;
      actor.g.rotation = Math.sin(actor.age * 5.2) * 0.12;
      if ((actor.attackTimer || 0) <= 0 && actor.x < WIDTH - 40 && actor.x > 280) {
        actor.attackTimer = Math.max(0.46, 1.05 - wave * 0.06);
        aimedShot(actor, 235 + wave * 10);
      }
      return;
    }

    if (actor.enemyType === "artillery") {
      actor.vy = Math.sin(actor.age * 1.4) * 38;
      actor.g.rotation = Math.sin(actor.age * 1.4) * 0.05;
      if ((actor.attackTimer || 0) <= 0 && actor.x < WIDTH - 60 && actor.x > 360) {
        actor.attackTimer = Math.max(1.1, 1.85 - wave * 0.05);
        const speed = 190 + wave * 8;
        spawnBullet(actor.x - 34, actor.y, -speed, -95, true);
        spawnBullet(actor.x - 38, actor.y, -speed - 25, 0, true);
        spawnBullet(actor.x - 34, actor.y, -speed, 95, true);
      }
      return;
    }

    if (actor.enemyType === "skimmer") {
      actor.vy = Math.sign(Math.sin(actor.age * 3.8)) * 115;
      actor.g.rotation = Math.sin(actor.age * 7.6) * 0.18;
      if ((actor.attackTimer || 0) <= 0 && actor.x < WIDTH - 70 && actor.x > 280) {
        actor.attackTimer = 0.78;
        const vertical = Math.sin(actor.age * 2.5) > 0 ? 135 : -135;
        spawnBullet(actor.x - 24, actor.y, -270, vertical, true);
      }
      return;
    }

    if (actor.enemyType === "bomber") {
      actor.vy = Math.sin(actor.age * 1.1) * 30;
      actor.g.rotation = Math.sin(actor.age * 0.9) * 0.04;
      if ((actor.attackTimer || 0) <= 0 && actor.x < WIDTH - 70 && actor.x > 330) {
        actor.attackTimer = 1.35;
        spawnMine(actor.x - 24, actor.y + 34, -150, 95);
        spawnMine(actor.x - 12, actor.y - 24, -120, -80);
      }
      return;
    }

    if (actor.enemyType === "boss") {
      actor.vx = actor.x > WIDTH - 210 ? -62 : 0;
      actor.vy = Math.sin(actor.age * 1.25) * 56;
      actor.g.rotation = Math.sin(actor.age * 0.9) * 0.035;
      if ((actor.attackTimer || 0) <= 0 && actor.x < WIDTH - 80) {
        actor.attackStep = ((actor.attackStep || 0) + 1) % 3;
        actor.attackTimer = actor.attackStep === 2 ? 1.35 : 0.82;
        if (actor.stage === 2) {
          if (actor.attackStep === 0) {
            bossCrystalSpiral(actor);
          } else {
            bossLavaMines(actor);
          }
        } else if (actor.attackStep === 0) {
          bossFan(actor);
        } else if (actor.attackStep === 1) {
          bossTentacleSweep(actor, -1);
        } else {
          bossTentacleSweep(actor, 1);
        }
      }
    }
  }

  function applyFirstBossMotion(actor: Actor) {
    const motion = getBossMotion();
    const pulseScale = 1 + motion.pulse * 0.045;
    const lungeOffset = -motion.lunge * 34;
    actor.g.scale.set(pulseScale, 1 + motion.pulse * 0.025);
    actor.g.x = actor.x + lungeOffset + motion.sway * 5;
    actor.g.y = actor.y + motion.sway * 8;
    actor.bossSprite?.scale.set(1 + motion.pulse * 0.035, 1 - motion.pulse * 0.018);
    if (actor.bossAura) {
      actor.bossAura.scale.set(1.05 + motion.pulse * 0.22 + motion.lunge * 0.18);
      actor.bossAura.alpha = 0.2 + motion.pulse * 0.24 + motion.lunge * 0.2;
    }
    actor.bossTentacles?.forEach((tentacle, index) => {
      const side = index === 0 ? -1 : 1;
      tentacle.x = -motion.lunge * 24 + motion.sway * 12;
      tentacle.y = side * motion.sway * 10;
      tentacle.rotation = side * (motion.sway * 0.16 + motion.lunge * 0.12);
      tentacle.alpha = 0.34 + motion.pulse * 0.26;
    });
  }

  function aimedShot(actor: Actor, speed: number) {
    const dx = player.x - actor.x;
    const dy = player.y - actor.y;
    const len = Math.max(1, Math.hypot(dx, dy));
    spawnBullet(actor.x - 24, actor.y, (dx / len) * speed, (dy / len) * speed, true);
  }

  function bossFan(actor: Actor) {
    for (let i = -2; i <= 2; i += 1) {
      spawnBossOrb(actor.x - 135, actor.y + i * 12, -245, i * 58);
    }
  }

  function bossTentacleSweep(actor: Actor, direction: -1 | 1) {
    for (let i = 0; i < 7; i += 1) {
      const y = direction < 0 ? HEIGHT - 82 - i * 72 : 82 + i * 72;
      spawnBossOrb(actor.x - 180 + i * 8, y, -185 - i * 10, direction * (120 - i * 18));
    }
    shake = Math.max(shake, 0.16);
  }

  function bossCrystalSpiral(actor: Actor) {
    for (let i = 0; i < 10; i += 1) {
      const angle = actor.age * 1.2 + i * 0.62;
      spawnBossOrb(actor.x - 150, actor.y, -210 + Math.cos(angle) * 70, Math.sin(angle) * 165);
    }
  }

  function bossLavaMines(actor: Actor) {
    for (let i = 0; i < 6; i += 1) {
      spawnMine(actor.x - 130, 85 + i * 108, -115 - i * 12, Math.sin(i) * 70);
    }
    shake = Math.max(shake, 0.2);
  }

  function updatePlayer(dt: number) {
    const focus = keys.has("ShiftLeft") || keys.has("ShiftRight");
    const speed = focus ? 230 : 385;
    const dx = (keys.has("ArrowRight") || keys.has("KeyD") ? 1 : 0) - (keys.has("ArrowLeft") || keys.has("KeyA") ? 1 : 0);
    const dy = (keys.has("ArrowDown") || keys.has("KeyS") ? 1 : 0) - (keys.has("ArrowUp") || keys.has("KeyW") ? 1 : 0);
    const len = Math.hypot(dx, dy) || 1;
    player.x = clamp(player.x + (dx / len) * speed * dt, 40, WIDTH - 64);
    player.y = clamp(player.y + (dy / len) * speed * dt, 42, HEIGHT - 42);
    invulnerable = Math.max(0, invulnerable - dt);
    updatePlayerAnimation(dt, dx, dy, focus);
    shieldField.x = player.x;
    shieldField.y = player.y;
    shieldField.rotation += dt * 0.8;
    shieldField.alpha = shields > 0 ? 0.62 + Math.sin(elapsed * 7) * 0.12 : 0;
  }

  function updatePlayerAnimation(dt: number, dx: number, dy: number, focus: boolean) {
    const moving = Math.abs(dx) + Math.abs(dy) > 0;
    playerRig.firing = keys.has("Space");
    playerRig.targetBank = clamp(dy * 0.28 + dx * 0.08, -0.34, 0.34);
    playerRig.bank = lerp(playerRig.bank, playerRig.targetBank, Math.min(1, dt * 9));
    playerRig.recoil = Math.max(0, playerRig.recoil - dt * 6.8);
    playerRig.hitFlash = invulnerable > 0 ? Math.max(playerRig.hitFlash, 0.55 + Math.sin(elapsed * 38) * 0.22) : Math.max(0, playerRig.hitFlash - dt * 5);
    playerRig.enginePulse = lerp(playerRig.enginePulse, moving || playerRig.firing ? 1 : 0.38, Math.min(1, dt * 7));

    const focusSquash = focus ? 0.96 : 1;
    const recoilOffset = playerRig.recoil * -8;
    const bob = Math.sin(elapsed * 10) * (moving ? 2.1 : 1.1);
    const thrust = playerRig.enginePulse + Math.sin(elapsed * 24) * 0.08;
    player.rotation = playerRig.bank;
    player.alpha = invulnerable > 0 ? 0.64 + Math.sin(elapsed * 38) * 0.18 : 1;
    playerRig.body.x = recoilOffset;
    playerRig.body.y = bob + dy * 2;
    playerRig.body.rotation = playerRig.bank * 0.45;
    playerRig.body.scale.set(
      playerRig.bodyBaseScaleX * (1 + playerRig.recoil * 0.035),
      playerRig.bodyBaseScaleY * (focusSquash - Math.abs(playerRig.bank) * 0.035)
    );
    playerRig.body.tint = playerRig.hitFlash > 0.5 ? 0xc9fbff : 0xffffff;
    playerRig.engineGlow.x = -47 + recoilOffset * 0.35;
    playerRig.engineGlow.y = 1 + bob * 0.4;
    playerRig.engineGlow.scale.set(1.1 + thrust * 0.55, 0.38 + thrust * 0.18);
    playerRig.engineGlow.alpha = 0.22 + thrust * 0.32 + playerRig.recoil * 0.2;
    playerRig.muzzleFlash.alpha = playerRig.recoil > 0 ? playerRig.recoil * 0.92 : 0;
    playerRig.muzzleFlash.scale.set(0.75 + playerRig.recoil * 0.7, 0.8 + playerRig.recoil * 0.25);

    playerRig.exhaustTimer -= dt;
    if (playerRig.exhaustTimer <= 0 && (moving || playerRig.firing || playerRig.enginePulse > 0.5)) {
      playerRig.exhaustTimer = playerRig.firing ? 0.036 : 0.055;
      spawnExhaustParticle(thrust, dy);
    }
    updateExhaustParticles(dt);
  }

  function spawnExhaustParticle(thrust: number, dy: number) {
    const particle = playerRig.exhaustPool[playerRig.exhaustCursor];
    playerRig.exhaustCursor = (playerRig.exhaustCursor + 1) % playerRig.exhaustPool.length;
    particle.visible = true;
    particle.x = -54 + Math.random() * 8;
    particle.y = Math.random() * 16 - 8;
    particle.vx = -72 - thrust * 86 - Math.random() * 46;
    particle.vy = dy * -18 + Math.random() * 42 - 21;
    particle.life = 0.26 + Math.random() * 0.16;
    particle.maxLife = particle.life;
    particle.baseScale = 0.45 + Math.random() * 0.55;
    particle.alpha = 0.68;
    particle.scale.set(particle.baseScale);
  }

  function updateExhaustParticles(dt: number) {
    for (const particle of playerRig.exhaustPool) {
      if (!particle.visible) {
        continue;
      }
      particle.life -= dt;
      if (particle.life <= 0) {
        particle.visible = false;
        particle.alpha = 0;
        continue;
      }
      const t = particle.life / particle.maxLife;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.alpha = t * 0.58;
      particle.scale.set(particle.baseScale * (0.45 + (1 - t) * 1.7));
    }
  }

  function updateActors(dt: number) {
    for (const actor of actors) {
      actor.x += actor.vx * dt;
      actor.y += actor.vy * dt;
      actor.g.x = actor.x;
      actor.g.y = actor.y;
      if (actor.kind === "enemy" && actor.enemyType === "boss" && actor.stage === 1) {
        applyFirstBossMotion(actor);
      }
      if (actor.kind === "pickup") {
        actor.g.rotation += dt * 2.5;
      }
      if (actor.kind === "hazard") {
        actor.g.rotation += actor.hazardType === "plasma" ? Math.sin(actor.age * 8) * dt * 0.7 : dt * 1.15;
        if (!actor.counted && actor.x < PLAYER_X - 90) {
          actor.counted = true;
          hazardsDodged += 1;
        }
      }
    }
    for (let i = actors.length - 1; i >= 0; i -= 1) {
      const actor = actors[i];
      if (actor.x < -180 || actor.x > WIDTH + 220 || actor.y < -160 || actor.y > HEIGHT + 160 || actor.hp <= 0) {
        actor.g.destroy();
        actors.splice(i, 1);
      }
    }
  }

  function updateCollisions() {
    for (const bullet of actors.filter((actor) => actor.kind === "playerBullet" || actor.kind === "missile")) {
      const blockingHazard = actors.find((actor) => actor.kind === "hazard" && hit(bullet, actor));
      if (blockingHazard) {
        bullet.hp = 0;
        hazardImpact(bullet, blockingHazard);
        continue;
      }
      for (const enemy of actors.filter((actor) => actor.kind === "enemy")) {
        if (hit(bullet, enemy)) {
          bullet.hp = 0;
          const isBoss = enemy.enemyType === "boss";
          const weakPointHit = isBoss && hitBossWeakPoint(bullet, enemy);
          const baseDamage = bullet.damage || 1;
          const damage = weakPointHit ? baseDamage * 2 : baseDamage;
          enemy.hp -= damage;
          if (weakPointHit) {
            score += 150 * Math.max(1, getComboMultiplier());
            rankScore += 8;
            audio.play("weak");
          }
          burst(
            weakPointHit ? getBossWeakPoint(enemy).x : enemy.x,
            weakPointHit ? getBossWeakPoint(enemy).y : enemy.y,
            weakPointHit ? 0xff5cff : 0xffbd5c
          );
          if (isBoss) {
            bossHealth = Math.max(0, (enemy.hp / (enemy.maxHp || 1)) * 100);
          }
          if (enemy.hp <= 0) {
            registerKill(enemy);
            if (!isBoss && Math.random() > 0.78) {
              spawnPickup(enemy.x, enemy.y);
            }
            if (isBoss) {
              awardBossBonus();
              runBosses += 1;
              if (stage === 1) {
                clearStageOne();
              } else {
                mode = "victory";
                runResult = "Victory";
                lastMessage = `Leviathan core shattered. Final score ${score}.`;
                saveScore();
                audio.play("victory");
                publish();
              }
            }
          }
        }
      }
    }

    for (const actor of actors) {
      if ((actor.kind === "enemy" || actor.kind === "enemyBullet" || actor.kind === "hazard") && distance(player.x, player.y, actor.x, actor.y) < actor.radius + 21) {
        damagePlayer(actor);
      }
      if (actor.kind === "pickup" && distance(player.x, player.y, actor.x, actor.y) < actor.radius + 24) {
        collect(actor);
      }
    }
  }

  function clearStageOne() {
    actors.splice(0).forEach((actor) => actor.g.destroy());
    bossActive = false;
    bossHealth = 100;
    mode = "stageclear";
    lastMessage = `Stage 1 cleared. Score ${score}.`;
    audio.play("clear");
    publish();
  }

  function startNextStage() {
    actors.splice(0).forEach((actor) => actor.g.destroy());
    stage = 2;
    wave = 1;
    bossActive = false;
    bossHealth = 100;
    waveEnemiesSpawned = 0;
    waveEnemyTarget = getWaveEnemyTarget(wave);
    spawnTimer = 1.4;
    hazardTimer = 2.2;
    invulnerable = Math.max(invulnerable, 2);
    player.x = PLAYER_X;
    player.y = HEIGHT / 2;
    resetPlayerRig();
    shieldField.x = player.x;
    shieldField.y = player.y;
    lastMessage = "Stage 2: the molten crystal belt.";
    mode = "playing";
    waveHitTaken = false;
    waveStartTime = elapsed;
    audio.play("start");
    publish();
  }

  function hitBossWeakPoint(bullet: Actor, boss: Actor) {
    const eye = getBossWeakPoint(boss);
    return distance(bullet.x, bullet.y, eye.x, eye.y) < 30;
  }

  function getBossWeakPoint(boss: Actor) {
    return {
      x: boss.x + (boss.stage === 2 ? -112 : -76),
      y: boss.y + (boss.stage === 2 ? -18 : -4)
    };
  }

  function damagePlayer(source: Actor) {
    if (invulnerable > 0) {
      return;
    }
    if (getDevMode()) {
      if (source.kind === "enemyBullet" || source.kind === "hazard") {
        source.hp = 0;
      }
      burst(player.x, player.y, 0x55e6ff);
      publish();
      return;
    }
    source.hp = 0;
    if (source.kind === "hazard") {
      hazardsHit += 1;
    }
    shake = 0.35;
    combo = 0;
    comboTimer = 0;
    waveHitTaken = true;
    audio.play("hit");
    burst(player.x, player.y, 0x55e6ff);
    if (shields > 0) {
      shields -= 1;
      invulnerable = 1.4;
      publish();
      return;
    }
    lives -= 1;
    invulnerable = 1.4;
    if (lives <= 0) {
      mode = "gameover";
      runResult = "Game Over";
      lastMessage = `Run ended at wave ${wave}. Final score ${score}.`;
      saveScore();
      audio.play("gameover");
    }
    publish();
  }

  function collect(actor: Actor) {
    actor.hp = 0;
    runPickups += 1;
    score += actor.pickup === "score" ? 900 : 180;
    audio.play(actor.pickup === "score" ? "score" : "pickup");
    if (actor.pickup === "shield") {
      shields = Math.min(SHIELD_MAX, shields + 1);
    }
    if (actor.pickup === "life") {
      lives = Math.min(LIVES_MAX, lives + 1);
    }
    if (actor.pickup === "spread") {
      spread = true;
      weaponPower = Math.min(WEAPON_POWER_MAX, weaponPower + 1);
    }
    if (actor.pickup === "option") {
      option = true;
      weaponPower = Math.min(WEAPON_POWER_MAX, weaponPower + 1);
    }
    if (actor.pickup === "missile") {
      missileCount = Math.min(MISSILE_MAX, missileCount + 1);
      missileCooldown = 0.5;
      weaponPower = Math.min(WEAPON_POWER_MAX, weaponPower + 1);
    }
    publish();
  }

  function burst(x: number, y: number, color: number) {
    const spark = new Text({ text: "+", style: { fill: color, fontSize: 26, fontWeight: "800" } });
    spark.anchor.set(0.5);
    spark.x = x;
    spark.y = y;
    effectsLayer.addChild(spark);
    setTimeout(() => spark.destroy(), 120);
  }

  function hazardImpact(projectile: Actor, hazard: Actor) {
    const angle = Math.atan2(projectile.vy || 0, projectile.vx || 1);
    const x = projectile.x - Math.cos(angle) * 8;
    const y = projectile.y - Math.sin(angle) * 8;
    const color = hazard.hazardType === "plasma" ? 0x55e6ff : 0xffbd5c;
    smallExplosion(x, y, color);
    shake = Math.max(shake, projectile.kind === "missile" ? 0.14 : 0.06);
  }

  function smallExplosion(x: number, y: number, color: number) {
    const pieces = 7;
    for (let i = 0; i < pieces; i += 1) {
      const spark = new Graphics();
      const angle = (Math.PI * 2 * i) / pieces + Math.random() * 0.45;
      const speed = 34 + Math.random() * 62;
      const size = 2.4 + Math.random() * 3.2;
      spark.circle(0, 0, size).fill({ color, alpha: 0.9 });
      spark.circle(0, 0, size * 0.42).fill({ color: 0xffffff, alpha: 0.8 });
      spark.x = x;
      spark.y = y;
      effectsLayer.addChild(spark);
      animateSpark(spark, Math.cos(angle) * speed, Math.sin(angle) * speed, 0.22 + Math.random() * 0.14);
    }

    const ring = new Graphics().circle(0, 0, 7).stroke({ color, width: 2.4, alpha: 0.8 });
    ring.x = x;
    ring.y = y;
    effectsLayer.addChild(ring);
    animateSpark(ring, 0, 0, 0.18, true);
  }

  function animateSpark(spark: Graphics, vx: number, vy: number, duration: number, ring = false) {
    let age = 0;
    const update = (ticker: { deltaMS: number }) => {
      const dt = Math.min(0.033, ticker.deltaMS / 1000);
      age += dt;
      const t = Math.min(1, age / duration);
      spark.x += vx * dt;
      spark.y += vy * dt;
      spark.alpha = 1 - t;
      spark.scale.set(ring ? 1 + t * 2.6 : 1 - t * 0.35);
      if (t >= 1) {
        app.ticker.remove(update);
        spark.destroy();
      }
    };
    app.ticker.add(update);
  }

  function registerKill(enemy: Actor) {
    combo += 1;
    maxCombo = Math.max(maxCombo, combo);
    runKills += enemy.enemyType === "boss" ? 0 : 1;
    comboTimer = 3.2;
    const multiplier = getComboMultiplier();
    score += Math.round((enemy.value || 0) * multiplier);
    rankScore += 5 + Math.min(10, combo);
    audio.play(enemy.enemyType === "boss" ? "bossKill" : "kill");
  }

  function getComboMultiplier() {
    return 1 + Math.min(3, Math.floor(combo / 5) * 0.25);
  }

  function awardWaveBonuses() {
    const quickClear = elapsed - waveStartTime <= 28;
    if (!waveHitTaken) {
      score += 1000;
      rankScore += 18;
      audio.play("bonus");
    }
    if (quickClear) {
      score += 650;
      rankScore += 12;
    }
  }

  function awardBossBonus() {
    const fastBoss = elapsed - bossStartTime <= 42;
    if (fastBoss) {
      score += stage === 1 ? 2500 : 4000;
      rankScore += 26;
      audio.play("bonus");
    }
  }

  function getRank() {
    if (rankScore >= 220) {
      return "S";
    }
    if (rankScore >= 160) {
      return "A";
    }
    if (rankScore >= 100) {
      return "B";
    }
    if (rankScore >= 45) {
      return "C";
    }
    return "D";
  }

  function updateBackground(dt: number) {
    stars.forEach((star, index) => {
      star.x -= dt * (18 + (index % 5) * 18);
      if (star.x < -6) {
        star.x = WIDTH + 6;
        star.y = Math.random() * HEIGHT;
      }
    });
    shake = Math.max(0, shake - dt);
    world.x = shake > 0 ? (Math.random() - 0.5) * 10 : 0;
    world.y = shake > 0 ? (Math.random() - 0.5) * 8 : 0;
  }

  function tick(ticker: { deltaMS: number }) {
    const dt = Math.min(0.033, ticker.deltaMS / 1000);
    updateBackground(dt);
    if (mode !== "playing") {
      return;
    }
    updatePlayer(dt);
    comboTimer = Math.max(0, comboTimer - dt);
    if (comboTimer <= 0 && combo > 0) {
      combo = 0;
    }
    handlePlayerFire(dt);
    handleSecondaryFire(dt);
    handleSpawns(dt);
    updateEnemies(dt);
    updateMissiles(dt);
    updateActors(dt);
    updateCollisions();
    if (Math.floor(elapsed * 4) % 4 === 0) {
      publish();
    }
  }

  function onKeyDown(event: KeyboardEvent) {
    keys.add(event.code);
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(event.code)) {
      event.preventDefault();
    }
    if ((event.code === "Enter" || event.key === "Enter") && mode === "stageclear") {
      startNextStage();
      return;
    }
    if ((event.code === "Enter" || event.key === "Enter") && mode !== "playing") {
      resetRun();
    }
    if (event.code === "KeyP" && mode === "playing") {
      mode = "paused";
      lastMessage = "Paused over the star lane.";
      publish();
    } else if (event.code === "KeyP" && mode === "paused") {
      mode = "playing";
      publish();
    }
    if (event.code === "Escape" && mode === "playing") {
      mode = "paused";
      lastMessage = "Paused over the star lane.";
      publish();
    }
  }

  function onKeyUp(event: KeyboardEvent) {
    keys.delete(event.code);
  }

  function resize() {
    const rect = mount.getBoundingClientRect();
    const availableWidth = Math.max(1, rect.width);
    const availableHeight = Math.max(1, rect.height);
    const scale = Math.min(availableWidth / WIDTH, availableHeight / HEIGHT);
    const displayWidth = Math.floor(WIDTH * scale);
    const displayHeight = Math.floor(HEIGHT * scale);
    app.canvas.style.width = `${displayWidth}px`;
    app.canvas.style.height = `${displayHeight}px`;
    app.canvas.style.marginLeft = `${(rect.width - WIDTH * scale) / 2}px`;
    app.canvas.style.marginTop = `${(rect.height - HEIGHT * scale) / 2}px`;
  }

  app.ticker.add(tick);
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("resize", resize);

  return {
    handleKeyDown: onKeyDown,
    handleKeyUp: onKeyUp,
    destroy() {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("resize", resize);
      resizeObserver.disconnect();
      app.ticker.remove(tick);
      app.destroy(true, { children: true, texture: false });
    }
  };
}

function hit(a: Actor, b: Actor) {
  return distance(a.x, a.y, b.x, b.y) < a.radius + b.radius;
}

function distance(ax: number, ay: number, bx: number, by: number) {
  return Math.hypot(ax - bx, ay - by);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function lerp(current: number, target: number, amount: number) {
  return current + (target - current) * amount;
}

function getWaveEnemyTarget(currentWave: number) {
  return WAVE_ENEMY_TARGET;
}

type SoundName =
  | "start"
  | "shoot"
  | "missile"
  | "pickup"
  | "score"
  | "kill"
  | "weak"
  | "hit"
  | "boss"
  | "bossKill"
  | "bonus"
  | "clear"
  | "victory"
  | "gameover";

function createAudioSystem(getMuted: () => boolean) {
  let context: AudioContext | undefined;
  let lastShoot = 0;

  function start() {
    context ??= new AudioContext();
    if (context.state === "suspended") {
      void context.resume();
    }
  }

  function tone(frequency: number, duration: number, type: OscillatorType, gain = 0.04, slideTo?: number) {
    if (!context) {
      return;
    }
    const now = context.currentTime;
    const osc = context.createOscillator();
    const amp = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, now);
    if (slideTo) {
      osc.frequency.exponentialRampToValueAtTime(slideTo, now + duration);
    }
    amp.gain.setValueAtTime(0.0001, now);
    amp.gain.exponentialRampToValueAtTime(gain, now + 0.01);
    amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(amp);
    amp.connect(context.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  function play(name: SoundName) {
    if (getMuted()) {
      return;
    }
    start();
    if (!context) {
      return;
    }
    if (name === "shoot") {
      if (context.currentTime - lastShoot < 0.055) {
        return;
      }
      lastShoot = context.currentTime;
    }
    const patterns: Record<SoundName, () => void> = {
      start: () => tone(330, 0.12, "triangle", 0.05, 660),
      shoot: () => tone(740, 0.045, "square", 0.018, 980),
      missile: () => tone(180, 0.18, "sawtooth", 0.04, 360),
      pickup: () => {
        tone(620, 0.08, "triangle", 0.045, 930);
        setTimeout(() => tone(930, 0.08, "triangle", 0.035, 1240), 45);
      },
      score: () => tone(1100, 0.14, "sine", 0.045, 1500),
      kill: () => tone(190, 0.12, "sawtooth", 0.035, 70),
      weak: () => tone(1250, 0.12, "square", 0.045, 620),
      hit: () => tone(90, 0.22, "sawtooth", 0.07, 45),
      boss: () => tone(70, 0.6, "sawtooth", 0.055, 120),
      bossKill: () => {
        tone(160, 0.18, "sawtooth", 0.06, 70);
        setTimeout(() => tone(420, 0.2, "triangle", 0.045, 720), 90);
      },
      bonus: () => tone(880, 0.16, "triangle", 0.045, 1320),
      clear: () => {
        tone(440, 0.18, "triangle", 0.045, 660);
        setTimeout(() => tone(660, 0.18, "triangle", 0.045, 990), 120);
      },
      victory: () => tone(520, 0.45, "triangle", 0.055, 1040),
      gameover: () => tone(180, 0.5, "sawtooth", 0.055, 55)
    };
    patterns[name]();
  }

  return { play, start };
}
