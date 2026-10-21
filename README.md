# 🚀 Space Station : Robot de Maintenance (Projet Steering Behaviours & IA Réactive)

Ce projet est une application interactive et ludique d'**Intelligence Artificielle Réactive** basée sur les travaux fondateurs de **Craig W. Reynolds** (*« Steering Behaviors for Autonomous Characters »*, GDC 1999) et enrichie par de la **vision par ordinateur (MediaPipe)** ainsi qu'un moteur de rendu **p5.js**.

---

## 📋 Table des Matières
1. [Vue d'ensemble et Scénario du Jeu](#vue-densemble-et-scénario-du-jeu)
2. [Architecture et Règles Fondamentales](#architecture-et-règles-fondamentales)
3. [Détail des Algorithmes de Steering Behaviours](#détail-des-algorithmes-de-steering-behaviours)
4. [Entités et Comportements Réactifs](#entités-et-comportements-réactifs)
5. [Améliorations et Mécaniques Spéciales](#améliorations-et-mécaniques-spéciales)
6. [Contrôles et Guide d'Utilisation](#contrôles-et-guide-dutilisation)
7. [Validation et Tests Automatisés](#validation-et-tests-automatisés)

---

## 1. 🌌 Vue d'ensemble et Scénario du Jeu

Vous incarnez le **Robot de Maintenance principal** d'une station spatiale futuriste endommagée.
- **Mission** : Restaurer l'intégrité de la station en réparant **4 modules vitaux** (Oxygène, Générateur, Sas et Télécommunications).
- **Contraintes** :
  - Votre robot consomme de l'**énergie** en se déplaçant et en effectuant les réparations.
  - Des **drones de sécurité hostiles** patrouillent dans les coursives et se lancent à votre poursuite dès que vous entrez dans leur champ de détection.
  - La station est encombrée d'**obstacles physiques** (piliers, réacteurs, sas) qu'il faut contourner.
- **Ressources** : Des **batteries de secours** disséminées sur la carte permettent de recharger l'énergie du robot.

---

## 2. 🏛️ Architecture et Règles Fondamentales

### Respect strict du modèle de Craig W. Reynolds
Conformément aux consignes du cours d'IA Réactive :
1. **Séparation Action / Steering / Locomotion** :
   - *Sélection d'action* : l'agent choisit son but actuel (patrouiller, fuir, poursuivre, assister).
   - *Steering* : l'agent calcule une force géométrique de pilotage $\vec{F}_{\text{steer}} = \vec{v}_{\text{desired}} - \vec{v}_{\text{current}}$ limitée à `maxForce`.
   - *Locomotion* : la force est intégrée via `applyForce(\vec{f})` puis `update()` applique l'accélération et met à jour la position (`position += velocity`). Aucune entité n'est téléportée ni déplacée manuellement.
2. **Tout objet visible est un `Vehicle`** :
   - Le robot joueur (`PlayerRobot`), les drones (`MaintenanceDrone`, `SecurityDrone`), les leurres EMP (`DecoyFlare`), les accélérateurs (`BoostPad`), les obstacles (`Obstacle`), les batteries (`Battery`) et les modules (`RepairModule`) héritent tous obligatoirement de la classe originale `Vehicle`.
   - Les objets statiques héritent de `Vehicle` tout en conservant une vitesse et accélération nulles afin de respecter le contrat sans dérive physique.
3. **`vehicle.js` intact** :
   - Le fichier de base fourni pour le TP n'a subi aucune modification. Les nouveaux comportements sont implémentés dans des classes dérivées modulaires.

---

## 3. 🧠 Détail des Algorithmes de Steering Behaviours

Chaque agent combine un ensemble de forces élémentaires selon des priorités et des pondérations adaptées à son rôle :

### A. Seek (Recherche / Attraction simple)
- **Principe** : Oriente le véhicule directement vers une coordonnée cible à vitesse maximale.
- **Calcul** :
  $$\vec{v}_{\text{desired}} = \text{normalize}(\vec{P}_{\text{cible}} - \vec{P}_{\text{véhicule}}) \times v_{\text{max}}$$
  $$\vec{F}_{\text{steer}} = \text{truncate}(\vec{v}_{\text{desired}} - \vec{v}_{\text{current}}, F_{\text{max}})$$
- **Usage** : Déplacement franc vers une batterie de secours ou un point de ralliement.

### B. Arrive (Arrivée avec décélération douce)
- **Principe** : Comportement de rapprochement identique à `seek` à longue distance, mais qui décélère progressivement lorsque la distance passe sous un seuil d'amortissement (`slowingRadius`).
- **Calcul** :
  $$d = \|\vec{P}_{\text{cible}} - \vec{P}_{\text{véhicule}}\|$$
  $$\vec{v}_{\text{desired}} = \begin{cases} \text{normalize}(\vec{P}_{\text{cible}} - \vec{P}_{\text{véhicule}}) \times \left(v_{\text{max}} \times \frac{d}{R_{\text{slowing}}}\right) & \text{si } d < R_{\text{slowing}} \\ \text{normalize}(\vec{P}_{\text{cible}} - \vec{P}_{\text{véhicule}}) \times v_{\text{max}} & \text{sinon} \end{cases}$$
- **Usage** : Utilisé par le robot joueur pour se positionner précisément sur la mire de guidage (doigt ou souris) sans osciller, et par les drones pour accoster un module en douceur.

### C. Pursue (Poursuite prédictive)
- **Principe** : Au lieu de poursuivre la position instantanée de la proie (ce qui produirait une traque inefficace avec du retard), le prédateur extrapole la **position future** de la cible en fonction de sa vitesse relative.
- **Calcul** :
  $$T = \frac{\|\vec{P}_{\text{proie}} - \vec{P}_{\text{chasseur}}\|}{v_{\text{max}}}$$
  $$\vec{P}_{\text{future}} = \vec{P}_{\text{proie}} + \vec{v}_{\text{proie}} \times T$$
  $$\vec{F}_{\text{steer}} = \text{seek}(\vec{P}_{\text{future}})$$
- **Usage** : Algorithme principal des `SecurityDrone` pour intercepter le joueur en anticipant sa course dans les couloirs.

### D. Flee & Evade (Fuite simple & Évasion prédictive)
- **Flee** : Calcul inverse de `seek`, générant une force dirigée exactement à l'opposé de la menace :
  $$\vec{v}_{\text{desired}} = \text{normalize}(\vec{P}_{\text{véhicule}} - \vec{P}_{\text{menace}}) \times v_{\text{max}}$$
- **Evade** : Calcul prédictif analogue à `pursue`, mais visant à fuir la position future estimée de l'agresseur :
  $$\vec{P}_{\text{future}} = \vec{P}_{\text{chasseur}} + \vec{v}_{\text{chasseur}} \times T$$
  $$\vec{F}_{\text{steer}} = \text{flee}(\vec{P}_{\text{future}})$$
- **Usage** : Utilisé par les drones alliés (`MaintenanceDrone`) pour fuir les drones de sécurité dès qu'ils s'approchent trop près.

### E. Wander (Déambulation organique et fluide)
- **Principe** : Permet à un véhicule de vagabonder de manière naturelle sans à-coups ni changement brusque d'angle à chaque frame.
- **Calcul (Cercle de Reynolds)** :
  1. On projette un cercle imaginaire à une distance $D_{\text{circle}}$ devant le véhicule (dans le sens de son vecteur vitesse).
  2. Sur ce cercle de rayon $R_{\text{circle}}$, un point cible est repéré par un angle polaire $\theta$.
  3. À chaque frame, $\theta$ subit une petite variation aléatoire $\Delta \theta \in [-\delta, +\delta]$ (`wanderTheta += random(-change, change)`).
  4. Le véhicule applique un `seek` vers ce point décentré sur le cercle.
- **Usage** : Déplacement de patrouille naturel des drones lorsqu'aucune alerte ou mission n'est détectée.

### F. FollowPath (Suivi de chemin dans les couloirs)
- **Principe** : L'agent anticipe sa position future ($\vec{P}_{\text{predict}} = \vec{P} + \vec{v} \times \Delta t$), la projette orthogonalement sur les segments du circuit (`Path`), trouve le point normal le plus proche et cherche une cible située légèrement en avant sur le segment si la distance au centre du corridor dépasse le rayon de tolérance.
- **Usage** : Navigation structurée des patrouilles de sécurité dans les coursives.

### G. AvoidObstacles (Évitement prédictif des obstacles fixes)
- **Principe** : L'agent projette devant lui un ou plusieurs vecteurs de détection (« feely sensors » ou sonde `ahead`).
- **Calcul** :
  1. $\vec{S}_{\text{ahead}} = \vec{P} + \text{normalize}(\vec{v}) \times d_{\text{max\_see\_ahead}}$
  2. Si la sonde pénètre dans la sphère d'un obstacle ($\|\vec{S}_{\text{ahead}} - \vec{C}_{\text{obstacle}}\| \le R_{\text{obstacle}} + R_{\text{véhicule}}$) :
  3. On calcule une force de répulsion latérale perpendiculaire à l'axe de marche pour contourner l'obstacle au plus court.
- **Usage** : Évite les collisions avec les réacteurs centraux et les piliers métalliques.

### H. AvoidVehicles (Évitement dynamique de véhicules)
- **Principe** : Implémentation de l'*Unaligned Collision Avoidance* de Reynolds. À l'aide de la position relative et de la vitesse relative de deux agents en mouvement, on estime le temps jusqu'au point de rapprochement maximal (*Time To Closest Approach*). Si une collision future est imminente, une force d'évitement latérale d'urgence est appliquée.

### I. Separate (Séparation spatiale)
- **Principe** : Évite l'agglutination entre agents proches. Chaque voisin situé à l'intérieur du rayon de séparation produit un vecteur répulsif inversement proportionnel à la distance le séparant de l'agent :
  $$\vec{F}_{\text{sep}} = \sum_{i} \frac{\vec{P}_{\text{moi}} - \vec{P}_{\text{voisin}_i}}{\|\vec{P}_{\text{moi}} - \vec{P}_{\text{voisin}_i}\|^2}$$

### J. Boundaries (Confinement aux limites de la station)
- **Principe** : Crée un bord protecteur avec une force de freinage et de demi-tour progressive lorsque le robot s'approche des cloisons extérieures de l'écran.

---

## 4. 🤖 Entités et Comportements Réactifs

| Entité | Classe | Comportements clés | Rôle dans la simulation |
|---|---|---|---|
| **Robot Joueur** | `PlayerRobot` | `arrive`, `seek`, `avoidObstacles`, `avoidVehicles`, `boundaries` | Conduit par la main (webcam) ou le clavier. Répare les modules, collecte les batteries, déploie bouclier et leurres. |
| **Drone de Sécurité** | `SecurityDrone` | `pursue`, `followPath`, `wander`, `avoidObstacles`, `separate` | Machine à états finis (Patrouille $\leftrightarrow$ Poursuite $\leftrightarrow$ Traque d'un leurre EMP). Réduit l'énergie du joueur au contact. |
| **Drone de Maintenance** | `MaintenanceDrone` | `wander`, `evade`, `arrive`, `avoidObstacles`, `separate` | Agent allié autonome qui inspecte les modules endommagés et fuit immédiatement les drones de sécurité à portée. |
| **Leurre / Fraise EMP** | `DecoyFlare` | `boundaries`, `applyForce` | Lancé par le joueur, émet un signal EMP qui détourne temporairement les drones de sécurité de leur cible. |
| **Accélérateur** | `BoostPad` | Hérite de `Vehicle` | Dalle au sol projetant une impulsion physique d'accélération dans les corridors. |
| **Batterie** | `Battery` | Hérite de `Vehicle` | Objet consommable rechargeant +35% d'énergie. |
| **Module de réparation** | `RepairModule` | Hérite de `Vehicle` | Cible prioritaire à réparer de 0% à 100% pour remporter la partie. |
| **Obstacle** | `Obstacle` | Hérite de `Vehicle` | Cylindre protecteur fixe nécessitant l'évitement actif par sonde. |

---

## 5. ⚡ Améliorations et Mécaniques Spéciales

1. **Leurres EMP / Fraises électroniques (`Touche F`)** :
   - Éjecte un leurre électromagnétique à impulsion lumineuse.
   - Les drones de sécurité les plus proches sont trompés par le signal et passent en mode poursuite sur le leurre pendant quelques secondes, libérant le joueur.
2. **Bouclier d'Énergie (`Touche B`)** :
   - Génère une bulle énergétique autour du robot absorbant 100% des dégâts pendant 2,5 secondes (temps de recharge ~7 s).
3. **Pads d'Accélération Néon (Turbo Couloirs)** :
   - Zones d'induction au sol qui propulsent instantanément le robot vers l'avant pour distancer les drones hostiles.
4. **Contrôle gestuel par Vision Artificielle (MediaPipe)** :
   - L'index levé devant la webcam pilote directement la mire de destination du robot.
   - Traitement par miroir horizontal, conversion d'échelle normalisée $[0, 1] \to [\text{largeur}, \text{hauteur}]$, lissage exponentiel (filtre passe-bas) pour éliminer les tremblements, et transition automatique vers les commandes clavier/souris en cas de perte de visibilité.
5. **Panneau de Réglages en Temps Réel** :
   - Ajustement de la vitesse du joueur, vitesse des drones de sécurité et rayon de détection des ennemis.
6. **Réouverture Périodique des Batteries (Recharge d'Urgence)** :
   - Après collecte, le socle de chaque batterie entre en phase de recharge avec affichage d'un anneau de progression cyan et décompte en secondes (~10s).
   - **Assistance survie** : si le robot est en état d'alerte critique (**énergie < 30%**), la vitesse de réouverture des capsules de batterie est **doublée**, permettant au joueur de trouver rapidement de nouvelles réserves d'énergie et d'éviter les situations de blocage.

---

## 6. 🎮 Contrôles et Guide d'Utilisation

### Lancement de l'application
Le projet nécessite un serveur web local pour charger les librairies (p5.js et MediaPipe) sans restriction CORS :
```bash
# Exemple avec npx serve
npx serve 5-3-PathFollowingComplex
# Ou avec python
python -m http.server 8000
```
Puis ouvrir votre navigateur sur `http://localhost:8000` (ou l'URL affichée).

### Tableau des Commandes

| Action | Clavier | Souris / Gestuel |
|---|---|---|
| **Déplacement du Robot** | Touches fléchées `↑` `↓` `←` `→` | Pointer avec l'index face caméra (ou cocher « Mode Souris » et déplacer le curseur) |
| **Réparer un module** | Maintenir `E` ou `ESPACE` à proximité | — |
| **Lancer une Fraise / Leurre EMP** | Touche `F` | — |
| **Activer le Bouclier d'Urgence** | Touche `B` | — |
| **Mode Débogage (vecteurs & rayons)** | Touche `D` | Case à cocher « Debug Mode (D) » |
| **Mettre en pause / Reprendre** | Touche `P` | Bouton interface |
| **Redémarrer la partie** | Touche `R` | Bouton interface |

### Astuces de Jeu
- Ne laissez jamais votre jauge d'énergie descendre à zéro : prévoyez un détour pour collecter une batterie avant de débuter une longue réparation.
- Si un drone rouge vous prend en chasse, activez votre bouclier (`B`), cherchez un pad turbo cyan au sol ou lâchez un leurre EMP (`F`) pour faire diversion.
- Activez le mode debug (`D`) pour visualiser en temps réel les cercles de détection, les sondes d'évitement et les vecteurs de force calculés par les algorithmes de Reynolds.

---

## 7. 🧪 Validation et Tests Automatisés

Une suite complète de **44 tests unitaires et d'intégration** valide l'exactitude des algorithmes conformément aux consignes strictes du cours :

Pour exécuter la suite de tests :
```bash
node --test 5-3-PathFollowingComplex/tests/spaceStationAudit.test.mjs 5-3-PathFollowingComplex/tests/spaceStationDrones.test.mjs 5-3-PathFollowingComplex/tests/spaceStationGameplay.test.mjs 5-3-PathFollowingComplex/tests/spaceStationNavigation.test.mjs 5-3-PathFollowingComplex/tests/spaceStationStep1.test.mjs 5-3-PathFollowingComplex/tests/spaceStationStep2.test.mjs 5-3-PathFollowingComplex/tests/spaceStationUpgrades.test.mjs
```

### Périmètre vérifié par les tests :
- ✅ **Intégrité de `vehicle.js`** : Fichier original préservé sans aucune altération.
- ✅ **Héritage strict de `Vehicle`** : Toutes les entités (joueur, drones, obstacles, batteries, modules, leurres, boostpads) dérivent de `Vehicle`.
- ✅ **Précision mathématique des forces** :
  - Décroissance continue de la vitesse désirée dans `Arrive` en dessous de `slowingRadius`.
  - Vecteur d'anticipation future $\vec{v} \times T$ dans `Pursue` et `Evade`.
  - Dérivation angulaire lissée du cercle de Reynolds dans `Wander`.
  - Calcul de projection orthogonale et point normal dans `FollowPath`.
  - Sondes de détection et forces de contournement latéral dans `AvoidObstacles`.
  - Matrice des priorités assurant la primauté de l'évitement d'urgence sur l'attraction.
- ✅ **Robustesse de la vision** :
  - Inversion miroir horizontale de la webcam.
  - Lissage exponentiel passe-bas ($x_{t} = \alpha x_{t} + (1-\alpha)x_{t-1}$).
  - Bascule de sécurité vers le clavier lors d'un timeout de la caméra.
