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

    // Système de réouverture périodique des batteries
    this.respawnTimer = 0;
    this.respawnDelay = 600; // ~10 secondes à 60 FPS
    this.isRecharging = false;
    this.openProgress = 1; // 0 (fermé) à 1 (ouvert)
  }

  /**
   * Objet statique : n'accumule aucune accélération.
   */
  applyForce(force) {}

  /**
   * Mise à jour de l'effet de collecte et gestion du rechargement / réouverture périodique.
   * Si la batterie est collectée, elle commence un cycle de régénération et se rouvre.
   * Si le joueur est en état d'énergie critique (< 30%), la réouverture s'accélère.
   * @param {PlayerRobot} [playerRobot]
   */
  update(playerRobot = null) {
    if (this.collectEffectTimer > 0) {
      this.collectEffectTimer--;
    }

    if (this.collected) {
      // Si le joueur est faible en énergie (< 30%), la batterie se régénère 2x plus vite
      let speedFactor = (playerRobot && playerRobot.energy < 30) ? 2 : 1;
      this.respawnTimer += speedFactor;

      if (this.respawnTimer >= this.respawnDelay) {
        this.reopen();
      }
    }
  }

  /**
   * Rouvre la batterie pour permettre une nouvelle recharge
   */
  reopen() {
    this.collected = false;
    this.respawnTimer = 0;
    this.collectEffectTimer = 0;
    if (typeof window !== 'undefined' && typeof window.createSparks === 'function') {
      window.createSparks(this.pos.x, this.pos.y, 14, '#00e5ff');
    }
    if (typeof window !== 'undefined' && typeof window.createFloatingText === 'function') {
      window.createFloatingText(this.pos.x, this.pos.y - 10, 'BATTERIE DISPONIBLE !', '#00e5ff');
    }
  }

  /**
   * Tente de collecter la batterie si le robot entre dans son rayon de collecte.
   * Empêche toute collecte multiple tant qu'elle n'est pas réouverte.
   * @param {PlayerRobot} robot 
   * @returns {boolean} true si la batterie a été collectée
   */
  checkCollection(robot) {
    if (this.collected || !robot) return false;

    const d = p5.Vector.dist(this.pos, robot.pos);
    const collectionRadius = this.r + robot.r + 8; // Rayon de contact

    if (d <= collectionRadius) {
      this.collected = true;
      this.respawnTimer = 0;
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
    // Si collectée : on affiche le socle de chargement avec jauge de réouverture
    if (this.collected) {
      push();
      translate(this.pos.x, this.pos.y);

      // Onde d'absorption initiale
      if (this.collectEffectTimer > 0) {
        noFill();
        let alpha = map(this.collectEffectTimer, 25, 0, 200, 0);
        let rad = map(this.collectEffectTimer, 25, 0, this.r, this.r * 3.5);
        stroke(255, 214, 0, alpha);
        strokeWeight(2);
        circle(0, 0, rad * 2);
      }

      // Socle métallique fermé en recharge
      stroke('#334155');
      strokeWeight(1.2);
      fill('#0f172a');
      circle(0, 0, this.r * 1.8);

      // Anneau de progression de la réouverture (cyan/bleu électrique)
      let progress = typeof constrain === 'function' ? constrain(this.respawnTimer / this.respawnDelay, 0, 1) : Math.min(1, Math.max(0, this.respawnTimer / this.respawnDelay));
      noFill();
      stroke('#00e5ff');
      strokeWeight(2);
      if (typeof arc === 'function') {
        let halfPi = typeof HALF_PI !== 'undefined' ? HALF_PI : Math.PI / 2;
        let twoPi = typeof TWO_PI !== 'undefined' ? TWO_PI : Math.PI * 2;
        arc(0, 0, this.r * 1.8, this.r * 1.8, -halfPi, -halfPi + twoPi * progress);
      } else {
        circle(0, 0, this.r * 1.8 * progress);
      }

      // Icône de chargement ou pulsation
      let fCount = typeof frameCount !== 'undefined' ? frameCount : 0;
      fill(0, 229, 255, 80 + Math.sin(fCount * 0.1) * 60);
      noStroke();
      circle(0, 0, this.r * 0.6);

      // Décompte ou texte indicatif
      fill('#94a3b8');
      textSize(8);
      textAlign(CENTER, TOP);
      let secLeft = Math.ceil((this.respawnDelay - this.respawnTimer) / 60);
      text(`Recharge ${secLeft}s`, 0, this.r * 1.1);

      pop();
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
