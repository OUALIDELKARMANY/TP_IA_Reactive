/**
 * Space Station — Robot de maintenance
 * battery.js : Cellule énergétique à collecter.
 * Hérite de la classe Vehicle existante (statique : physique désactivée).
 */

class Battery extends Vehicle {
  constructor(x, y, energyValue = 35) {
    // Vitesse et force maximales nulles
    super(x, y, 0, 0);

    this.isStatic = true;
    this.r = 14;
    this.energyValue = energyValue;
    this.collected = false;

    // Effet visuel d'absorption lors de la collecte
    this.collectEffectTimer = 0;

    // Déphasage d'animation lumineuse
    this.pulseOffset = random(100);
  }

  /**
   * Objet statique : n'accumule aucune accélération.
   */
  applyForce(force) {}

  /**
   * Objet statique : ne modifie ni vitesse ni position.
   */
  update() {
    if (this.collectEffectTimer > 0) {
      this.collectEffectTimer--;
    }
  }

  /**
   * Tente de collecter la batterie si le robot entre dans son rayon de collecte.
   * Empêche toute collecte multiple.
   * @param {PlayerRobot} robot 
   * @returns {boolean} true si la batterie a été collectée
   */
  checkCollection(robot) {
    if (this.collected || !robot) return false;

    const d = p5.Vector.dist(this.pos, robot.pos);
    const collectionRadius = this.r + robot.r + 8; // Rayon de contact

    if (d <= collectionRadius) {
      this.collected = true;
      this.collectEffectTimer = 25; // 25 frames d'effet visuel
      robot.recharge(this.energyValue);
      robot.batteriesCollected = (robot.batteriesCollected || 0) + 1;
      return true;
    }
    return false;
  }

  render() {
    this.show();
  }

  /**
   * Rendu visuel d'une cellule d'énergie dorée avec halo lumineux.
   */
  show() {
    // Si déjà collectée, affichage éventuel de l'onde d'absorption
    if (this.collected) {
      if (this.collectEffectTimer > 0) {
        push();
        translate(this.pos.x, this.pos.y);
        noFill();
        let alpha = map(this.collectEffectTimer, 25, 0, 200, 0);
        let rad = map(this.collectEffectTimer, 25, 0, this.r, this.r * 3.5);
        stroke(255, 214, 0, alpha);
        strokeWeight(2);
        circle(0, 0, rad * 2);
        pop();
      }
      return;
    }

    let pulse = sin(frameCount * 0.08 + this.pulseOffset) * 2;

    push();
    translate(this.pos.x, this.pos.y);

    // 1. Halo lumineux externe (ambre/jaune)
    noStroke();
    fill(255, 214, 0, 45 + pulse * 12);
    circle(0, 0, (this.r + 7 + pulse) * 2);

    // 2. Boîtier de la cellule
    stroke('#ffd600');
    strokeWeight(1.5);
    fill('#1e293b');
    rectMode(CENTER);
    rect(0, 0, this.r * 1.6, this.r * 1.2, 3);

    // 3. Bornes de connexion métalliques
    fill('#cbd5e1');
    noStroke();
    rect(-this.r * 0.7, 0, 3, 6, 1);
    rect(this.r * 0.7, 0, 3, 6, 1);

    // 4. Noyau d'énergie jaune luisant
    fill('#ffd600');
    rect(0, 0, this.r * 0.9, this.r * 0.7, 2);

    // 5. Symbole d'éclair intérieur
    stroke('#ffffff');
    strokeWeight(1.5);
    noFill();
    beginShape();
    vertex(1, -4);
    vertex(-2, 1);
    vertex(1, 1);
    vertex(-1, 5);
    endShape();

    // 6. Étiquette de valeur énergétique
    noStroke();
    fill('#ffd600');
    textSize(9);
    textAlign(CENTER, TOP);
    text(`+${this.energyValue}`, 0, this.r * 0.8);

    pop();
  }
}
