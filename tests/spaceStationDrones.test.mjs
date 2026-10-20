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

function loadDroneEnvironment() {
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
    height: 800
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

  return vm.runInContext('({ Vehicle, PlayerRobot, Battery, RepairModule, MaintenanceDrone, SecurityDrone })', scope);
}

test('Héritage strict : MaintenanceDrone et SecurityDrone étendent Vehicle', () => {
  const { Vehicle, MaintenanceDrone, SecurityDrone } = loadDroneEnvironment();

  const mDrone = new MaintenanceDrone(100, 100);
  const sDrone = new SecurityDrone(200, 200);

  assert.ok(mDrone instanceof Vehicle, 'MaintenanceDrone doit hériter de Vehicle');
  assert.ok(sDrone instanceof Vehicle, 'SecurityDrone doit hériter de Vehicle');
  assert.equal(typeof mDrone.update, 'function');
  assert.equal(typeof sDrone.update, 'function');
  assert.equal(typeof mDrone.applyForce, 'function');
  assert.equal(typeof sDrone.applyForce, 'function');
});

test('Wander : génère une force de déambulation limitée sans altérer la physique', () => {
  const { MaintenanceDrone, SecurityDrone } = loadDroneEnvironment();

  const mDrone = new MaintenanceDrone(300, 300, 3, 0.25);
  const sDrone = new SecurityDrone(400, 400, 4, 0.3);

  const forceM = mDrone.wander();
  const forceS = sDrone.wander();

  assert.ok(Number.isFinite(forceM.x) && Number.isFinite(forceM.y));
  assert.ok(Number.isFinite(forceS.x) && Number.isFinite(forceS.y));
  assert.ok(forceM.mag() <= mDrone.maxForce + 1e-4, 'La force wander de MaintenanceDrone doit respecter maxForce');
  assert.ok(forceS.mag() <= sDrone.maxForce + 1e-4, 'La force wander de SecurityDrone doit respecter maxForce');
});

test('Seek et Arrive : comparaison cinématique et décélération progressive', () => {
  const { MaintenanceDrone } = loadDroneEnvironment();
  const drone = new MaintenanceDrone(100, 100, 4, 0.3);
  drone.vel.set(0, 0);

  const targetFar = new Vector(600, 100);
  const targetNear = new Vector(120, 100); // Distance 20 < slowingRadius (80)

  // Seek : cherche toujours maxSpeed
  const forceSeek = drone.seek(targetFar);
  assert.ok(forceSeek.x > 0, 'Seek doit pousser vers la droite');
  assert.ok(forceSeek.mag() <= drone.maxForce + 1e-4);

  // Arrive loin : équivalent à seek
  const forceArriveFar = drone.arrive(targetFar, 80);
  assert.ok(Math.abs(forceArriveFar.mag() - forceSeek.mag()) < 1e-3);

  // Arrive près : la vitesse désirée est atténuée proportionnellement à la distance
  const forceArriveNear = drone.arrive(targetNear, 80);
  assert.ok(forceArriveNear.x > 0);
  assert.ok(forceArriveNear.mag() <= drone.maxForce);
});

test('Pursue : anticipation prédictive de la trajectoire future du robot joueur', () => {
  const { SecurityDrone, PlayerRobot } = loadDroneEnvironment();
  const security = new SecurityDrone(100, 100, 5, 0.4);
  security.vel.set(0, 0);

  const player = new PlayerRobot(200, 100);
  // Le joueur se déplace rapidement vers le bas (vel.y = 4)
  player.vel.set(0, 4);

  const pursueForce = security.pursue(player, 20);

  // La position future doit être anticipée vers le bas (y > 100)
  assert.ok(security.predictedTargetPos.y > player.pos.y, 'La cible prédite doit être devant le joueur (y plus grand)');
  assert.ok(pursueForce.y > 0, 'La force de poursuite doit anticiper et viser vers le bas');
  assert.ok(pursueForce.mag() <= security.maxForce + 1e-4);
});

test('Flee et Evade : répulsion simple et évasion prédictive des drones fragiles', () => {
  const { MaintenanceDrone, SecurityDrone, PlayerRobot } = loadDroneEnvironment();
  const fragile = new MaintenanceDrone(200, 200, 4, 0.3);
  fragile.vel.set(0, 0);

  const threat = new Vector(220, 200); // Menace à droite

  // 1. Flee direct
  const fleeForce = fragile.flee(threat, 100);
  assert.ok(fleeForce.x < 0, 'Flee doit pousser vers la gauche (à l opposé de la menace)');
  assert.ok(fleeForce.mag() <= fragile.maxForce + 1e-4);

  // Flee hors de portée : doit être nul
  const fleeFar = fragile.flee(new Vector(600, 200), 100);
  assert.equal(fleeFar.mag(), 0, 'Flee hors de portée doit renvoyer une force nulle');

  // 2. Evade d un prédateur mobile
  const pursuer = new SecurityDrone(250, 200, 4, 0.3);
  pursuer.vel.set(-3, 0); // Le prédateur fonce vers la gauche

  const evadeForce = fragile.evade(pursuer, 20, 200);
  assert.ok(evadeForce.x < 0, 'Evade doit fuir à l opposé de la trajectoire du poursuivant');
  assert.ok(evadeForce.mag() <= fragile.maxForce + 1e-4);

  // 3. PlayerRobot dispose également des méthodes flee et evade
  const player = new PlayerRobot(300, 300);
  assert.equal(typeof player.flee, 'function');
  assert.equal(typeof player.evade, 'function');
  const playerFlee = player.flee(new Vector(310, 300), 50);
  assert.ok(playerFlee.x < 0);
});

test('Machine à états SecurityDrone : patrouille, engagement en poursuite et hystérésis', () => {
  const { SecurityDrone, PlayerRobot } = loadDroneEnvironment();
  const security = new SecurityDrone(100, 100, 4, 0.3);
  const player = new PlayerRobot(500, 100); // Distance 400 > detectionRadius (220)

  // 1. Joueur éloigné : état PATROL
  security.updateBehavior(player);
  assert.equal(security.state, 'PATROL');
  assert.equal(security.targetPlayer, null);

  // 2. Le joueur entre dans le rayon d engagement (dist = 150 <= 220)
  player.pos.set(250, 100);
  security.updateBehavior(player);
  assert.equal(security.state, 'PURSUIT');
  assert.equal(security.targetPlayer, player);

  // 3. Hystérésis : le joueur s éloigne à 300 px (entre 220 et 340) -> reste en PURSUIT
  player.pos.set(400, 100);
  security.updateBehavior(player);
  assert.equal(security.state, 'PURSUIT', 'Hystérésis : doit maintenir la poursuite tant que dist <= loseTargetRadius (340)');

  // 4. Le joueur dépasse le rayon d abandon (dist = 400 > 340) -> retour à PATROL
  player.pos.set(500, 100);
  security.updateBehavior(player);
  assert.equal(security.state, 'PATROL', 'Doit abandonner la cible et repasser en patrouille');
  assert.equal(security.targetPlayer, null);
});

test('Machine à états MaintenanceDrone : priorité évasion, assistance et exploration', () => {
  const { MaintenanceDrone, SecurityDrone, Battery, RepairModule } = loadDroneEnvironment();
  const drone = new MaintenanceDrone(300, 300, 3.5, 0.25);

  const battery = new Battery(350, 300, 35);
  const module = new RepairModule(300, 380, 'Oxygène', 20);
  const hostile = new SecurityDrone(600, 600); // Loin

  // 1. Sans menace proche, détecte le module endommagé prioritaire
  drone.updateBehavior({ hostiles: [hostile], modules: [module], batteries: [battery] });
  assert.equal(drone.state, 'ARRIVE_MODULE');
  assert.equal(drone.assignedModule, module);

  // 2. Si le module est réparé, se dirige vers la batterie
  module.integrity = 100;
  drone.updateBehavior({ hostiles: [hostile], modules: [module], batteries: [battery] });
  assert.equal(drone.state, 'SEEK_BATTERY');
  assert.equal(drone.assignedBattery, battery);

  // 3. Priorité absolue d évasion : un drone hostile surgit à portée (dist = 120 <= warningRadius 180)
  hostile.pos.set(300, 180);
  drone.updateBehavior({ hostiles: [hostile], modules: [module], batteries: [battery] });
  assert.equal(drone.state, 'EVADE', 'La menace hostile doit avoir la priorité absolue sur les tâches');
  assert.equal(drone.evadingTarget, hostile);

  // 4. Hystérésis d évasion : le prédateur s éloigne à 220 px (< safeEscapeRadius 260) -> reste en EVADE
  hostile.pos.set(300, 80);
  drone.updateBehavior({ hostiles: [hostile], modules: [module], batteries: [battery] });
  assert.equal(drone.state, 'EVADE', 'Hystérésis : reste en évasion jusqu à distance de sécurité');

  // 5. Hors de danger (dist = 300 > 260) -> reprise de l exploration
  hostile.pos.set(300, 0);
  drone.updateBehavior({ hostiles: [hostile], modules: [], batteries: [] });
  assert.equal(drone.state, 'WANDER');
});
