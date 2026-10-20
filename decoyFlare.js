/**
 * Space Station — Robot de maintenance
 * decoyFlare.js : Leurre thermique / impulsion EMP largué par le joueur.
 * Hérite obligatoirement de la classe Vehicle existante.
 * Rôle : attire et déconcentre les drones de sécurité hostiles à portée.
 */

class DecoyFlare extends Vehicle {
  constructor(x, y, dirVector = null, maxLifetime = 240) {
    // Vitesse modérée pour la dérive du leurre
    super(x, y, 2.5, 0.15);

    this.r = 12;
    this.couleur = '#f59e0b'; // Ambre incandescent
    this.isStatic = false;

    // Propulsion initiale dans la direction de lancement
    if (dirVector && typeof dirVector.copy === 'function') {
      this.vel = dirVector.copy().setMag(this.maxSpeed * 0.9);
    } else if (typeof p5 !== 'undefined' && p5.Vector?.random2D) {
      this.vel = p5.Vector.random2D().mult(this.maxSpeed * 0.7);
    } else {
      this.vel = createVector(0, 0);
    }

    // Durée de vie du leurre (frames)
    this.lifetime = Number(maxLifetime) || 240; // ~4 secondes à 60 FPS
    this.maxLifetime = this.lifetime;

    // Rayon d'attraction électromagnétique sur les drones hostiles
    this.attractionRadius = 260;

    // État actif
    this.expired = false;
  }

  /**
   * Met à jour la position et l'énergie du leurre.
   */
  update() {
    if (this.expired) return;

    // Amortissement de déplacement
    this.vel.mult(0.96);
    this.pos.add(this.vel);

    this.lifetime--;
    if (this.lifetime <= 0) {
      this.expired = true;
    }

    // Émission continue d'étincelles d'interférence
    if (this.lifetime % 8 === 0 && typeof window.createSparks === 'function') {
      window.createSparks(this.pos.x, this.pos.y, 3, '#f59e0b');
    }
  }

  /**
   * Vérifie si le leurre est actif et capable de distraire.
   * @returns {boolean}
   */
  isDistracting() {
    return !this.expired;
  }

  /**
   * Vérifie si un drone se trouve dans le rayon de déconcentration.
   * @param {Vehicle} drone 
   * @returns {boolean}
   */
  isDroneInRange(drone) {
    if (!drone || !drone.pos || this.expired) return false;
    return p5.Vector.dist(this.pos, drone.pos) <= this.attractionRadius;
  }

  /**
   * Rendu visuel d'une balise émettrice pulsante.
   */
  show() {
    if (this.expired) return;

    push();
    translate(this.pos.x, this.pos.y);

    let lifeRatio = this.lifetime / this.maxLifetime;
    let pulse = sin(frameCount * 0.25) * 6;

    // 1. Onde électromagnétique pulsante (rayon d'attraction)
    noFill();
    let waveAlpha = (60 + sin(frameCount * 0.2) * 40) * lifeRatio;
    stroke(245, 158, 11, waveAlpha);
    strokeWeight(1.2);
    circle(0, 0, (this.attractionRadius * 0.6 + pulse * 2) * 2);

    // 2. Halo lumineux chaud
    fill(245, 158, 11, 40 * lifeRatio);
    noStroke();
    circle(0, 0, (this.r * 2.8 + pulse));

    // 3. Cœur d'énergie incandescent
    fill('#ffffff');
    circle(0, 0, this.r * 0.8);
    fill('#f59e0b');
    circle(0, 0, this.r * 1.5);

    // 4. Étiquette holographique
    fill('#f59e0b');
    textSize(9);
    textAlign(CENTER, BOTTOM);
    noStroke();
    text("LEURRE EMP", 0, -this.r - 4);

    pop();
  }
}
