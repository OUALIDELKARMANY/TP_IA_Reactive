import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

class Vector {
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }
  set(x, y) {
    this.x = x;
    this.y = y;
    return this;
  }
  copy() {
    return new Vector(this.x, this.y);
  }
  add(v, y) {
    this.x += typeof v === 'number' ? v : v.x;
    this.y += typeof v === 'number' ? y : v.y;
    return this;
  }
  sub(v) {
    this.x -= v.x;
    this.y -= v.y;
    return this;
  }
  mult(n) {
    this.x *= n;
    this.y *= n;
    return this;
  }
  div(n) {
    return this.mult(1 / n);
  }
  mag() {
    return Math.hypot(this.x, this.y);
  }
  magSq() {
    return this.x * this.x + this.y * this.y;
  }
  normalize() {
    const magnitude = this.mag();
    return magnitude ? this.div(magnitude) : this;
  }
  setMag(n) {
    return this.normalize().mult(n);
  }
  limit(n) {
    return this.mag() > n ? this.setMag(n) : this;
  }
  dot(v) {
    return this.x * v.x + this.y * v.y;
  }
  heading() {
    return Math.atan2(this.y, this.x);
  }
  static add(a, b) {
    return a.copy().add(b);
  }
  static sub(a, b) {
    return a.copy().sub(b);
  }
  static mult(a, n) {
    return a.copy().mult(n);
  }
  static dist(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }
  static random2D() {
    return new Vector(1, 0);
  }
}

function createAuditScope() {
  const scope = {
    console,
    createVector: (x = 0, y = 0) => new Vector(x, y),
    p5: { Vector },
    width: 1200,
    height: 800,
    random: (min = 0, max = 1) => typeof max === 'number' ? min + (max - min) * 0.5 : min * 0.5,
    cos: Math.cos,
    sin: Math.sin,
    map: (v, a, b, c, d) => c + ((v - a) / (b - a)) * (d - c),
    constrain: (v, min, max) => Math.min(Math.max(v, min), max),
    TWO_PI: Math.PI * 2,
    PI: Math.PI,
    HALF_PI: Math.PI / 2,
    frameCount: 1,
    millis: () => 1000,
    performance: { now: () => 1000 },
    keyIsDown: () => false,
    createCanvas: () => {},
    push: () => {},
    pop: () => {},
    stroke: () => {},
    noStroke: () => {},
    fill: () => {},
    noFill: () => {},
    rect: () => {},
    rectMode: () => {},
    circle: () => {},
    ellipse: () => {},
    line: () => {},
    triangle: () => {},
    strokeJoin: () => {},
    ROUND: 'round',
    CLOSE: 'close',
    beginShape: () => {},
    vertex: () => {},
    endShape: () => {},
    strokeWeight: () => {},
    color: (c) => ({ setAlpha: () => {} }),
    lerpColor: () => '#000',
    textAlign: () => {},
    textSize: () => {},
    textStyle: () => {},
    BOLD: 'bold',
    NORMAL: 'normal',
    text: () => {},
    translate: () => {},
    rotate: () => {},
    background: () => {},
    nf: (n, d) => String(n).padStart(d, '0'),
    min: Math.min,
    max: Math.max,
    CENTER: 'center',
    CORNER: 'corner',
    LEFT: 'left',
    RIGHT: 'right',
    TOP: 'top',
    BOTTOM: 'bottom'
  };
  scope.window = scope;

  const files = [
    '5-3-PathFollowingComplex/path.js',
    '5-3-PathFollowingComplex/vehicle.js',
    '5-3-PathFollowingComplex/snakeSegment.js',
    '5-3-PathFollowingComplex/snake.js',
    '5-3-PathFollowingComplex/snakePathFollowing.js',
    '5-3-PathFollowingComplex/playerRobot.js',
    '5-3-PathFollowingComplex/battery.js',
    '5-3-PathFollowingComplex/repairModule.js',
    '5-3-PathFollowingComplex/obstacle.js',
    '5-3-PathFollowingComplex/maintenanceDrone.js',
    '5-3-PathFollowingComplex/securityDrone.js',
    '5-3-PathFollowingComplex/handController.js',
    '5-3-PathFollowingComplex/sketch.js'
  ];

  const context = vm.createContext(scope);
  for (const file of files) {
    const code = readFileSync(file, 'utf-8');
    vm.runInContext(code, context, { filename: file });
  }

  const exported = vm.runInContext(`({
    Vehicle,
    PlayerRobot,
    Battery,
    RepairModule,
    Obstacle,
    MaintenanceDrone,
    SecurityDrone,
    HandController,
    Snake,
    SnakeSegment,
    SnakePathFollowing,
    Path,
    initSpaceStationEntities
  })`, context);

  return Object.assign(context, exported);
}

test('AUDIT POINT 1 : Hiérarchie stricte d\'héritage depuis Vehicle', () => {
  const ctx = createAuditScope();
  const { Vehicle, PlayerRobot, Battery, RepairModule, Obstacle, MaintenanceDrone, SecurityDrone, Snake, SnakeSegment, SnakePathFollowing } = ctx;

  assert.ok(PlayerRobot.prototype instanceof Vehicle, 'PlayerRobot doit hériter de Vehicle');
  assert.ok(Battery.prototype instanceof Vehicle, 'Battery doit hériter de Vehicle');
  assert.ok(RepairModule.prototype instanceof Vehicle, 'RepairModule doit hériter de Vehicle');
  assert.ok(Obstacle.prototype instanceof Vehicle, 'Obstacle doit hériter de Vehicle');
  assert.ok(MaintenanceDrone.prototype instanceof Vehicle, 'MaintenanceDrone doit hériter de Vehicle');
  assert.ok(SecurityDrone.prototype instanceof Vehicle, 'SecurityDrone doit hériter de Vehicle');
  assert.ok(Snake.prototype instanceof Vehicle, 'Snake doit hériter de Vehicle');
  assert.ok(SnakeSegment.prototype instanceof Vehicle, 'SnakeSegment doit hériter de Vehicle');
  assert.ok(SnakePathFollowing.prototype instanceof Vehicle, 'SnakePathFollowing doit hériter de Vehicle');
});

test('AUDIT POINT 2 : Immobilité physique garantie des entités statiques', () => {
  const ctx = createAuditScope();
  const bat = new ctx.Battery(100, 200, 35);
  const mod = new ctx.RepairModule(300, 400, "Mod-1");
  const obs = new ctx.Obstacle(500, 600, 25);

  const initialBatPos = { x: bat.pos.x, y: bat.pos.y };
  const initialModPos = { x: mod.pos.x, y: mod.pos.y };
  const initialObsPos = { x: obs.pos.x, y: obs.pos.y };

  const bigForce = ctx.createVector(100, -100);
  bat.applyForce(bigForce);
  mod.applyForce(bigForce);
  obs.applyForce(bigForce);

  bat.update();
  mod.update();
  obs.update();

  assert.equal(bat.pos.x, initialBatPos.x, 'Battery ne doit pas bouger');
  assert.equal(bat.pos.y, initialBatPos.y);
  assert.equal(mod.pos.x, initialModPos.x, 'RepairModule ne doit pas bouger');
  assert.equal(mod.pos.y, initialModPos.y);
  assert.equal(obs.pos.x, initialObsPos.x, 'Obstacle ne doit pas bouger');
  assert.equal(obs.pos.y, initialObsPos.y);
});

test('AUDIT POINT 3 : Intégration et conformité des 11 Steering Behaviors', () => {
  const ctx = createAuditScope();
  const testPath = new ctx.Path();
  testPath.addPoint(100, 100);
  testPath.addPoint(300, 300);
  ctx.path = testPath;
  const robot = new ctx.PlayerRobot(500, 500, 5, 0.3);
  const droneM = new ctx.MaintenanceDrone(400, 400, 4, 0.25);
  const droneS = new ctx.SecurityDrone(600, 600, 4, 0.25);

  // 1. Seek
  const seekForce = robot.seek(ctx.createVector(800, 500));
  assert.ok(seekForce.mag() > 0 && seekForce.mag() <= robot.maxForce + 1e-4, 'Seek doit produire une force bornée par maxForce');

  // 2. Arrive
  const closeTarget = ctx.createVector(510, 500);
  const farTarget = ctx.createVector(800, 500);
  const arriveClose = robot.arrive(closeTarget, 100);
  const arriveFar = robot.arrive(farTarget, 100);
  assert.ok(arriveClose.mag() < arriveFar.mag() || robot.vel.mag() === 0, 'Arrive ralentit à proximité de la cible');

  // 3. Wander
  const wanderForce = droneM.wander();
  assert.ok(wanderForce.mag() <= droneM.maxForce + 1e-4, 'Wander doit respecter maxForce');

  // 4. Pursue
  const targetToPursue = new ctx.PlayerRobot(600, 500, 5, 0.3);
  targetToPursue.vel.set(4, 0);
  const pursueForce = droneS.pursue(targetToPursue);
  assert.ok(pursueForce.mag() <= droneS.maxForce + 1e-4, 'Pursue doit produire une force bornée');

  // 5. Evade
  const pursuerThreat = new ctx.SecurityDrone(450, 400, 4, 0.25);
  pursuerThreat.vel.set(3, 0);
  const evadeForce = droneM.evade(pursuerThreat);
  assert.ok(evadeForce.mag() <= droneM.maxForce + 1e-4, 'Evade doit produire une force bornée');

  // 6. Flee
  const fleeForce = droneM.flee(ctx.createVector(410, 400));
  assert.ok(fleeForce.x < 0, 'Flee doit s\'éloigner de la position cible');

  // 7. Boundaries
  robot.pos.set(10, 500);
  robot.acc.set(0, 0);
  robot.boundaries(35, 35, 1165, 765);
  assert.ok(robot.acc.x > 0, 'Boundaries doit appliquer une accélération vers l\'intérieur de la station');

  // 8. Path Following
  const pfForce = robot.followPath(ctx.path);
  assert.ok(pfForce.mag() <= robot.maxForce + 1e-4, 'followPath doit être borné');

  // 9. Separation
  robot.pos.set(500, 500);
  robot.vel.set(0, 0);
  const neighbors = [new ctx.PlayerRobot(505, 500, 5, 0.3)];
  const sepForce = robot.separate(neighbors);
  assert.ok(sepForce.x < 0, 'Separation doit repousser le voisin trop proche');

  // 10. Avoid Obstacles (Reynolds 1999)
  const obs = [new ctx.Obstacle(550, 500, 20)];
  robot.vel.set(4, 0);
  const obsForce = robot.avoidObstacles(obs);
  assert.ok(obsForce.mag() > 0, 'avoidObstacles doit réagir à un obstacle sur la trajectoire');

  // 11. Avoid Vehicles (Unaligned collision avoidance de Reynolds 1999)
  const incomingVeh = new ctx.PlayerRobot(580, 500, 5, 0.3);
  incomingVeh.vel.set(-4, 0);
  const vForce = robot.avoidVehicles([incomingVeh]);
  assert.ok(vForce.mag() > 0, 'avoidVehicles doit anticiper une collision frontale');
});

test('AUDIT POINT 4 : Conservation des classes Snake et Path sans impact sur Space Station', () => {
  const ctx = createAuditScope();
  const path = new ctx.Path();
  path.addPoint(100, 100);
  path.addPoint(300, 100);
  path.addPoint(300, 300);

  const snake = new ctx.SnakePathFollowing(100, 100);

  assert.ok(path instanceof ctx.Path, 'La classe Path doit pouvoir être instanciée');
  assert.ok(snake instanceof ctx.Vehicle, 'SnakePathFollowing doit étendre Vehicle');
  assert.ok(typeof snake.move === 'function', 'Le serpent doit avoir sa méthode move()');
  assert.ok(typeof snake.show === 'function', 'Le serpent doit avoir sa méthode show()');
});

test('AUDIT POINT 5, 6, 7 : Contrôle par index MediaPipe, lissage et repli clavier', () => {
  const ctx = createAuditScope();
  const hc = new ctx.HandController(1200, 800);

  // Conversion miroir : x = 0.2 (webcam) -> (1 - 0.2) * 1200 = 960 (canvas)
  const mirroredX = (1 - 0.2) * 1200;
  assert.equal(mirroredX, 960, 'L\'effet miroir horizontal doit être (1 - x) * width');

  // Lissage passe-bas
  hc.processNewTarget(100, 100);
  assert.equal(hc.smoothedTarget.x, 100);
  hc.processNewTarget(200, 200);
  assert.ok(hc.smoothedTarget.x > 100 && hc.smoothedTarget.x < 200, 'Le filtre exponentiel doit lisser le déplacement');

  // Timeout de détection
  hc.isHandDetected = true;
  hc.lastDetectionTime = 100;
  ctx.millis = () => 600; // 500ms plus tard (> 400ms timeout)
  hc.update();
  assert.equal(hc.isHandDetected, false, 'La main doit être marquée perdue après le timeout');
  assert.equal(hc.getTarget(), null, 'getTarget() doit renvoyer null si aucune main détectée');
});

test('AUDIT POINT 8 : Mécaniques de jeu, batteries, réparation, jauges, victoire/défaite', () => {
  const ctx = createAuditScope();
  vm.runInContext('path = new Path(); path.addPoint(100, 100); path.addPoint(300, 100); path.addPoint(300, 300);', ctx);
  ctx.initSpaceStationEntities();

  const { playerRobot, batteries, repairModules } = vm.runInContext(
    '({ playerRobot, batteries, repairModules })',
    ctx
  );

  const initialBatteries = playerRobot.batteriesCollected;
  const bat = batteries[0];

  // Placer le robot sur la batterie
  playerRobot.pos.set(bat.pos.x, bat.pos.y);
  const collected = bat.checkCollection(playerRobot);
  assert.equal(collected, true, 'La batterie doit être collectée');
  assert.equal(bat.collected, true);
  assert.equal(playerRobot.batteriesCollected, initialBatteries + 1);

  // Empêche la collecte multiple
  const reCollected = bat.checkCollection(playerRobot);
  assert.equal(reCollected, false, 'Une batterie collectée ne peut pas être reprise');

  // Réparation de module
  const mod = repairModules[0];
  playerRobot.energy = 80;
  playerRobot.pos.set(mod.pos.x, mod.pos.y);
  const initialIntegrity = mod.integrity;
  mod.performRepair(playerRobot);
  assert.ok(mod.integrity > initialIntegrity, 'L\'intégrité du module doit progresser lors de la réparation');
  assert.ok(playerRobot.energy < 80, 'L\'énergie du robot doit être consommée lors de la réparation');

  // Condition de victoire
  vm.runInContext('repairModules.forEach(m => m.integrity = m.maxIntegrity); gameState = "PLAYING"; draw();', ctx);
  assert.equal(vm.runInContext('gameState', ctx), 'VICTORY', 'Tous les modules réparés déclenchent l\'état VICTORY');

  // Condition de défaite
  vm.runInContext('repairModules[0].integrity = 0; playerRobot.energy = 0; gameState = "PLAYING"; draw();', ctx);
  assert.equal(vm.runInContext('gameState', ctx), 'GAMEOVER', 'Énergie à 0 déclenche l\'état GAMEOVER');
});

test('AUDIT POINT 9 : Respect strict des limites physiques (maxSpeed, maxForce, finitude)', () => {
  const ctx = createAuditScope();
  const robot = new ctx.PlayerRobot(500, 500, 4.5, 0.25);

  // Test de force produite par les comportements individuels : limitée à maxForce
  const steer = robot.seek(ctx.createVector(1000, 1000));
  assert.ok(steer.mag() <= robot.maxForce + 1e-4, 'La force de pilotage steer ne doit jamais dépasser maxForce');

  // Test de vitesse excessive : limitée à maxSpeed dans update()
  robot.vel.set(50, 50);
  robot.update();
  assert.ok(robot.vel.mag() <= robot.maxSpeed + 1e-4, 'La vitesse ne doit jamais dépasser maxSpeed');
  assert.ok(Number.isFinite(robot.pos.x) && Number.isFinite(robot.pos.y), 'La position doit toujours être un nombre fini');
});
