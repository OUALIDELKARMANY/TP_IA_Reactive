# Serpents et suivi de chemin complexe

Ouvrir `index.html` avec un serveur HTTP. Un serpent apparaît au départ ; **T** crée un serpent au pointeur. **D** active le debug, et glisser dans le canvas ajoute des véhicules ordinaires.

Les curseurs règlent en direct les poids **follow** (0–5, défaut 2) et **séparation** (0–5, défaut 1,2) de tous les serpents, y compris ceux créés ensuite. La **largeur du circuit** (10–100 pixels) contrôle le rayon de suivi utilisé par `Vehicle.follow()` et l'épaisseur visuelle du chemin. La **distance entre anneaux** (5–80 pixels) est passée à l'arrivée de chaque anneau. La **taille des serpents** (8–60 pixels) modifie le rayon de la tête et des anneaux.

`snake.js` reprend la composition et le dessin de `3-Arrival_correction/snake.js`. `SnakePathFollowing` spécialise son déplacement : la tête réutilise `Vehicle.follow(path)` ; les anneaux suivent leur prédécesseur en `arrive`. Le poids follow concerne la tête afin de conserver le corps articulé. Tête et anneaux utilisent `Vehicle.separate()` contre les véhicules et les autres serpents. Les anneaux d'un même serpent sont exclus de ce voisinage pour éviter de désassembler le corps. Les véhicules ordinaires se séparent aussi du corps des serpents.

`SnakeSegment extends Vehicle` fournit l'arrivée avec un espacement réglable, car le Vehicle local ne possède pas `arrive()`. Les forces sont combinées avant une seule intégration héritée par segment. Chaque serpent exclut sa propre liste d'anneaux du voisinage de séparation, mais conserve les véhicules ordinaires et les anneaux des autres serpents. `snakeWander.js`, qui n'est pas utilisé pour ce scénario, n'est pas chargé. Aucun `vehicle.js` ni fichier source de `3-Arrival_correction` n'est modifié.

La séparation est une force d'évitement souple ; un poids nul la désactive et une forte densité peut encore produire des chevauchements.

Tests : `node --test 5-3-PathFollowingComplex/tests/*.test.mjs` depuis la racine. Ils couvrent l'héritage, l'espacement, la composition pondérée, les vraies méthodes follow/separate, la stabilité et les contrôles.
