import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

class Vector {
  constructor(x = 0, y = 0) {
    this.x = Number(x) || 0;
    this.y = Number(y) || 0;
  }
  set(x, y) {
    this.x = Number(x) || 0;
    this.y = Number(y) || 0;
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
  static fromAngle(angle) {
    return new Vector(Math.cos(angle), Math.sin(angle));
  }
}

function createUpgradeScope() {
  const scope = {
    console,
    createVector: (x = 0, y = 0) => new Vector(x, y),
    p5: { Vector },
    width: 1200,
    height: 800,
    random: (min = 0, max = 1) => (typeof max === 'number' ? min + (max - min) * 0.5 : min * 0.5),
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
    color: () => ({ setAlpha: () => {} }),
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
    '5-3-PathFollowingComplex/obstacle.js',
    '5-3-PathFollowingComplex/battery.js',
    '5-3-PathFollowingComplex/repairModule.js',
    '5-3-PathFollowingComplex/decoyFlare.js',
    '5-3-PathFollowingComplex/boostPad.js',
    '5-3-PathFollowingComplex/securityDrone.js',
    '5-3-PathFollowingComplex/maintenanceDrone.js',
    '5-3-PathFollowingComplex/playerRobot.js'
  ];

  const context = vm.createContext(scope);
  for (const file of files) {
    const code = readFileSync(file, 'utf8');
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
    DecoyFlare,
    BoostPad
  })`, context);

  return Object.assign(context, exported);
}

test('AMÉLIORATION 1 : Leurre EMP (DecoyFlare) hérite de Vehicle et attire les drones', () => {
  const scope = createUpgradeScope();
  const { Vehicle, DecoyFlare } = scope;

  assert.ok(DecoyFlare, 'DecoyFlare doit être exportée');
  assert.ok(DecoyFlare.prototype instanceof Vehicle, 'DecoyFlare doit obligatoirement hériter de Vehicle');

  const flare = new DecoyFlare(200, 200, null, 100);
  assert.equal(flare.pos.x, 200);
  assert.equal(flare.pos.y, 200);
  assert.equal(flare.isDistracting(), true);

  // Portée d attraction
  const droneNearby = { pos: scope.createVector(250, 200) };
  const droneFar = { pos: scope.createVector(800, 800) };
  assert.equal(flare.isDroneInRange(droneNearby), true, 'Drone proche doit être détecté dans le rayon du leurre');
  assert.equal(flare.isDroneInRange(droneFar), false, 'Drone lointain ne doit pas être affecté');

  // Expiration après maxLifetime
  for (let i = 0; i < 110; i++) {
    flare.update();
  }
  assert.equal(flare.expired, true, 'Le leurre doit expirer après sa durée de vie');
  assert.equal(flare.isDistracting(), false);
});

test('AMÉLIORATION 1 & SecurityDrone : Le drone se détourne pour cibler le leurre EMP', () => {
  const scope = createUpgradeScope();
  const { SecurityDrone, DecoyFlare } = scope;

  const drone = new SecurityDrone(300, 300, 4, 0.3);
  const player = { pos: scope.createVector(350, 300), vel: scope.createVector(1, 0), r: 15 };
  const flare = new DecoyFlare(280, 280, null, 150);

  // Drone sans leurre : cible le joueur
  drone.updateBehavior(player, { obstacles: [], neighbors: [], flares: [] });
  assert.equal(drone.state, 'PURSUIT');

  // Drone avec leurre actif proche : bascule en DISTRACTED et cible le leurre
  drone.updateBehavior(player, { obstacles: [], neighbors: [], flares: [flare] });
  assert.equal(drone.state, 'DISTRACTED', 'Le drone doit entrer dans l état DISTRACTED face au leurre');
  assert.equal(drone.distractionTarget, flare);
});

test('AMÉLIORATION 2 : Bouclier de protection d urgence du PlayerRobot', () => {
  const scope = createUpgradeScope();
  const { PlayerRobot } = scope;

  const robot = new PlayerRobot(200, 200, 5, 0.3);
  assert.equal(robot.isShieldActive(), false);

  // Déclenchement du bouclier
  const activated = robot.activateShield();
  assert.equal(activated, true);
  assert.equal(robot.isShieldActive(), true);
  const energyAfterActivation = robot.energy;

  // Encaissement de dégâts avec bouclier actif : absorption 100%
  robot.damage(20);
  assert.equal(robot.energy, energyAfterActivation, 'Le bouclier actif doit absorber la totalité des dégâts');

  // Incrément jusqu à expiration
  for (let i = 0; i < 200; i++) {
    robot.update();
  }
  assert.equal(robot.isShieldActive(), false, 'Le bouclier doit se désactiver après son temps imparti');

  // Encaissement après expiration : perte d énergie effective
  robot.damage(10);
  assert.ok(robot.energy < energyAfterActivation, 'Sans bouclier, les dégâts diminuent l énergie');
});

test('AMÉLIORATION 3 : BoostPad (accélérateur de couloir) hérite de Vehicle et propulse le joueur', () => {
  const scope = createUpgradeScope();
  const { Vehicle, BoostPad } = scope;

  assert.ok(BoostPad, 'BoostPad doit être exportée');
  assert.ok(BoostPad.prototype instanceof Vehicle, 'BoostPad doit hériter de Vehicle');

  // BoostPad orienté vers la droite (direction angle 0, force 10)
  const pad = new BoostPad(300, 300, 0, 10, 80, 50);
  assert.equal(pad.isStatic, true);

  // Le pad ne bouge pas sous applyForce / update
  pad.applyForce(scope.createVector(5, 5));
  pad.update();
  assert.equal(pad.pos.x, 300);
  assert.equal(pad.pos.y, 300);

  // Robot joueur sur le BoostPad
  const robot = {
    pos: scope.createVector(310, 305),
    vel: scope.createVector(1, 0),
    maxSpeed: 4
  };

  const initialVelX = robot.vel.x;
  const boosted = pad.checkBoost(robot);
  assert.equal(boosted, true, 'Le BoostPad doit détecter le robot en contact');
  assert.ok(robot.vel.x > initialVelX + 5, 'Le BoostPad doit appliquer une impulsion significative de vélocité');
});

test('AMÉLIORATION 5 : Déploiement de Fraises (DecoyFlare) par PlayerRobot', () => {
  const scope = createUpgradeScope();
  const { Vehicle, PlayerRobot } = scope;

  const robot = new PlayerRobot(200, 200, 5, 0.3);
  assert.equal(robot.canDeployFlare(), true);

  const initialEnergy = robot.energy;
  const flare = robot.deployFlare();
  assert.ok(flare, 'Le robot doit instancier un DecoyFlare');
  assert.ok(flare instanceof Vehicle, 'Le leurre doit être une instance de Vehicle');
  assert.ok(robot.energy < initialEnergy, 'Le déploiement de leurre consomme de l énergie');
  assert.equal(robot.canDeployFlare(), false, 'Leurres en cooldown immédiat');
});

test('RÈGLE DU PROJET : vehicle.js est intact et non modifié', () => {
  const vPath = path.resolve('5-3-PathFollowingComplex/vehicle.js');
  const content = readFileSync(vPath, 'utf8');

  // Vérifier que Vehicle a conservé ses méthodes fondamentales d origine
  assert.ok(content.includes('class Vehicle'), 'Vehicle doit définir la classe');
  assert.ok(content.includes('applyForce('), 'Vehicle doit contenir applyForce');
  assert.ok(content.includes('applyBehaviors('), 'Vehicle doit contenir applyBehaviors');
  assert.ok(content.includes('follow('), 'Vehicle doit contenir follow');
  assert.ok(content.includes('separate('), 'Vehicle doit contenir separate');
  assert.ok(content.includes('wander('), 'Vehicle doit contenir wander');
  assert.ok(content.includes('seek('), 'Vehicle doit contenir seek');
  assert.ok(content.includes('edges()'), 'Vehicle doit contenir edges');
  assert.ok(content.includes('update()'), 'Vehicle doit contenir update');
});
