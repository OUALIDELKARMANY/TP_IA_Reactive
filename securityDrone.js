/**
 * Space Station — Robot de maintenance
 * securityDrone.js : Drone autonome hostile de sécurité / patrouille.
 * Hérite de la classe Vehicle existante.
 * Implémente les comportements : Wander, Seek, Arrive, Flee, Pursue, Evade.
 */

class SecurityDrone extends Vehicle {
  constructor(x, y, maxSpeed = 3.6, maxForce = 0.26) {
    super(x, y, maxSpeed, maxForce);

    this.r = 17;
    this.couleur = '#ef4444'; // Écarlate hostile
    this.isStatic = false;

    // Vitesse initiale pour la ronde
    this.vel = typeof p5 !== 'undefined' && p5.Vector?.random2D
      ? p5.Vector.random2D().mult(this.maxSpeed * 0.6)
      : createVector(this.maxSpeed * 0.6, 0);

    // Machine à états : 'PATROL' | 'PURSUIT'
    this.state = 'PATROL';

    // Paramètres de détection et hystérésis de poursuite
    this.detectionRadius = 220;    // Rayon d'engagement du joueur
    this.loseTargetRadius = 340;   // Rayon d'abandon de la traque
    this.targetPlayer = null;

    // Cible prédite pour affichage visuel
    this.predictedTargetPos = null;

    // Paramètres Wander hérités de Vehicle
    this.distanceCercle = 90;
    this.wanderRadius = 40;
    this.wanderTheta = typeof PI !== 'undefined' ? PI / 2 : 1.57;
    this.displaceRange = 0.3;

    // Traînée de déplacement
    this.path = [];
    this.pathMaxLength = 16;
  }

  /**
   * Comportement Arrive selon Craig Reynolds :
   * Ralentit progressivement à l'intérieur du rayon de décélération.
   * @param {p5.Vector|Vehicle} target 
   * @param {number} slowingRadius 
   * @returns {p5.Vector}
   */
  arrive(target, slowingRadius = 90) {
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
   * S'éloigne d'une cible dans un rayon donné.
   * @param {p5.Vector|Vehicle} target 
   * @param {number} detectionRadius 
   * @returns {p5.Vector}
   */
  flee(target, detectionRadius = Infinity) {
    const targetPos = target?.pos || target;
    if (!targetPos) return createVector(0, 0);

    let desired = p5.Vector.sub(this.pos, targetPos);
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
   * Comportement Pursue selon Craig Reynolds :
   * Anticipe la trajectoire future de la cible pour l'intercepter.
   * futurePos = targetPos + targetVel * T (où T = distance / maxSpeed).
   * @param {Vehicle} target 
   * @param {number} maxPredictionFrames 
   * @returns {p5.Vector}
   */
  pursue(target, maxPredictionFrames = 22) {
    if (!target) return createVector(0, 0);
    const targetPos = target.pos || target;
    const targetVel = target.vel || createVector(0, 0);

    let distance = p5.Vector.dist(this.pos, targetPos);
    let timeAhead = this.maxSpeed > 0 ? constrain(distance / this.maxSpeed, 0, maxPredictionFrames) : 0;
    let futurePos = p5.Vector.add(targetPos, p5.Vector.mult(targetVel, timeAhead));

    this.predictedTargetPos = futurePos.copy();

    // Utilise le seek hérité de Vehicle vers la position future
    return this.seek(futurePos);
  }

  /**
   * Comportement Evade selon Craig Reynolds :
   * Fuit la position future anticipée d'une menace.
   * @param {Vehicle} target 
   * @param {number} maxPredictionFrames 
   * @param {number} detectionRadius 
   * @returns {p5.Vector}
   */
  evade(target, maxPredictionFrames = 20, detectionRadius = Infinity) {
    if (!target) return createVector(0, 0);
    const targetPos = target.pos || target;
    const targetVel = target.vel || createVector(0, 0);

    let distance = p5.Vector.dist(this.pos, targetPos);
    if (distance > detectionRadius) {
      return createVector(0, 0);
    }

    let timeAhead = this.maxSpeed > 0 ? constrain(distance / this.maxSpeed, 0, maxPredictionFrames) : 0;
    let futureThreat = p5.Vector.add(targetPos, p5.Vector.mult(targetVel, timeAhead));

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
      steer.limit(this.maxForce * 1.6);
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
   * Machine à états réactive du drone de sécurité hostile :
   * - PATROL : patrouille autonome (suivi de couloir ou wander) avec évitement.
   * - PURSUIT : engage pursue() dès que le joueur pénètre dans detectionRadius.
   * - Hystérésis : reste en chasse jusqu'à loseTargetRadius.
   * @param {PlayerRobot|Vehicle} player 
   * @param {Object} context { obstacles, neighbors, path }
   */
  updateBehavior(player, context = {}) {
    const { obstacles = [], neighbors = [], path = null, flares = [] } = context;

    // 1. Détection prioritaire des leurres déconcentrants actifs (Flares)
    let activeFlare = null;
    let minFlareDist = Infinity;
    for (let f of flares) {
      if (f && !f.expired && f.isDroneInRange(this)) {
        let dist = p5.Vector.dist(this.pos, f.pos);
        if (dist < minFlareDist) {
          minFlareDist = dist;
          activeFlare = f;
        }
      }
    }

    if (activeFlare) {
      // Déconcentré par le leurre thermique / EMP
      this.state = 'DISTRACTED';
      this.targetPlayer = null;
      this.distractionTarget = activeFlare;
    } else if (!player) {
      this.state = 'PATROL';
      this.targetPlayer = null;
      this.distractionTarget = null;
    } else {
      let d = p5.Vector.dist(this.pos, player.pos);

      if (this.state === 'PURSUIT') {
        if (d > this.loseTargetRadius) {
          // Joueur hors d'atteinte : retour à la patrouille
          this.state = 'PATROL';
          this.targetPlayer = null;
          this.predictedTargetPos = null;
        } else {
          this.targetPlayer = player;
        }
      } else {
        // En patrouille : engagement si le joueur pénètre dans le cercle de détection
        if (d <= this.detectionRadius) {
          this.state = 'PURSUIT';
          this.targetPlayer = player;
        }
      }
    }

    let goalForce = createVector(0, 0);

    if (this.state === 'DISTRACTED' && activeFlare) {
      // Le drone fonce enquêter sur le leurre au lieu du joueur
      goalForce = this.seek(activeFlare.pos);
    } else if (this.state === 'PURSUIT' && this.targetPlayer) {
      goalForce = this.pursue(this.targetPlayer);
    } else {
      if (path && Math.random() < 0.65) {
        goalForce = this.followPath(path);
      } else {
        // Vitesse minimale pour wander
        if (this.vel.mag() < 0.2) {
          this.vel = typeof p5 !== 'undefined' && p5.Vector?.random2D
            ? p5.Vector.random2D().mult(1.5)
            : createVector(1.5, 0);
        }
        goalForce = this.wander();
      }
    }

    // Forces prioritaires : Obstacles et Véhicules
    let obsForce = this.avoidObstacles(obstacles);
    let vehForce = this.avoidVehicles(neighbors);
    let sepForce = typeof this.separate === 'function' ? this.separate(neighbors) : createVector(0, 0);

    // Arbitrage par priorité : l'urgence d'évitement prime sur la poursuite/patrouille
    if (obsForce && obsForce.mag() > 0.05) {
      obsForce.mult(1.8);
      this.applyForce(obsForce);
      goalForce.mult(0.2);
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
   * Rendu visuel d'un drone hostile menaçant avec optique rouge et cône radar.
   */
  show() {
    push();
    translate(this.pos.x, this.pos.y);

    let angle = this.vel.heading();
    rotate(angle);

    // 1. Cercle / halo de détection menaçant
    if (this.state === 'PURSUIT') {
      noFill();
      stroke(239, 68, 68, 120 + sin(frameCount * 0.2) * 50);
      strokeWeight(1.5);
      circle(0, 0, this.r * 3.5);
    }

    // 2. Châssis angulaire d'intercepteur hostile
    fill('#18181b');
    stroke(this.state === 'PURSUIT' ? '#ef4444' : '#71717a');
    strokeWeight(2);

    beginShape();
    vertex(this.r * 1.3, 0);                 // Pointe avant
    vertex(-this.r * 0.8, -this.r * 0.9);   // Aile gauche
    vertex(-this.r * 0.4, 0);               // Encoche arrière
    vertex(-this.r * 0.8, this.r * 0.9);    // Aile droite
    endShape(CLOSE);

    // 3. Optique scanner rouge (clignotant en poursuite)
    let eyeColor = this.state === 'PURSUIT'
      ? (frameCount % 10 < 5 ? '#ff0033' : '#ff4444')
      : '#b91c1c';
    fill(eyeColor);
    noStroke();
    circle(this.r * 0.4, 0, 7);

    // 4. Tuyère réacteur arrière
    if (this.vel.mag() > 0.5) {
      fill(239, 68, 68, 200);
      circle(-this.r * 0.6, 0, 5 + sin(frameCount * 0.4) * 2);
    }

    pop();

    // 5. Zone de détection radar au sol et ligne de prédiction (en mode debug ou poursuite)
    if (this.state === 'PURSUIT' && this.predictedTargetPos) {
      push();
      // Point prédictif vert Reynolds
      fill(16, 185, 129, 160);
      noStroke();
      circle(this.predictedTargetPos.x, this.predictedTargetPos.y, 10);

      // Trait d'interception
      stroke(239, 68, 68, 100);
      strokeWeight(1);
      line(this.pos.x, this.pos.y, this.predictedTargetPos.x, this.predictedTargetPos.y);
      pop();
    }

    // 6. Étiquette d'état
    push();
    textAlign(CENTER, BOTTOM);
    textSize(9);
    noStroke();
    let label = this.state === 'PURSUIT' ? '⚠️ [POURSUITE]' : '[PATROUILLE]';
    fill(this.state === 'PURSUIT' ? '#ef4444' : '#a1a1aa');
    text(label, this.pos.x, this.pos.y - this.r - 6);
    pop();
  }
}
