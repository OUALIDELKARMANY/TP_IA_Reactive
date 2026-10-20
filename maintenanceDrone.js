/**
 * Space Station — Robot de maintenance
 * maintenanceDrone.js : Drone autonome allié de maintenance.
 * Hérite de la classe Vehicle existante.
 * Implémente les comportements : Wander, Seek, Arrive, Flee, Evade.
 */

class MaintenanceDrone extends Vehicle {
  constructor(x, y, maxSpeed = 3.2, maxForce = 0.22) {
    super(x, y, maxSpeed, maxForce);

    this.r = 15;
    this.couleur = '#06b6d4'; // Cyan allié
    this.isStatic = false;

    // Direction initiale aléatoire pour la patrouille
    this.vel = typeof p5 !== 'undefined' && p5.Vector?.random2D
      ? p5.Vector.random2D().mult(this.maxSpeed * 0.7)
      : createVector(this.maxSpeed * 0.7, 0);

    // Machine à états : 'WANDER' | 'SEEK_BATTERY' | 'ARRIVE_MODULE' | 'EVADE'
    this.state = 'WANDER';

    // Paramètres de perception et d'interaction
    this.warningRadius = 180;      // Distance de détection d'un prédateur hostile
    this.safeEscapeRadius = 260;   // Distance d'hystérésis pour sortir d'évasion
    this.perceptionRadius = 200;   // Portée de détection des tâches (batteries, modules)
    this.slowingRadius = 80;       // Rayon de décélération pour Arrive

    // Cibles courantes
    this.assignedBattery = null;
    this.assignedModule = null;
    this.evadingTarget = null;

    // Paramètres Wander hérités de Vehicle
    this.distanceCercle = 80;
    this.wanderRadius = 35;
    this.wanderTheta = typeof PI !== 'undefined' ? PI / 2 : 1.57;
    this.displaceRange = 0.25;

    // Traînée visuelle
    this.path = [];
    this.pathMaxLength = 14;
  }

  /**
   * Comportement Arrive selon Craig Reynolds :
   * Ralentit progressivement à l'intérieur du rayon slowingRadius.
   * @param {p5.Vector|Vehicle} target 
   * @param {number} slowingRadius 
   * @returns {p5.Vector}
   */
  arrive(target, slowingRadius = this.slowingRadius) {
    const targetPos = target?.pos || target;
    if (!targetPos) return createVector(0, 0);

    let desired = p5.Vector.sub(targetPos, this.pos);
    let d = desired.mag();

    if (d < 1e-4) return createVector(0, 0);

    let speed = this.maxSpeed;
    if (d < slowingRadius) {
      speed = (d / slowingRadius) * this.maxSpeed;
    }

    desired.setMag(speed);
    let steer = p5.Vector.sub(desired, this.vel);
    steer.limit(this.maxForce);
    return steer;
  }

  /**
   * Comportement Flee selon Craig Reynolds :
   * Fuit en sens opposé de la menace si elle est à portée.
   * @param {p5.Vector|Vehicle} threat 
   * @param {number} detectionRadius 
   * @returns {p5.Vector}
   */
  flee(threat, detectionRadius = this.warningRadius) {
    const threatPos = threat?.pos || threat;
    if (!threatPos) return createVector(0, 0);

    let desired = p5.Vector.sub(this.pos, threatPos);
    let d = desired.mag();

    if (d > detectionRadius || d < 1e-4) {
      return createVector(0, 0);
    }

    desired.setMag(this.maxSpeed);
    let steer = p5.Vector.sub(desired, this.vel);
    steer.limit(this.maxForce);
    return steer;
  }

  /**
   * Comportement Evade selon Craig Reynolds :
   * Anticipe la trajectoire future d'un poursuivant pour s'en échapper.
   * @param {Vehicle} pursuer 
   * @param {number} maxPredictionFrames 
   * @param {number} detectionRadius 
   * @returns {p5.Vector}
   */
  evade(pursuer, maxPredictionFrames = 18, detectionRadius = this.warningRadius) {
    if (!pursuer) return createVector(0, 0);
    const pursuerPos = pursuer.pos || pursuer;
    const pursuerVel = pursuer.vel || createVector(0, 0);

    let distance = p5.Vector.dist(this.pos, pursuerPos);
    if (distance > detectionRadius) {
      return createVector(0, 0);
    }

    let timeAhead = this.maxSpeed > 0 ? constrain(distance / this.maxSpeed, 0, maxPredictionFrames) : 0;
    let futureThreat = p5.Vector.add(pursuerPos, p5.Vector.mult(pursuerVel, timeAhead));

    return this.flee(futureThreat, Infinity);
  }

  /**
   * Suivi de chemin le long d'une suite de points avec anticipation (Craig Reynolds).
   * Réutilise la méthode follow(path) de Vehicle.
   * @param {Path} path 
   * @returns {p5.Vector}
   */
  followPath(path) {
    if (!path || typeof this.follow !== 'function') return createVector(0, 0);
    return this.follow(path);
  }

  /**
   * Évitement prédictif d'obstacles fixes (Craig Reynolds 1999).
   * Projette deux vecteurs ahead devant le drone et génère une force latérale d'évitement.
   * @param {Array<Obstacle>} obstacles 
   * @param {number} lookaheadFrames 
   * @returns {p5.Vector}
   */
  avoidObstacles(obstacles, lookaheadFrames = 22) {
    if (!obstacles || obstacles.length === 0) return createVector(0, 0);

    let speed = this.vel.mag();
    if (speed < 0.05) return createVector(0, 0);

    let forward = this.vel.copy().normalize();
    let aheadDist = constrain(speed * lookaheadFrames, 30, 100);

    let mostThreatening = null;
    let minDistance = Infinity;
    let lateralOffset = null;

    for (let obs of obstacles) {
      if (!obs || !obs.pos) continue;

      let toObs = p5.Vector.sub(obs.pos, this.pos);
      let projection = toObs.dot(forward);

      // L'obstacle doit être devant le drone dans la fenêtre d'anticipation
      if (projection < -this.r || projection > aheadDist + obs.r) continue;

      let projPoint = p5.Vector.add(this.pos, p5.Vector.mult(forward, Math.max(0, projection)));
      let lateral = p5.Vector.sub(obs.pos, projPoint);
      let latDist = lateral.mag();

      let collisionMargin = obs.r + this.r + 14;

      if (latDist < collisionMargin) {
        if (projection < minDistance) {
          minDistance = projection;
          mostThreatening = obs;
          lateralOffset = lateral;
        }
      }
    }

    if (mostThreatening && lateralOffset) {
      let avoidDir = null;
      if (lateralOffset.mag() < 1e-4) {
        // Obstacle pile dans l'axe : déviation latérale perpendiculaire (Craig Reynolds)
        avoidDir = createVector(-forward.y, forward.x);
      } else {
        // Force latérale dirigée à l'opposé du centre de l'obstacle
        avoidDir = p5.Vector.mult(lateralOffset, -1).normalize();
      }

      avoidDir.setMag(this.maxSpeed);
      let steer = p5.Vector.sub(avoidDir, this.vel);
      steer.limit(this.maxForce * 1.5);
      return steer;
    }

    return createVector(0, 0);
  }

  /**
   * Évitement prédictif des véhicules mobiles (Unaligned collision avoidance de Reynolds).
   * @param {Array<Vehicle>} neighbors 
   * @param {number} maxTimeHorizon 
   * @returns {p5.Vector}
   */
  avoidVehicles(neighbors, maxTimeHorizon = 26) {
    if (!neighbors || neighbors.length === 0) return createVector(0, 0);

    let earliestTime = Infinity;
    let threatVehicle = null;
    let threatRelPosAtMinDist = null;

    for (let other of neighbors) {
      if (!other || other === this || other.isStatic) continue;

      let relPos = p5.Vector.sub(other.pos, this.pos);
      let relVel = p5.Vector.sub(other.vel, this.vel);
      let relSpeed = relVel.mag();

      if (relSpeed < 0.05) continue;

      let timeToClosest = -relPos.dot(relVel) / (relSpeed * relSpeed);

      if (timeToClosest > 0 && timeToClosest < maxTimeHorizon) {
        let futurePosThis = p5.Vector.add(this.pos, p5.Vector.mult(this.vel, timeToClosest));
        let futurePosOther = p5.Vector.add(other.pos, p5.Vector.mult(other.vel, timeToClosest));
        let futureDist = p5.Vector.dist(futurePosThis, futurePosOther);

        let safetyDistance = this.r + (other.r || 14) + 14;

        if (futureDist < safetyDistance) {
          if (timeToClosest < earliestTime) {
            earliestTime = timeToClosest;
            threatVehicle = other;
            threatRelPosAtMinDist = p5.Vector.sub(futurePosThis, futurePosOther);
          }
        }
      }
    }

    if (threatVehicle && threatRelPosAtMinDist) {
      let avoidDir = threatRelPosAtMinDist.copy();
      if (avoidDir.mag() < 1e-4) {
        avoidDir = createVector(-this.vel.y, this.vel.x);
      }
      avoidDir.setMag(this.maxSpeed);
      let steer = p5.Vector.sub(avoidDir, this.vel);
      steer.limit(this.maxForce * 1.5);
      return steer;
    }

    return createVector(0, 0);
  }

  /**
   * Machine à états réactive du drone de maintenance :
   * 1. EVADE : priorité si un drone hostile (SecurityDrone) s'approche.
   * 2. ARRIVE_MODULE : rejoindre un module endommagé pour inspection.
   * 3. SEEK_BATTERY : rejoindre une batterie repérée.
   * 4. WANDER : explorer librement la station spatiale.
   * @param {Object} context { hostiles, modules, batteries, obstacles, neighbors, path }
   */
  updateBehavior(context = {}) {
    const {
      hostiles = [],
      modules = [],
      batteries = [],
      obstacles = [],
      neighbors = [],
      path = null
    } = context;

    // 1. Détection de menace prioritaire (SecurityDrone)
    let closestHostile = null;
    let minHostileDist = Infinity;
    for (let h of hostiles) {
      let d = p5.Vector.dist(this.pos, h.pos);
      if (d < minHostileDist) {
        minHostileDist = d;
        closestHostile = h;
      }
    }

    // Hystérésis d'évasion
    if (this.state === 'EVADE') {
      if (!closestHostile || minHostileDist > this.safeEscapeRadius) {
        this.state = 'WANDER';
        this.evadingTarget = null;
      }
    } else if (closestHostile && minHostileDist < this.warningRadius) {
      this.state = 'EVADE';
      this.evadingTarget = closestHostile;
    }

    // 2. Si non menacé, évaluation des tâches d'assistance
    if (this.state !== 'EVADE') {
      // Recherche de module endommagé à proximité
      const damagedModule = modules.find(m => !m.isRepaired && p5.Vector.dist(this.pos, m.pos) < this.perceptionRadius);
      // Recherche de batterie non collectée à proximité
      const freeBattery = batteries.find(b => !b.collected && p5.Vector.dist(this.pos, b.pos) < this.perceptionRadius);

      if (damagedModule) {
        this.state = 'ARRIVE_MODULE';
        this.assignedModule = damagedModule;
      } else if (freeBattery) {
        this.state = 'SEEK_BATTERY';
        this.assignedBattery = freeBattery;
      } else {
        this.state = 'WANDER';
        this.assignedModule = null;
        this.assignedBattery = null;
      }
    }

    // 3. Calcul de la force principale selon l'état
    let goalForce = createVector(0, 0);

    switch (this.state) {
      case 'EVADE':
        if (this.evadingTarget) {
          goalForce = this.evade(this.evadingTarget, 18, this.safeEscapeRadius);
        }
        break;

      case 'ARRIVE_MODULE':
        if (this.assignedModule && !this.assignedModule.isRepaired) {
          goalForce = this.arrive(this.assignedModule.pos, this.slowingRadius);
        } else {
          this.state = 'WANDER';
        }
        break;

      case 'SEEK_BATTERY':
        if (this.assignedBattery && !this.assignedBattery.collected) {
          goalForce = this.seek(this.assignedBattery.pos);
        } else {
          this.state = 'WANDER';
        }
        break;

      case 'WANDER':
      default:
        if (path && Math.random() < 0.6) {
          goalForce = this.followPath(path);
        } else {
          if (this.vel.mag() < 0.2) {
            this.vel = typeof p5 !== 'undefined' && p5.Vector?.random2D
              ? p5.Vector.random2D().mult(1.5)
              : createVector(1.5, 0);
          }
          goalForce = this.wander();
        }
        break;
    }

    // 4. Forces prioritaires de sécurité : Évitement d'obstacles et de véhicules
    let obsForce = this.avoidObstacles(obstacles);
    let vehForce = this.avoidVehicles(neighbors);
    let sepForce = typeof this.separate === 'function' ? this.separate(neighbors) : createVector(0, 0);

    // Arbitrage par priorité
    if (obsForce && obsForce.mag() > 0.05) {
      obsForce.mult(1.7);
      this.applyForce(obsForce);
      goalForce.mult(0.25);
    }
    if (vehForce && vehForce.mag() > 0.05) {
      vehForce.mult(1.4);
      this.applyForce(vehForce);
      goalForce.mult(0.4);
    }
    if (sepForce && sepForce.mag() > 0) {
      sepForce.mult(0.8);
      this.applyForce(sepForce);
    }
    if (goalForce && goalForce.mag() > 0) {
      this.applyForce(goalForce);
    }
  }

  /**
   * Confinement à l'intérieur de la station.
   */
  boundaries(xMin, yMin, xMax, yMax, d = 30) {
    let desired = null;
    if (this.pos.x < xMin + d) desired = createVector(this.maxSpeed, this.vel.y);
    else if (this.pos.x > xMax - d) desired = createVector(-this.maxSpeed, this.vel.y);

    if (this.pos.y < yMin + d) desired = createVector(this.vel.x, this.maxSpeed);
    else if (this.pos.y > yMax - d) desired = createVector(this.vel.x, -this.maxSpeed);

    if (desired !== null) {
      desired.setMag(this.maxSpeed);
      let steer = p5.Vector.sub(desired, this.vel);
      steer.limit(this.maxForce * 1.5);
      this.applyForce(steer);
    }
  }

  /**
   * Rendu visuel d'un drone allié cyan / vert menthe avec halo et étiquette d'état.
   */
  show() {
    push();
    translate(this.pos.x, this.pos.y);

    let angle = this.vel.heading();
    rotate(angle);

    // 1. Halo lumineux d'état
    let haloColor = this.state === 'EVADE' ? 'rgba(245, 158, 11, 0.4)' : 'rgba(6, 182, 212, 0.25)';
    noStroke();
    fill(haloColor);
    circle(0, 0, (this.r + 6) * 2);

    // 2. Châssis principal sphérique allié
    fill('#0f172a');
    stroke(this.state === 'EVADE' ? '#f59e0b' : '#06b6d4');
    strokeWeight(1.8);
    circle(0, 0, this.r * 2);

    // 3. Réacteurs latéraux / propulseurs
    fill('#06b6d4');
    noStroke();
    rectMode(CENTER);
    rect(0, -this.r - 2, 8, 4, 1);
    rect(0, this.r + 2, 8, 4, 1);

    // 4. Optique centrale
    fill('#ffffff');
    circle(this.r * 0.4, 0, 5);

    // Flamme de propulsion
    if (this.vel.mag() > 0.5) {
      fill(6, 182, 212, 180);
      circle(-this.r - 2, 0, 4 + sin(frameCount * 0.3) * 2);
    }

    pop();

    // 5. Étiquette d'état au-dessus du drone
    push();
    textAlign(CENTER, BOTTOM);
    textSize(9);
    noStroke();
    let labelColor = this.state === 'EVADE' ? '#f59e0b' : '#38bdf8';
    fill(labelColor);
    text(`[${this.state}]`, this.pos.x, this.pos.y - this.r - 5);
    pop();
  }
}
