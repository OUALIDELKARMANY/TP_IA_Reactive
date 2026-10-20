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
  static dist(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }
}

function loadSpaceStation() {
  const scope = vm.createContext({
    p5: { Vector },
    createVector: (x, y) => new Vector(x, y),
    PI: Math.PI,
    TWO_PI: Math.PI * 2,
    min: Math.min,
    max: Math.max,
    constrain: (n, low, high) => Math.max(low, Math.min(high, n)),
    map: (val, in_min, in_max, out_min, out_max) => ((val - in_min) * (out_max - out_min)) / (in_max - in_min) + out_min,
    sin: Math.sin,
    cos: Math.cos,
    random: (a, b) => (b === undefined ? a / 2 : (a + b) / 2),
    color: (r, g, b) => `rgb(${r},${g},${b})`,
    push: () => {},
    pop: () => {},
    translate: () => {},
    rotate: () => {},
    stroke: () => {},
    strokeWeight: () => {},
    noStroke: () => {},
    fill: () => {},
    noFill: () => {},
    circle: () => {},
    rect: () => {},
    line: () => {},
    text: () => {},
    textSize: () => {},
    textAlign: () => {},
    rectMode: () => {},
    beginShape: () => {},
    endShape: () => {},
    vertex: () => {},
    CLOSE: 'close',
    CENTER: 'center',
    CORNER: 'corner',
    frameCount: 0,
    width: 1200,
    height: 800
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

test('Battery : collecte unique, recharge énergétique et impossibilité de ré-échantillonnage', () => {
  const { Battery, PlayerRobot } = loadSpaceStation();
  const battery = new Battery(300, 300, 35);
  const robot = new PlayerRobot(500, 500, 4.5, 0.25, 40); // 40 / 100 énergie

  assert.equal(battery.collected, false, 'La batterie doit initialement être non collectée');
  assert.equal(robot.batteriesCollected, 0);

  // 1. Robot trop loin : pas de collecte
  const collectedFar = battery.checkCollection(robot);
  assert.equal(collectedFar, false, 'Pas de collecte si hors de portée');
  assert.equal(battery.collected, false);
  assert.equal(robot.energy, 40);

  // 2. Robot entre dans le rayon de contact
  robot.pos.set(305, 305);
  const collectedNear = battery.checkCollection(robot);
  assert.equal(collectedNear, true, 'La batterie doit être collectée lors du contact');
  assert.equal(battery.collected, true);
  assert.equal(robot.energy, 75, 'L énergie doit être augmentée de 35 (40 + 35 = 75)');
  assert.equal(robot.batteriesCollected, 1, 'Le compteur de batteries doit s incrémenter');

  // 3. Tentative de double collecte : doit être bloquée
  const collectedAgain = battery.checkCollection(robot);
  assert.equal(collectedAgain, false, 'Une batterie déjà collectée ne peut être collectée une seconde fois');
  assert.equal(robot.energy, 75, 'L énergie ne doit pas ré-augmenter');
  assert.equal(robot.batteriesCollected, 1, 'Le compteur ne doit pas être incrémenté deux fois');
});

test('PlayerRobot : jauge d énergie, limitation maximale et consommation en mouvement', () => {
  const { PlayerRobot } = loadSpaceStation();
  const robot = new PlayerRobot(200, 200, 4.5, 0.25, 80);

  assert.equal(robot.maxEnergy, 100, 'La valeur maximale d énergie doit être 100');
  assert.equal(robot.energy, 80);

  // Plafonnement à maxEnergy lors de la recharge
  robot.recharge(50);
  assert.equal(robot.energy, 100, 'L énergie ne doit pas dépasser maxEnergy');

  // Consommation lors du déplacement
  robot.vel.set(4, 0); // Vitesse active de magnitude 4
  robot.update();
  assert.ok(robot.energy < 100, 'Le déplacement doit consommer de l énergie');

  // Pas de passage en dessous de 0
  robot.consumeEnergy(500);
  assert.equal(robot.energy, 0, 'L énergie ne doit jamais devenir négative');
});

test('RepairModule : interaction à portée, besoin d énergie et progression vers 100%', () => {
  const { RepairModule, PlayerRobot } = loadSpaceStation();
  const module = new RepairModule(400, 400, 'Système Oxygène', 30);
  const robot = new PlayerRobot(600, 600, 4.5, 0.25, 50);

  assert.equal(module.integrity, 30);
  assert.equal(module.isRepaired, false);
  assert.equal(module.isRobotInRange(robot), false);

  // 1. Robot hors de portée : impossible de réparer
  const repairedFar = module.performRepair(robot, 10, 5);
  assert.equal(repairedFar, false);
  assert.equal(module.integrity, 30, 'L intégrité ne doit pas changer si hors de portée');
  assert.equal(robot.energy, 50, 'L énergie ne doit pas être débitée');

  // 2. Robot s approche à portée (distance <= 62)
  robot.pos.set(420, 420);
  assert.equal(module.isRobotInRange(robot), true);

  const repairedNear = module.performRepair(robot, 25, 10);
  assert.equal(repairedNear, true);
  assert.equal(module.integrity, 55);
  assert.equal(robot.energy, 40, 'L énergie doit être consommée lors de la réparation');
  assert.equal(module.isRepaired, false);

  // 3. Sans énergie (robot épuisé) : impossible de réparer
  robot.energy = 0;
  const repairedWithoutEnergy = module.performRepair(robot, 20, 5);
  assert.equal(repairedWithoutEnergy, false, 'Impossible de réparer sans énergie');
  assert.equal(module.integrity, 55, 'L intégrité ne doit pas progresser');

  // 4. Achèvement de la réparation jusqu à 100%
  robot.energy = 50;
  module.performRepair(robot, 60, 10);
  assert.equal(module.integrity, 100, 'L intégrité est plafonnée à 100%');
  assert.equal(module.isRepaired, true, 'Le module doit être marqué comme réparé');

  // 5. Module déjà réparé : n accepte plus d intervention
  const repairAlreadyDone = module.performRepair(robot, 10, 5);
  assert.equal(repairAlreadyDone, false);
});

test('Condition de victoire : validation lorsque tous les modules requis sont réparés', () => {
  const { RepairModule } = loadSpaceStation();
  const modules = [
    new RepairModule(200, 200, 'Module 1', 20),
    new RepairModule(400, 200, 'Module 2', 40),
    new RepairModule(600, 200, 'Module 3', 60)
  ];

  // État initial : pas de victoire
  assert.equal(modules.every(m => m.isRepaired), false, 'La condition de victoire ne doit pas être atteinte au départ');

  // Réparation partielle
  modules[0].repair(100);
  modules[1].repair(100);
  assert.equal(modules.every(m => m.isRepaired), false, 'Tous les modules ne sont pas encore réparés');

  // Réparation finale
  modules[2].repair(100);
  assert.equal(modules.every(m => m.isRepaired), true, 'Victoire acquise lorsque 100% des modules sont réparés');
});

test('Héritage impératif de Vehicle et immobilité des entités statiques du jeu', () => {
  const { Vehicle, Battery, RepairModule, Obstacle } = loadSpaceStation();

  const bat = new Battery(100, 100);
  const mod = new RepairModule(200, 200);
  const obs = new Obstacle(300, 300, 20);

  assert.ok(bat instanceof Vehicle, 'Battery doit hériter de Vehicle');
  assert.ok(mod instanceof Vehicle, 'RepairModule doit hériter de Vehicle');
  assert.ok(obs instanceof Vehicle, 'Obstacle doit hériter de Vehicle');

  // Application de force sur objet statique
  bat.applyForce(new Vector(10, 10));
  bat.update();
  assert.equal(bat.pos.x, 100);
  assert.equal(bat.pos.y, 100);
  assert.equal(bat.vel.mag(), 0, 'La batterie doit rester immobile');

  mod.applyForce(new Vector(10, 10));
  mod.update();
  assert.equal(mod.pos.x, 200);
  assert.equal(mod.pos.y, 200);
  assert.equal(mod.vel.mag(), 0, 'Le module de réparation doit rester immobile');
});
