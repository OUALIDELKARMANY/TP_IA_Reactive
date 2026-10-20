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
  static sub(a, b) {
    return new Vector(a.x - b.x, a.y - b.y);
  }
}

function loadStep2Context() {
  let simulatedMillis = 1000;
  const scope = vm.createContext({
    p5: { Vector },
    PI: Math.PI,
    createVector: (x = 0, y = 0) => new Vector(x, y),
    sin: Math.sin,
    cos: Math.cos,
    TWO_PI: Math.PI * 2,
    HALF_PI: Math.PI / 2,
    min: Math.min,
    max: Math.max,
    random: (a, b) => (b === undefined ? a / 2 : (a + b) / 2),
    width: 1200,
    height: 800,
    frameCount: 10,
    millis: () => simulatedMillis,
    advanceTime: (ms) => { simulatedMillis += ms; },
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
    triangle: () => {},
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
    CORNER: 'corner',
    document: {
      createElement: () => ({
        setAttribute: () => {},
        style: {}
      }),
      body: { appendChild: () => {} }
    },
    navigator: { mediaDevices: { getUserMedia: async () => ({}) } },
    window: {}
  });

  const files = [
    '../vehicle.js',
    '../playerRobot.js',
    '../handController.js'
  ];

  for (const file of files) {
    vm.runInContext(readFileSync(new URL(file, import.meta.url), 'utf8'), scope);
  }

  return { scope, ...vm.runInContext('({ Vehicle, PlayerRobot, HandController })', scope) };
}

test('Conversion et effet miroir des coordonnées de webcam [0, 1] vers le canvas', () => {
  const { HandController } = loadStep2Context();
  const controller = new HandController(1200, 800);

  // Landmark 8 au bord gauche de la caméra (x=0) -> doit se projeter au bord droit du canvas (effet miroir)
  const normLeft = { x: 0.0, y: 0.5 };
  const targetX1 = (1 - normLeft.x) * controller.canvasWidth;
  const targetY1 = normLeft.y * controller.canvasHeight;
  assert.equal(targetX1, 1200, 'x=0 doit être inversé vers 1200 (effet miroir)');
  assert.equal(targetY1, 400);

  // Landmark 8 au bord droit de la caméra (x=1) -> bord gauche du canvas (x=0)
  const normRight = { x: 1.0, y: 0.25 };
  const targetX2 = (1 - normRight.x) * controller.canvasWidth;
  const targetY2 = normRight.y * controller.canvasHeight;
  assert.equal(targetX2, 0, 'x=1 doit être inversé vers 0 (effet miroir)');
  assert.equal(targetY2, 200);

  // Centre (x=0.5, y=0.5)
  const normCenter = { x: 0.5, y: 0.5 };
  assert.equal((1 - normCenter.x) * controller.canvasWidth, 600);
  assert.equal(normCenter.y * controller.canvasHeight, 400);
});

test('Lissage exponentiel (filtre passe-bas) des coordonnées de la cible', () => {
  const { HandController } = loadStep2Context();
  const controller = new HandController(1200, 800);
  controller.smoothingAlpha = 0.2;

  // Première cible : initialisation directe
  controller.processNewTarget(100, 100);
  assert.equal(controller.smoothedTarget.x, 100);
  assert.equal(controller.smoothedTarget.y, 100);

  // Saut brusque vers 200 : la position lissée doit progresser de 20%
  controller.processNewTarget(200, 100);
  // smoothed = 100 + (200 - 100) * 0.2 = 120
  assert.equal(controller.smoothedTarget.x, 120);
  assert.equal(controller.smoothedTarget.y, 100);

  // Deuxième frame à 200 : progression continue
  controller.processNewTarget(200, 100);
  // smoothed = 120 + (200 - 120) * 0.2 = 136
  assert.equal(controller.smoothedTarget.x, 136);
});

test('Gestion de la perte de détection de la main et timeout', () => {
  const { scope, HandController } = loadStep2Context();
  const controller = new HandController(1200, 800);
  controller.detectionTimeout = 300;

  // Simulation d'une main détectée à t = 1000ms
  controller.processNewTarget(500, 500);
  controller.isHandDetected = true;
  controller.status = 'HAND_DETECTED';
  controller.lastDetectionTime = 1000;

  assert.ok(controller.getTarget() !== null);
  assert.equal(controller.status, 'HAND_DETECTED');

  // Avance de 200ms (< 300ms) : la main reste active
  scope.advanceTime(200);
  controller.update(); // currentTime n'a pas changé
  // Pas encore dépassé le timeout
  assert.equal(controller.isHandDetected, true);

  // Avance de 200ms supplémentaires (total 400ms > 300ms) : la main est considérée perdue
  scope.advanceTime(200);
  controller.update();
  assert.equal(controller.isHandDetected, false);
  assert.equal(controller.status, 'NO_HAND');
  assert.equal(controller.getTarget(), null, 'getTarget doit renvoyer null en l absence de main');
});

test('PlayerRobot.arrive() : force de ralentissement fluide près de la cible', () => {
  const { PlayerRobot } = loadStep2Context();
  const robot = new PlayerRobot(0, 0, 4.5, 0.25);
  robot.vel.set(0, 0);

  // 1. Cible lointaine (d = 300 > slowingRadius = 90) : vitesse désirée maximale
  const farTarget = new Vector(300, 0);
  const forceFar = robot.arrive(farTarget, 90);
  assert.ok(forceFar.x > 0);
  assert.ok(forceFar.mag() <= robot.maxForce + 1e-12);

  // 2. Cible proche (d = 45 < slowingRadius = 90) : vitesse désirée diminuée de moitié
  const nearTarget = new Vector(45, 0);
  robot.vel.set(0, 0);
  const forceNear = robot.arrive(nearTarget, 90);
  // desired = (45/90) * 4.5 = 2.25 px/frame vers +x
  assert.ok(forceNear.x > 0);
  assert.ok(forceNear.mag() <= robot.maxForce + 1e-12);

  // 3. Cible atteinte (d = 2 < 4px) : force nulle et arrêt
  const atTarget = new Vector(2, 0);
  robot.vel.set(1, 0);
  const forceStopped = robot.arrive(atTarget, 90);
  assert.equal(forceStopped.mag(), 0, 'La force de pilotage doit être nulle à destination');
  assert.ok(robot.vel.x < 1, 'Un freinage amorti doit être appliqué');
});

test('PlayerRobot.followTarget() : permutation fluide entre les modes arrive et seek', () => {
  const { PlayerRobot } = loadStep2Context();
  const robot = new PlayerRobot(100, 100);
  const target = new Vector(140, 100); // Distance = 40px

  // Mode Arrive
  robot.acc.set(0, 0);
  robot.followTarget(target, 'arrive');
  assert.ok(robot.acc.x > 0, 'Arrive doit appliquer une force vers la cible');

  // Mode Seek
  robot.acc.set(0, 0);
  robot.followTarget(target, 'seek');
  assert.ok(robot.acc.x > 0, 'Seek doit appliquer une force vers la cible');
});

test('Protections contre les vecteurs nuls, forces excessives et valeurs non finies', () => {
  const { PlayerRobot } = loadStep2Context();
  const robot = new PlayerRobot(200, 200, 4.5, 0.25);

  // 1. Seek avec cible nulle ou superposée
  assert.equal(robot.seek(null).mag(), 0, 'Seek sur cible nulle doit renvoyer un vecteur nul');
  assert.equal(robot.seek(new Vector(200, 200)).mag(), 0, 'Seek sur même position doit renvoyer 0 sans erreur');

  // 2. Arrive avec cible nulle
  assert.equal(robot.arrive(null).mag(), 0, 'Arrive sur cible nulle doit renvoyer un vecteur nul');

  // 3. Protection applyForce contre NaN / Infinity
  robot.acc.set(0, 0);
  robot.applyForce(new Vector(NaN, 10));
  assert.equal(robot.acc.mag(), 0, 'Une force contenant NaN doit être rejetée');

  robot.applyForce(new Vector(Infinity, 0));
  assert.equal(robot.acc.mag(), 0, 'Une force infinie doit être rejetée');

  // 4. Limitation stricte des forces de steering calculées par maxForce
  const seekForce = robot.seek(new Vector(1000, 200));
  assert.ok(seekForce.mag() <= robot.maxForce + 1e-12, 'La force de seek doit être bornée par maxForce');

  const arriveForce = robot.arrive(new Vector(1000, 200));
  assert.ok(arriveForce.mag() <= robot.maxForce + 1e-12, 'La force d arrive doit être bornée par maxForce');
});

test('Mode débogage (drawDebug) : exécution sans levée d exception', () => {
  const { PlayerRobot } = loadStep2Context();
  const robot = new PlayerRobot(300, 300);

  // Exécution avec et sans cible
  assert.doesNotThrow(() => robot.drawDebug(null, 'arrive', 90));
  assert.doesNotThrow(() => robot.drawDebug(new Vector(400, 350), 'arrive', 90));
  assert.doesNotThrow(() => robot.drawDebug(new Vector(400, 350), 'seek', 90));
});

