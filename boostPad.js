/**
 * Space Station — Robot de maintenance
 * boostPad.js : Zone d'accélération turbo de la station spatiale.
 * Hérite obligatoirement de la classe Vehicle existante (statique).
 * Rôle : propulse cinématiquement le robot pour lui permettre de distancer les drones.
 */

class BoostPad extends Vehicle {
  /**
   * @param {number} x Centre X
   * @param {number} y Centre Y
   * @param {number} angleRad Direction de propulsion (radians)
   * @param {number} boostPower Puissance d'impulsion de vitesse
   * @param {number} w Largeur du pad
   * @param {number} h Hauteur du pad
   */
  constructor(x, y, angleRad = 0, boostPower = 8.5, w = 70, h = 42) {
    super(x, y, 0, 0);

    this.isStatic = true;
    this.r = Math.max(w, h) / 2;
    this.w = w;
    this.h = h;
    this.angle = angleRad;
    this.boostPower = boostPower;

    // Vecteur de direction de l'accélération
    this.dir = typeof p5 !== 'undefined' && p5.Vector?.fromAngle
      ? p5.Vector.fromAngle(angleRad)
      : createVector(Math.cos(angleRad), Math.sin(angleRad));

    // Délai anti-rebond pour éviter une propulsion infinie
    this.cooldowns = new Map();
  }

  /**
   * Objet statique : physique désactivée.
   */
  applyForce(force) {}
  update() {
    // Décrémente les cooldowns des véhicules ayant emprunté le pad
    for (let [veh, time] of this.cooldowns.entries()) {
      if (time > 0) {
        this.cooldowns.set(veh, time - 1);
      } else {
        this.cooldowns.delete(veh);
      }
    }
  }

  /**
   * Vérifie si le robot roule sur le boost pad et applique l'accélération.
   * @param {PlayerRobot} robot 
   * @returns {boolean} true si l'accélération a été déclenchée
   */
  checkBoost(robot) {
    if (!robot || !robot.pos) return false;

    // Vérification du cooldown
    if (this.cooldowns.has(robot) && this.cooldowns.get(robot) > 0) {
      return false;
    }

    // Distance par rapport au centre du pad
    let d = p5.Vector.dist(this.pos, robot.pos);
    if (d < this.r * 0.9) {
      // Impulsion cinématique puissante dans la direction du pad
      let impulse = this.dir.copy().setMag(this.boostPower);
      robot.vel.add(impulse);
      robot.vel.limit(robot.maxSpeed * 1.8); // Permet un surcroît de vitesse temporaire

      this.cooldowns.set(robot, 50); // Cooldown de ~0.8s

      if (typeof window.createFloatingText === 'function') {
        window.createFloatingText(this.pos.x, this.pos.y - 20, '⚡ TURBO BOOST !', '#00e5ff');
      }
      if (typeof window.createSparks === 'function') {
        window.createSparks(this.pos.x, this.pos.y, 14, '#00e5ff');
      }
      return true;
    }

    return false;
  }

  /**
   * Rendu visuel des chevrons néon animés.
   */
  show() {
    push();
    translate(this.pos.x, this.pos.y);
    rotate(this.angle);

    rectMode(CENTER);

    // 1. Dalle de sol blindée avec liseré cyan
    fill('#081528');
    stroke('#00e5ff');
    strokeWeight(1.8);
    rect(0, 0, this.w, this.h, 8);

    // 2. Chevrons directionnels animés défilants
    const chevronCount = 3;
    const animOffset = (frameCount * 1.6) % 18;

    stroke('#00e5ff');
    strokeWeight(2.5);
    noFill();

    for (let i = 0; i < chevronCount; i++) {
      let cx = -this.w * 0.3 + i * (this.w * 0.3) + (animOffset * 0.4);
      if (cx > this.w * 0.38) cx -= this.w * 0.8;

      let alphaVal = map(cx, -this.w * 0.4, this.w * 0.4, 60, 255);
      stroke(0, 229, 255, constrain(alphaVal, 40, 255));

      beginShape();
      vertex(cx - 8, -this.h * 0.3);
      vertex(cx + 4, 0);
      vertex(cx - 8, this.h * 0.3);
      endShape();
    }

    // 3. Indicateurs latéraux d'énergie
    noStroke();
    fill('#38bdf8');
    circle(-this.w * 0.42, 0, 5);
    circle(this.w * 0.42, 0, 5);

    pop();
  }
}
