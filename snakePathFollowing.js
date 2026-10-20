// La tête suit le chemin ; le corps reprend le suivi en arrive du Snake original.
class SnakePathFollowing extends Snake {
  constructor(x, y, length = 12, taille = 22, couleur = '#268550') {
    super(x, y, length, taille, couleur);
    this.followWeight = 2;
    this.separationWeight = 1.2;
    this.ringSpacing = 20;
  }

  setRingSpacing(spacing) {
    const value = Number(spacing);
    if (Number.isFinite(value)) this.ringSpacing = Math.max(1, value);
  }

  setSize(taille) {
    const value = Number(taille);
    if (!Number.isFinite(value)) return;
    this.r = Math.max(1, value);
    this.head.r = this.r;
    for (let index = 1; index < this.anneaux.length; index++) {
      this.anneaux[index].r = this.r * 0.9;
    }
  }

  move(path, neighbors) {
    this.head.applyForce(this.head.follow(path).mult(this.followWeight));
    this.head.applyForce(this.head.separate(neighbors).mult(this.separationWeight));
    this.head.update();
    for (let index = 1; index < this.anneaux.length; index++) {
      const ring = this.anneaux[index];
      const previous = this.anneaux[index - 1];
      ring.applyForce(ring.arrive(previous.pos, this.ringSpacing));
      // Le corps connecté du même serpent ne se repousse pas lui-même.
      ring.applyForce(ring.separate(neighbors).mult(this.separationWeight));
      ring.update();
    }
  }
}
