/**
 * Space Station — Robot de maintenance
 * handController.js : Gestionnaire MediaPipe Hand Landmarker et flux webcam.
 * 
 * Rôle :
 * 1. Initialise la webcam réelle et le modèle MediaPipe Tasks Vision
 * 2. Détecte le landmark 8 (extrémité de l'index)
 * 3. Convertit les coordonnées normalisées [0, 1] en repère canvas avec effet miroir
 * 4. Lisse les coordonnées (filtre exponentiel) pour supprimer le jitter
 * 5. Gère la machine à états de la webcam (INIT, HAND_DETECTED, NO_HAND, ERROR)
 */

class HandController {
  constructor(canvasWidth = 1200, canvasHeight = 800) {
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;

    // États : 'INIT', 'READY', 'HAND_DETECTED', 'NO_HAND', 'ERROR'
    this.status = 'INIT';
    this.statusMessage = 'Initialisation MediaPipe & Caméra...';
    this.errorMessage = '';

    // Coordonnées cibles de l'index
    this.rawTarget = null;
    this.smoothedTarget = null;
    this.isHandDetected = false;
    this.lastDetectionTime = 0;
    this.detectionTimeout = 400; // ms avant de considérer la main perdue

    // Paramètre de lissage (filtre passe-bas)
    // 0 = aucun mouvement, 1 = aucune atténuation du bruit
    this.smoothingAlpha = 0.28;

    // Éléments MediaPipe et vidéo
    this.video = null;
    this.handLandmarker = null;
    this.lastVideoTime = -1;
    this.isModelLoaded = false;
  }

  /**
   * Initialise le flux vidéo de la webcam et télécharge le modèle MediaPipe.
   */
  async init() {
    try {
      this.status = 'INIT';
      this.statusMessage = 'Démarrage du flux webcam...';

      // 1. Création de l'élément vidéo HTML pour la capture
      this.video = document.createElement('video');
      this.video.setAttribute('playsinline', '');
      this.video.setAttribute('autoplay', '');
      this.video.setAttribute('muted', '');
      this.video.style.display = 'none';
      document.body.appendChild(this.video);

      // 2. Demande d'accès réel à la webcam
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        },
        audio: false
      });

      this.video.srcObject = stream;
      await new Promise(resolve => {
        this.video.onloadedmetadata = () => {
          this.video.play();
          resolve();
        };
      });

      this.statusMessage = 'Chargement du modèle MediaPipe Hand Landmarker...';

      // 3. Chargement de MediaPipe Tasks Vision
      await this.loadMediaPipeModel();

      this.status = 'NO_HAND';
      this.statusMessage = 'Webcam active — Présentez votre index';
    } catch (err) {
      console.warn('Erreur webcam ou MediaPipe :', err);
      this.status = 'ERROR';
      this.errorMessage = err.name === 'NotAllowedError' 
        ? 'Accès caméra refusé' 
        : 'Webcam indisponible';
      this.statusMessage = `${this.errorMessage} (Contrôle clavier actif : ZQSD)`;
    }
  }

  /**
   * Télécharge les composants WebAssembly et le modèle Hand Landmarker.
   */
  async loadMediaPipeModel() {
    // Vérification de la disponibilité de Tasks Vision
    const tasksVision = window.TasksVision || window;
    const FilesetResolver = tasksVision.FilesetResolver;
    const HandLandmarker = tasksVision.HandLandmarker;

    if (!FilesetResolver || !HandLandmarker) {
      throw new Error('Bibliothèque MediaPipe Tasks Vision non chargée');
    }

    const vision = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
    );

    this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
        delegate: 'GPU'
      },
      runningMode: 'VIDEO',
      numHands: 1
    });

    this.isModelLoaded = true;
  }

  /**
   * Met à jour la détection pour chaque frame p5.js.
   */
  update() {
    // 1. Gestion de la perte temporaire de détection par expiration du timeout
    if (this.isHandDetected && (millis() - this.lastDetectionTime > this.detectionTimeout)) {
      this.isHandDetected = false;
      this.status = 'NO_HAND';
      this.statusMessage = 'Webcam active — Présentez votre index';
    }

    if (!this.handLandmarker || !this.video || this.video.readyState < 2) {
      return;
    }

    try {
      let startTimeMs = performance.now();
      if (this.video.currentTime !== this.lastVideoTime) {
        this.lastVideoTime = this.video.currentTime;
        const results = this.handLandmarker.detectForVideo(this.video, startTimeMs);

        if (results.landmarks && results.landmarks.length > 0) {
          const landmarks = results.landmarks[0];
          // Landmark 8 = INDEX_FINGER_TIP (Bout de l'index)
          const indexTip = landmarks[8];

          if (indexTip) {
            // Conversion en coordonnées canvas avec effet miroir (1 - x)
            const targetX = (1 - indexTip.x) * this.canvasWidth;
            const targetY = indexTip.y * this.canvasHeight;

            this.processNewTarget(targetX, targetY);
            this.status = 'HAND_DETECTED';
            this.statusMessage = 'Index détecté — Contrôle actif';
            this.isHandDetected = true;
            this.lastDetectionTime = millis();
            return;
          }
        }
      }
    } catch (e) {
      // Évite de casser la boucle p5 en cas d'erreur ponctuelle d'inférence
      console.error('Erreur inférence MediaPipe :', e);
    }
  }

  /**
   * Applique le filtre de lissage exponentiel (passe-bas) aux coordonnées reçues.
   * @param {number} x 
   * @param {number} y 
   */
  processNewTarget(x, y) {
    if (!this.rawTarget) {
      this.rawTarget = createVector(x, y);
      this.smoothedTarget = createVector(x, y);
    } else {
      this.rawTarget.set(x, y);
      // Lissage : S_t = S_{t-1} * (1 - alpha) + X_t * alpha
      this.smoothedTarget.x += (x - this.smoothedTarget.x) * this.smoothingAlpha;
      this.smoothedTarget.y += (y - this.smoothedTarget.y) * this.smoothingAlpha;
    }
  }

  /**
   * Renvoie la position lissée de l'index comme p5.Vector (ou null si non détectée).
   * @returns {p5.Vector|null}
   */
  getTarget() {
    return this.isHandDetected && this.smoothedTarget ? this.smoothedTarget : null;
  }

  /**
   * Dessine le réticule holographique représentant la position de l'index.
   */
  drawTargetMarker() {
    if (!this.isHandDetected || !this.smoothedTarget) return;

    const x = this.smoothedTarget.x;
    const y = this.smoothedTarget.y;
    const pulse = sin(frameCount * 0.15) * 4;

    push();
    translate(x, y);

    // 1. Cercle extérieur pulsant cyan
    noFill();
    stroke(0, 229, 255, 180);
    strokeWeight(1.5);
    circle(0, 0, 36 + pulse);

    // 2. Anneau rotatif segmenté
    rotate(frameCount * 0.03);
    stroke(0, 229, 255, 120);
    strokeWeight(2);
    line(-22, 0, -14, 0);
    line(14, 0, 22, 0);
    line(0, -22, 0, -14);
    line(0, 14, 0, 22);

    // 3. Point focal central
    rotate(-frameCount * 0.03);
    noStroke();
    fill('#ffffff');
    circle(0, 0, 6);
    fill('#00e5ff');
    circle(0, 0, 12);

    // 4. Étiquette holographique
    fill('#00e5ff');
    textSize(10);
    textAlign(LEFT, CENTER);
    text("INDEX CIBLE", 22, 0);

    pop();
  }

  /**
   * Affiche l'indicateur d'état de la webcam dans le HUD supérieur.
   */
  drawStatusBadge(x, y) {
    push();
    translate(x, y);

    let dotColor = '#94a3b8'; // Gris par défaut
    if (this.status === 'HAND_DETECTED') {
      dotColor = '#10b981'; // Vert
    } else if (this.status === 'NO_HAND') {
      dotColor = '#f59e0b'; // Ambre
    } else if (this.status === 'INIT') {
      dotColor = '#38bdf8'; // Bleu
    } else if (this.status === 'ERROR') {
      dotColor = '#ef4444'; // Rouge
    }

    // Pastille de statut lumineuse
    noStroke();
    fill(dotColor);
    circle(0, 0, 10);

    // Texte de statut
    fill('#e2e8f0');
    textSize(11);
    textAlign(LEFT, CENTER);
    text(this.statusMessage, 12, 0);

    pop();
  }
}
