/**
 * TİLTOPİA — "KEDİ KAPI: KULE TIRMANIŞI" v6.0
 * src/input.js — Taktil Sapan Girişi, Anında Sıfırlama (Zero-Lag Hot Restart) & Güç Halkası
 * Sorumlular: Emre (Dopamin & Gösterge), Mert (Sıfır Gecikme), Zeynep (Pofuduk Modu)
 */

class InputHandler {
  constructor(canvas, cat, audio, engine, config = CONFIG) {
    this.canvas = canvas;
    this.cat = cat;
    this.audio = audio;
    this.engine = engine;
    this.config = config;

    this.isDragging = false;
    this.dragStart = { x: 0, y: 0 };
    this.currentPos = { x: 0, y: 0 };
    this.dragHoldTimer = 0;
    this.lastDragNotch = 0;
    this.hasInteracted = (typeof localStorage !== 'undefined' && localStorage.getItem("catdoor_has_played") === "1");

    this.setupEvents();
  }

  getPos(e) {
    const r = this.canvas.getBoundingClientRect();
    const screenX = (e.clientX - r.left) * (this.config.CANVAS_WIDTH / r.width);
    const screenY = (e.clientY - r.top) * (this.config.CANVAS_HEIGHT / r.height);
    // Kamera ofsetini ekle (Dünya koordinatları!)
    return {
      x: screenX,
      y: screenY + this.engine.cameraY
    };
  }

  setupEvents() {
    this.canvas.addEventListener("pointerdown", e => {
      this.audio.init();

      // EĞER OYUNCU BAŞARISIZ OLMUŞSA: Dokunulduğu an MEVCUT KATTA anında tüneğe oturur ve hemen yeni atış başlar!
      if (this.engine.gameState === "FAIL" || this.cat.mode === "SPLAT") {
        this.cat.settleOnFloor(this.engine.currentFloor);
        this.engine.gameState = "IDLE";
        this.engine.timeScale = 1.0;
        this.engine.freezeFrameTimer = 0;
        this.engine.realSlowMoTimer = 0;
        this.audio.playInstantRestart();
      } else if (this.engine.gameState === "FLOOR_TRANSITION") {
        this.engine.fastPerchDrop();
        return;
      } else if (this.engine.gameState === "VICTORY_CLIMAX") {
        this.engine.finishVictoryClimax();
        return;
      } else if (this.engine.gameState === "SUCCESS") {
        this.engine.reset();
        this.audio.playInstantRestart();
        return;
      }

      if (this.cat.isLaunched) return;

      const pos = this.getPos(e);
      const c = this.cat.getCenter();
      const dist = Math.hypot(pos.x - c.x, pos.y - c.y);

      // Modern Ergonomik Sapan Başlatma:
      // Kediye yakın VEYA ekranın alt yarısında (pos.y > 330) herhangi bir yere dokunulunca başla!
      // Böylece oyuncu başparmağını ekranın ortasına koyup aşağı doğru ferah bir çekme alanına sahip olur.
      if (dist < 180 || pos.y > 330) {
        if (!this.hasInteracted) {
          this.hasInteracted = true;
          try { localStorage.setItem("catdoor_has_played", "1"); } catch (err) {}
        }
        this.isDragging = true;
        this.dragStart = { x: pos.x, y: pos.y };
        this.currentPos = { x: pos.x, y: pos.y };
        this.dragHoldTimer = 0;
        this.cat.mode = "DRAGGING";
        this.cat.dragIntensity = 0;
        this.cat.dragOffset = { x: 0, y: 0 };
        this.audio.playCatCuriousMew();
      }
    });

    window.addEventListener("pointermove", e => {
      if (this.isDragging) {
        this.currentPos = this.getPos(e);
        const dx = this.dragStart.x - this.currentPos.x;
        const dy = this.dragStart.y - this.currentPos.y;
        const dist = Math.hypot(dx, dy);

        // MAX_DRAG_DIST = 90px: Kısa ve ergonomik başparmak hareketi
        const intensity = Math.min(1.0, dist / this.config.MAX_DRAG_DIST);
        this.cat.dragIntensity = intensity;

        // Dokunsal Haptic Sapan Direnci (0.25, 0.50, 0.75, 1.0 eşiklerinde mekanik mikro tık)
        const currentNotch = Math.floor(intensity * 4);
        if (currentNotch > this.lastDragNotch) {
          if (this.engine.haptics) this.engine.haptics.pull();
          this.lastDragNotch = currentNotch;
        } else if (currentNotch < this.lastDragNotch) {
          this.lastDragNotch = currentNotch;
        }

        // Kedinin platform üzerindeki elastik çekilme mesafesi (en fazla 34px)
        const pullDirX = dist > 0 ? (this.currentPos.x - this.dragStart.x) / dist : 0;
        const pullDirY = dist > 0 ? (this.currentPos.y - this.dragStart.y) / dist : 0;
        this.cat.dragOffset = {
          x: pullDirX * intensity * 34,
          y: pullDirY * intensity * 34
        };

        this.audio.playSlingshotStretch(intensity);
      }
    });

    window.addEventListener("pointerup", () => {
      if (!this.isDragging) return;
      this.isDragging = false;
      this.lastDragNotch = 0;
      this.cat.dragIntensity = 0;
      this.cat.dragOffset = null;

      const dx = this.dragStart.x - this.currentPos.x;
      const dy = this.dragStart.y - this.currentPos.y;
      const dist = Math.hypot(dx, dy);

      if (dist > 16) {
        if (this.engine.haptics) this.engine.haptics.launch();
        const rawRatio = Math.min(dist, this.config.MAX_DRAG_DIST) / this.config.MAX_DRAG_DIST;
        // Taban güç desteği: En hafif atışta bile kedinin kapıya uçacak yeterli zıplama gücü olur
        const force = (0.38 + 0.62 * rawRatio) * this.config.MAX_LAUNCH_IMPULSE;

        let impulseX, impulseY;
        if (this.currentPos.y >= this.dragStart.y) {
          // Klasik Sapan (Geriye Çekip Bırakma): Aşağı çekilir, yukarı kapıya uçar
          impulseX = (dx / dist) * force;
          impulseY = -Math.abs((dy / dist) * force);
        } else {
          // Doğrudan Hedefe Kaydırma (Flick): Yukarı doğru kaydırılır, kapıya uçar
          impulseX = -(dx / dist) * force;
          impulseY = -Math.abs((dy / dist) * force);
        }

        if (this.engine.tower) {
          const curDoor = this.engine.tower.getCurrentDoor();
          if (curDoor) {
            curDoor.hasBouncedThisLaunch = false;
            curDoor.hasCollidedBlade = false;
            curDoor.wasOpenOnCatEntry = false;
          }
        }
        this.cat.isGlassSmushed = false;
        this.cat.glassSmushTimer = 0;
        this.cat.applyImpulse(impulseX, impulseY);
        this.audio.playLaunch();
        this.audio.playCatLaunchMeow();
      } else {
        this.cat.mode = "IDLE";
      }
    });

    window.addEventListener("keydown", e => {
      if (e.key === "r" || e.key === "R" || e.code === "Space") {
        this.engine.reset();
        this.audio.playInstantRestart();
      }
    });
  }

  update(dt) {
    // Sapan çekme esnasında temiz, odaklı ve öngörülebilir kontrol
  }

  // Sıfır Metin Onboarding Jesti (Zero-Text Onboarding Kinetic Hint)
  drawOnboardingHint(ctx) {
    if (this.hasInteracted || this.engine.currentFloor !== 1 || this.engine.gameState !== "IDLE" || this.isDragging) return;

    const c = this.cat.getCenter();
    const t = (Date.now() % 1600) / 1600; // 0..1
    const ease = Math.sin(t * Math.PI);
    const pullDist = ease * 52;
    const handX = c.x;
    const handY = c.y + 16 + pullDist;
    const alpha = Math.sin(t * Math.PI) * 0.85;

    ctx.save();

    // 1. Kedi Etrafında Yumuşak Nabız Halkası
    ctx.strokeStyle = `rgba(0, 245, 155, ${0.4 * (1 - ease)})`;
    ctx.shadowColor = "#00f59b";
    ctx.shadowBlur = 14;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(c.x, c.y + 4, 30 + ease * 16, 0, Math.PI * 2);
    ctx.stroke();

    // 2. Aşağı Doğru Çekme Yönünü Gösteren Kinetik Oklar (Chevrons)
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    for (let i = 0; i < 3; i++) {
      const cy = c.y + 24 + i * 14 + ease * 10;
      const chAlpha = Math.max(0, alpha - i * 0.22);
      ctx.strokeStyle = `rgba(0, 245, 155, ${chAlpha})`;
      ctx.shadowColor = "#00f59b";
      ctx.beginPath();
      ctx.moveTo(c.x - 12, cy - 6);
      ctx.lineTo(c.x, cy);
      ctx.lineTo(c.x + 12, cy - 6);
      ctx.stroke();
    }

    // 3. Çekilen Dokunuş Kapsülü (Glowing Touch Pill)
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.shadowColor = "#00f59b";
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.arc(handX, handY, 13, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = `rgba(0, 245, 155, ${alpha * 0.9})`;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(handX, handY, 19 + (1 - ease) * 8, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }

  drawSlingshot(ctx) {
    if (!this.isDragging) return;
    const c = this.cat.getCenter();
    const dx = this.dragStart.x - this.currentPos.x;
    const dy = this.dragStart.y - this.currentPos.y;
    const dist = Math.hypot(dx, dy);
    const power = Math.min(1.0, dist / this.config.MAX_DRAG_DIST);

    ctx.save();

    // 1. Gerilen Lastik Bantlar (Platform tüneğinden kedinin çekilen gövdesine)
    const stretchPoint = {
      x: c.x + (this.cat.dragOffset ? this.cat.dragOffset.x * 0.85 : 0),
      y: c.y + (this.cat.dragOffset ? this.cat.dragOffset.y * 0.85 : 0)
    };
    ctx.strokeStyle = power > 0.85 ? "#ff0055" : (power > 0.4 ? "#ffd700" : "#00ff88");
    ctx.lineWidth = 4.5;
    ctx.shadowColor = ctx.strokeStyle;
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.moveTo(c.x - 38, c.y);
    ctx.lineTo(stretchPoint.x, stretchPoint.y);
    ctx.moveTo(c.x + 38, c.y);
    ctx.lineTo(stretchPoint.x, stretchPoint.y);
    ctx.stroke();

    // 2. Oyuncunun Parmağı Altındaki Modern Güç Halkası
    ctx.lineWidth = 3.0;
    ctx.strokeStyle = power > 0.8 ? "#ff0055" : (power > 0.4 ? "#ffff00" : "#00ff88");
    ctx.shadowColor = ctx.strokeStyle;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(this.currentPos.x, this.currentPos.y, 22 + power * 10, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * power);
    ctx.stroke();

    // Çekme Doğrultusu İnce Kılavuz Hattı
    ctx.strokeStyle = "rgba(255, 255, 255, 0.22)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(this.dragStart.x, this.dragStart.y);
    ctx.lineTo(this.currentPos.x, this.currentPos.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.stroke();

    // 3. Gerçekçi Fizik Yörünge Yayı (Dinamik Hedef Önizlemesi)
    const currentDoor = this.engine.tower.getCurrentDoor();
    const curSpec = this.config.FLOORS[this.engine.currentFloor - 1];
    const windAcc = (curSpec && curSpec.mechanic === "WIND_BOUNCE") ? (curSpec.windForce || 0) : 0;

    const rawRatio = Math.min(dist, this.config.MAX_DRAG_DIST) / this.config.MAX_DRAG_DIST;
    const impulseForce = (0.38 + 0.62 * rawRatio) * this.config.MAX_LAUNCH_IMPULSE;
    let simVx, simVy;
    if (this.currentPos.y >= this.dragStart.y) {
      simVx = (dx / dist) * (impulseForce / 1.25);
      simVy = -Math.abs((dy / dist) * (impulseForce / 1.25));
    } else {
      simVx = -(dx / dist) * (impulseForce / 1.25);
      simVy = -Math.abs((dy / dist) * (impulseForce / 1.25));
    }

    let arcColor = (curSpec && curSpec.mechanic === "WIND_BOUNCE") ? "#00e5ff" : "#00ff88";
    const arcPoints = [];
    const steps = 14;
    const simDt = 0.040;
    let hasBounced = false;
    let curSimX = c.x;

    for (let i = 1; i <= steps; i++) {
      const t = simDt;
      if (curSpec && curSpec.mechanic === "WIND_BOUNCE") {
        simVx += windAcc * t;
      }
      simVy += this.config.GRAVITY * t;
      curSimX += simVx * t;
      const py = c.y + simVy * (i * simDt) * 0.5;

      // Sekme Pedi Yansıma Simülasyonu
      const bTop = curSpec.bouncerYOffset ? (currentDoor ? currentDoor.y + curSpec.bouncerYOffset : -1070) : (currentDoor ? currentDoor.y + 90 : -1070);
      const bBot = bTop + (curSpec.bouncerH || 180);
      if (curSpec && curSpec.mechanic === "WIND_BOUNCE" && !hasBounced && curSimX >= (curSpec.bouncerX - 26) && py >= bTop - 30 && py <= bBot + 30) {
        curSimX = curSpec.bouncerX - 25;
        simVx = -260;
        simVy = -820;
        hasBounced = true;
      }

      // Fırtına Sundurması Engeli Simülasyonu (Doğrudan dikey atış kırmızı ikaz)
      const canopyY = currentDoor ? (currentDoor.y + (curSpec.canopyYOffset || 190)) : -970;
      const canopyW = curSpec.canopyW || 295;
      if (curSpec && curSpec.mechanic === "WIND_BOUNCE" && !hasBounced && curSimX < canopyW && py < canopyY + 30) {
        arcColor = "#ff0055"; // Sundurmaya çarpacak
      }

      arcPoints.push({ x: curSimX, y: py, t: i * simDt });

      // Kapı hizasından geçerken çarpışma analizi
      if (currentDoor && Math.abs(py - currentDoor.y) < 28) {
        if (curSimX < currentDoor.leftPostX || curSimX > currentDoor.rightPostX) {
          arcColor = "#ff0055"; // Duvara çarpacak (Kırmızı Tehlike)
        } else if (curSimX < currentDoor.leftPostX + 12 || curSimX > currentDoor.rightPostX - 12) {
          arcColor = "#ffd700"; // Kenara yakın (Sarı Dikkat)
        }
      }
    }

    // Yörünge Noktalarını Çiz (Dinamik Nabız)
    ctx.fillStyle = arcColor;
    ctx.shadowColor = arcColor;
    ctx.shadowBlur = 10;
    arcPoints.forEach((pt, idx) => {
      const pR = Math.max(2, 4.5 - idx * 0.25 + Math.sin(Date.now() * 0.012 + idx) * 0.8);
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pR, 0, Math.PI * 2);
      ctx.fill();
    });

    // Yörünge Son Hedef Halkası
    if (arcPoints.length > 0) {
      const lastPt = arcPoints[arcPoints.length - 1];
      ctx.strokeStyle = arcColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(lastPt.x, lastPt.y, 8, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 4. Slingshot Handle Indicator
    ctx.fillStyle = power > 0.85 ? "rgba(255, 0, 85, 0.75)" : "rgba(0, 255, 136, 0.65)";
    ctx.beginPath();
    ctx.arc(this.currentPos.x, this.currentPos.y, 14, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = InputHandler;
}
