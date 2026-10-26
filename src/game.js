/**
 * TİLTOPİA — "KEDİ KAPI: KULE TIRMANIŞI" v6.5
 * src/game.js — Kule Oyun Döngüsü, Dinamik Parallax Kamera, Kat Tırmanışı & Sıfır Gecikme
 * Konsorsiyum Mutabakatı: Baran, Mert, Defne, Selin, Burak, Kürşat, Ece, Emre, Kaan, Zeynep
 */

const FloorDoorClass = (typeof FloorDoor !== 'undefined') ? FloorDoor : (typeof require !== 'undefined' ? require('./door.js').FloorDoor : null);
const TowerManagerClass = (typeof TowerManager !== 'undefined') ? TowerManager : (typeof require !== 'undefined' ? require('./door.js').TowerManager : null);

class GameEngine {
  constructor() {
    this.canvas = document.getElementById("gameCanvas");
    this.ctx = this.canvas.getContext("2d");

    // UI Referansları
    this.scorePassesDisplay = document.getElementById("score-passes");
    this.scoreBestDisplay = document.getElementById("score-best");
    this.scoreNearmissDisplay = document.getElementById("score-nearmiss");
    this.floorDisplay = document.getElementById("floor-display");
    this.rageCounterDisplay = document.getElementById("rage-counter");
    this.ladderNodes = document.querySelectorAll(".ladder-node");

    // Modal & Kart Referansları
    this.retryContainer = document.getElementById("retry-container");
    this.retryTitle = document.getElementById("retry-title");
    this.retrySubtitle = document.getElementById("retry-subtitle");
    this.retryFloorBadge = document.getElementById("retry-floor-badge");
    this.retryPercentileBadge = document.getElementById("retry-percentile-badge");
    this.retryBtn = document.getElementById("retry-btn");
    this.shareBtn = document.getElementById("share-btn");

    // Viral URL Challenge & Meydan Okuma Referansları (P1)
    this.activeChallenge = this.parseURLChallenge();
    this.challengeBanner = document.getElementById("challenge-banner");
    this.challengerName = document.getElementById("challenger-name");
    this.challengeFloor = document.getElementById("challenge-floor");
    this.challengeTries = document.getElementById("challenge-tries");
    this.challengeDismissBtn = document.getElementById("challenge-dismiss-btn");
    this.gameToast = document.getElementById("game-toast");
    this.toastTimeout = null;
    this.lightningArcs = [];

    // HUD Hızlı Aksiyon & Kontrol Referansları (P0 Viral Kanca & Ses)
    this.hudChallengeBtn = document.getElementById("hud-challenge-btn");
    this.hudSoundBtn = document.getElementById("hud-sound-btn");
    this.hudSoundIcon = document.getElementById("hud-sound-icon");

    // Çekirdek Sistemler
    this.audio = new AudioManager();
    this.haptics = (typeof HapticsEngine !== "undefined") ? new HapticsEngine(this) : null;
    this.particles = new ParticleSystem();
    this.tower = new TowerManagerClass(CONFIG);
    this.cat = new Cat(CONFIG.CANVAS_WIDTH / 2, CONFIG.GROUND_Y - 45, CONFIG);
    this.input = new InputHandler(this.canvas, this.cat, this.audio, this, CONFIG);

    // Kule İlerleme Değişkenleri
    this.gameState = "IDLE"; // IDLE, FLOOR_TRANSITION, VICTORY_CLIMAX, SUCCESS, FAIL
    this.currentFloor = 1;
    this.victoryClimaxTimer = 0;

    // URL üzerinden temiz başlangıç kontrolü (?reset=1 veya ?clean=1)
    if (typeof window !== "undefined" && window.location && window.location.search) {
      if (window.location.search.includes("reset") || window.location.search.includes("clean")) {
        try {
          localStorage.removeItem("catdoor_best_floor");
          localStorage.removeItem("catdoor_nearmiss");
          localStorage.removeItem("catdoor_rage_attempts");
        } catch (e) {}
      }
    }

    // Mantıklı ve Temiz Sayaç Mimarisi (Mert & Burak - Seviye Standardı):
    // 1. BEST: Oyuncunun kuledeki rekor katı (1-5)
    this.bestFloor = parseInt(localStorage.getItem("catdoor_best_floor") || "1", 10);
    // 2. NEAR-MISS: Bu tırmanış koşusundaki toplam kıl payı skoru (0'dan başlar!)
    this.nearMisses = 0;
    // 3. TRY: O anki katın deneme sayısı (Her yeni kata geçildiğinde #1'den başlar!)
    this.stageAttempts = 1;
    this.rageAttempts = this.stageAttempts; // Geriye dönük tam uyumluluk

    // Kamera & Görsel Efektler
    this.cameraY = 0;
    this.cameraTargetY = 0;
    this.screenShake = 0;
    this.shakeDuration = 0;
    this.cameraZoom = 1.0;
    this.targetZoom = 1.0;
    this.timeScale = 1.0;
    this.realSlowMoTimer = 0;
    this.nearMissBadgeTimer = 0;
    this.nearMissFlashTimer = 0;
    this.freezeFrameTimer = 0; // 0.1s Near-Miss Freeze-Frame Heart Attack

    // Duyuru & Efekt Metinleri
    this.floatingBanner = null;
    this.lastTime = performance.now();

    // Ambient Cyber Dust & Starfield (Elite Parallax Atmosphere)
    this.ambientStars = [];
    for (let i = 0; i < 36; i++) {
      this.ambientStars.push({
        x: Math.random() * CONFIG.CANVAS_WIDTH,
        y: Math.random() * (CONFIG.TOTAL_STORY_FLOORS * CONFIG.FLOOR_HEIGHT + 600) - (CONFIG.TOTAL_STORY_FLOORS * CONFIG.FLOOR_HEIGHT),
        radius: 0.8 + Math.random() * 1.5,
        speed: 10 + Math.random() * 20,
        alpha: 0.15 + Math.random() * 0.45
      });
    }

    this.setupUI();
    this.updateHUD();
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);

    window.game = {
      cat: this.cat,
      tower: this.tower,
      engine: this,
      reset: () => this.reset(),
      state: () => this.gameState
    };
  }

  setupUI() {
    if (this.retryBtn) {
      this.retryBtn.addEventListener("click", () => {
        this.handlePlayAgain();
      });
    }
    if (this.shareBtn) {
      this.shareBtn.addEventListener("click", () => this.shareChallenge(this.shareBtn));
    }
    if (this.hudChallengeBtn) {
      this.hudChallengeBtn.addEventListener("click", () => this.shareChallenge(this.hudChallengeBtn));
    }
    if (this.hudSoundBtn) {
      this.updateSoundBtnUI();
      this.hudSoundBtn.addEventListener("click", () => {
        const isMuted = this.audio.toggleMute();
        this.updateSoundBtnUI();
        this.showToast(isMuted ? "🔇 Audio Muted" : "🔊 Audio Unmuted");
      });
    }
    if (this.retryContainer) {
      this.retryContainer.addEventListener("click", (e) => {
        if (e.target === this.retryContainer) {
          this.handlePlayAgain();
        }
      });
    }

    // P1: Challenge Banner Kapatma & Başlatma
    if (this.challengeDismissBtn) {
      this.challengeDismissBtn.addEventListener("click", () => {
        if (this.challengeBanner) this.challengeBanner.style.display = "none";
      });
    }
    this.initChallengeBanner();

    // Temiz Kayıt & Video Modu Sıfırlayıcısı (Mert & Burak):
    window.resetAllStats = () => {
      try {
        localStorage.clear();
      } catch (e) {}
      this.bestFloor = 1;
      this.nearMisses = 0;
      this.stageAttempts = 1;
      this.rageAttempts = 1;
      this.reset();
      this.updateHUD();
      this.showToast("✨ İstatistikler sıfırlandı! (STAGE 1/5 • TRY: #1)");
    };

    if (this.scoreBestDisplay) {
      this.scoreBestDisplay.style.cursor = "pointer";
      this.scoreBestDisplay.title = "Sıfırlamak için tıkla (Clean Recording Mode)";
      this.scoreBestDisplay.addEventListener("click", () => {
        if (window.resetAllStats) window.resetAllStats();
      });
    }

    window.addEventListener("keydown", (e) => {
      if (e.shiftKey && (e.key === "R" || e.key === "r")) {
        if (window.resetAllStats) window.resetAllStats();
      }
    });

    // Kule Merdiveninden Açılmış Katlara Doğrudan Atlama
    if (this.ladderNodes && this.ladderNodes.length) {
      this.ladderNodes.forEach(node => {
        node.addEventListener("click", () => {
          const f = parseInt(node.dataset.floor, 10);
          if (f <= this.bestFloor && f !== this.currentFloor && this.gameState !== "FLOOR_TRANSITION") {
            this.goToFloor(f);
            this.audio.playFloorClear(f);
          }
        });
      });
    }
  }

  updateHUD() {
    if (this.scorePassesDisplay) {
      this.scorePassesDisplay.textContent = this.currentFloor;
    }
    if (this.scoreBestDisplay) {
      this.scoreBestDisplay.textContent = this.bestFloor;
    }
    if (this.scoreNearmissDisplay) {
      this.scoreNearmissDisplay.textContent = this.nearMisses;
    }
    if (this.rageCounterDisplay) {
      this.rageCounterDisplay.textContent = `#${this.stageAttempts || 1}`;
    }
    if (this.floorDisplay) {
      const spec = CONFIG.FLOORS[this.currentFloor - 1] || { name: `AŞAMA ${this.currentFloor}` };
      this.floorDisplay.textContent = spec.name;
    }

    // Kule Merdiveni (Sağ Taraf Minimap) Güncellemesi
    if (this.ladderNodes && this.ladderNodes.length) {
      this.ladderNodes.forEach(node => {
        const f = parseInt(node.dataset.floor, 10);
        node.classList.remove("active", "cleared");
        if (f === this.currentFloor) {
          node.classList.add("active");
        } else if (f < this.currentFloor) {
          node.classList.add("cleared");
        }
      });
    }
  }

  // P1: Viral URL Challenge / Meydan Okuma Ayrıştırıcısı
  parseURLChallenge() {
    if (typeof window === "undefined" || !window.location || !window.location.search) return null;
    try {
      const params = new URLSearchParams(window.location.search);
      const challengerRaw = params.get("challenger") || params.get("c");
      if (!challengerRaw) return null;

      // XSS & uzunluk koruması
      const challenger = challengerRaw.replace(/[^\w\s\u00C0-\u017F-]/gi, "").trim().slice(0, 18) || "Rival";
      const floorVal = parseInt(params.get("floor") || params.get("f") || "4", 10);
      const targetFloor = Math.max(1, Math.min(5, isNaN(floorVal) ? 4 : floorVal));
      const triesVal = parseInt(params.get("tries") || params.get("t") || "28", 10);
      const targetTries = Math.max(1, isNaN(triesVal) ? 28 : triesVal);

      return {
        challenger,
        targetFloor,
        targetTries,
        isBeaten: false
      };
    } catch (e) {
      return null;
    }
  }

  initChallengeBanner() {
    if (!this.activeChallenge || !this.challengeBanner) return;
    if (this.challengerName) this.challengerName.textContent = this.activeChallenge.challenger;
    if (this.challengeFloor) this.challengeFloor.textContent = this.activeChallenge.targetFloor;
    if (this.challengeTries) this.challengeTries.textContent = this.activeChallenge.targetTries;
    this.challengeBanner.style.display = "flex";
  }

  updateChallengeBannerVictory() {
    if (!this.challengeBanner || !this.activeChallenge) return;
    this.challengeBanner.classList.add("beaten");
    const headline = this.challengeBanner.querySelector(".challenge-headline");
    const desc = this.challengeBanner.querySelector(".challenge-desc");
    if (headline) headline.innerHTML = `🏆 RECORD CRUSHED!`;
    if (desc) desc.innerHTML = `You beat <b>${this.activeChallenge.challenger}</b>'s Stage ${this.activeChallenge.targetFloor} challenge!`;
    this.particles.spawnVictoryFeast(CONFIG.CANVAS_WIDTH / 2, this.cameraY + 160);
    this.showToast(`🎉 You beat ${this.activeChallenge.challenger}'s challenge!`);
  }

  showToast(msg) {
    if (!this.gameToast) return;
    this.gameToast.textContent = msg;
    this.gameToast.style.display = "block";
    if (this.toastTimeout) clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => {
      if (this.gameToast) this.gameToast.style.display = "none";
    }, 2500);
  }

  updateSoundBtnUI() {
    if (!this.hudSoundIcon) return;
    const isMuted = this.audio && this.audio.isMuted;
    this.hudSoundIcon.textContent = isMuted ? "🔇" : "🔊";
    if (this.hudSoundBtn) {
      if (typeof this.hudSoundBtn.setAttribute === "function") {
        this.hudSoundBtn.setAttribute("aria-label", isMuted ? "Unmute Sound" : "Mute Sound");
      }
      if (this.hudSoundBtn.classList) {
        if (typeof this.hudSoundBtn.classList.toggle === "function") {
          this.hudSoundBtn.classList.toggle("muted", isMuted);
        } else if (isMuted && typeof this.hudSoundBtn.classList.add === "function") {
          this.hudSoundBtn.classList.add("muted");
        } else if (!isMuted && typeof this.hudSoundBtn.classList.remove === "function") {
          this.hudSoundBtn.classList.remove("muted");
        }
      }
    }
  }

  // P1: Kışkırtıcı Paylaşım Metni & Dinamik Meydan Okuma URL Üretimi
  shareChallenge(btnElement = null) {
    const origin = (typeof window !== "undefined" && window.location && window.location.origin) ? window.location.origin : "https://tiltopia.games";
    const pathname = (typeof window !== "undefined" && window.location && window.location.pathname) ? window.location.pathname : "/kedi-kapi";
    const shareUrl = `${origin}${pathname}?challenger=Player&floor=${this.currentFloor}&tries=${this.rageAttempts || 1}`;
    const text = `🐱 TILTOPIA CAT DOOR CHALLENGE!\nI reached Stage ${this.currentFloor} in ${this.rageAttempts || 1} tries! 😼\nThink you have faster reflexes than a cat?\n⚔️ Beat my score: ${shareUrl}\n#Tiltopia #CatDoor #IndieGame`;

    const targetBtn = btnElement || this.shareBtn;

    const handleSuccess = () => {
      if (targetBtn) {
        const orig = targetBtn.textContent;
        targetBtn.textContent = "⚡ COPIED!";
        targetBtn.classList.add("copied");
        setTimeout(() => {
          if (targetBtn) {
            targetBtn.textContent = orig;
            targetBtn.classList.remove("copied");
          }
        }, 1800);
      }
      this.showToast(`🏆 Challenge copied! Beat Stage ${this.currentFloor} in ${this.rageAttempts || 1} tries ⚡`);
      if (this.audio && !this.audio.isMuted) {
        this.audio.playCrownClink();
      }
    };

    if (typeof navigator !== "undefined" && navigator.share) {
      navigator.share({
        title: "Cat Door: Tower Climb",
        text: text,
        url: shareUrl
      }).then(handleSuccess).catch((err) => {
        if (err && err.name !== "AbortError") {
          this.copyToClipboard(text, handleSuccess);
        }
      });
    } else {
      this.copyToClipboard(text, handleSuccess);
    }
  }

  copyToClipboard(text, handleSuccess) {
    if (typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(handleSuccess).catch(() => {
        this.fallbackCopy(text);
        handleSuccess();
      });
    } else {
      this.fallbackCopy(text);
      handleSuccess();
    }
  }

  fallbackCopy(text) {
    try {
      if (typeof document === "undefined") return;
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    } catch (e) {}
  }

  // P2: Çatallanan Mikro Şimşek Koordinat Üreteci
  generateJaggedLightning(start, end, segments = 5) {
    const points = [start];
    const dx = (end.x - start.x) / segments;
    const dy = (end.y - start.y) / segments;
    for (let i = 1; i < segments; i++) {
      const normalX = -dy;
      const normalY = dx;
      const len = Math.hypot(normalX, normalY) || 1;
      const offset = (Math.random() - 0.5) * 22;
      points.push({
        x: start.x + dx * i + (normalX / len) * offset,
        y: start.y + dy * i + (normalY / len) * offset
      });
    }
    points.push(end);
    return points;
  }

  triggerShake(intensity, duration) {
    this.screenShake = intensity;
    this.shakeDuration = duration;
  }

  // 1. ZİRVE: KAT ATLAMA BAŞARISI (Yukarı Fırlama & Kamera Tırmanışı!)
  triggerFloorClear() {
    if (this.gameState === "FLOOR_TRANSITION" || this.gameState === "SUCCESS") return;

    const clearedFloor = this.currentFloor;
    const door = this.tower.getCurrentDoor();
    const c = this.cat.getCenter();

    // 1. Alt Katı Anında Mühürle & Kilitli Çelik Izgarayı Kapat (CLANG-LATCH!)
    this.tower.sealFloor(clearedFloor);
    this.audio.playGrateSlam();

    // Otomatik geçiş hatasını önlemek için bayrakları sıfırla
    door.wasOpenOnCatEntry = false;
    this.cat.isLaunched = false;
    this.cat.launchTime = 0;

    // 2. Kıl Payı Başarılı Geçiş (Close-Call Squeeze Success) Kontrolü
    const isCloseCall = door.isWarning || door.isSnapping || Math.abs(c.x - door.leftPostX) < 14 || Math.abs(c.x - door.rightPostX) < 14;
    if (isCloseCall) {
      this.timeScale = 0.25;
      this.realSlowMoTimer = 0.22;
      this.targetZoom = 1.10;
      this.triggerShake(6.5, 0.22);
      this.audio.playCloseCall();
      this.particles.spawnSparks(door.centerX, door.y);
      this.nearMisses++;
      localStorage.setItem("catdoor_nearmiss", this.nearMisses.toString());
    } else {
      this.targetZoom = 1.05;
      this.triggerShake(4.5, 0.18);
      this.audio.playFloorClear(clearedFloor);
      this.audio.playCatHappyPurr();
    }

    if (this.haptics) {
      this.haptics.floorClear();
    }

    this.cat.mode = "VICTORY_SPIN";
    this.cat.spinAngle = 0;
    this.cat.spinVelocity = Math.PI * 5;

    // Kedi üst kata doğru kontrollü ve pürüzsüz bir zafer sıçraması yapar (aşırı fırlama & geri düşme yok!)
    this.cat.pointList.forEach(pt => {
      pt.vx = (CONFIG.CANVAS_WIDTH / 2 - pt.x) * 3;
      pt.vy = -280;
    });

    this.particles.spawnVictoryFeast(door.centerX, door.y - 65);

    // P1: Challenge Hedefi Aşma Kontrolü
    if (this.activeChallenge && !this.activeChallenge.isBeaten) {
      if (clearedFloor >= this.activeChallenge.targetFloor) {
        this.activeChallenge.isBeaten = true;
        this.updateChallengeBannerVictory();
      }
    }

    // Kule Zirvesi (Aşama 5 Kraliyet Çatısı Şampiyonluğu & 1.8s Altın Konfeti Zafer Kutlaması)
    if (clearedFloor >= CONFIG.TOTAL_STORY_FLOORS) {
      this.gameState = "VICTORY_CLIMAX";
      this.victoryClimaxTimer = 1.8;
      this.currentFloor = CONFIG.TOTAL_STORY_FLOORS;
      this.bestFloor = CONFIG.TOTAL_STORY_FLOORS;
      localStorage.setItem("catdoor_best_floor", "5");

      if (this.audio) {
        if (this.audio.playCrownClink) this.audio.playCrownClink();
        if (this.audio.playPopCork) this.audio.playPopCork();
        if (this.audio.playCatHappyPurr) this.audio.playCatHappyPurr();
      }

      if (this.haptics) {
        this.haptics.victory();
      }

      this.floatingBanner = {
        title: "👑 ROYAL SALMON KING! 👑",
        subtitle: "YOU CONQUERED THE TOWER!",
        color: "#ffd700",
        alpha: 1.0
      };

      this.updateHUD();
      return;
    }

    // Kat Atlama Geçişi
    this.gameState = "FLOOR_TRANSITION";
    const nextFloor = clearedFloor + 1;
    const nextSpec = CONFIG.FLOORS[nextFloor - 1];

    let bannerTitle = `STAGE ${nextFloor} UNLOCKED!`;
    let bannerSubtitle = nextSpec ? nextSpec.subtitle : "Keep climbing!";
    let bannerColor = "#00ff88";

    // P0 Dopamin: Kat Evrim Aksesuarı Açılma Kutlaması
    if (nextFloor === 3) {
      bannerTitle = "🍣 SALMON NIGIRI UNLOCKED!";
      bannerSubtitle = "Stage 03: Laser Guillotine Hall";
      bannerColor = "#ff0055";
      if (this.audio && this.audio.playCrownClink) this.audio.playCrownClink();
    } else if (nextFloor === 4) {
      bannerTitle = "🦸 HERO CAPE UNLOCKED!";
      bannerSubtitle = "Stage 04: Gale Windy Balcony";
      bannerColor = "#00e5ff";
      if (this.audio && this.audio.playCrownClink) this.audio.playCrownClink();
    } else if (nextFloor === 5) {
      bannerTitle = "👑 ROYAL CROWN UNLOCKED!";
      bannerSubtitle = "Final Ascent: The Steampunk Vault";
      bannerColor = "#ffd700";
      if (this.audio && this.audio.playCrownClink) this.audio.playCrownClink();
    }

    if (isCloseCall) {
      bannerTitle = `⚡ CLOSE CALL! +500 ⚡`;
    }

    this.floatingBanner = {
      title: bannerTitle,
      subtitle: bannerSubtitle,
      color: bannerColor,
      alpha: 1.0
    };

    // Kamerayı anında yukarıdaki kata doğru kaydırmaya başla (Asansör hissi!)
    this.cameraTargetY = (nextFloor - 1) * (-CONFIG.FLOOR_HEIGHT) || 0;
    this.transitionNextFloor = nextFloor;
    this.transitionMaxTimer = 1.6; // Parabolik fiziksel iniş güvenlik zaman aşımı
  }

  // 2. ZİRVE: NEAR-MISS (Milimetrik Giyotin / Kuyruk Kıstırma)
  triggerNearMiss() {
    if (this.gameState === "FAIL" || this.cat.isNearMissTriggered) return;
    this.gameState = "FAIL";
    this.cat.isNearMissTriggered = true;
    this.stageAttempts++;
    this.rageAttempts = this.stageAttempts;

    this.timeScale = 0.25;
    this.realSlowMoTimer = 0.35;
    this.nearMissBadgeTimer = 1.8;
    this.nearMissFlashTimer = 0.28;
    this.freezeFrameTimer = 0.12; // 0.1s Dramatik Donma (Freeze Frame)
    this.cat.isEyePopped = true;
    this.cat.eyePopTimer = 0.65;
    this.targetZoom = 1.22; // Makro zoom
    this.triggerShake(7.5, 0.26);
    if (this.haptics) this.haptics.nearMiss();

    if (this.audio && this.audio.playHeartThump) this.audio.playHeartThump();
    this.audio.playMagnetSnap();
    this.audio.playNearMiss();
    this.audio.playCatBonkYowl();

    const door = this.tower.getCurrentDoor();
    this.particles.spawnSparks(door.centerX, door.y);
    // P2: Yüksek voltajlı elektrik kıvılcımları & çatallanan şimşek yayları
    this.particles.spawnElectricSparks(door.centerX, door.y);
    const c = this.cat.getCenter();
    this.lightningArcs = [];
    for (let i = 0; i < 4; i++) {
      const start = { x: c.x + (Math.random() - 0.5) * 18, y: c.y + (Math.random() - 0.5) * 18 };
      const end = { x: door.centerX + (Math.random() - 0.5) * (door.doorWidth || 80), y: door.y + (Math.random() - 0.5) * 20 };
      this.lightningArcs.push(this.generateJaggedLightning(start, end, 5));
    }
    // P2: HUD Near-Miss Nabız Animasyonu
    if (this.scoreNearmissDisplay) {
      this.scoreNearmissDisplay.classList.remove("pulse");
      void this.scoreNearmissDisplay.offsetWidth;
      this.scoreNearmissDisplay.classList.add("pulse");
    }
    door.applyImpactShudder(1.8);

    // Kedi kapıya çarpınca kendi kat zeminine doğru seker!
    this.startFloorBonkRebound();
    this.nearMisses++;
    this.updateHUD();
  }

  // 3. ZİRVE: FLAP BONK (DOINK! Kilitli Kapağa Kafa Çarpma)
  triggerBonk() {
    if (this.gameState === "FAIL") return;
    this.gameState = "FAIL";
    this.stageAttempts++;
    this.rageAttempts = this.stageAttempts;

    this.audio.playMetallicBonk();
    this.audio.playCatBonkYowl();
    this.triggerShake(9.0, 0.30);
    if (this.haptics) this.haptics.bonk();

    const door = this.tower.getCurrentDoor();
    door.applyImpactShudder(2.0);
    this.particles.spawnSparks(this.cat.points.head.x, this.cat.points.head.y);

    this.startFloorBonkRebound();
    this.updateHUD();
  }

  // Mevcut Kat Zeminine Sekme & Çakılma (Asla Alt Katlara Düşmez — Kamera Sabit Kalır!)
  startFloorBonkRebound() {
    this.audio.playFallWhistle(0.8);
    this.cat.mode = "TUMBLING";
    this.cat.tumbleAngle = 0;
    this.cat.tumbleTimer = 0.45;

    // Kediyi mantıklı bir kavisle KENDİ KATININ başlangıç tüneğine doğru yönlendirir
    const c = this.cat.getCenter();
    const targetStartX = CONFIG.CANVAS_WIDTH / 2;
    const toCenterX = (targetStartX - c.x);
    const returnVx = Math.max(-120, Math.min(120, toCenterX * 2.2));
    this.cat.tumbleVelocity = (returnVx >= 0 ? 1 : -1) * 12.0;

    this.cat.pointList.forEach(pt => {
      pt.vx = returnVx + (Math.random() - 0.5) * 20;
      pt.vy = 260; // Yumuşak ve doğal iniş
    });

    const spec = CONFIG.FLOORS[this.currentFloor - 1] || { name: `STAGE ${this.currentFloor}` };
    this.floatingBanner = {
      title: `💥 STAGE ${this.currentFloor} BONK!`,
      subtitle: `Try #${this.stageAttempts} • Auto-Resetting...`,
      color: "#ff0055",
      alpha: 1.0
    };
  }

  // Zemin Çakılması (Mevcut kat zemininde lokal çakılma — Modal Popup Yok!)
  triggerGroundFail() {
    if (this.gameState === "FAIL") return;
    this.gameState = "FAIL";
    this.stageAttempts++;
    this.rageAttempts = this.stageAttempts;
    this.audio.playTowerSplat();
    this.triggerShake(9.5, 0.35);
    if (this.haptics) this.haptics.bonk();
    this.cat.mode = "SPLAT";
    const platformY = CONFIG.GROUND_Y - (this.currentFloor - 1) * CONFIG.FLOOR_HEIGHT;
    this.cat.settleSplat(this.cat.getCenter().x, platformY);

    this.floatingBanner = {
      title: `SPLAT!`,
      subtitle: `Try #${this.stageAttempts} • Tap to Launch`,
      color: "#ff0055",
      alpha: 1.0
    };

    // 0.50 sn sonra kedi otomatik olarak pıt diye ayağa kalkar (Kesintisiz Arcade Akışı)
    setTimeout(() => {
      if (this.gameState === "FAIL") {
        this.cat.settleOnFloor(this.currentFloor);
        this.gameState = "IDLE";
        this.updateHUD();
      }
    }, 500);
    this.updateHUD();
  }

  finishVictoryClimax() {
    this.victoryClimaxTimer = 0;
    this.gameState = "SUCCESS";
    this.showRetryModal("👑 TOWER CHAMPION!", "The Royal Salmon Crown is yours!");
  }

  // Kat Geçişi Hızlı İniş (Tap-to-Drop: 1.6s beklemeyi anında 0.1s'ye indirip tüneğe oturtur)
  fastPerchDrop() {
    if (this.gameState !== "FLOOR_TRANSITION" || !this.transitionNextFloor) return;
    const nextFloor = this.transitionNextFloor;
    this.currentFloor = nextFloor;
    if (this.currentFloor > this.bestFloor) {
      this.bestFloor = this.currentFloor;
      localStorage.setItem("catdoor_best_floor", this.bestFloor.toString());
    }
    this.tower.currentFloor = this.currentFloor;
    this.cat.settleOnFloor(nextFloor);
    this.cameraTargetY = (nextFloor - 1) * (-CONFIG.FLOOR_HEIGHT) || 0;
    this.cameraY = this.cameraTargetY;
    this.gameState = "IDLE";
    this.transitionNextFloor = null;
    this.transitionMaxTimer = 0;
    this.tower.doors.forEach(d => { d.wasOpenOnCatEntry = false; });
    this.cat.isLaunched = false;
    this.cat.mode = "IDLE";
    if (this.audio) this.audio.playBoing();
    if (this.haptics) this.haptics.pull();
    this.updateHUD();
  }

  showRetryModal(title, subtitle) {
    if (!this.retryContainer) return;
    if (this.retryTitle) this.retryTitle.textContent = title;
    if (this.retrySubtitle) this.retrySubtitle.textContent = subtitle;
    if (this.retryFloorBadge) this.retryFloorBadge.textContent = `STAGE 0${this.currentFloor}`;
    if (this.retryPercentileBadge) {
      this.retryPercentileBadge.style.display = "none";
    }
    this.retryContainer.classList.add("visible");
  }

  // Belirli Bir Kata Gitme / Atlama
  goToFloor(floorNum) {
    this.currentFloor = floorNum;
    this.tower.currentFloor = floorNum;
    // Geçilmiş alt katları mühürle (delik kalmasın)
    for (let f = 1; f < floorNum; f++) {
      this.tower.sealFloor(f);
    }
    const curDoor = this.tower.getCurrentDoor();
    if (curDoor) {
      curDoor.isSealed = false;
      curDoor.cycleTimer = 0;
      curDoor.isOpen = false;
      curDoor.isWarning = false;
      curDoor.isSnapping = false;
      curDoor.flapAngle = 0;
      curDoor.targetFlapAngle = 0;
      curDoor.fanAngle = 0;
      curDoor.hasCollidedBlade = false;
      curDoor.wasOpenOnCatEntry = false;
    }
    this.cat.settleOnFloor(floorNum);
    this.cameraTargetY = (floorNum - 1) * (-CONFIG.FLOOR_HEIGHT) || 0;
    this.cameraY = this.cameraTargetY;
    this.gameState = "IDLE";
    this.victoryClimaxTimer = 0;
    this.transitionNextFloor = null;
    this.timeScale = 1.0;
    this.realSlowMoTimer = 0;
    this.nearMissBadgeTimer = 0;
    this.nearMissFlashTimer = 0;
    this.freezeFrameTimer = 0; // 0.1s Near-Miss Freeze-Frame Heart Attack
    this.screenShake = 0;
    this.targetZoom = 1.0;
    this.cameraZoom = 1.0;
    this.floatingBanner = null;
    if (this.splatRecoveryTimer) {
      clearTimeout(this.splatRecoveryTimer);
      this.splatRecoveryTimer = null;
    }
    if (this.retryContainer) this.retryContainer.classList.remove("visible");
    this.updateHUD();
  }

  // Zafer Ekranı veya Ara Kat Yeniden Oyna Butonu Yönetimi
  handlePlayAgain() {
    if (this.retryContainer) {
      this.retryContainer.classList.remove("visible");
    }
    if (this.audio) this.audio.playInstantRestart();
    // Eğer kule tamamlandıysa (5. Kat) veya oyun SUCCESS modundaysa,
    // tüm kuleyi sıfırlayıp 1. Kattan (Bodrum Girişi) başlatır!
    if (this.currentFloor >= CONFIG.TOTAL_STORY_FLOORS || this.gameState === "SUCCESS") {
      this.reset();
    } else {
      this.retryCurrentFloor();
    }
  }

  // Mevcut Aşamayı Sıfır Gecikmeyle Yeniden Başlatma (Hot Retry)
  retryCurrentFloor() {
    this.goToFloor(this.currentFloor);
  }

  // Tüm Kuleyi Sıfırlama (Hard Reset)
  reset() {
    this.tower.reset();
    this.stageAttempts = 1;
    this.rageAttempts = 1;
    this.nearMisses = 0;
    this.goToFloor(1);
  }

  update(rawDt) {
    if (this.realSlowMoTimer > 0) {
      this.realSlowMoTimer -= rawDt;
      if (this.realSlowMoTimer <= 0) {
        this.timeScale = 1.0;
        this.targetZoom = 1.0;
      }
    }
    if (this.freezeFrameTimer > 0) {
      this.freezeFrameTimer -= rawDt;
    }
    if (this.nearMissBadgeTimer > 0) {
      this.nearMissBadgeTimer -= rawDt;
    }
    if (this.nearMissFlashTimer > 0) {
      this.nearMissFlashTimer -= rawDt;
    }

    // 0.1s Freeze Frame: Zaman neredeyse durur (0.02x mikro akış), kalp atışı çalınır
    const scaledDt = (this.freezeFrameTimer > 0) ? (rawDt * 0.02) : (rawDt * this.timeScale);

    // Kamera Sarsıntısı & Zoom
    if (this.shakeDuration > 0) {
      this.shakeDuration -= rawDt;
      if (this.shakeDuration <= 0) this.screenShake = 0;
    }
    this.cameraZoom += (this.targetZoom - this.cameraZoom) * Math.min(1, rawDt * 10);

    // Kule Kamera Takibi (Kamera daima mevcut katın platform seviyesinde stabil kalır)
    this.cameraTargetY = (this.currentFloor - 1) * (-CONFIG.FLOOR_HEIGHT);
    this.cameraY += (this.cameraTargetY - this.cameraY) * Math.min(1, rawDt * 8);

    // Alt Sistem Güncellemeleri
    this.tower.update(scaledDt, this.audio, this.particles);
    this.particles.update(scaledDt);
    this.input.update(rawDt);

    if (this.floatingBanner && this.floatingBanner.alpha > 0) {
      this.floatingBanner.alpha -= rawDt * 0.45;
      if (this.floatingBanner.alpha <= 0) this.floatingBanner = null;
    }

    // Ambient Dust Takibi
    if (this.ambientStars) {
      this.ambientStars.forEach(s => {
        s.y -= s.speed * rawDt;
        const topBound = this.cameraY - 200;
        const botBound = this.cameraY + CONFIG.CANVAS_HEIGHT + 200;
        if (s.y < topBound) s.y = botBound;
      });
    }

    // 0. KAT 5 KRALİYET ZİRVE ZAFER KUTLAMASI (2.2s Altın Konfeti Yağmuru & Gururlu Kedi Duruşu)
    if (this.gameState === "VICTORY_CLIMAX") {
      this.victoryClimaxTimer -= rawDt;
      this.particles.spawnGoldenConfettiRain(this.cameraY);

      this.cat.update(scaledDt);
      const catCenter = this.cat.getCenter();
      if (Math.random() < 0.28) {
        this.particles.spawnPurrHeart(catCenter.x, catCenter.y);
      }

      // Zafer taklası tamamlanınca gururlu mutlu feasting duruşuna geç
      if (this.victoryClimaxTimer < 1.7 && this.cat.mode === "VICTORY_SPIN") {
        this.cat.mode = "FEASTING";
      }

      if (this.victoryClimaxTimer <= 0) {
        this.finishVictoryClimax();
      }
      return;
    }

    // 0. TELEPORTASYONSUZ KESİNTİSİZ KAT GEÇİŞİ VE ÜST KATA FİZİKSEL İNİŞ
    if (this.gameState === "FLOOR_TRANSITION" && this.transitionNextFloor) {
      if (this.transitionMaxTimer > 0) this.transitionMaxTimer -= rawDt;
      const nextFloor = this.transitionNextFloor;
      const nextPlatformY = CONFIG.GROUND_Y - (nextFloor - 1) * CONFIG.FLOOR_HEIGHT;
      const targetPerchY = nextPlatformY - 45;

      this.cat.update(scaledDt);
      const catCenter = this.cat.getCenter();

      // Üst kata kontrollü iniş: Kedi tüneğe ulaştığında veya inişteyken pürüzsüz konar
      if ((catCenter.y >= targetPerchY - 20 && this.cat.points.body_bottom.vy >= 0 && this.transitionMaxTimer < 1.4) || (catCenter.y <= targetPerchY + 10 && this.transitionMaxTimer < 1.0) || this.transitionMaxTimer <= 0) {
        this.currentFloor = nextFloor;
        if (this.currentFloor > this.bestFloor) {
          this.bestFloor = this.currentFloor;
          localStorage.setItem("catdoor_best_floor", this.bestFloor.toString());
        }
        this.tower.currentFloor = this.currentFloor;
        this.cat.landOnFloor(this.currentFloor);
        this.gameState = "IDLE";
        this.targetZoom = 1.0;
        this.transitionNextFloor = null;

        // BİR SONRAKİ KATI OTOMATİK GEÇME HATASINI KESİN OLARAK ENGELLE:
        this.tower.doors.forEach(d => { d.wasOpenOnCatEntry = false; });
        this.cat.isLaunched = false;
        this.cat.mode = "IDLE";
        this.cat.launchTime = 0;
        this.stageAttempts = 1;
        this.rageAttempts = 1;

        this.updateHUD();
        this.audio.playBoing();
        this.particles.spawnSparks(CONFIG.CANVAS_WIDTH / 2, nextPlatformY);
        return; // BU KAREDE İŞLEMİ ANINDA BİTİR!
      }
      return; // Kat geçişi devam ederken kapı kontrollerini çalıştırma!
    }

    // Aktif katın kapısı güncel kattan çekilir
    const door = this.tower.getCurrentDoor();
    const c = this.cat.getCenter();
    const doorTop = door.y - door.height;

    // 1. Matematiksel Açıklık Koridoru: Kedinin yatayda kapı direkleri arasında olması
    const inApertureX = (c.x >= door.leftPostX - 14 && c.x <= door.rightPostX + 16);

    // 2. Kapı Eşiği Bölgesi & Hacim Sıkışması ("Cats are liquid" hacim korunumu)
    // KRİTİK: inDoorZone SADECE kapı açıklığı hizasında (inApertureX) aktiftir;
    // Açık balkon ve yan duvar koridorlarında havada hayalet bonk oluşması kesinlikle engellenir!
    const inDoorZone = this.cat.isLaunched && inApertureX && Math.abs(c.y - door.y) < 46;
    this.cat.isSqueezing = inDoorZone && inApertureX;

    if (inDoorZone && inApertureX && door.isOpen) {
      door.wasOpenOnCatEntry = true;
    }

    this.cat.update(scaledDt);

    // Kat 4 Özel Mekaniği: Çapraz Fırtına Rüzgarı (-520G Kuvvet)
    const curFloorSpec = CONFIG.FLOORS[this.currentFloor - 1];
    if (curFloorSpec && (curFloorSpec.mechanic === "WIND" || curFloorSpec.mechanic === "WIND_BOUNCE") && this.cat.isLaunched && this.cat.mode === "LAUNCHED") {
      const windForceVal = curFloorSpec.windForce || -520;
      this.cat.pointList.forEach(pt => {
        pt.vx += windForceVal * scaledDt;
      });
      // Rüzgar hava akımı sürtünme parçacıkları
      if (Math.random() < 0.6) {
        this.particles.spawnWindSlipstream(c.x, c.y);
      }
    }

    const collisionResult = door.checkCollision(this.cat, scaledDt, this.audio, this.particles);

    // Mekanizmaya Özel Çarpışmalar (Bıçak ve İris Çarpışması)
    if (collisionResult === "BONK_BLADE" || collisionResult === "BONK_IRIS") {
      if (this.gameState === "IDLE") {
        this.triggerBonk();
        return;
      }
    } else if (collisionResult === "NEAR_MISS_IRIS" || collisionResult === "NEAR_MISS_BLADE" || collisionResult === "NEAR_MISS_GUILLOTINE") {
      if (this.gameState === "IDLE") {
        this.triggerNearMiss();
        return;
      }
    }

    // 1. KAT ATLAMA BAŞARISI (SADECE VE SADECE O KATTA AKTİF VE BİLİNÇLİ FIRLATILMIŞSA ÇALIŞIR!)
    const isActivelyLaunched = (this.cat.isLaunched && this.cat.mode === "LAUNCHED" && (this.cat.launchTime || 0) > 0.12);
    const isPassingUpward = (this.cat.points.head.vy < 0);
    // 4. Kat Özel Trickshot Kuralı: Bouncera çarpmadan doğrudan kapıdan geçilemez!
    const bouncerSatisfied = (curFloorSpec.mechanic !== "WIND_BOUNCE" || door.hasBouncedThisLaunch);

    let hasClearedCurrentDoor = false;
    let doorOpenSatisfied = false;

    if (curFloorSpec.mechanic === "ROTATING_FAN") {
      // 2. KAT: DÖNEN CAM KAPI GEÇİŞ STANDARDI (MERT & BURAK - POLAR AÇISAL KORİDOR)
      const fanTopY = door.y - (curFloorSpec.fanRadius || 64);
      const isPastFan = (c.y < door.y - 2 || this.cat.points.head.y < fanTopY);
      const zeroContact = (!door.hasCollidedBlade && !this.cat.isGlassSmushed);
      doorOpenSatisfied = zeroContact && (door.wasOpenOnCatEntry || door.isOpen);
      hasClearedCurrentDoor = isPastFan && zeroContact;
    } else {
      // DİĞER STANDART VE ÖZEL KAPILAR:
      // KRİTİK DOĞRULAMA (Senaryo 2): Kedi kapıdan geçerken kapı kapanmışsa (isSnapping veya !door.isOpen),
      // kedi üst kata GEÇEMEZ; kapak kediye çarpar ve KESİN NEAR-MISS tetiklenir!
      const allPointsCleared = (this.cat.points.body_bottom.y < door.y - 4);

      if (door.isSnapping || (!door.isOpen && !allPointsCleared)) {
        if (inDoorZone && this.gameState === "IDLE") {
          this.triggerNearMiss();
          return;
        }
        doorOpenSatisfied = false;
      } else {
        doorOpenSatisfied = door.wasOpenOnCatEntry && door.isOpen;
      }

      hasClearedCurrentDoor = allPointsCleared && (c.y > door.y - CONFIG.FLOOR_HEIGHT);
    }

    const isClearValid = isActivelyLaunched && hasClearedCurrentDoor && inApertureX && doorOpenSatisfied && isPassingUpward && bouncerSatisfied;

    if (isClearValid && this.gameState === "IDLE") {
      this.triggerFloorClear();
      return;
    }

    // 2. KAPI ENGELİ KONTROLÜ (Kapalıyken veya Pervaneye/Giyotine Çarpma — Anti-Ghosting)
    if (inDoorZone && this.gameState === "IDLE") {
      if (curFloorSpec.mechanic === "ROTATING_FAN") {
        // Dönen kapı kapalıyken (kırmızı/süpüren engel) alt giriş portuna çarpma
        if (!door.isOpen && !door.wasOpenOnCatEntry && c.y > door.y) {
          this.triggerBonk();
          return;
        }
      } else {
        if (!door.isOpen) {
          const ptsAbove = this.cat.pointList.filter(pt => pt.y < door.y).length;
          const edgeProximity = Math.min(Math.abs(c.x - door.leftPostX), Math.abs(c.x - door.rightPostX));
          // Kıl payı eşiği: 14px pervaz teğeti (10-14px standardı), kapı kapanırken içeride kalma veya başın kapıyı aşmış olması
          const isNearMiss = door.wasOpenOnCatEntry || door.isSnapping || (door.isWarning && ptsAbove >= 1) || edgeProximity < 14;
          if (isNearMiss) {
            this.triggerNearMiss();
            return;
          } else {
            this.triggerBonk();
            return;
          }
        }
      }
    }

    // Kat 4 Trickshot Kıl Payı: Bouncer'dan sekip kapı kapalıyken veya pervaz dışına toslama (14px standardı)
    if (curFloorSpec && curFloorSpec.mechanic === "WIND_BOUNCE" && door.hasBouncedThisLaunch && this.gameState === "IDLE") {
      if (Math.abs(c.y - door.y) < 16) {
        const isOutsideAperture = (c.x < door.leftPostX || c.x > door.rightPostX);
        if (!door.isOpen || isOutsideAperture) {
          const edgeProximity = Math.min(Math.abs(c.x - door.leftPostX), Math.abs(c.x - door.rightPostX));
          if (edgeProximity < 14) {
            this.triggerNearMiss();
            return;
          }
        }
      }
    }

    // 3. YERE İNME / YETERSİZ GÜÇ KONTROLÜ (Gereksiz Fail Yok — Anında Yeniden Atış!)
    if (this.cat.isLaunched && this.cat.mode === "LAUNCHED" && (this.cat.launchTime || 0) > 0.25) {
      const platformY = CONFIG.GROUND_Y - (this.currentFloor - 1) * CONFIG.FLOOR_HEIGHT;
      if (c.y >= platformY - 55 && this.cat.points.body_bottom.vy >= 0) {
        if (this.gameState === "IDLE") {
          this.audio.playBoing();
          this.cat.settleOnFloor(this.currentFloor);
          this.floatingBanner = {
            title: "PULL HARDER! 😼",
            subtitle: "Pull back further to clear the door!",
            color: "#ffd700",
            alpha: 1.0
          };
        }
      }
    }

    // 4. MEVCUT KAT ZEMİNİNE ÇAKILMA & HIZLI OTOMATİK AYAĞA KALKIŞ (MODAL YOK — SIFIR KESİNTİ!)
    const currentPlatformY = CONFIG.GROUND_Y - (this.currentFloor - 1) * CONFIG.FLOOR_HEIGHT;
    if ((this.cat.mode === "TUMBLING" || this.cat.mode === "SPLAT") && c.y >= currentPlatformY - 45) {
      if (!this.splatRecoveryTimer && this.gameState === "FAIL") {
        this.audio.playTowerSplat();
        this.triggerShake(8.5, 0.28);
        this.cat.mode = "SPLAT";
        this.cat.settleSplat(c.x, currentPlatformY);

        // 0.45 sn sonra kedi otomatik olarak pıt diye ayağa kalkıp tüneğe oturur
        this.splatRecoveryTimer = setTimeout(() => {
          this.splatRecoveryTimer = null;
          if (this.gameState === "FAIL") {
            this.cat.settleOnFloor(this.currentFloor);
            this.gameState = "IDLE";
            this.updateHUD();
          }
        }, 450);
      }
    }
  }

  render() {
    this.ctx.save();

    // Kamera Dönüşümü (Kule Yükseklik Takibi)
    const zx = CONFIG.CANVAS_WIDTH / 2;
    const zy = CONFIG.CANVAS_HEIGHT / 2;
    this.ctx.translate(zx, zy);
    this.ctx.scale(this.cameraZoom, this.cameraZoom);

    const sx = this.screenShake > 0 ? (Math.random() - 0.5) * this.screenShake : 0;
    const sy = this.screenShake > 0 ? (Math.random() - 0.5) * this.screenShake : 0;
    this.ctx.translate(-zx + sx, -zy + sy);

    // Kamera Y Kaydırması
    this.ctx.translate(0, -this.cameraY);

    this.ctx.clearRect(0, this.cameraY - 200, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT + 400);

    // 1. Kule Parallax Arka Planı
    this.drawTowerBackground();

    // 2. Kule Katları, Platformları & Kapıları
    this.tower.draw(this.ctx, this.particles, this.cameraY);

    // 3. Sapan & Kedi
    this.input.drawSlingshot(this.ctx);
    this.cat.draw(this.ctx);
    this.particles.draw(this.ctx);

    // 4. Sıfır Metin Onboarding Jesti (0-2 Saniye Görsel Affordance)
    this.input.drawOnboardingHint(this.ctx);

    // 5. Near-Miss Yüksek Voltaj Şimşek Parlaması & Çatallanan Elektrik Yayları (P2)
    if (this.nearMissFlashTimer > 0) {
      const flashAlpha = Math.min(1.0, this.nearMissFlashTimer * 3.5) * 0.38;
      this.ctx.fillStyle = `rgba(255, 230, 0, ${flashAlpha})`;
      this.ctx.fillRect(0, this.cameraY - 100, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT + 200);

      // P2: Mikro Sarı Şimşek Çatlamaları (Branching Lightning Arcs)
      if (this.lightningArcs && this.lightningArcs.length) {
        this.ctx.save();
        this.ctx.shadowColor = "#ffff00";
        this.ctx.shadowBlur = 14;
        this.ctx.strokeStyle = "#ffee00";
        this.ctx.lineWidth = 2.4;
        this.lightningArcs.forEach(arc => {
          this.ctx.beginPath();
          arc.forEach((pt, idx) => {
            if (idx === 0) this.ctx.moveTo(pt.x, pt.y);
            else this.ctx.lineTo(pt.x, pt.y);
          });
          this.ctx.stroke();
        });
        // Akkor Beyaz Çekirdek
        this.ctx.strokeStyle = "#ffffff";
        this.ctx.lineWidth = 1.0;
        this.lightningArcs.forEach(arc => {
          this.ctx.beginPath();
          arc.forEach((pt, idx) => {
            if (idx === 0) this.ctx.moveTo(pt.x, pt.y);
            else this.ctx.lineTo(pt.x, pt.y);
          });
          this.ctx.stroke();
        });
        this.ctx.restore();
      }
    }

    // ⚡ VİRAL: 0.1s Near-Miss Freeze-Frame Anime Hız Çizgileri (Dramatic Speed Lines)
    if (this.freezeFrameTimer > 0) {
      const c = this.cat.getCenter();
      this.ctx.save();
      this.ctx.strokeStyle = "rgba(255, 255, 255, 0.50)";
      this.ctx.lineWidth = 2.0;
      for (let i = 0; i < 16; i++) {
        const a = (i * Math.PI * 2) / 16 + (Math.sin(Date.now() * 0.05 + i) * 0.08);
        const r1 = 55 + (i % 2) * 15;
        const r2 = 280 + (i % 3) * 45;
        this.ctx.beginPath();
        this.ctx.moveTo(c.x + Math.cos(a) * r1, c.y + Math.sin(a) * r1);
        this.ctx.lineTo(c.x + Math.cos(a) * r2, c.y + Math.sin(a) * r2);
        this.ctx.stroke();
      }
      this.ctx.restore();
    }

    // 6. Near-Miss Rozeti (⚡ 1 MILIMETRE! ⚡)
    if (this.nearMissBadgeTimer > 0) {
      const door = this.tower.getCurrentDoor();
      this.drawNearMissBadge(door.centerX, door.y - 88);
    }

    // 6.5. Kat 5 Kraliyet Şampiyonluk Altın Işık Hüzmeleri (Victory Climax Golden God Rays)
    if (this.gameState === "VICTORY_CLIMAX") {
      const c = this.cat.getCenter();
      this.ctx.save();
      this.ctx.translate(c.x, c.y);
      const now = Date.now();
      this.ctx.rotate(now * 0.0008);
      for (let r = 0; r < 12; r++) {
        const ra = (r * Math.PI * 2) / 12;
        this.ctx.fillStyle = (r % 2 === 0) ? "rgba(255, 215, 0, 0.12)" : "rgba(255, 255, 255, 0.07)";
        this.ctx.beginPath();
        this.ctx.moveTo(0, 0);
        this.ctx.lineTo(Math.cos(ra - 0.14) * 400, Math.sin(ra - 0.14) * 400);
        this.ctx.lineTo(Math.cos(ra + 0.14) * 400, Math.sin(ra + 0.14) * 400);
        this.ctx.closePath();
        this.ctx.fill();
      }
      this.ctx.restore();
    }

    // 7. Ekran Ortası Duyuru Başlığı
    if (this.floatingBanner) {
      this.drawFloatingBanner();
    }

    this.ctx.restore();
  }

  drawTowerBackground() {
    const minY = this.cameraY - 120;
    const maxY = this.cameraY + CONFIG.CANVAS_HEIGHT + 120;

    // Derin Velvet Obsidian Gradyanı
    const curSpec = CONFIG.FLOORS[this.currentFloor - 1] || CONFIG.FLOORS[0];
    const bgGrad = this.ctx.createLinearGradient(0, minY, 0, maxY);
    bgGrad.addColorStop(0, curSpec.wallColor || CONFIG.COLORS.BG_DARK);
    bgGrad.addColorStop(0.5, CONFIG.COLORS.BG_MID);
    bgGrad.addColorStop(1, CONFIG.COLORS.BG_LIGHT);
    this.ctx.fillStyle = bgGrad;
    this.ctx.fillRect(0, minY, CONFIG.CANVAS_WIDTH, maxY - minY);

    // 1. Ambient Cyber Star Dust (Elite Derinlik & Parallax Efekti)
    if (this.ambientStars && this.ambientStars.length) {
      this.ctx.save();
      this.ambientStars.forEach(s => {
        if (s.y > minY && s.y < maxY) {
          this.ctx.fillStyle = `rgba(0, 255, 157, ${s.alpha})`;
          this.ctx.beginPath();
          this.ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
          this.ctx.fill();
        }
      });
      this.ctx.restore();
    }

    // 2. Zarif Mimari Dikey Çizgiler & İnce Kılavuz Ticks
    this.ctx.save();
    this.ctx.strokeStyle = "rgba(255, 255, 255, 0.04)";
    this.ctx.lineWidth = 1;
    [50, 225, 400].forEach(lx => {
      this.ctx.beginPath();
      this.ctx.moveTo(lx, minY);
      this.ctx.lineTo(lx, maxY);
      this.ctx.stroke();
    });

    // 3. P1: Kule Katları Arka Plan Çeşitliliği (Her Kat İçin Özgün Mimari Silüetler)
    CONFIG.FLOORS.forEach((floor, idx) => {
      const fy = CONFIG.DOOR_Y - idx * CONFIG.FLOOR_HEIGHT;
      if (fy > minY - 260 && fy < maxY + 260) {
        this.drawStageSpecificAtmosphere(floor.id, fy, minY, maxY);

        // Arka Plandaki Minimalist Kat Numaraları (Stencil Wall Art)
        this.ctx.font = "900 88px -apple-system, sans-serif";
        this.ctx.fillStyle = "rgba(255, 255, 255, 0.028)";
        this.ctx.textAlign = "center";
        this.ctx.fillText(`0${floor.id}`, CONFIG.CANVAS_WIDTH / 2, fy + 70);
      }
    });

    this.ctx.restore();
  }

  // P1: Kat Bazlı Tematik Arka Plan Atmosferleri
  drawStageSpecificAtmosphere(floorId, fy, minY, maxY) {
    this.ctx.save();
    const curSpec = CONFIG.FLOORS[floorId - 1] || CONFIG.FLOORS[0];

    if (floorId === 1) {
      // Kat 1: BASEMENT ENTRY — Eski Endüstriyel Bodrum Boruları & Loş Fener Halesi
      this.ctx.strokeStyle = "rgba(0, 255, 136, 0.045)";
      this.ctx.lineWidth = 6;
      this.ctx.beginPath();
      this.ctx.moveTo(0, fy + 120);
      this.ctx.lineTo(CONFIG.CANVAS_WIDTH, fy + 120);
      this.ctx.stroke();
      this.ctx.fillStyle = "rgba(0, 255, 136, 0.06)";
      [70, 210, 370].forEach(px => {
        this.ctx.fillRect(px - 4, fy + 114, 8, 12);
      });
      this.ctx.lineWidth = 4;
      this.ctx.beginPath();
      this.ctx.moveTo(70, fy - 60);
      this.ctx.lineTo(70, fy + 120);
      this.ctx.stroke();
      const lampGlow = this.ctx.createRadialGradient(380, fy - 20, 5, 380, fy - 20, 75);
      lampGlow.addColorStop(0, "rgba(255, 180, 50, 0.055)");
      lampGlow.addColorStop(1, "transparent");
      this.ctx.fillStyle = lampGlow;
      this.ctx.beginPath();
      this.ctx.arc(380, fy - 20, 75, 0, Math.PI * 2);
      this.ctx.fill();

    } else if (floorId === 2) {
      // Kat 2: KITCHEN VENT — Havalandırma Izgarası & Alt Kat Mutfak Işık Halesi
      this.ctx.strokeStyle = "rgba(255, 215, 0, 0.035)";
      this.ctx.lineWidth = 1.5;
      for (let x = 40; x < CONFIG.CANVAS_WIDTH; x += 36) {
        this.ctx.beginPath();
        this.ctx.moveTo(x, fy - 80);
        this.ctx.lineTo(x + 40, fy + 100);
        this.ctx.stroke();
        this.ctx.beginPath();
        this.ctx.moveTo(x + 40, fy - 80);
        this.ctx.lineTo(x, fy + 100);
        this.ctx.stroke();
      }
      this.ctx.strokeRect(30, fy - 85, CONFIG.CANVAS_WIDTH - 60, 190);
      const kitchenGlow = this.ctx.createRadialGradient(CONFIG.CANVAS_WIDTH / 2, fy + 90, 10, CONFIG.CANVAS_WIDTH / 2, fy + 90, 140);
      kitchenGlow.addColorStop(0, "rgba(255, 215, 0, 0.04)");
      kitchenGlow.addColorStop(1, "transparent");
      this.ctx.fillStyle = kitchenGlow;
      this.ctx.beginPath();
      this.ctx.arc(CONFIG.CANVAS_WIDTH / 2, fy + 90, 140, 0, Math.PI * 2);
      this.ctx.fill();

    } else if (floorId === 3) {
      // Kat 3: GUILLOTINE HALL — Yüksek Voltaj Lazer Rayları & Asılı Kablo Demetleri
      this.ctx.strokeStyle = "rgba(255, 0, 85, 0.055)";
      this.ctx.lineWidth = 1;
      [110, 340].forEach(rx => {
        this.ctx.beginPath();
        this.ctx.moveTo(rx, fy - 180);
        this.ctx.lineTo(rx, fy + 120);
        this.ctx.stroke();
      });
      this.ctx.strokeStyle = "rgba(255, 0, 85, 0.045)";
      this.ctx.lineWidth = 2.5;
      this.ctx.beginPath();
      this.ctx.moveTo(20, fy - 120);
      this.ctx.quadraticCurveTo(CONFIG.CANVAS_WIDTH / 2, fy - 60, CONFIG.CANVAS_WIDTH - 20, fy - 120);
      this.ctx.stroke();
      this.ctx.beginPath();
      this.ctx.moveTo(40, fy - 140);
      this.ctx.quadraticCurveTo(CONFIG.CANVAS_WIDTH / 2, fy - 90, CONFIG.CANVAS_WIDTH - 40, fy - 140);
      this.ctx.stroke();

    } else if (floorId === 4) {
      // Kat 4: WINDY BALCONY — Açık Fırtınalı Balkon, Uzak Şehir Silüeti & Korkuluklar
      this.ctx.fillStyle = "rgba(0, 229, 255, 0.025)";
      const buildings = [
        { x: 30, w: 50, h: 140 },
        { x: 90, w: 40, h: 180 },
        { x: 140, w: 60, h: 120 },
        { x: 260, w: 45, h: 160 },
        { x: 315, w: 55, h: 130 },
        { x: 380, w: 40, h: 190 }
      ];
      buildings.forEach(b => {
        this.ctx.fillRect(b.x, fy + 120 - b.h, b.w, b.h);
      });
      this.ctx.strokeStyle = "rgba(0, 229, 255, 0.05)";
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.moveTo(20, fy + 65);
      this.ctx.lineTo(CONFIG.CANVAS_WIDTH - 20, fy + 65);
      this.ctx.stroke();
      for (let bx = 30; bx < CONFIG.CANVAS_WIDTH - 20; bx += 24) {
        this.ctx.beginPath();
        this.ctx.moveTo(bx, fy + 65);
        this.ctx.lineTo(bx, fy + 120);
        this.ctx.stroke();
      }

    } else if (floorId === 5) {
      // Kat 5: ROYAL ROOF — Kraliyet Çatısı, Burçlar & Parlayan Hilal Ay
      this.ctx.fillStyle = "rgba(255, 215, 0, 0.035)";
      for (let mx = 30; mx < CONFIG.CANVAS_WIDTH - 30; mx += 50) {
        this.ctx.fillRect(mx, fy + 70, 30, 45);
      }
      this.ctx.fillRect(20, fy + 115, CONFIG.CANVAS_WIDTH - 40, 15);
      const moonX = 350;
      const moonY = fy - 120;
      const moonGlow = this.ctx.createRadialGradient(moonX, moonY, 10, moonX, moonY, 70);
      moonGlow.addColorStop(0, "rgba(255, 215, 0, 0.08)");
      moonGlow.addColorStop(1, "transparent");
      this.ctx.fillStyle = moonGlow;
      this.ctx.beginPath();
      this.ctx.arc(moonX, moonY, 70, 0, Math.PI * 2);
      this.ctx.fill();

      this.ctx.fillStyle = "rgba(255, 240, 180, 0.12)";
      this.ctx.beginPath();
      this.ctx.arc(moonX, moonY, 26, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.fillStyle = curSpec.wallColor || "#100a1d";
      this.ctx.beginPath();
      this.ctx.arc(moonX - 9, moonY - 7, 24, 0, Math.PI * 2);
      this.ctx.fill();

      this.ctx.font = "32px -apple-system, sans-serif";
      this.ctx.fillStyle = "rgba(255, 215, 0, 0.055)";
      this.ctx.textAlign = "center";
      this.ctx.fillText("👑", CONFIG.CANVAS_WIDTH / 2, fy - 65);
    }
    this.ctx.restore();
  }

  // İlk 2 Saniye Kancası: Sadeleştirilmiş Sapan İpucu
  drawLaunchTutorialPrompt() {
    this.ctx.save();
    const cx = this.cat.startX;
    const cy = this.cat.startY + 62;
    const bounce = Math.sin(Date.now() * 0.006) * 5;

    this.ctx.fillStyle = "rgba(14, 10, 24, 0.88)";
    this.ctx.strokeStyle = "rgba(0, 255, 136, 0.5)";
    this.ctx.lineWidth = 1.5;
    this.ctx.shadowColor = "#00ff88";
    this.ctx.shadowBlur = 10;
    this.ctx.beginPath();
    if (this.ctx.roundRect) {
      this.ctx.roundRect(cx - 85, cy - 12 + bounce, 170, 24, 12);
    } else {
      this.ctx.rect(cx - 85, cy - 12 + bounce, 170, 24);
    }
    this.ctx.fill();
    this.ctx.stroke();

    this.ctx.font = "800 11px -apple-system, sans-serif";
    this.ctx.fillStyle = "#ffffff";
    this.ctx.shadowBlur = 0;
    this.ctx.textAlign = "center";
    this.ctx.fillText("👇 PULL & RELEASE", cx, cy + 4 + bounce);

    this.ctx.restore();
  }

  drawFloatingBanner() {
    if (!this.floatingBanner) return;
    this.ctx.save();
    const bx = CONFIG.CANVAS_WIDTH / 2;
    const by = this.cameraY + 220;
    this.ctx.translate(bx, by);
    this.ctx.globalAlpha = Math.max(0, this.floatingBanner.alpha);

    // Elite Frosted Glass Capsule
    this.ctx.fillStyle = "rgba(12, 8, 22, 0.90)";
    this.ctx.strokeStyle = this.floatingBanner.color;
    this.ctx.lineWidth = 1.8;
    this.ctx.shadowColor = this.floatingBanner.color;
    this.ctx.shadowBlur = 16;
    this.ctx.beginPath();
    this.ctx.roundRect ? this.ctx.roundRect(-150, -28, 300, 56, 16) : this.ctx.rect(-150, -28, 300, 56);
    this.ctx.fill();
    this.ctx.stroke();

    // Üst İnce Işıltı Hattı
    this.ctx.strokeStyle = "rgba(255, 255, 255, 0.16)";
    this.ctx.lineWidth = 1;
    this.ctx.shadowBlur = 0;
    this.ctx.beginPath();
    this.ctx.moveTo(-125, -27);
    this.ctx.lineTo(125, -27);
    this.ctx.stroke();

    // Başlık
    this.ctx.font = "900 15px -apple-system, sans-serif";
    this.ctx.fillStyle = this.floatingBanner.color;
    this.ctx.textAlign = "center";
    this.ctx.fillText(this.floatingBanner.title, 0, -4);

    // Alt Başlık
    this.ctx.font = "700 11px -apple-system, sans-serif";
    this.ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
    this.ctx.fillText(this.floatingBanner.subtitle, 0, 16);

    this.ctx.restore();
  }

  drawNearMissBadge(bx, by) {
    this.ctx.save();
    this.ctx.translate(bx, by);

    this.ctx.fillStyle = "rgba(10, 10, 26, 0.95)";
    this.ctx.strokeStyle = "#ffff00";
    this.ctx.lineWidth = 2.5;
    this.ctx.shadowColor = "#ffff00";
    this.ctx.shadowBlur = 20;
    this.ctx.beginPath();
    this.ctx.roundRect ? this.ctx.roundRect(-94, -18, 188, 36, 8) : this.ctx.rect(-94, -18, 188, 36);
    this.ctx.fill();
    this.ctx.stroke();

    // Milimetre Cetvel Çizgileri
    this.ctx.strokeStyle = "#ffff00";
    this.ctx.lineWidth = 1.8;
    for (let i = -82; i <= -52; i += 4) {
      this.ctx.beginPath(); this.ctx.moveTo(i, -10); this.ctx.lineTo(i, i % 8 === 0 ? 6 : -2); this.ctx.stroke();
    }
    for (let i = 52; i <= 82; i += 4) {
      this.ctx.beginPath(); this.ctx.moveTo(i, -10); this.ctx.lineTo(i, i % 8 === 0 ? 6 : -2); this.ctx.stroke();
    }

    this.ctx.font = "900 13px -apple-system, sans-serif";
    this.ctx.fillStyle = "#ffff00";
    this.ctx.textAlign = "center";
    this.ctx.fillText("⚡ 1 MILLIMETER! ⚡", 0, 5);

    // Küçük Ok
    this.ctx.fillStyle = "#ffff00";
    this.ctx.shadowBlur = 12;
    this.ctx.beginPath();
    this.ctx.moveTo(-7, 18); this.ctx.lineTo(7, 18); this.ctx.lineTo(0, 26);
    this.ctx.closePath();
    this.ctx.fill();

    this.ctx.restore();
  }

  loop(currentTime) {
    const now = (typeof currentTime === "number" && !isNaN(currentTime)) ? currentTime : (typeof performance !== "undefined" && performance.now ? performance.now() : Date.now());
    const rawDt = this.lastTime ? (now - this.lastTime) / 1000 : 0.016;
    this.lastTime = now;
    const dt = Math.min(Math.max(0.001, rawDt || 0.016), 0.033);
    this.update(dt);
    this.render();
    requestAnimationFrame(this.loop);
  }
}

window.addEventListener("DOMContentLoaded", () => {
  window.game = new GameEngine();
});
