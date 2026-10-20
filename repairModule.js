/**
 * Space Station — Robot de maintenance
 * repairModule.js : Module technique de la station à réparer.
 * Hérite de la classe Vehicle existante (statique : physique désactivée).
 */

class RepairModule extends Vehicle {
  constructor(x, y, name = "Module-Alpha", integrity = 25) {
    super(x, y, 0, 0);

    this.isStatic = true;
    this.r = 24;
    this.name = name;
    this.integrity = integrity;
    this.maxIntegrity = 100;

    // Rayon d'interaction pour la réparation
    this.repairRange = 62;

    // État de réparation active pendant la frame courante
    this.isRepairing = false;
  }

  get isRepaired() {
    return this.integrity >= this.maxIntegrity;
  }

  /**
   * Objet statique : n'accumule aucune accélération.
   */
  applyForce(force) {}

  /**
   * Objet statique : ne modifie ni vitesse ni position.
   */
  update() {}

  /**
   * Vérifie si le robot est à portée d'intervention.
   * @param {PlayerRobot} robot 
   * @returns {boolean}
   */
  isRobotInRange(robot) {
    if (!robot) return false;
    return p5.Vector.dist(this.pos, robot.pos) <= this.repairRange;
  }

  /**
   * Augmente l'intégrité du module jusqu'à sa valeur maximale.
   * @param {number} amount 
   * @returns {boolean} true si le module est réparé
   */
  repair(amount) {
    this.integrity = Math.min(this.maxIntegrity, this.integrity + amount);
    return this.isRepaired;
  }

  /**
   * Exécute une étape de réparation si le robot est à portée et dispose d'énergie.
   * @param {PlayerRobot} robot 
   * @param {number} rate Taux de réparation (en %)
   * @param {number} energyCost Coût énergétique
   * @returns {boolean} true si la réparation est active
   */
  performRepair(robot, rate = 0.55, energyCost = 0.22) {
    if (this.isRepaired || !this.isRobotInRange(robot) || robot.energy <= 0) {
      this.isRepairing = false;
      return false;
    }

    robot.consumeEnergy(energyCost);
    this.repair(rate);
    this.isRepairing = true;
    return true;
  }

  render() {
    this.show();
  }

  /**
   * Rendu visuel d'une console technique avec jauges et effets de réparation.
   * @param {PlayerRobot|null} robot 
   */
  show(robot = null) {
    push();
    translate(this.pos.x, this.pos.y);

    let statusColor = this.isRepaired ? '#10b981' : (this.integrity > 50 ? '#f59e0b' : '#ef4444');
    let inRange = robot ? this.isRobotInRange(robot) : false;

    // 1. Cercle d'interaction si le robot est à proximité et le module non réparé
    if (!this.isRepaired && inRange) {
      noFill();
      stroke(0, 229, 255, 100 + sin(frameCount * 0.15) * 40);
      if (typeof drawingContext !== 'undefined' && drawingContext?.setLineDash) {
        drawingContext.setLineDash([4, 4]);
      }
      circle(0, 0, this.repairRange * 2);
      if (typeof drawingContext !== 'undefined' && drawingContext?.setLineDash) {
        drawingContext.setLineDash([]);
      }
    }

    // 2. Embase hexagonale de la console
    stroke('#334155');
    strokeWeight(2);
    fill('#0f172a');
    beginShape();
    for (let i = 0; i < 6; i++) {
      let angle = TWO_PI / 6 * i;
      let px = cos(angle) * (this.r + 2);
      let py = sin(angle) * (this.r + 2);
      vertex(px, py);
    }
    endShape(CLOSE);

    // 3. Anneau de statut lumineux
    stroke(statusColor);
    strokeWeight(2);
    noFill();
    circle(0, 0, this.r * 1.5);

    // 4. Panneau central
    fill('#1e293b');
    noStroke();
    circle(0, 0, this.r);

    // 5. Voyant de fonctionnement
    if (!this.isRepaired && sin(frameCount * 0.12) > 0) {
      fill(statusColor);
      circle(0, 0, 8);
    } else if (this.isRepaired) {
      fill(statusColor);
      circle(0, 0, 8);
    }

    pop();

    // 6. Faisceau laser de soudure / réparation si en cours
    if (this.isRepairing && robot) {
      this.drawRepairLaser(robot);
    }

    // 7. Jauge d'intégrité et invite d'interaction
    this.drawIntegrityBar(statusColor, inRange);

    // Réinitialisation de l'état de réparation pour la frame suivante
    this.isRepairing = false;
  }

  /**
   * Dessine le laser de réparation entre le robot et le module.
   * @param {PlayerRobot} robot 
   */
  drawRepairLaser(robot) {
    push();
    stroke(0, 229, 255, 180 + sin(frameCount * 0.4) * 60);
    strokeWeight(2);
    line(robot.pos.x, robot.pos.y, this.pos.x, this.pos.y);

    // Étincelles au point de contact
    noStroke();
    fill('#ffffff');
    circle(this.pos.x + random(-4, 4), this.pos.y + random(-4, 4), random(3, 7));
    fill('#00e5ff');
    circle(this.pos.x + random(-6, 6), this.pos.y + random(-6, 6), random(4, 9));
    pop();
  }

  /**
   * Dessine l'étiquette, la jauge d'intégrité et le prompt d'action.
   */
  drawIntegrityBar(statusColor, inRange) {
    push();
    translate(this.pos.x, this.pos.y - this.r - 14);

    // Nom du module
    fill('#94a3b8');
    noStroke();
    textAlign(CENTER);
    textSize(10);
    text(this.name, 0, -4);

    // Fond de jauge
    rectMode(CENTER);
    fill(15, 23, 42, 200);
    stroke('#334155');
    strokeWeight(1);
    rect(0, 4, 46, 6, 2);

    // Remplissage proportionnel
    let ratio = this.integrity / this.maxIntegrity;
    rectMode(CORNER);
    fill(statusColor);
    noStroke();
    rect(-22, 2, 44 * ratio, 4, 1);

    // Prompt d'interaction si le robot est à portée
    if (!this.isRepaired && inRange) {
      fill('#00e5ff');
      textSize(9);
      textAlign(CENTER, TOP);
      text("MAINTENIR [E] RÉPARER", 0, 10);
    } else if (this.isRepaired) {
      fill('#10b981');
      textSize(8);
      textAlign(CENTER, TOP);
      text("OPÉRATIONNEL", 0, 10);
    }

    pop();
  }
}
