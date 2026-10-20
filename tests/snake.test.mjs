import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

class Vector {
  constructor(x = 0, y = 0) { this.set(x, y); }
  set(x, y) { this.x = x; this.y = y; return this; }
  copy() { return new Vector(this.x, this.y); }
  add(v, y) { this.x += typeof v === 'number' ? v : v.x; this.y += typeof v === 'number' ? y : v.y; return this; }
  sub(v) { this.x -= v.x; this.y -= v.y; return this; }
  mult(n) { this.x *= n; this.y *= n; return this; }
  div(n) { return this.mult(1 / n); }
  mag() { return Math.hypot(this.x, this.y); }
  normalize() { const magnitude = this.mag(); return magnitude ? this.div(magnitude) : this; }
  setMag(n) { return this.normalize().mult(n); }
  limit(n) { return this.mag() > n ? this.setMag(n) : this; }
  heading() { return Math.atan2(this.y, this.x); }
  dot(v) { return this.x * v.x + this.y * v.y; }
  static add(a, b) { return a.copy().add(b); }
  static sub(a, b) { return a.copy().sub(b); }
  static dist(a, b) { return Vector.sub(a, b).mag(); }
}

function load() {
  const elements = new Map();
  for (const [id, value] of [['snake-follow', '2'], ['snake-separation', '1.2'],
    ['circuit-width', '20'], ['snake-spacing', '20'], ['snake-size', '22'],
    ['snake-follow-value', ''], ['snake-separation-value', ''],
    ['circuit-width-value', ''], ['snake-spacing-value', ''], ['snake-size-value', ''],
    ['snake-count', '']]) {
    elements.set(id, { value, events: {}, addEventListener(type, fn) { this.events[type] = fn; } });
  }
  const scope = vm.createContext({ p5: { Vector }, createVector: (x, y) => new Vector(x, y),
    PI: Math.PI, TWO_PI: Math.PI * 2, min: Math.min, max: Math.max, cos: Math.cos, sin: Math.sin,
    constrain: (v, a, b) => Math.max(a, Math.min(b, v)),
    random: (a, b) => b === undefined ? a / 2 : (a + b) / 2,
    color: (...args) => args, width: 1200, height: 800, mouseX: 500, mouseY: 300,
    document: { getElementById: id => elements.get(id), activeElement: { matches: () => false } }
  });
  for (const file of ['vehicle.js', 'path.js', 'snakeSegment.js', 'snake.js', 'snakePathFollowing.js', 'sketch.js']) {
    vm.runInContext(readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'), scope);
  }
  return { scope, elements, ...vm.runInContext('({Vehicle, Snake, SnakeSegment, SnakePathFollowing, Path})', scope) };
}

test('héritage, construction et arrivée avec espacement stable', () => {
  const { Vehicle, Snake, SnakePathFollowing } = load();
  const snake = new SnakePathFollowing(200, 200);
  assert.ok(snake instanceof Snake && snake instanceof Vehicle);
  assert.equal(snake.anneaux.length, 12);
  assert.ok(snake.anneaux.every(part => part instanceof Vehicle));
  const ring = snake.anneaux[1]; ring.vel.set(0, 0);
  assert.equal(ring.arrive(snake.head.pos, 20).mag(), 0);
  ring.pos.set(0, 200);
  assert.ok(ring.arrive(snake.head.pos).x > 0);
  assert.ok(ring.arrive(snake.head.pos).mag() <= ring.maxForce);
});

test('follow et séparation pondérés avant une seule intégration par segment', () => {
  const { SnakePathFollowing } = load(); const snake = new SnakePathFollowing(200, 200, 3);
  snake.followWeight = 2; snake.separationWeight = 3;
  snake.head.follow = () => new Vector(1, 0);
  snake.head.separate = () => new Vector(0, 1);
  let integrated = 0;
  snake.head.update = () => { assert.equal(snake.head.acc.x, 2); assert.equal(snake.head.acc.y, 3); integrated++; };
  for (const ring of snake.anneaux.slice(1)) {
    ring.arrive = () => new Vector(1, 0); ring.separate = () => new Vector(0, 1);
    ring.update = () => { assert.equal(ring.acc.x, 1); assert.equal(ring.acc.y, 3); integrated++; };
  }
  snake.move({}, []); assert.equal(integrated, 3);
});

test('espacement et taille des anneaux sont réglables pour chaque serpent', () => {
  const { SnakePathFollowing } = load();
  const snake = new SnakePathFollowing(200, 200, 4, 22);
  snake.setRingSpacing(47);
  snake.setSize(31);
  assert.equal(snake.ringSpacing, 47);
  assert.equal(snake.head.r, 31);
  assert.equal(snake.anneaux[1].r, 31 * 0.9);
  let spacing;
  snake.anneaux[1].arrive = (_target, value) => { spacing = value; return new Vector(); };
  snake.head.follow = () => new Vector();
  snake.move({}, []);
  assert.equal(spacing, 47);
});

test('vraies forces héritées : éloignement des voisins et simulation sans NaN', () => {
  const { Vehicle, SnakePathFollowing, Path } = load();
  const snake = new SnakePathFollowing(200, 200, 6);
  const path = new Path(); [[300, 100], [800, 100], [800, 600], [300, 600]].forEach(p => path.addPoint(...p));
  const obstacle = new Vehicle(210, 200, 2, 0.3); snake.head.vel.set(0, 0);
  assert.ok(snake.head.separate([obstacle]).x < 0);
  for (let i = 0; i < 500; i++) snake.move(path, [obstacle]);
  for (const part of snake.anneaux) {
    assert.ok(Number.isFinite(part.pos.x) && Number.isFinite(part.pos.y));
    assert.ok(part.vel.mag() <= part.maxSpeed + 1e-9);
    assert.equal(part.acc.mag(), 0);
  }
});

test('curseurs input et touche T : anciens et nouveaux serpents partagent les poids', () => {
  const { scope, elements } = load();
  vm.runInContext('newPath(); newSnake(200, 200); bindSnakeControls();', scope);
  elements.get('snake-follow').value = '0'; elements.get('snake-separation').value = '5';
  elements.get('circuit-width').value = '60'; elements.get('snake-spacing').value = '35';
  elements.get('snake-size').value = '30';
  elements.get('snake-follow').events.input();
  vm.runInContext('key = "t"; keyPressed({repeat:false}); keyPressed({repeat:true});', scope);
  assert.equal(vm.runInContext('snakes.length', scope), 2);
  assert.equal(vm.runInContext('snakes.every(s => s.followWeight === 0 && s.separationWeight === 5)', scope), true);
  assert.equal(vm.runInContext('path.radius', scope), 60);
  assert.equal(vm.runInContext('snakes.every(s => s.ringSpacing === 35 && s.r === 30)', scope), true);
  assert.equal(elements.get('snake-count').value, '2 serpents');
});

test('la séparation exclut les anneaux du serpent courant mais garde les autres', () => {
  const { scope } = load();
  vm.runInContext('const a = new SnakePathFollowing(100,100,3); const b = new SnakePathFollowing(300,300,3); globalThis.__a=a; globalThis.__b=b;', scope);
  const result = vm.runInContext('neighborsForSnake(__a, [...__a.anneaux, ...__b.anneaux, ...vehicles])', scope);
  const own = vm.runInContext('__a.anneaux', scope);
  const other = vm.runInContext('__b.anneaux', scope);
  assert.equal(result.some(v => own.includes(v)), false);
  assert.equal(other.every(v => result.includes(v)), true);
});
