class Snake extends Vehicle {
    constructor(x, y, length, taille, couleur) {
        super(x, y, 3, 0.3);
        this.anneaux = [];
        this.couleur = couleur;
        this.r = taille;
        this.voirLangue = false;

        // On crée la tête du snake
        this.head = new SnakeSegment(x, y, taille, this.couleur);
        this.anneaux.push(this.head);

        // On crée les anneaux suivants
        for (let i = 1; i < length; i++) {
            let anneau = new SnakeSegment(x - i * 20, y, taille * 0.9, this.couleur);
            anneau.maxForce = 2;
            anneau.maxSpeed = 10;
            this.anneaux.push(anneau);
        }
    }

    move(target) {
        // La tête arrive à la cible
        let force = this.head.arrive(target);
        this.head.applyForce(force);
        this.head.update();

        // Chaque anneau suit l'anneau précédent
        for (let i = 1; i < this.anneaux.length; i++) {
            let cible = this.anneaux[i - 1].pos;
            let force = this.anneaux[i].arrive(cible, 20);
            this.anneaux[i].applyForce(force);
            this.anneaux[i].update();
        }
    }
    
    show() {
        this.dessineTete();
        this.dessineLesAnneaux();
    }

    dessineTete() {
        // On dessine la tête comme un cercle avec deux yeux
        push();
        fill(this.couleur);
        noStroke();
        circle(this.head.pos.x, this.head.pos.y, this.r);
        
        // yeux
        let eyeOffsetX = this.r / 6;
        let eyeOffsetY = this.r / 6;
        let eyeSize = this.r / 5;
        fill(255); // blanc des yeux
        circle(this.head.pos.x - eyeOffsetX, this.head.pos.y - eyeOffsetY, eyeSize);
        circle(this.head.pos.x + eyeOffsetX, this.head.pos.y - eyeOffsetY, eyeSize);
        pop();
    }

    dessineLesAnneaux() {
        // On dessine les anneaux du corps du snake
        this.anneaux.forEach((anneau, index) => {
            if (index === 0) return; // on ne redessine pas la tête
            // On veut que la couleur aille de this.couleur à une couleur plus foncée
            let inter = map(index, 0, this.anneaux.length - 1, 0, 1);
            let couleurAnneau = lerpColor(color(this.couleur), color(0, 100, 0), inter);
            
            push();
            fill(couleurAnneau);
            noStroke();
            circle(anneau.pos.x, anneau.pos.y, this.r * 0.9); // anneaux un peu plus petits que la tête
            pop();
        });
    }
}
