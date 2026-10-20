// Adaptation de l'arrivée de 3-Arrival_correction au Vehicle de cet exemple.
class SnakeSegment extends Vehicle {
  constructor(x, y, taille, couleur) {
    super(x, y, 3, 0.3);
    this.r = taille;
    this.couleur = couleur;
  }

  arrive(target, spacing = 20) {
    const distance = p5.Vector.dist(this.pos, target);
    const speed = this.maxSpeed * constrain((distance - spacing) / 60, 0, 1);
    const desired = p5.Vector.sub(target, this.pos).setMag(speed);
    return desired.sub(this.vel).limit(this.maxForce);
  }
}
