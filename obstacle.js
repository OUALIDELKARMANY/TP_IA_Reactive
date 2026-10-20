/**
 * Space Station — Robot de maintenance
 * obstacle.js : Obstacles de la station (piliers générateurs et cloisons).
 * Hérite de la classe Vehicle existante (statique : physique désactivée).
 */

class Obstacle extends Vehicle {
  /**
   * @param {number} x Centre X
   * @param {number} y Centre Y
   * @param {number} rOrW Rayon (si circulaire) ou Largeur (si rectangulaire)
   * @param {number|null} h Hauteur (null si circulaire)
   * @param {string} type 'pillar' ou 'wall'
   */
  constructor(x, y, rOrW = 24, h = null, type = 'pillar') {
    super(x, y, 0, 0);

    this.isStatic = true;
    this.type = type;

    if (h === null || type === 'pillar') {
      this.r = rOrW;
      this.isCircular = true;
      this.w = rOrW * 2;
      this.h = rOrW * 2;
    } else {
      this.w = rOrW;
      this.h = h;
      this.r = Math.max(this.w, this.h) / 2;
      this.isCircular = false;
    }
  }

  /**
   * Objet statique : n'accumule aucune accélération.
   */
  applyForce(force) {}

  /**
   * Objet statique : ne modifie ni vitesse ni position.
   */
  update() {}

  render() {
    this.show();
  }

  /**
   * Rendu visuel d'un obstacle métallique renforcé.
   */
  show() {
    push();
    translate(this.pos.x, this.pos.y);

    if (this.isCircular) {
      // Pilier réacteur de confinement
      noStroke();
      fill(0, 229, 255, 12 + sin(frameCount * 0.1) * 6);
      circle(0, 0, (this.r + 6) * 2);

      // Blindage externe en acier renforcé
      stroke('#475569');
      strokeWeight(2.5);
      fill('#0f172a');
      circle(0, 0, this.r * 2);

      // Anneau intermédiaire
      stroke('#334155');
      strokeWeight(1.5);
      fill('#1e293b');
      circle(0, 0, this.r * 1.3);

      // Noyau énergétique cyan pulsant
      fill('#00e5ff');
      noStroke();
      circle(0, 0, 10 + sin(frameCount * 0.12) * 2);
      fill('#ffffff');
      circle(0, 0, 4);

      // Rivets périphériques
      fill('#94a3b8');
      for (let i = 0; i < 6; i++) {
        let a = (TWO_PI / 6) * i;
        circle(cos(a) * (this.r * 0.75), sin(a) * (this.r * 0.75), 3);
      }
    } else {
      // Cloison / mur blindé avec hachures de sécurité jaunes/noires
      rectMode(CENTER);

      stroke('#475569');
      strokeWeight(2.5);
      fill('#0f172a');
      rect(0, 0, this.w, this.h, 4);

      // Bandes hachurées d'avertissement de zone
      push();
      stroke(245, 158, 11, 140);
      strokeWeight(1.8);
      let step = 16;
      if (this.w > this.h) {
        for (let x = -this.w / 2 + 8; x < this.w / 2 - 8; x += step) {
          line(x, -this.h / 2 + 3, x + 6, this.h / 2 - 3);
        }
      } else {
        for (let y = -this.h / 2 + 8; y < this.h / 2 - 8; y += step) {
          line(-this.w / 2 + 3, y, this.w / 2 - 3, y + 6);
        }
      }
      pop();

      // Témoin lumineux central de la cloison
      noStroke();
      fill(sin(frameCount * 0.1) > 0 ? '#00e5ff' : '#0284c7');
      circle(0, 0, 5);
    }

    pop();
  }
}
