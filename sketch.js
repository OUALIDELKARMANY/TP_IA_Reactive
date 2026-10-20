/**
 * Space Station — Robot de maintenance
 * sketch.js : Point d'entrée principal p5.js en plein écran interactif.
 * Développé dans le cadre du cours d'IA réactive (Steering Behaviors).
 * Toutes les entités visibles dérivent obligatoirement de Vehicle.
 */

// Debug navigation & steering forces
let debug = false;

// Entités du jeu Space Station (toutes dérivées de Vehicle)
let playerRobot = null;
let batteries = [];
let repairModules = [];
let stationObstacles = [];
let maintenanceDrones = [];
let securityDrones = [];
let decoyFlares = [];
let boostPads = [];
let handController = null;

// État du jeu
let gameState = 'START'; // 'START' | 'PLAYING' | 'PAUSED' | 'VICTORY' | 'GAMEOVER'
let missionTimeFrames = 0;
let followMode = 'arrive'; // 'arrive' ou 'seek'
let hasCelebratedVictory = false;

// Système de particules et effets légers
let particles = [];
let floatingTexts = [];
let backgroundStars = [];
let visualEffectsEnabled = true;

// Paramètres configurables depuis le panneau ⚙️
let gameConfig = {
  difficulty: 'normal',
  droneCount: 2,
  batteryCount: 4,
  robotSpeed: 4.8,
  droneSpeed: 3.6,
  droneRadius: 230,
  effects: true,
  controlMode: 'auto' // 'auto' | 'mouse' | 'keyboard'
};

// Fonctions globales d'effets visuels légers
if (typeof window !== 'undefined') {
  window.createSparks = function(x, y, count = 10, col = '#00e5ff') {
    if (!visualEffectsEnabled || typeof random !== 'function') return;
    for (let i = 0; i < count; i++) {
      let angle = random(TWO_PI);
      let speed = random(1, 4.5);
      particles.push({
        x, y,
        vx: cos(angle) * speed,
        vy: sin(angle) * speed,
        size: random(2, 5),
        color: col,
        life: random(15, 30),
        maxLife: 30
      });
    }
  };

  window.createFloatingText = function(x, y, txt, col = '#00e5ff') {
    if (!visualEffectsEnabled) return;
    floatingTexts.push({
      x, y,
      text: txt,
      color: col,
      life: 45
    });
  };
}

function setup() {
  // 1. Canvas plein écran dynamique sans marges
  createCanvas(windowWidth, windowHeight);

  // 2. Initialisation des étoiles de fond
  initBackgroundStars();

  // 3. Liaison des commandes du panneau de configuration ⚙️
  initSettingsPanel();

  // 4. Initialisation des entités de la station spatiale
  initSpaceStationEntities();

  // 5. Initialisation du contrôleur MediaPipe Hand Landmarker
  if (typeof HandController !== 'undefined') {
    handController = new HandController(width, height);
    handController.init();
  }
}

/**
 * Adaptation automatique du canvas lors du redimensionnement de la fenêtre.
 */
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  initBackgroundStars();

  if (handController) {
    handController.canvasWidth = width;
    handController.canvasHeight = height;
  }

  // Maintient le robot et les drones dans le nouveau périmètre
  if (playerRobot) {
    playerRobot.pos.x = constrain(playerRobot.pos.x, 50, width - 50);
    playerRobot.pos.y = constrain(playerRobot.pos.y, 50, height - 50);
  }
}

/**
 * Génère le champ d'étoiles spatiales en arrière-plan.
 */
function initBackgroundStars() {
  backgroundStars = [];
  let count = Math.floor((width * height) / 14000);
  for (let i = 0; i < count; i++) {
    backgroundStars.push({
      x: random(width),
      y: random(height),
      size: random(1, 2.5),
      speed: random(0.02, 0.06),
      offset: random(100)
    });
  }
}

/**
 * Instancie et positionne les entités selon la taille de l'écran et la configuration.
 */
function initSpaceStationEntities() {
  missionTimeFrames = 0;
  particles = [];
  floatingTexts = [];

  // Vitesse du robot selon paramètre
  const speed = Number(gameConfig.robotSpeed) || 4.8;
  if (typeof PlayerRobot !== 'undefined') {
    playerRobot = new PlayerRobot(width / 2, height / 2, speed, 0.28);
  }

  // Répartition des modules techniques dans les 4 quadrants
  if (typeof RepairModule !== 'undefined') {
    const marginX = Math.min(width * 0.22, 280);
    const marginY = Math.min(height * 0.22, 190);
    repairModules = [
      new RepairModule(width / 2 - marginX, height / 2 - marginY, "Système Oxygène", 20),
      new RepairModule(width / 2 + marginX, height / 2 - marginY, "Générateur Alpha", 15),
      new RepairModule(width / 2 - marginX, height / 2 + marginY, "Sas Pressurisé", 25),
      new RepairModule(width / 2 + marginX, height / 2 + marginY, "Console Télécom", 10)
    ];
  }

  // Dispersion des batteries dorées (4 ou 8)
  if (typeof Battery !== 'undefined') {
    batteries = [];
    const bCount = Number(gameConfig.batteryCount) || 4;
    const positions = [
      { x: width / 2 - width * 0.32, y: height / 2 },
      { x: width / 2 + width * 0.32, y: height / 2 },
      { x: width / 2, y: height / 2 - height * 0.32 },
      { x: width / 2, y: height / 2 + height * 0.32 },
      { x: width / 2 - width * 0.16, y: height / 2 - height * 0.3 },
      { x: width / 2 + width * 0.16, y: height / 2 + height * 0.3 },
      { x: width / 2 - width * 0.25, y: height / 2 + height * 0.18 },
      { x: width / 2 + width * 0.25, y: height / 2 - height * 0.18 }
    ];

    for (let i = 0; i < Math.min(bCount, positions.length); i++) {
      batteries.push(new Battery(positions[i].x, positions[i].y, 35));
    }
  }

  // 3. Zones d'accélération BoostPad (propulsion turbo pour semer les drones)
  if (typeof BoostPad !== 'undefined') {
    const cx = width / 2;
    const cy = height / 2;
    boostPads = [
      // Couloir Nord : propulse vers l'Est
      new BoostPad(cx, cy - height * 0.28, 0, 9.5, 75, 42),
      // Couloir Sud : propulse vers l'Ouest
      new BoostPad(cx, cy + height * 0.28, PI, 9.5, 75, 42),
      // Aile Ouest : propulse vers le Nord
      new BoostPad(cx - width * 0.28, cy, -HALF_PI, 9.5, 42, 75),
      // Aile Est : propulse vers le Sud
      new BoostPad(cx + width * 0.28, cy, HALF_PI, 9.5, 42, 75)
    ];
  }

  // Réinitialisation des leurres actifs
  decoyFlares = [];
  hasCelebratedVictory = false;

  // Obstacles fixes : piliers réacteurs et cloisons pour rendre les déplacements intéressants
  if (typeof Obstacle !== 'undefined') {
    const cx = width / 2;
    const cy = height / 2;
    stationObstacles = [
      new Obstacle(cx - 160, cy - 80, 26, null, 'pillar'),
      new Obstacle(cx + 160, cy + 80, 26, null, 'pillar'),
      new Obstacle(cx - 160, cy + 80, 24, null, 'pillar'),
      new Obstacle(cx + 160, cy - 80, 24, null, 'pillar'),
      new Obstacle(cx, cy - 130, Math.min(width * 0.16, 170), 18, 'wall'),
      new Obstacle(cx, cy + 130, Math.min(width * 0.16, 170), 18, 'wall')
    ];
  }

  // Drones hostiles de sécurité selon difficulté, vitesse et portée configurées
  if (typeof SecurityDrone !== 'undefined') {
    securityDrones = [];
    const dCount = Number(gameConfig.droneCount) || 2;
    let sSpeed = Number(gameConfig.droneSpeed) || 3.6;
    let sForce = 0.26;
    let detectRad = Number(gameConfig.droneRadius) || 230;

    if (gameConfig.difficulty === 'easy') {
      sSpeed *= 0.85;
      sForce = 0.20;
      detectRad *= 0.85;
    } else if (gameConfig.difficulty === 'hard') {
      sSpeed *= 1.2;
      sForce = 0.32;
      detectRad *= 1.25;
    }

    const spawns = [
      { x: 90, y: 90 },
      { x: width - 90, y: height - 90 },
      { x: width - 90, y: 90 },
      { x: 90, y: height - 90 }
    ];

    for (let i = 0; i < Math.min(dCount, spawns.length); i++) {
      let drone = new SecurityDrone(spawns[i].x, spawns[i].y, sSpeed, sForce);
      drone.detectionRadius = detectRad;
      securityDrones.push(drone);
    }
  }

  // Drone allié de maintenance autonome (assistance)
  if (typeof MaintenanceDrone !== 'undefined') {
    maintenanceDrones = [
      new MaintenanceDrone(width / 2 - 120, height / 2 + 60, 3.2, 0.22)
    ];
  }
}

function draw() {
  // 1. Fond spatial immersif et blindage de la station spatiale
  drawSpaceStationBackground();

  // 2. Mise à jour de la détection webcam si active
  if (handController) {
    handController.update();
  }

  // 3. Collectif de voisins pour la séparation et l'évitement entre véhicules
  const allNeighbors = [
    ...(playerRobot ? [playerRobot] : []),
    ...maintenanceDrones,
    ...securityDrones
  ];

  // Gestion des écrans de jeu non actifs
  if (gameState === 'START') {
    drawStationPreview();
    drawStartScreen();
    drawTopBarHUD();
    return;
  }

  if (gameState === 'PAUSED') {
    drawStationPreview();
    drawPauseScreen();
    drawTopBarHUD();
    return;
  }

  if (gameState === 'GAMEOVER') {
    drawStationPreview();
    drawGameOverScreen();
    drawTopBarHUD();
    return;
  }

  if (gameState === 'VICTORY') {
    drawStationPreview();
    drawVictoryScreen();
    drawTopBarHUD();
    return;
  }

  // == ÉTAT EN JEU (PLAYING) ==
  missionTimeFrames++;

  // 4. Obstacles fixes (piliers réacteurs et cloisons)
  for (let obs of stationObstacles) {
    obs.update();
    obs.show();
  }

  // 4b. Zones d'accélération BoostPad (propulsion turbo pour semer les drones)
  for (let pad of boostPads) {
    pad.update();
    if (playerRobot) {
      pad.checkBoost(playerRobot);
    }
    pad.show();
  }

  // 4c. Leurres EMP déployés (Fraises)
  for (let i = decoyFlares.length - 1; i >= 0; i--) {
    decoyFlares[i].update();
    decoyFlares[i].show();
    if (decoyFlares[i].expired) {
      decoyFlares.splice(i, 1);
    }
  }

  // 5. Modules techniques à réparer (touche E ou ESPACE maintenue)
  const isRepairActive = typeof keyIsDown === 'function' && (keyIsDown(69) || keyIsDown(32));

  for (let mod of repairModules) {
    mod.update();
    if (playerRobot) {
      if (isRepairActive && mod.isRobotInRange(playerRobot)) {
        let wasRepairedBefore = mod.isRepaired;
        mod.performRepair(playerRobot);
        if (!wasRepairedBefore && mod.isRepaired) {
          if (typeof window.createFloatingText === 'function') {
            window.createFloatingText(mod.pos.x, mod.pos.y - 25, 'MODULE RÉPARÉ !', '#10b981');
          }
          if (typeof window.createSparks === 'function') {
            window.createSparks(mod.pos.x, mod.pos.y, 14, '#10b981');
          }
        }
      }
    }
    mod.show(playerRobot);
  }

  // 6. Batteries d'énergie à collecter
  for (let bat of batteries) {
    bat.update();
    if (playerRobot) {
      let collected = bat.checkCollection(playerRobot);
      if (collected) {
        if (typeof window.createSparks === 'function') {
          window.createSparks(bat.pos.x, bat.pos.y, 16, '#ffd600');
        }
        if (typeof window.createFloatingText === 'function') {
          window.createFloatingText(bat.pos.x, bat.pos.y, `+${bat.energyValue} ⚡`, '#ffd600');
        }
      }
    }
    bat.show();
  }

  // 7. Robot joueur (contrôle par index, souris ou clavier)
  if (playerRobot) {
    let target = null;

    if (gameConfig.controlMode === 'mouse') {
      target = createVector(constrain(mouseX, 20, width - 20), constrain(mouseY, 20, height - 20));
    } else if (gameConfig.controlMode === 'auto') {
      target = handController?.getTarget?.();
    }

    if (target) {
      playerRobot.followTarget(target, followMode, stationObstacles, allNeighbors);
    } else {
      handlePlayerKeyboardControls();
    }

    // Dégâts de contact avec les drones de sécurité hostiles
    let damageRate = gameConfig.difficulty === 'hard' ? 0.48 : (gameConfig.difficulty === 'easy' ? 0.22 : 0.35);
    for (let sDrone of securityDrones) {
      let d = p5.Vector.dist(sDrone.pos, playerRobot.pos);
      if (d < sDrone.r + playerRobot.r + 4) {
        playerRobot.damage(damageRate);
      }
    }

    playerRobot.boundaries(35, 35, width - 35, height - 35);
    playerRobot.update();
    playerRobot.show();

    // Réticule de l'index si actif
    if (target && handController && gameConfig.controlMode === 'auto') {
      handController.drawTargetMarker();
    }

    // Affichage debug individuel si actif
    if (debug) {
      playerRobot.drawDebug(target, followMode, 90);
    }

    // Condition de défaite : panne critique d'énergie
    if (playerRobot.energy <= 0) {
      gameState = 'GAMEOVER';
    }
  }

  // 8. Drones alliés de maintenance (assistance autonome)
  for (let drone of maintenanceDrones) {
    drone.updateBehavior({
      hostiles: securityDrones,
      modules: repairModules,
      batteries: batteries,
      obstacles: stationObstacles,
      neighbors: allNeighbors
    });
    drone.boundaries(35, 35, width - 35, height - 35);
    drone.update();
    drone.show();
  }

  // 9. Drones de sécurité hostiles (patrouille Wander / poursuite Pursue / distraction Fraise)
  for (let sDrone of securityDrones) {
    sDrone.updateBehavior(playerRobot, {
      obstacles: stationObstacles,
      neighbors: allNeighbors,
      flares: decoyFlares
    });
    sDrone.boundaries(35, 35, width - 35, height - 35);
    sDrone.update();
    sDrone.show();
  }

  // 10. Particules légères et messages flottants
  updateAndDrawEffects();

  // 11. Mode débogage de navigation (Touche D)
  if (debug) {
    drawNavigationDebug();
  }

  // 12. HUD compact moderne en haut et barre d'actions rapides
  drawTopBarHUD();
  updateQuickActionHUD();

  // Condition de victoire : tous les modules requis réparés à 100%
  if (repairModules.length > 0 && repairModules.every(m => m.isRepaired)) {
    if (gameState !== 'VICTORY') {
      gameState = 'VICTORY';
      if (!hasCelebratedVictory) {
        hasCelebratedVictory = true;
        if (typeof confetti === 'function') {
          try {
            confetti({
              particleCount: 130,
              spread: 85,
              origin: { y: 0.6 }
            });
          } catch (e) {
            console.warn("Confetti error", e);
          }
        }
      }
    }
  }
}

/**
 * Affichage des entités immobiles pour les écrans de menu / pause / fin.
 */
function drawStationPreview() {
  for (let pad of boostPads) pad.show();
  for (let obs of stationObstacles) obs.show();
  for (let f of decoyFlares) f.show();
  for (let mod of repairModules) mod.show(playerRobot);
  for (let bat of batteries) bat.show();
  if (playerRobot) playerRobot.show();
  for (let drone of maintenanceDrones) drone.show();
  for (let sDrone of securityDrones) sDrone.show();
  updateAndDrawEffects();
}

/**
 * Gestion du système de particules et textes flottants.
 */
function updateAndDrawEffects() {
  if (!visualEffectsEnabled) {
    particles = [];
    floatingTexts = [];
    return;
  }

  for (let i = particles.length - 1; i >= 0; i--) {
    let p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vx *= 0.94;
    p.vy *= 0.94;
    p.life--;
    let a = map(p.life, p.maxLife, 0, 255, 0);

    noStroke();
    let c = color(p.color);
    c.setAlpha(a);
    fill(c);
    circle(p.x, p.y, p.size * (p.life / p.maxLife));

    if (p.life <= 0) {
      particles.splice(i, 1);
    }
  }

  for (let i = floatingTexts.length - 1; i >= 0; i--) {
    let ft = floatingTexts[i];
    ft.y -= 0.6;
    ft.life--;
    let a = map(ft.life, 45, 0, 255, 0);

    push();
    textAlign(CENTER, CENTER);
    textSize(11);
    let c = color(ft.color);
    c.setAlpha(a);
    fill(c);
    noStroke();
    text(ft.text, ft.x, ft.y);
    pop();

    if (ft.life <= 0) {
      floatingTexts.splice(i, 1);
    }
  }
}

/**
 * Décor immersif plein écran de station spatiale vue du dessus.
 */
function drawSpaceStationBackground() {
  // Fond sombre du vide sidéral
  background('#050812');

  // Étoiles scintillantes
  push();
  noStroke();
  for (let star of backgroundStars) {
    let alpha = 90 + sin(frameCount * star.speed + star.offset) * 70;
    fill(255, 255, 255, alpha);
    circle(star.x, star.y, star.size);
  }
  pop();

  push();
  rectMode(CORNER);

  // Blindage extérieur de la station
  fill('#090f1d');
  stroke('#1e293b');
  strokeWeight(3);
  rect(20, 20, width - 40, height - 40, 16);

  // Grillage technique au sol (dalles modulaires)
  stroke(255, 255, 255, 6);
  strokeWeight(1);
  const gridSize = 45;
  for (let x = 60; x < width - 40; x += gridSize) {
    line(x, 25, x, height - 25);
  }
  for (let y = 60; y < height - 40; y += gridSize) {
    line(25, y, width - 25, y);
  }

  // Anneau central du réacteur de station
  noFill();
  stroke(0, 229, 255, 12);
  strokeWeight(2);
  circle(width / 2, height / 2, Math.min(width, height) * 0.45);

  pop();
}

/**
 * Contrôles clavier de test / secours pour la locomotion du PlayerRobot.
 */
function handlePlayerKeyboardControls() {
  if (!playerRobot) return;
  if (typeof document !== 'undefined' && document.activeElement?.matches?.('input, select, textarea')) return;

  let moveForce = createVector(0, 0);
  const forceMag = playerRobot.maxForce || 0.25;

  if (typeof keyIsDown === 'function') {
    if (keyIsDown(81) || keyIsDown(65) || (typeof LEFT_ARROW !== 'undefined' && keyIsDown(LEFT_ARROW))) {
      moveForce.x -= forceMag;
    }
    if (keyIsDown(68) || (typeof RIGHT_ARROW !== 'undefined' && keyIsDown(RIGHT_ARROW))) {
      moveForce.x += forceMag;
    }
    if (keyIsDown(90) || keyIsDown(87) || (typeof UP_ARROW !== 'undefined' && keyIsDown(UP_ARROW))) {
      moveForce.y -= forceMag;
    }
    if (keyIsDown(83) || (typeof DOWN_ARROW !== 'undefined' && keyIsDown(DOWN_ARROW))) {
      moveForce.y += forceMag;
    }

    if (moveForce.mag() > 0) {
      playerRobot.applyForce(moveForce);
    } else {
      playerRobot.vel.mult(0.96);
    }
  }
}

/**
 * HUD compact, moderne et responsive en haut de l'écran.
 */
function drawTopBarHUD() {
  push();
  rectMode(CORNER);

  // Barre glassmorphism supérieure
  fill(10, 16, 31, 210);
  stroke(56, 189, 248, 50);
  strokeWeight(1);
  rect(16, 10, width - 32, 42, 8);

  // 1. Titre & Chronomètre (Gauche)
  let minutes = Math.floor(missionTimeFrames / 3600);
  let seconds = Math.floor((missionTimeFrames % 3600) / 60);
  let timeStr = `${nf(minutes, 2)}:${nf(seconds, 2)}`;

  fill('#38bdf8');
  noStroke();
  textSize(12.5);
  textStyle(BOLD);
  textAlign(LEFT, CENTER);
  text("🛰️ AURORA", 32, 31);

  fill('#94a3b8');
  textStyle(NORMAL);
  textSize(11.5);
  text(`⏱️ ${timeStr}`, 135, 31);

  // 2. Jauge d'énergie centrale
  if (playerRobot) {
    const energy = Math.max(0, playerRobot.energy);
    const maxE = playerRobot.maxEnergy || 100;
    const ratio = energy / maxE;
    const barW = Math.min(width * 0.22, 190);
    const barX = width / 2 - barW / 2;
    const barY = 22;

    fill('#1e293b');
    rect(barX, barY, barW, 16, 4);

    let barColor = ratio > 0.5 ? '#10b981' : (ratio > 0.25 ? '#f59e0b' : '#ef4444');
    fill(barColor);
    rect(barX, barY, barW * ratio, 16, 4);

    fill('#ffffff');
    textSize(10);
    textAlign(CENTER, CENTER);
    text(`ÉNERGIE : ${Math.round(energy)}%`, width / 2, barY + 8);
  }

  // 3. Compteur Batteries & Réparations
  let repairedCount = repairModules.filter(m => m.isRepaired).length;
  let batCount = playerRobot?.batteriesCollected || 0;

  fill('#ffd600');
  textSize(11.5);
  textAlign(LEFT, CENTER);
  let statsX = width / 2 + Math.min(width * 0.14, 120);
  text(`⚡ ${batCount}/${batteries.length}`, statsX, 31);

  fill('#10b981');
  text(`🔧 ${repairedCount}/${repairModules.length}`, statsX + 75, 31);

  // 4. Alerte hostile dynamique
  const isHostilePursuit = securityDrones.some(d => d.state === 'PURSUIT');
  if (isHostilePursuit) {
    let alertAlpha = 150 + sin(frameCount * 0.25) * 105;
    fill(239, 68, 68, alertAlpha);
    textAlign(CENTER, CENTER);
    textSize(11.5);
    textStyle(BOLD);
    text("⚠️ ALERTE INTRUSION : DRONES HOSTILES EN CHASSE", width / 2, 68);
  }

  // 5. Statut webcam / contrôle (droite, avant le bouton paramètres)
  if (handController && gameConfig.controlMode === 'auto') {
    handController.drawStatusBadge(width - 245, 31);
  } else {
    fill(gameConfig.controlMode === 'mouse' ? '#38bdf8' : '#94a3b8');
    textSize(11);
    textAlign(RIGHT, CENTER);
    let modeText = gameConfig.controlMode === 'mouse' ? 'Souris active' : 'Clavier (ZQSD)';
    text(`Contrôle : ${modeText}`, width - 110, 31);
  }

  pop();
}

/**
 * Écran de briefing et démarrage de mission (START).
 */
function drawStartScreen() {
  push();
  rectMode(CENTER);
  translate(width / 2, height / 2);

  fill(10, 16, 31, 235);
  stroke('#00e5ff');
  strokeWeight(2);
  rect(0, 0, Math.min(width * 0.88, 580), 280, 16);

  textAlign(CENTER, CENTER);

  fill('#00e5ff');
  noStroke();
  textSize(22);
  textStyle(BOLD);
  text("🛰️ SPACE STATION — ROBOT DE MAINTENANCE", 0, -85);

  fill('#e2e8f0');
  textStyle(NORMAL);
  textSize(13);
  text("Votre mission : Réparer les 4 modules techniques de la station spatiale.", 0, -45);

  fill('#94a3b8');
  textSize(12);
  text("1. Récupérez les batteries dorées ⚡ pour alimenter votre équipement.", 0, -18);
  text("2. Approchez d'un module et maintenez [E] ou [ESPACE] pour souder.", 0, 6);
  text("3. Évitez les drones rouges hostiles 🚨 qui anticipent vos trajectoires !", 0, 30);

  fill('#ffd600');
  textSize(13.5);
  textStyle(BOLD);
  text("Appuyez sur [ESPACE] ou [CLIQUEZ] pour démarrer", 0, 75);

  fill('#64748b');
  textStyle(NORMAL);
  textSize(11);
  text("Contrôles : Index webcam, Souris ou Clavier ZQSD · Paramètres via ⚙️ Options", 0, 105);

  pop();
}

/**
 * Écran de pause (PAUSED).
 */
function drawPauseScreen() {
  push();
  rectMode(CENTER);
  translate(width / 2, height / 2);

  fill(10, 16, 31, 230);
  stroke('#38bdf8');
  strokeWeight(2);
  rect(0, 0, 380, 150, 12);

  fill('#38bdf8');
  noStroke();
  textSize(22);
  textAlign(CENTER, CENTER);
  text("⏸️ MISSION EN PAUSE", 0, -25);

  fill('#f1f5f9');
  textSize(13);
  text("Appuyez sur [P] pour reprendre la mission", 0, 15);

  pop();
}

/**
 * Écran de défaite (GAMEOVER).
 */
function drawGameOverScreen() {
  push();
  rectMode(CENTER);
  translate(width / 2, height / 2);

  fill(18, 10, 14, 235);
  stroke('#ef4444');
  strokeWeight(2.5);
  rect(0, 0, Math.min(width * 0.85, 520), 190, 12);

  fill('#ef4444');
  noStroke();
  textSize(22);
  textAlign(CENTER, CENTER);
  text("🚨 PANNE CRITIQUE D'ÉNERGIE", 0, -42);

  fill('#f1f5f9');
  textSize(13);
  text("Le robot de maintenance a été neutralisé.", 0, -8);

  fill('#94a3b8');
  textSize(12);
  text("Veillez à collecter les batteries dorées et à contourner les patrouilles ennemies.", 0, 18);

  fill('#ffd600');
  textSize(13.5);
  text("Appuyez sur [R] ou [ESPACE] pour réessayer", 0, 55);

  pop();
}

/**
 * Écran de célébration de victoire (VICTORY).
 */
function drawVictoryScreen() {
  push();
  rectMode(CENTER);
  translate(width / 2, height / 2);

  if (frameCount % 4 === 0 && typeof window.createSparks === 'function') {
    window.createSparks(width / 2 + random(-250, 250), height / 2 + random(-80, 80), 6, '#10b981');
  }

  fill(8, 24, 18, 235);
  stroke('#10b981');
  strokeWeight(2.5);
  rect(0, 0, Math.min(width * 0.88, 560), 200, 12);

  fill('#10b981');
  noStroke();
  textSize(24);
  textAlign(CENTER, CENTER);
  text("🎉 MISSION ACCOMPLIE !", 0, -45);

  fill('#f1f5f9');
  textSize(14);
  text("Tous les modules techniques de la station sont opérationnels.", 0, -10);

  let minutes = Math.floor(missionTimeFrames / 3600);
  let seconds = Math.floor((missionTimeFrames % 3600) / 60);
  fill('#38bdf8');
  textSize(13);
  text(`Temps d'intervention : ${nf(minutes, 2)}:${nf(seconds, 2)} | Batteries : ${playerRobot?.batteriesCollected || 0} / ${batteries.length}`, 0, 20);

  fill('#ffd600');
  textSize(13.5);
  text("Appuyez sur [R] ou [ESPACE] pour rejouer", 0, 58);

  pop();
}

/**
 * Visualisation du mode débogage de navigation avancée (Touche 'D') :
 * Sondes d'évitement, rayons radar et forces de steering.
 */
function drawNavigationDebug() {
  push();

  // Rayons de détection radar des drones de sécurité hostiles
  for (let sDrone of securityDrones) {
    noFill();
    stroke(239, 68, 68, 80);
    strokeWeight(1.2);
    circle(sDrone.pos.x, sDrone.pos.y, sDrone.detectionRadius * 2);

    if (sDrone.vel && sDrone.vel.mag() > 0.1) {
      let ahead = sDrone.vel.copy().setMag(65);
      stroke(239, 68, 68, 140);
      strokeWeight(1.5);
      line(sDrone.pos.x, sDrone.pos.y, sDrone.pos.x + ahead.x, sDrone.pos.y + ahead.y);
      fill(239, 68, 68, 160);
      circle(sDrone.pos.x + ahead.x, sDrone.pos.y + ahead.y, 5);
    }
  }

  // Marges de sécurité des obstacles fixes
  for (let obs of stationObstacles) {
    noFill();
    stroke(56, 189, 248, 50);
    strokeWeight(1);
    circle(obs.pos.x, obs.pos.y, (obs.r + 20) * 2);
  }

  // Sonde d'évitement du robot joueur
  if (playerRobot && playerRobot.vel && playerRobot.vel.mag() > 0.1) {
    let ahead = playerRobot.vel.copy().setMag(70);
    stroke(0, 229, 255, 140);
    strokeWeight(2);
    line(playerRobot.pos.x, playerRobot.pos.y, playerRobot.pos.x + ahead.x, playerRobot.pos.y + ahead.y);
    fill(0, 229, 255, 180);
    circle(playerRobot.pos.x + ahead.x, playerRobot.pos.y + ahead.y, 6);
  }

  pop();
}

/**
 * Initialisation des gestionnaires d'événements du panneau de configuration ⚙️.
 */
function initSettingsPanel() {
  if (typeof document === 'undefined') return;

  const btnSettings = document.getElementById('settings-btn');
  const panel = document.getElementById('settings-panel');
  const btnClose = document.getElementById('close-settings');
  const btnRestart = document.getElementById('restart-game-btn');
  const btnToggleDebug = document.getElementById('toggle-debug-btn');

  if (btnSettings && panel) {
    btnSettings.addEventListener('click', (e) => {
      e.stopPropagation();
      panel.classList.toggle('open');
    });
  }

  if (btnClose && panel) {
    btnClose.addEventListener('click', () => {
      panel.classList.remove('open');
    });
  }

  if (btnRestart) {
    btnRestart.addEventListener('click', () => {
      initSpaceStationEntities();
      gameState = 'PLAYING';
      if (panel) panel.classList.remove('open');
    });
  }

  if (btnToggleDebug) {
    btnToggleDebug.addEventListener('click', () => {
      debug = !debug;
      Vehicle.debug = debug;
      btnToggleDebug.textContent = `Debug (D) : ${debug ? 'ON' : 'OFF'}`;
    });
  }

  // Liaison des sélecteurs de configuration
  const linkSelect = (id, prop, callback) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('change', () => {
      gameConfig[prop] = el.value;
      if (callback) callback(el.value);
    });
  };

  linkSelect('opt-difficulty', 'difficulty', () => initSpaceStationEntities());
  linkSelect('opt-drones', 'droneCount', () => initSpaceStationEntities());
  linkSelect('opt-batteries', 'batteryCount', () => initSpaceStationEntities());
  linkSelect('opt-speed', 'robotSpeed', (val) => {
    if (playerRobot) playerRobot.maxSpeed = Number(val) || 4.8;
  });
  linkSelect('opt-drone-speed', 'droneSpeed', (val) => {
    const sp = Number(val) || 3.6;
    for (let drone of securityDrones) {
      drone.maxSpeed = sp;
    }
  });
  linkSelect('opt-drone-radius', 'droneRadius', (val) => {
    const rad = Number(val) || 230;
    for (let drone of securityDrones) {
      drone.detectionRadius = rad;
    }
  });
  linkSelect('opt-effects', 'effects', (val) => {
    visualEffectsEnabled = (val === 'on');
  });
  linkSelect('opt-control', 'controlMode');

  // Boutons rapides Bouclier & Leurre (HUD en bas)
  const btnShield = document.getElementById('btn-shield');
  if (btnShield) {
    btnShield.addEventListener('click', (e) => {
      e.stopPropagation();
      if (playerRobot && gameState === 'PLAYING') {
        playerRobot.activateShield();
      }
    });
  }

  const btnFlare = document.getElementById('btn-flare');
  if (btnFlare) {
    btnFlare.addEventListener('click', (e) => {
      e.stopPropagation();
      if (playerRobot && gameState === 'PLAYING') {
        let f = playerRobot.deployFlare();
        if (f) decoyFlares.push(f);
      }
    });
  }
}

/**
 * Mise à jour visuelle des badges de rechargement dans la barre d'action.
 */
function updateQuickActionHUD() {
  if (typeof document === 'undefined') return;
  const shieldBadge = document.getElementById('shield-indicator');
  const flareBadge = document.getElementById('flare-indicator');

  if (shieldBadge && playerRobot) {
    if (playerRobot.isShieldActive()) {
      shieldBadge.textContent = `ACTIF (${Math.ceil(playerRobot.shieldTimer / 60)}s)`;
      shieldBadge.className = 'quick-badge active';
    } else if (playerRobot.shieldCooldown > 0) {
      shieldBadge.textContent = `${Math.ceil(playerRobot.shieldCooldown / 60)}s`;
      shieldBadge.className = 'quick-badge cooldown';
    } else {
      shieldBadge.textContent = 'PRÊT';
      shieldBadge.className = 'quick-badge ready';
    }
  }

  if (flareBadge && playerRobot) {
    if (playerRobot.flareCooldown > 0) {
      flareBadge.textContent = `${Math.ceil(playerRobot.flareCooldown / 60)}s`;
      flareBadge.className = 'quick-badge cooldown';
    } else {
      flareBadge.textContent = 'PRÊT';
      flareBadge.className = 'quick-badge ready';
    }
  }
}

/**
 * Gestion globale du clavier.
 */
function keyPressed(event) {
  if (typeof document !== 'undefined' && document.activeElement?.matches?.('input, select, textarea')) return;

  if (key == "d" || key == "D") {
    debug = !debug;
    Vehicle.debug = debug;
    const btn = document.getElementById('toggle-debug-btn');
    if (btn) btn.textContent = `Debug (D) : ${debug ? 'ON' : 'OFF'}`;
  } else if (key == "b" || key == "B") {
    if (playerRobot && gameState === 'PLAYING') {
      playerRobot.activateShield();
    }
  } else if (key == "f" || key == "F") {
    if (playerRobot && gameState === 'PLAYING') {
      let f = playerRobot.deployFlare();
      if (f) decoyFlares.push(f);
    }
  } else if (key == "p" || key == "P") {
    if (gameState === 'PLAYING') gameState = 'PAUSED';
    else if (gameState === 'PAUSED') gameState = 'PLAYING';
  } else if (key == "r" || key == "R") {
    initSpaceStationEntities();
    gameState = 'PLAYING';
  } else if (key == "m" || key == "M") {
    followMode = followMode === 'arrive' ? 'seek' : 'arrive';
  } else if (key == " " || keyCode === 13 || keyCode === 32) {
    if (gameState === 'START' || gameState === 'GAMEOVER' || gameState === 'VICTORY') {
      initSpaceStationEntities();
      gameState = 'PLAYING';
    }
  }
}

/**
 * Clic souris : démarrer / relancer ou fermer les panneaux si clic hors zone.
 */
function mouseClicked(e) {
  if (e?.target?.closest?.('#settings-panel, #settings-btn')) return;

  if (gameState === 'START' || gameState === 'GAMEOVER' || gameState === 'VICTORY') {
    initSpaceStationEntities();
    gameState = 'PLAYING';
  }
}
