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
  heading() {
    return Math.atan2(this.y, this.x);
  }
  static add(a, b) {
    return a.copy().add(b);
  }
  static sub(a, b) {
    return a.copy().sub(b);
  }
}

function loadSpaceStation() {
  const scope = vm.createContext({
    p5: { Vector },
    createVector: (x, y) => new Vector(x, y),
    PI: Math.PI,
    TWO_PI: Math.PI * 2,
    HALF_PI: Math.PI / 2,
    QUARTER_PI: Math.PI / 4,
    min: Math.min,
    max: Math.max,
    cos: Math.cos,
    sin: Math.sin,
    random: (a, b) => b === undefined ? a / 2 : (a + b) / 2,
    width: 1200,
    height: 800,
    frameCount: 1,
    push: () => {},
    pop: () => {},
    translate: () => {},
    rotate: () => {},
    stroke: () => {},
    noStroke: () => {},
    strokeWeight: () => {},
    fill: () => {},
    noFill: () => {},
    circle: () => {},
    rect: () => {},
    line: () => {},
    rectMode: () => {},
    textAlign: () => {},
    textSize: () => {},
    text: () => {},
    beginShape: () => {},
    endShape: () => {},
    vertex: () => {},
    CLOSE: 'close',
    CENTER: 'center',
    CORNER: 'corner'
  });

  const files = [
    '../vehicle.js',
    '../playerRobot.js',
    '../battery.js',
    '../repairModule.js',
    '../obstacle.js'
  ];

  for (const file of files) {
    vm.runInContext(readFileSync(new URL(file, import.meta.url), 'utf8'), scope);
  }

  return vm.runInContext('({ Vehicle, PlayerRobot, Battery, RepairModule, Obstacle })', scope);
}

test('Héritage strict : toutes les entités Space Station étendent la classe Vehicle existante', () => {
  const { Vehicle, PlayerRobot, Battery, RepairModule, Obstacle } = loadSpaceStation();

  const robot = new PlayerRobot(600, 400);
  const battery = new Battery(200, 200, 30);
  const mod = new RepairModule(300, 300, 'Test-Mod', 50);
  const pillar = new Obstacle(400, 400, 26, null, 'pillar');
  const wall = new Obstacle(500, 500, 180, 20, 'wall');

  assert.ok(robot instanceof Vehicle, 'PlayerRobot doit hériter de Vehicle');
  assert.ok(battery instanceof Vehicle, 'Battery doit hériter de Vehicle');
  assert.ok(mod instanceof Vehicle, 'RepairModule doit hériter de Vehicle');
  assert.ok(pillar instanceof Vehicle, 'Obstacle (pillar) doit hériter de Vehicle');
  assert.ok(wall instanceof Vehicle, 'Obstacle (wall) doit hériter de Vehicle');
});

test('Locomotion dynamique : PlayerRobot répond à applyForce et update', () => {
  const { PlayerRobot } = loadSpaceStation();
  const robot = new PlayerRobot(100, 100);

  assert.equal(robot.isStatic, false);
  const initialX = robot.pos.x;

  robot.applyForce(new Vector(1, 0));
  assert.equal(robot.acc.x, 1);

  robot.update();
  assert.ok(robot.pos.x > initialX, 'La position du robot doit progresser suite à l accélération');
  assert.equal(robot.acc.mag(), 0, 'L accélération doit être réinitialisée après update');
});

test('Immobilité des objets statiques : Battery, RepairModule et Obstacle restent immobiles', () => {
  const { Battery, RepairModule, Obstacle } = loadSpaceStation();

  const battery = new Battery(200, 200);
  const mod = new RepairModule(300, 300);
  const obstacle = new Obstacle(400, 400, 30);

  const staticEntities = [battery, mod, obstacle];

  for (const entity of staticEntities) {
    assert.equal(entity.isStatic, true, `${entity.constructor.name} doit avoir isStatic=true`);
    const initialPos = { x: entity.pos.x, y: entity.pos.y };

    entity.applyForce(new Vector(10, 10));
    assert.equal(entity.acc.mag(), 0, 'Une entité statique ne doit accumuler aucune force');

    entity.update();
    assert.equal(entity.pos.x, initialPos.x, 'La position X ne doit pas varier');
    assert.equal(entity.pos.y, initialPos.y, 'La position Y ne doit pas varier');
    assert.equal(entity.vel.mag(), 0, 'La vitesse doit rester nulle');
  }
});

test('PlayerRobot : gestion d énergie, orientation et boundaries', () => {
  const { PlayerRobot } = loadSpaceStation();
  const robot = new PlayerRobot(100, 100);

  assert.equal(robot.energy, 100);
  robot.consumeEnergy(25);
  assert.equal(robot.energy, 75);

  robot.recharge(50);
  assert.equal(robot.energy, 100, 'L énergie ne doit pas dépasser maxEnergy');

  // Rotation vers la droite
  robot.vel.set(3, 0);
  robot.update();
  assert.equal(robot.heading, 0);

  // Confinement boundaries près du bord gauche
  robot.pos.set(10, 100);
  robot.boundaries(0, 0, 1200, 800, 25);
  assert.ok(robot.acc.x > 0, 'Boundaries doit appliquer une force vers la droite');
});

test('RepairModule : jauge d intégrité et réparation', () => {
  const { RepairModule } = loadSpaceStation();
  const mod = new RepairModule(100, 100, 'Sas-Alpha', 30);

  assert.equal(mod.integrity, 30);
  assert.equal(mod.isRepaired, false);

  mod.repair(40);
  assert.equal(mod.integrity, 70);
  assert.equal(mod.isRepaired, false);

  mod.repair(50);
  assert.equal(mod.integrity, 100);
  assert.equal(mod.isRepaired, true);
});

test('Obstacle : circularité et dimensions', () => {
  const { Obstacle } = loadSpaceStation();
  const pillar = new Obstacle(100, 100, 25, null, 'pillar');
  assert.equal(pillar.isCircular, true);
  assert.equal(pillar.r, 25);

  const wall = new Obstacle(200, 200, 180, 20, 'wall');
  assert.equal(wall.isCircular, false);
  assert.equal(wall.w, 180);
  assert.equal(wall.h, 20);
});
