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
  dot(v) {
    return this.x * v.x + this.y * v.y;
  }
  dist(v) {
    return Math.hypot(this.x - v.x, this.y - v.y);
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
    const angle = Math.random() * Math.PI * 2;
    return new Vector(Math.cos(angle), Math.sin(angle));
  }
}

class PathMock {
  constructor(radius = 25) {
    this.radius = radius;
    this.points = [
      new Vector(100, 100),
      new Vector(500, 100),
      new Vector(500, 500),
      new Vector(100, 500)
    ];
  }
  addPoint(x, y) {
    this.points.push(new Vector(x, y));
  }
}

function loadNavigationEnvironment() {
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
    BOTTOM: 'bottom',
    frameCount: 0,
    width: 1200,
    height: 800,
    debug: false
  });

  const files = [
    '../vehicle.js',
    '../playerRobot.js',
    '../battery.js',
    '../repairModule.js',
    '../obstacle.js',
    '../maintenanceDrone.js',
    '../securityDrone.js'
  ];

  for (const file of files) {
    vm.runInContext(readFileSync(new URL(file, import.meta.url), 'utf8'), scope);
  }

  return vm.runInContext('({ Vehicle, PlayerRobot, Battery, RepairModule, Obstacle, MaintenanceDrone, SecurityDrone })', scope);
}

test('1. boundaries() : confinement et répulsion des limites de station', () => {
  const { PlayerRobot, MaintenanceDrone } = loadNavigationEnvironment();
  const robot = new PlayerRobot(50, 400, 4, 0.3); // Bord gauche (x = 50 < 35 + 25 = 60)
  robot.vel.set(-2, 0);

  robot.boundaries(35, 35, 1165, 765, 25);
  assert.ok(robot.acc.x > 0, 'La force de boundaries doit repousser vers la droite depuis le bord gauche');

  // Test pour MaintenanceDrone
  const drone = new MaintenanceDrone(1155, 400, 3, 0.25); // Bord droit
  drone.vel.set(2, 0);
  drone.boundaries(35, 35, 1165, 765, 25);
  assert.ok(drone.acc.x < 0, 'La force de boundaries doit repousser vers la gauche depuis le bord droit');
});

test('2. followPath(path) : anticipation et projection sur le chemin de circulation', () => {
  const { PlayerRobot, MaintenanceDrone } = loadNavigationEnvironment();
  const path = new PathMock(20);

  const drone = new MaintenanceDrone(100, 200, 4, 0.3); // Hors de la route (y = 200, segment à y = 100)
  drone.vel.set(3, 0);

  const pathForce = drone.followPath(path);
  assert.ok(Number.isFinite(pathForce.x) && Number.isFinite(pathForce.y));
  assert.ok(pathForce.mag() > 0, 'followPath doit générer une force de correction quand le véhicule est hors circuit');
  assert.ok(pathForce.mag() <= drone.maxForce + 1e-4);
});

test('3. separate(neighbors) : répulsion spatiale proportionnelle à la distance', () => {
  const { Vehicle, PlayerRobot } = loadNavigationEnvironment();
  const robot = new PlayerRobot(200, 200, 4, 0.3);
  robot.vel.set(0, 0);

  const neighborVeryClose = new Vehicle(210, 200, 2, 0.2); // Distance 10 < desiredseparation (36)
  const sepForce = robot.separate([neighborVeryClose]);

  assert.ok(sepForce.x < 0, 'La séparation doit repousser le véhicule à l opposé du voisin proche');
  assert.ok(sepForce.mag() <= robot.maxForce + 1e-4);

  // Voisin éloigné : aucune force
  const neighborFar = new Vehicle(400, 200, 2, 0.2);
  const sepForceZero = robot.separate([neighborFar]);
  assert.equal(sepForceZero.mag(), 0, 'Aucune force de séparation si les voisins sont hors portée');
});

test('4. avoidObstacles(obstacles) : anticipation par sonde ahead et déviation latérale', () => {
  const { PlayerRobot, Obstacle } = loadNavigationEnvironment();
  const robot = new PlayerRobot(200, 200, 4, 0.3);
  robot.vel.set(3, 0); // Vitesse vers la droite

  const obstacleDirectAhead = new Obstacle(280, 200, 26, null, 'pillar'); // En plein dans la trajectoire
  const avoidForce = robot.avoidObstacles([obstacleDirectAhead]);

  assert.ok(avoidForce.mag() > 0, 'avoidObstacles doit détecter l obstacle devant et générer une force');
  // Comme l'obstacle est dans l'axe, la force doit dévier latéralement (composante Y non nulle)
  assert.ok(Math.abs(avoidForce.y) > 0 || avoidForce.x < 0, 'La force d évitement doit corriger la trajectoire');
  assert.ok(avoidForce.mag() <= robot.maxForce * 1.6 + 1e-4);

  // Obstacle derrière : aucun risque
  const obstacleBehind = new Obstacle(100, 200, 26, null, 'pillar');
  const avoidBehind = robot.avoidObstacles([obstacleBehind]);
  assert.equal(avoidBehind.mag(), 0, 'Aucun évitement pour un obstacle situé derrière le vecteur vitesse');
});

test('5. avoidVehicles(neighbors) : Unaligned collision avoidance basé sur vitesse relative', () => {
  const { PlayerRobot, SecurityDrone } = loadNavigationEnvironment();

  // Robot joueur avançant vers la droite
  const player = new PlayerRobot(200, 300, 4, 0.3);
  player.vel.set(3, 0);

  // Drone hostile venant en sens inverse sur la même ligne (collision frontale imminente)
  const hostile = new SecurityDrone(350, 300, 4, 0.3);
  hostile.vel.set(-3, 0);

  const collisionAvoidForce = player.avoidVehicles([hostile]);
  assert.ok(collisionAvoidForce.mag() > 0, 'avoidVehicles doit anticiper la collision frontale imminente');

  // Si les véhicules s éloignent l un de l autre : pas de collision future
  player.vel.set(-3, 0); // Fuit vers la gauche
  hostile.vel.set(3, 0);  // Fuit vers la droite
  const noCollisionForce = player.avoidVehicles([hostile]);
  assert.equal(noCollisionForce.mag(), 0, 'avoidVehicles ne doit pas déclencher d alerte si les trajectoires divergent');
});

test('6. Priorité des forces : l urgence d évitement prime sur la consigne vers la cible', () => {
  const { PlayerRobot, Obstacle } = loadNavigationEnvironment();
  const robot = new PlayerRobot(200, 200, 4, 0.3);
  robot.vel.set(3, 0);

  const target = new Vector(600, 200); // Cible tout droit
  const obstacleInWay = new Obstacle(270, 200, 26, null, 'pillar'); // Obstacle barrant la route

  robot.followTarget(target, 'arrive', [obstacleInWay], []);

  // L accélération résultante doit comporter une déviation d évitement et ne pas foncer tout droit
  assert.ok(Math.abs(robot.acc.y) > 0 || robot.acc.x < 0.2, 'L évitement prioritaire doit infléchir l accélération');
});
