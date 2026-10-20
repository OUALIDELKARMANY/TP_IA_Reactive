/**
 * Space Station — Robot de maintenance
 * playerRobot.js : Robot contrôlé par le joueur.
 * Hérite de la classe Vehicle existante de 5-3-PathFollowingComplex.
 */

class PlayerRobot extends Vehicle {
  constructor(x = 600, y = 400, maxSpeed = 4.5, maxForce = 0.25, initialEnergy = 100) {
    // Appel du constructeur existant de Vehicle(x, y, ms, mf)
    super(x, y, maxSpeed, maxForce);

    this.r = 18;
    this.couleur = '#00e5ff';
    this.isStatic = false;

    // Le robot joueur démarre au repos
    this.vel.set(0, 0);

    // Métriques du robot de maintenance
    this.maxEnergy = 100;
    this.energy = initialEnergy;
    this.name = "Unit-M1";
    this.batteriesCollected = 0;

    // Orientation visuelle
    this.heading = 0;

    // Retour visuel de dégâts
    this.damageTimer = 0;

    // Bouclier d'énergie protecteur temporaire
    this.shieldActive = false;
    this.shieldTimer = 0;
    this.shieldMaxDuration = 180; // 3 secondes à 60 FPS
    this.shieldCooldown = 0;
    this.shieldMaxCooldown = 360; // 6 secondes de recharge

    // Balises leurres déconcentrantes (Flares EMP)
    this.flareCooldown = 0;
    this.flareMaxCooldown = 240; // 4 secondes de recharge
  }

  /**
   * Active le bouclier d'énergie protecteur si disponible.
   * @returns {boolean}
   */
  activateShield() {
    if (this.shieldCooldown > 0 || this.energy < 10) return false;
    this.consumeEnergy(10);
    this.shieldActive = true;
    this.shieldTimer = this.shieldMaxDuration;
    this.shieldCooldown = this.shieldMaxCooldown;

    if (typeof window.createFloatingText === 'function') {
      window.createFloatingText(this.pos.x, this.pos.y - 30, '🛡️ BOUCLIER ACTIF !', '#38bdf8');
    }
    if (typeof window.createSparks === 'function') {
      window.createSparks(this.pos.x, this.pos.y, 16, '#38bdf8');
    }
    return true;
  }

  isShieldActive() {
    return this.shieldActive && this.shieldTimer > 0;
  }

  canActivateShield() {
    return this.shieldCooldown <= 0 && this.energy >= 10;
  }

  /**
   * Tente de larguer un leurre thermique / EMP déconcentrant.
   * @returns {DecoyFlare|null}
   */
  deployFlare() {
    if (this.flareCooldown > 0 || this.energy < 12) return null;
    this.consumeEnergy(12);
    this.flareCooldown = this.flareMaxCooldown;

    let launchDir = this.vel.mag() > 0.1
      ? this.vel.copy().mult(-1) // Largué vers l'arrière pour semer le poursuivant
      : createVector(-cos(this.heading), -sin(this.heading));

    if (typeof window.createFloatingText === 'function') {
      window.createFloatingText(this.pos.x, this.pos.y - 25, '🍓 LEURRE LARGUÉ !', '#f59e0b');
    }

    if (typeof DecoyFlare !== 'undefined') {
      return new DecoyFlare(this.pos.x, this.pos.y, launchDir);
    }
    return null;
  }

  canDeployFlare() {
    return this.flareCooldown <= 0 && this.energy >= 12;
  }

  /**
   * Inflige des dégâts d'énergie au robot (bloqués si le bouclier est actif).
   * @param {number} amount 
   */
  damage(amount) {
    if (this.isShieldActive()) {
      // Le bouclier absorbe 100% des dégâts et produit des étincelles de déflexion
      if (typeof createSparks === 'function') {
        createSparks(this.pos.x, this.pos.y, 4, '#38bdf8');
      }
      return;
    }

    this.consumeEnergy(amount);
    this.damageTimer = 18;
    if (typeof createSparks === 'function') {
      createSparks(this.pos.x, this.pos.y, 6, '#ef4444');
    }
  }

  /**
   * Met à jour la position, les timers de capacités et la cinématique.
   */
  update() {
    super.update();

    // Gestion du bouclier
    if (this.shieldTimer > 0) {
      this.shieldTimer--;
      if (this.shieldTimer <= 0) {
        this.shieldActive = false;
      }
    }
    if (this.shieldCooldown > 0) {
      this.shieldCooldown--;
    }

    // Gestion du leurre
    if (this.flareCooldown > 0) {
      this.flareCooldown--;
    }

    if (this.vel && this.vel.mag() > 0.05) {
      this.heading = this.vel.heading();
      // Consommation progressive d'énergie lors de la propulsion
      this.consumeEnergy(0.012 * this.vel.mag());
    }
  }

  /**
   * Recharge l'énergie du robot.
   * @param {number} amount 
   */
  recharge(amount) {
    this.energy = Math.min(this.maxEnergy, this.energy + amount);
  }

  /**
   * Consomme de l'énergie.
   * @param {number} amount 
   */
  consumeEnergy(amount) {
    this.energy = Math.max(0, this.energy - amount);
  }

  /**
   * Maintient le robot à l'intérieur des limites de la station spatiale.
   */
  boundaries(xMin, yMin, xMax, yMax, d = 25) {
    let desired = null;

    if (this.pos.x < xMin + d) {
      desired = createVector(this.maxSpeed, this.vel.y);
    } else if (this.pos.x > xMax - d) {
      desired = createVector(-this.maxSpeed, this.vel.y);
    }

    if (this.pos.y < yMin + d) {
      desired = createVector(this.vel.x, this.maxSpeed);
    } else if (this.pos.y > yMax - d) {
      desired = createVector(this.vel.x, -this.maxSpeed);
    }

    if (desired !== null) {
      desired.setMag(this.maxSpeed);
      let steer = p5.Vector.sub(desired, this.vel);
      steer.limit(this.maxForce * 1.5);
      this.applyForce(steer);
    }
  }

  /**
   * Applique une force de steering en validant sa conformité mathématique (pas de NaN/Infini).
   * @param {p5.Vector} force 
   */
  applyForce(force) {
    if (this.isStatic || !force) return;
    if (Number.isFinite(force.x) && Number.isFinite(force.y)) {
      super.applyForce(force);
    }
  }

  /**
   * Comportement Seek selon Craig Reynolds avec protection contre vecteur nul :
   * desired = (target - pos).setMag(maxSpeed)
   * steer = desired - vel, limité à maxForce
   * @param {p5.Vector} target 
   * @returns {p5.Vector} force de steering
   */
  seek(target) {
    if (!target) return createVector(0, 0);

    let desired = p5.Vector.sub(target, this.pos);
    let d = desired.mag();

    // Protection contre vecteur nul (déjà sur la cible)
    if (d < 1e-4) return createVector(0, 0);

    desired.setMag(this.maxSpeed);
    let steer = p5.Vector.sub(desired, this.vel);
    steer.limit(this.maxForce);
    return steer;
  }

  /**
   * Comportement de pilotage Arrive selon Craig Reynolds :
   * Ralentit progressivement à l'intérieur du rayon de décélération (slowingRadius).
   * @param {p5.Vector} target 
   * @param {number} slowingRadius Rayon de début du ralentissement
   * @returns {p5.Vector} force de steering
   */
  arrive(target, slowingRadius = 90) {
    if (!target) return createVector(0, 0);

    let desired = p5.Vector.sub(target, this.pos);
    let d = desired.mag();

    // Protection seuil d'arrêt : pas d'oscillation autour du point
    if (d < 4) {
      this.vel.mult(0.85); // Amortissement d'arrêt
      return createVector(0, 0);
    }

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
   * S'éloigne d'une menace dans un rayon donné.
   * @param {p5.Vector|Vehicle} threat 
   * @param {number} detectionRadius 
   * @returns {p5.Vector} force de steering
   */
  flee(threat, detectionRadius = Infinity) {
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
   * @returns {p5.Vector} force de steering
   */
  evade(pursuer, maxPredictionFrames = 20, detectionRadius = Infinity) {
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
   * Projette deux vecteurs ahead devant le robot et génère une force latérale
   * d'évitement si un obstacle coupe la zone de sécurité.
   * @param {Array<Obstacle>} obstacles 
   * @param {number} lookaheadFrames 
   * @returns {p5.Vector}
   */
  avoidObstacles(obstacles, lookaheadFrames = 25) {
    if (!obstacles || obstacles.length === 0) return createVector(0, 0);

    let speed = this.vel.mag();
    if (speed < 0.05) return createVector(0, 0);

    let forward = this.vel.copy().normalize();
    let aheadDist = constrain(speed * lookaheadFrames, 35, 120);

    let mostThreatening = null;
    let minDistance = Infinity;
    let lateralOffset = null;

    for (let obs of obstacles) {
      if (!obs || !obs.pos) continue;

      let toObs = p5.Vector.sub(obs.pos, this.pos);
      let projection = toObs.dot(forward);

      // L'obstacle doit être devant le véhicule dans la fenêtre d'anticipation
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
   * Anticipe la trajectoire relative des autres agents pour prévenir les collisions futures.
   * @param {Array<Vehicle>} neighbors 
   * @param {number} maxTimeHorizon 
   * @returns {p5.Vector}
   */
  avoidVehicles(neighbors, maxTimeHorizon = 28) {
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

        let safetyDistance = this.r + (other.r || 14) + 16;

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
   * Suit une cible de commande (ex: index MediaPipe) selon le mode choisi ('arrive' ou 'seek'),
   * en combinant les forces avec priorité pour contourner les obstacles et éviter les véhicules.
   * @param {p5.Vector} target 
   * @param {'arrive'|'seek'} mode 
   * @param {Array<Obstacle>} obstacles 
   * @param {Array<Vehicle>} neighbors 
   */
  followTarget(target, mode = 'arrive', obstacles = [], neighbors = []) {
    if (!target) return;

    // 1. Force d'évitement d'obstacle (priorité max)
    let obsForce = this.avoidObstacles(obstacles);

    // 2. Force d'évitement prédictif des véhicules
    let vehForce = this.avoidVehicles(neighbors);

    // 3. Force d'objectif (arrive / seek)
    let goalForce = mode === 'arrive' ? this.arrive(target) : this.seek(target);

    // Combinaison par priorité : un risque imminent prime sur la consigne
    if (obsForce && obsForce.mag() > 0.05) {
      obsForce.mult(1.8);
      this.applyForce(obsForce);
      goalForce.mult(0.25);
    }
    if (vehForce && vehForce.mag() > 0.05) {
      vehForce.mult(1.4);
      this.applyForce(vehForce);
      goalForce.mult(0.5);
    }
    if (goalForce && goalForce.mag() > 0) {
      this.applyForce(goalForce);
    }
  }

  /**
   * Affiche les informations de débogage (cible, rayon de ralentissement, vitesse, direction).
   * @param {p5.Vector|null} target 
   * @param {'arrive'|'seek'} mode 
   * @param {number} slowingRadius 
   */
  drawDebug(target, mode = 'arrive', slowingRadius = 90) {
    push();

    // 1. Zone d'arrivée et lien vers la cible
    if (target) {
      if (mode === 'arrive') {
        noFill();
        stroke(0, 229, 255, 75);
        strokeWeight(1.5);
        circle(target.x, target.y, slowingRadius * 2);
      }

      stroke(255, 255, 255, 70);
      strokeWeight(1);
      line(this.pos.x, this.pos.y, target.x, target.y);

      // Vecteur vitesse désirée (orange)
      let desired = p5.Vector.sub(target, this.pos);
      let d = desired.mag();
      let speed = this.maxSpeed;
      if (mode === 'arrive' && d < slowingRadius) {
        speed = (d / slowingRadius) * this.maxSpeed;
      }
      desired.setMag(speed * 12);
      this.drawDebugArrow(this.pos, desired, '#f59e0b');
    }

    // 2. Vecteur vitesse actuelle (vert néon)
    if (this.vel && this.vel.mag() > 0.05) {
      let velVector = this.vel.copy().mult(12);
      this.drawDebugArrow(this.pos, velVector, '#10b981');
    }

    // 3. Télémétrie incrustée au-dessus du robot
    fill('#38bdf8');
    noStroke();
    textSize(10);
    textAlign(CENTER);
    let speedStr = `Vit: ${this.vel.mag().toFixed(1)} / ${this.maxSpeed.toFixed(1)}`;
    let modeStr = `[${mode.toUpperCase()}]`;
    text(`${modeStr} ${speedStr}`, this.pos.x, this.pos.y - this.r - 22);

    pop();
  }

  /**
   * Dessine une flèche de vecteur pour le débogage.
   */
  drawDebugArrow(origin, vector, col) {
    push();
    stroke(col);
    strokeWeight(2);
    fill(col);
    line(origin.x, origin.y, origin.x + vector.x, origin.y + vector.y);

    let arrowSize = 6;
    translate(origin.x + vector.x, origin.y + vector.y);
    rotate(vector.heading());
    triangle(0, 0, -arrowSize, arrowSize / 2, -arrowSize, -arrowSize / 2);
    pop();
  }

  /**
   * Surcharge de render() pour doter le robot d'un visuel sci-fi de maintenance.
   */
  render() {
    this.show();
  }

  /**
   * Rendu visuel soigné du robot de maintenance en vue du dessus.
   */
  show() {
    push();
    translate(this.pos.x, this.pos.y);
    rotate(this.heading);

    // 1. Phares directionnels projetés vers l'avant (faisceau lumineux d'ambiance)
    noStroke();
    fill(0, 229, 255, 12);
    triangle(this.r * 0.7, -5, this.r * 0.7 + 75, -28, this.r * 0.7 + 75, -2);
    triangle(this.r * 0.7, 5, this.r * 0.7 + 75, 2, this.r * 0.7 + 75, 28);

    // 2. Chenilles latérales / Pods de propulsion
    fill('#090d16');
    stroke('#334155');
    strokeWeight(1.5);
    rectMode(CENTER);
    rect(0, -this.r * 0.85, this.r * 1.7, 6, 2);
    rect(0, this.r * 0.85, this.r * 1.7, 6, 2);

    // Crans des chenilles
    stroke('#475569');
    strokeWeight(1);
    for (let i = -3; i <= 3; i++) {
      let tx = i * 4;
      line(tx, -this.r * 0.85 - 2, tx, -this.r * 0.85 + 2);
      line(tx, this.r * 0.85 - 2, tx, this.r * 0.85 + 2);
    }

    // 3. Flamme de propulsion arrière si le robot avance
    if (this.vel && this.vel.mag() > 0.2) {
      let flameLen = map(this.vel.mag(), 0, this.maxSpeed, 6, 18) + sin(frameCount * 0.6) * 3;
      noStroke();
      fill(0, 229, 255, 200);
      ellipse(-this.r - flameLen * 0.4, 0, flameLen, 7);
      fill('#ffffff');
      ellipse(-this.r - flameLen * 0.2, 0, flameLen * 0.5, 3);
    }

    // 4. Châssis métallique principal
    let chassisColor = this.damageTimer > 0 ? '#ef4444' : '#00e5ff';
    stroke(chassisColor);
    strokeWeight(1.8);
    fill('#0f172a'); // Titane graphite sombre
    beginShape();
    vertex(-this.r * 0.8, -this.r * 0.65);
    vertex(this.r * 0.45, -this.r * 0.65);
    vertex(this.r * 0.95, -this.r * 0.25);
    vertex(this.r * 0.95, this.r * 0.25);
    vertex(this.r * 0.45, this.r * 0.65);
    vertex(-this.r * 0.8, this.r * 0.65);
    vertex(-this.r * 0.95, 0);
    endShape(CLOSE);

    // 5. Bras d'outillage / pinces de maintenance avant avec jointures dorées
    stroke('#94a3b8');
    strokeWeight(2);
    line(this.r * 0.35, -this.r * 0.65, this.r * 0.85, -this.r * 0.45);
    line(this.r * 0.35, this.r * 0.65, this.r * 0.85, this.r * 0.45);
    fill('#ffd600');
    noStroke();
    circle(this.r * 0.85, -this.r * 0.45, 3);
    circle(this.r * 0.85, this.r * 0.45, 3);

    // 6. Noyau énergétique central réactif
    let energyRatio = this.energy / this.maxEnergy;
    let coreColor = energyRatio > 0.5 ? '#00e5ff' : (energyRatio > 0.25 ? '#ffd600' : '#ff3366');
    let corePulse = sin(frameCount * 0.15) * 1.5;

    fill(coreColor);
    circle(0, 0, 11 + corePulse);
    fill('#ffffff');
    circle(0, 0, 5);

    // 7. Visière de capteurs frontale
    fill('#38bdf8');
    rectMode(CENTER);
    rect(this.r * 0.45, 0, 4, 8, 1);

    // 8. Halo de bouclier si endommagé récemment
    if (this.damageTimer > 0) {
      noFill();
      stroke(239, 68, 68, this.damageTimer * 14);
      strokeWeight(2);
      circle(0, 0, (this.r + 8) * 2);
      this.damageTimer--;
    }

    // 8b. Champ de force déflecteur du Bouclier Protecteur
    if (this.isShieldActive()) {
      let shieldPulse = sin(frameCount * 0.2) * 3;
      let shieldAlpha = 140 + sin(frameCount * 0.3) * 60;

      // Sphère d'énergie extérieure
      noFill();
      stroke(56, 189, 248, shieldAlpha);
      strokeWeight(2.5);
      circle(0, 0, (this.r + 15 + shieldPulse) * 2);

      // Remplissage plasma semi-transparent
      fill(0, 229, 255, 35);
      circle(0, 0, (this.r + 14) * 2);

      // Maillage géométrique hexagonal rotatif
      push();
      rotate(frameCount * 0.04);
      stroke(56, 189, 248, 80);
      strokeWeight(1);
      beginShape();
      for (let i = 0; i < 6; i++) {
        let ang = TWO_PI / 6 * i;
        vertex(cos(ang) * (this.r + 13), sin(ang) * (this.r + 13));
      }
      endShape(CLOSE);
      pop();
    }

    pop();

    // 9. Jauge d'énergie au-dessus du robot
    this.drawEnergyBar();
  }

  /**
   * Dessine la jauge d'énergie du robot.
   */
  drawEnergyBar() {
    push();
    translate(this.pos.x, this.pos.y - this.r - 12);
    rectMode(CENTER);

    // Fond de la barre
    fill(15, 23, 42, 180);
    stroke('#334155');
    strokeWeight(1);
    rect(0, 0, 36, 6, 2);

    // Remplissage proportionnel
    let energyRatio = this.energy / this.maxEnergy;
    let barColor = energyRatio > 0.5 ? '#00e5ff' : (energyRatio > 0.25 ? '#ffd600' : '#ff3366');
    fill(barColor);
    noStroke();
    rectMode(CORNER);
    rect(-17, -2, 34 * energyRatio, 4, 1);

    pop();
  }
}
