/**
 * TİLTOPİA — "KEDİ KAPI: KULE TIRMANIŞI" v8.0
 * src/door.js — 5 Benzersiz Kapı Mekanizması, Kilitli Zemin Mimarisi & Fiziksel Güvenlik
 * Konsorsiyum: Mert (Fizik & Kule), Selin (Görsel Tasarım & UI), Burak (Çarpışma & Platform)
 */

function distToSegmentSq(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const l2 = dx * dx + dy * dy;
  if (l2 === 0) return (px - x1) * (px - x1) + (py - y1) * (py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  const qx = x1 + t * dx;
  const qy = y1 + t * dy;
  return (px - qx) * (px - qx) + (py - qy) * (py - qy);
}

class FloorDoor {
  constructor(floorNumber, y, spec, config = CONFIG) {
    this.floorNumber = floorNumber;
    this.y = y;
    this.spec = spec;
    this.config = config;

    this.width = spec.doorWidth;
    this.height = config.DOOR_HEIGHT;
    this.centerX = config.CANVAS_WIDTH / 2;
    const halfSpan = (spec.mechanic === "ROTATING_FAN") ? (spec.fanRadius || 64) : this.width / 2;
    this.leftPostX = this.centerX - halfSpan;
    this.rightPostX = this.centerX + halfSpan;

    this.cycleLength = spec.cycleLength;
    this.openDuration = spec.openDuration;
    this.cycleTimer = 0;

    // Durum Değişkenleri
    this.isOpen = false;
    this.isSnapping = false;
    this.isWarning = false;
    this.wasOpenOnCatEntry = false;
    this.snapSoundPlayed = false;
    this.impactRattle = 0;
    this.isSealed = false; // Kat geçilince alt zemin tamamen mühürlenir

    // 1. & 3. Aşama: Sarkaç & Giyotin Açısı
    this.flapAngle = 0;
    this.targetFlapAngle = 0;

    // 2. Aşama: Dönen Havalandırma Çarkı
    this.fanAngle = 0;
    this.hasCollidedBlade = false;

    // 4. Aşama: Sekme Pedi & Fırtına Sundurması
    this.bouncerX = spec.bouncerX || 416;
    this.bouncerYOffset = (spec.bouncerYOffset !== undefined) ? spec.bouncerYOffset : 90;
    this.bouncerH = spec.bouncerH || 180;
    this.bouncerHitTimer = 0;
    this.hasBouncedThisLaunch = false;
    this.canopyW = spec.canopyW || 295;
    this.canopyH = spec.canopyH || 22;
    this.canopyYOffset = (spec.canopyYOffset !== undefined) ? spec.canopyYOffset : 190;

    // 5. Aşama: İris Diyafram Açıklığı
    this.irisRadius = 0;
    this.irisMaxR = spec.irisMaxR || 44;

    this.glowLeft = 0;
    this.glowRight = 0;

    // Kat taban kotu
    this.platformY = config.GROUND_Y - (floorNumber - 1) * config.FLOOR_HEIGHT;
  }

  sealFloor() {
    this.isSealed = true;
    this.isOpen = false;
    this.hasCollidedBlade = false;
    this.hasBouncedThisLaunch = false;
    this.targetFlapAngle = 0;
    this.flapAngle = 0;
  }

  applyImpactShudder(intensity = 1.0) {
    this.impactRattle = 0.28 * intensity;
    this.glowLeft = 1.0;
    this.glowRight = 1.0;
  }

  update(dt, audio = null, particles = null, isCurrentFloor = true) {
    // Geçilmiş alt katlar tamamen dondurulur (Sıfır ses, sıfır hareket, sıfır gürültü)
    if (this.isSealed && !isCurrentFloor) return;

    this.cycleTimer = (this.cycleTimer + dt) % this.cycleLength;
    const progress = this.cycleTimer / this.cycleLength;

    if (this.bouncerHitTimer > 0) {
      this.bouncerHitTimer = Math.max(0, this.bouncerHitTimer - dt);
    }

    // -------------------------------------------------------------
    // MEKANİZMA 2: DÖNEN KANATLI HAVALANDIRMA ÇARKI (ROTATING_FAN)
    // -------------------------------------------------------------
    if (this.spec.mechanic === "ROTATING_FAN") {
      this.fanAngle = (this.fanAngle + (this.spec.fanSpeed || 1.25) * dt) % (Math.PI * 2);
      const bladeHalf = (this.spec.bladeAngle || 0.28) / 2; // ~0.14 rad
      // Kırmızı kapalı olma eşiği: ~0.48 rad (~27.5°). Kırmızı kapalı kalma oranı %44'e çıkarıldı.
      const entryCorridorThreshold = bladeHalf + 0.34; // ~0.48 rad
      let minEntryDiff = Math.PI;
      for (let b = 0; b < 3; b++) {
        const bAngle = (this.fanAngle + (b * Math.PI * 2) / 3) % (Math.PI * 2);
        // Alt giriş ekseni: PI / 2 (Aşağıdan yukarıya dikey geçiş)
        const diff = Math.abs((((bAngle - Math.PI / 2) + Math.PI) % (Math.PI * 2)) - Math.PI);
        if (diff < minEntryDiff) minEntryDiff = diff;
      }

      this.isOpen = (minEntryDiff > entryCorridorThreshold);
      this.isWarning = (minEntryDiff > entryCorridorThreshold && minEntryDiff <= entryCorridorThreshold + 0.14);
      this.isSnapping = (minEntryDiff <= entryCorridorThreshold);
      return;
    }

    // -------------------------------------------------------------
    // MEKANİZMA 3: RAYDA KAYAN YATAY LAZER GİYOTİNİ (SLIDING_GUILLOTINE)
    // -------------------------------------------------------------
    if (this.spec.mechanic === "SLIDING_GUILLOTINE") {
      const offset = Math.sin(this.cycleTimer * (this.spec.slideSpeed || 2.20)) * (this.spec.slideAmp || 62);
      this.centerX = this.config.CANVAS_WIDTH / 2 + offset;
      this.leftPostX = this.centerX - this.width / 2;
      this.rightPostX = this.centerX + this.width / 2;

      // Kapı merkez eksendeyken açık; orantılı daraltılmış tolerans (|offset| < 28px)
      this.isOpen = (Math.abs(offset) < 28);
      this.isWarning = (Math.abs(offset) >= 28 && Math.abs(offset) < 38);
      this.isSnapping = (Math.abs(offset) >= 38);
      this.targetFlapAngle = Math.PI / 2.2;
      this.flapAngle = this.targetFlapAngle;
      return;
    } else {
      this.centerX = this.config.CANVAS_WIDTH / 2;
      this.leftPostX = this.centerX - this.width / 2;
      this.rightPostX = this.centerX + this.width / 2;
    }

    // -------------------------------------------------------------
    // MEKANİZMA 5: KRALİYET İRİS DİYAFRAM KASASI (IRIS_APERTURE)
    // -------------------------------------------------------------
    if (this.spec.mechanic === "IRIS_APERTURE") {
      const openRatio = this.openDuration / this.cycleLength;
      const closedHold = 0.40;
      const openEnd = closedHold + openRatio;

      if (progress < closedHold) {
        this.irisRadius += (0 - this.irisRadius) * Math.min(1, dt * 22);
        this.isOpen = false;
        this.isWarning = false;
        this.isSnapping = false;
        this.snapSoundPlayed = false;
      } else if (progress < openEnd - 0.12) {
        this.irisRadius += (this.irisMaxR - this.irisRadius) * Math.min(1, dt * 18);
        this.isOpen = this.irisRadius > 22;
        this.isWarning = false;
        this.isSnapping = false;
      } else if (progress < openEnd) {
        this.isOpen = true;
        this.isWarning = true;
        this.isSnapping = false;
      } else {
        this.irisRadius += (0 - this.irisRadius) * Math.min(1, dt * 26);
        this.isOpen = false;
        this.isWarning = false;
        this.isSnapping = true;
        if (!this.snapSoundPlayed && audio && isCurrentFloor) {
          audio.playMagnetSnap();
          if (particles) particles.spawnSparks(this.centerX, this.y);
          this.snapSoundPlayed = true;
        }
      }
      return;
    }

    // -------------------------------------------------------------
    // MEKANİZMA 1 & 4: STANDART SARKAÇ & RÜZGARLI KAPI (AKICI 6 FAZ)
    // -------------------------------------------------------------
    const openRatio = this.openDuration / this.cycleLength;
    const closedTime = this.cycleLength - this.openDuration;

    const closedHoldEnd = (closedTime * 0.68) / this.cycleLength;
    const swingUpEnd = closedHoldEnd + 0.15;
    const goldenEnd = swingUpEnd + (this.openDuration - 0.22) / this.cycleLength;
    const warningEnd = swingUpEnd + this.openDuration / this.cycleLength;
    const slamEnd = warningEnd + 0.08;

    if (progress < closedHoldEnd) {
      this.targetFlapAngle = 0;
      this.isOpen = false;
      this.isWarning = false;
      this.isSnapping = false;
      this.snapSoundPlayed = false;
    } else if (progress < swingUpEnd) {
      const t = (progress - closedHoldEnd) / 0.15;
      this.targetFlapAngle = Math.sin((t * Math.PI) / 2) * 1.55;
      this.isOpen = t > 0.40;
      this.isWarning = false;
      this.isSnapping = false;
      this.snapSoundPlayed = false;
    } else if (progress < goldenEnd) {
      const t = (progress - swingUpEnd) / ((goldenEnd - swingUpEnd) || 0.01);
      this.targetFlapAngle = 1.55 + Math.sin(t * Math.PI * 2) * 0.04;
      this.isOpen = true;
      this.isWarning = false;
      this.isSnapping = false;
    } else if (progress < warningEnd) {
      const t = (progress - goldenEnd) / ((warningEnd - goldenEnd) || 0.01);
      this.targetFlapAngle = 1.52 - t * 0.18 + Math.sin(t * Math.PI * 8) * 0.03;
      this.isOpen = true;
      this.isWarning = true;
      this.isSnapping = false;
    } else if (progress < slamEnd) {
      const t = (progress - warningEnd) / 0.08;
      this.targetFlapAngle = Math.max(0, (1.0 - t * t) * 1.34);
      this.isOpen = t < 0.15;
      this.isWarning = false;
      this.isSnapping = true;
    } else {
      this.isOpen = false;
      this.isWarning = false;
      this.isSnapping = false;

      if (!this.snapSoundPlayed && audio && isCurrentFloor) {
        audio.playMagnetSnap();
        if (particles) particles.spawnSparks(this.centerX, this.y);
        this.snapSoundPlayed = true;
      }
      const t = (progress - slamEnd) / ((1.0 - slamEnd) || 0.01);
      this.targetFlapAngle = Math.max(0, Math.sin(t * Math.PI * 3) * 0.06 * Math.exp(-t * 6));
    }

    this.flapAngle += (this.targetFlapAngle - this.flapAngle) * Math.min(1, dt * 22);

    if (this.impactRattle > 0) {
      this.impactRattle = Math.max(0, this.impactRattle - dt * 2.5);
    }
  }

  checkCollision(cat, dt, audio = null, particles = null) {
    this.glowLeft = Math.max(0, this.glowLeft - dt * 4);
    this.glowRight = Math.max(0, this.glowRight - dt * 4);
    const top = this.y - this.height / 2;
    const bot = this.y + this.height / 2;
    const c = cat.getCenter();

    // 4. Aşama Sekme Pedi Çarpışması (Trickshot Bouncer Sofa)
    // KRİTİK: Her atışta sadece 1 kez tetiklenir (!hasBouncedThisLaunch), yay salınımıyla çoklu tetikleme önlenir
    if (this.spec.mechanic === "WIND_BOUNCE" && !this.hasBouncedThisLaunch) {
      const bTop = this.y + (this.bouncerYOffset !== undefined ? this.bouncerYOffset : 90);
      const bBot = bTop + (this.bouncerH || 180);
      let hitTriggered = false;

      // Kedi bouncera değdi mi?
      for (let i = 0; i < cat.pointList.length; i++) {
        const pt = cat.pointList[i];
        if (pt.x > this.bouncerX - 26 && pt.y > bTop - 20 && pt.y < bBot + 20 && pt.vx > 0) {
          hitTriggered = true;
          break;
        }
      }

      if (hitTriggered) {
        this.bouncerHitTimer = 0.45; // Derin sünger esnemesi
        this.hasBouncedThisLaunch = true; // Bouncer şartı sağlandı!
        if (audio && audio.playBoing) audio.playBoing();
        if (particles) particles.spawnSparks(this.bouncerX - 20, c.y);

        // BÜTÜNSEL KÜTLE İTKİSİ (Whole-Body Impulse):
        // Kedinin tüm soft-body noktaları eşzamanlı olarak kapıya yönlenir (yay sönümlenmesi sıfırlanır)
        cat.pointList.forEach(pt => {
          pt.x = Math.min(pt.x, this.bouncerX - 25);
          pt.vx = -460; // Trambolinden sola kapı açıklığına (X=225) güçlü açılı falso kavis
          pt.vy = -760; // Tavan engeline toslamadan kapı eşiğinden içeri dalış açısı
        });
      }

      // 4. Kat Fırtına Sundurması (Balcony Canopy): Doğrudan dikey geçişi engelleyen fiziksel kalkan
      // SADECE VE SADECE bouncera çarpmadan önceki doğrudan atışları engeller (trickshot kavisini kesmez!)
      if (!this.hasBouncedThisLaunch) {
        const canopyY = this.y + (this.canopyYOffset !== undefined ? this.canopyYOffset : 190);
        const canopyW = this.canopyW || 295;
        const canopyH = this.canopyH || 22;
        cat.pointList.forEach(pt => {
          if (pt.x < canopyW && pt.y > canopyY && pt.y < canopyY + canopyH + 20 && pt.vy < 0) {
            pt.y = canopyY + canopyH + 20;
            pt.vy = Math.abs(pt.vy) * 0.45 + 140; // Tok metalik çarpıp düşme
            if (audio && audio.playMetallicBonk) audio.playMetallicBonk();
            if (particles) particles.spawnSparks(pt.x, canopyY + canopyH);
          }
        });
      }
    }

    // 2. Aşama: 3 Bölmeli Lüks Otel Döner Camı & Süpüren Engel Çarpışması (ROTATING_FAN)
    // Konsorsiyum Mimarisi: Mert & Burak (Ritmik Zamanlama, Adil Açık Koridor & Polar Fizik)
    if (this.spec.mechanic === "ROTATING_FAN" && cat.isLaunched) {
      const fanR = this.spec.fanRadius || 64;
      const cx = this.centerX;
      const cy = this.y;

      // Kedi dikey olarak çarkın etki alanındayken (cy - fanR ile cy + fanR + 24)
      if (c.y < cy + fanR + 24 && c.y > cy - fanR - 16) {
        // Alt giriş ekseni: Math.PI / 2 (Aşağıdan yukarıya dikey geçiş)
        let minEntryDiff = Math.PI;
        for (let b = 0; b < 3; b++) {
          const bAngle = (this.fanAngle + (b * Math.PI * 2) / 3) % (Math.PI * 2);
          const diff = Math.abs((((bAngle - Math.PI / 2) + Math.PI) % (Math.PI * 2)) - Math.PI);
          if (diff < minEntryDiff) minEntryDiff = diff;
        }

        // Kanat dikey geçiş koridorunu kapatıyorsa (engel anı - kırmızı kapalı hız ve tolerans artışı):
        const bladeHazardSpan = (this.spec.bladeHazardSpan || 0.45); // ~26° süpüren kanat engeli (0.33 -> 0.45 rad)
        if (minEntryDiff < bladeHazardSpan) {
          // Kanat alt giriş veya dikey koridorda kediye çarpar!
          this.hasCollidedBlade = true;
          this.applyImpactShudder(1.8);
          cat.isGlassSmushed = true;
          cat.glassSmushTimer = 0.95;

          if (audio && audio.playGlassSmush) audio.playGlassSmush();

          if (minEntryDiff > bladeHazardSpan - 0.08) {
            return "NEAR_MISS_BLADE";
          }
          return "BONK_BLADE";
        } else if (minEntryDiff < bladeHazardSpan + 0.14) {
          this.wasCloseCall = true;
        }

        // Dairesel Dış Çerçeve Çarpışması: Kedi yatayda çarkın dışına fırlarsa
        for (let i = 0; i < cat.pointList.length; i++) {
          const pt = cat.pointList[i];
          if (Math.abs(pt.y - cy) < 26) {
            const distFromCenter = Math.hypot(pt.x - cx, pt.y - cy);
            if (distFromCenter > fanR + 2 && distFromCenter < fanR + 28) {
              this.applyImpactShudder(1.2);
              if (audio && audio.playMetallicBonk) audio.playMetallicBonk();
              return "BONK_BLADE";
            }
          }
        }
      }
    }

    // 3. Aşama: Siber X-Ray Tarayıcısı (Kedi lazer alanındayken iskeleti parlar)
    if (this.spec.mechanic === "SLIDING_GUILLOTINE" && cat.isLaunched) {
      if (Math.abs(c.x - this.centerX) < this.width / 2 + 18 && Math.abs(c.y - this.y) < 58) {
        cat.isXRayActive = true;
        cat.xRayTimer = 0.40;
        if (!this.isOpen && Math.abs(c.y - this.y) < 38) {
          const edgeDist = Math.abs(Math.abs(c.x - this.centerX) - this.width / 2);
          if (edgeDist < 14 || (this.isWarning && edgeDist < 20)) {
            return "NEAR_MISS_GUILLOTINE";
          }
          return "BONK_BLADE";
        }
      }
    }

    // 5. Aşama: İris Diyafram Kapanma Çarpışması (IRIS_APERTURE)
    // Sorumlu: Mert & Burak — Doğru Dikey Portal Geçiş Geometrisi
    if (this.spec.mechanic === "IRIS_APERTURE" && cat.isLaunched) {
      if (Math.abs(c.y - this.y) < 22) {
        const lateralDist = Math.abs(c.x - this.centerX);
        // Sıkışmış kedi yarıçapı (~12px) ile iris açıklığı kontrolü
        if (lateralDist + 12 > this.irisRadius) {
          if (this.irisRadius > 18) {
            return "NEAR_MISS_IRIS";
          } else {
            return "BONK_IRIS";
          }
        } else if (lateralDist + 16 > this.irisRadius) {
          this.wasCloseCall = true;
        }
      }
    }

    // Pervaz ve Yan Duvar Çarpışmaları (Giyotin, Standart ve Rüzgarlı Kapılar)
    cat.pointList.forEach(pt => {
      // Sol pervaz yönlendirici huni (Kat 4 trickshot için genişletilmiş kavis)
      const leftFunnelSpan = (this.spec.mechanic === "WIND_BOUNCE") ? 45 : 26;
      if (pt.x > this.leftPostX - leftFunnelSpan && pt.x < this.leftPostX + 18) {
        const archTop = (this.spec.mechanic === "WIND_BOUNCE") ? (top - 12) : top;
        const archBot = (this.spec.mechanic === "WIND_BOUNCE") ? (bot + 30) : bot;
        if (pt.y + pt.radius > archTop && pt.y - pt.radius < archBot) {
          const pushIn = (this.leftPostX + 18 - pt.x);
          if (pushIn > 0) {
            pt.x += pushIn * 0.20;
            pt.vx += pushIn * 18 * dt * 60;
            pt.vy *= 0.96;
            this.glowLeft = 1;
          }
        }
      }
      // Sağ pervaz yönlendirici huni (Kat 4 açılı trickshot için kavisli kemer mimarisi)
      const rightFunnelSpan = (this.spec.mechanic === "WIND_BOUNCE") ? 55 : 26;
      if (pt.x > this.rightPostX - 18 && pt.x < this.rightPostX + rightFunnelSpan) {
        const archTop = (this.spec.mechanic === "WIND_BOUNCE") ? (top - 12) : top;
        const archBot = (this.spec.mechanic === "WIND_BOUNCE") ? (bot + 30) : bot;
        if (pt.y + pt.radius > archTop && pt.y - pt.radius < archBot) {
          const pushIn = (pt.x - (this.rightPostX - 18));
          if (pushIn > 0) {
            pt.x -= pushIn * 0.20;
            pt.vx -= pushIn * 18 * dt * 60;
            pt.vy *= 0.96;
            this.glowRight = 1;
          }
        }
      }
      // Katı yan duvar engeli
      const leftWallBound = (this.spec.mechanic === "WIND_BOUNCE") ? (this.leftPostX - leftFunnelSpan) : (this.leftPostX - 14);
      const rightWallBound = (this.spec.mechanic === "WIND_BOUNCE") ? (this.rightPostX + rightFunnelSpan) : (this.rightPostX + 14);
      if (pt.x < leftWallBound || pt.x > rightWallBound) {
        if (pt.y + pt.radius > top && pt.y - pt.radius < bot) {
          if (pt.y > this.y) {
            pt.y = bot + pt.radius;
            pt.vy = Math.abs(pt.vy) * 0.4;
          } else {
            pt.y = top - pt.radius;
            pt.vy = -Math.abs(pt.vy) * 0.4;
          }
        }
      }
    });

    return null;
  }

  // =============================================================
  // PLATFORM ÇİZİMİ (KİLİTLİ ZEMİN MİMARİSİ — ASLA AŞAĞI DÜŞÜRMEYEN SİSTEM)
  // =============================================================
  drawPlatform(ctx, currentFloor) {
    ctx.save();
    const py = this.platformY;
    const isCurrent = (this.floorNumber === currentFloor);
    const isPassed = (this.floorNumber < currentFloor);

    // KURAL: Eğer kedi bu kattaysa VEYA bu kat önceden geçilmişse,
    // zemin %100 YEKPARE VE MÜHÜRLÜ ÇELİK KİRİŞTİR (Delik veya kuyu yoktur!)
    if (this.floorNumber === 1 || isCurrent || isPassed) {
      const beamH = (this.floorNumber === 1) ? 120 : 26;
      ctx.fillStyle = this.spec.platformColor || "#1b1130";
      ctx.fillRect(0, py, this.config.CANVAS_WIDTH, beamH);

      // Üst Neon Çizgisi
      ctx.strokeStyle = this.spec.themeColor;
      ctx.lineWidth = 3;
      ctx.shadowColor = this.spec.themeColor;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.moveTo(0, py);
      ctx.lineTo(this.config.CANVAS_WIDTH, py);
      ctx.stroke();

      // Mühürlü Çelik Izgara & Emniyet Işıkları
      if (this.floorNumber > 1) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
        ctx.fillRect(18, py + 4, this.config.CANVAS_WIDTH - 36, beamH - 8);

        // Kilitli Çelik Izgara Çizgileri
        ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
        ctx.lineWidth = 2;
        for (let gx = 30; gx < this.config.CANVAS_WIDTH - 30; gx += 20) {
          ctx.beginPath(); ctx.moveTo(gx, py + 4); ctx.lineTo(gx, py + beamH - 4); ctx.stroke();
        }

        // Yeşil Emniyet LED'leri (Zemin Kilitli & Güvenli)
        ctx.fillStyle = "#00ff88";
        ctx.shadowColor = "#00ff88";
        ctx.shadowBlur = 6;
        ctx.fillRect(24, py + 2, 4, 3);
        ctx.fillRect(this.config.CANVAS_WIDTH - 28, py + 2, 4, 3);
      }

      // Sadece aktif aşamada kalkış halkası çizilir
      if (isCurrent) {
        this.drawLaunchPadRing(ctx, this.centerX, py - 4, this.spec.themeColor);
      }
    } else {
      // ÜST KATLAR (Henüz ulaşılmamış katlar): Kedinin yukarı uçabilmesi için açık şaft
      // KRİTİK DÜZELTME (MERT & BURAK): Üst kat tavan şaftı sabit ve merkezlenmiş dikey asansör bacasıdır.
      // Henüz o kata ulaşılmamışken üst katın kayar kapıları (örn. 3. Kat giyotini) tavan kirişini hareket ettiremez!
      const beamH = 22;
      const shaftWidth = (this.spec.mechanic === "ROTATING_FAN") ? 128 : 100;
      const shaftCenterX = this.config.CANVAS_WIDTH / 2;
      const gapLeft = shaftCenterX - shaftWidth / 2 - 14;
      const gapRight = shaftCenterX + shaftWidth / 2 + 14;

      ctx.fillStyle = this.spec.platformColor || "#221538";
      ctx.fillRect(0, py, gapLeft, beamH);
      ctx.fillRect(gapRight, py, this.config.CANVAS_WIDTH - gapRight, beamH);

      ctx.strokeStyle = this.spec.themeColor;
      ctx.lineWidth = 2.5;
      ctx.shadowColor = this.spec.themeColor;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(0, py); ctx.lineTo(gapLeft, py);
      ctx.moveTo(gapRight, py); ctx.lineTo(this.config.CANVAS_WIDTH, py);
      ctx.stroke();
    }

    ctx.restore();
  }

  drawLaunchPadRing(ctx, cx, cy, color) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 48, 12, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
    ctx.fill();

    // İleri Fırlatma Oku
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 14);
    ctx.lineTo(cx - 8, cy - 6);
    ctx.lineTo(cx + 8, cy - 6);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  // =============================================================
  // 5 BENZERSİZ KAPI ÇİZİMİ
  // =============================================================
  draw(ctx, particles = null, isCurrentFloor = true, currentFloor = 1) {
    ctx.save();

    // 1. Kat Hedef Ödülü
    // SADECE mühürlenmemiş ve henüz geçilmemiş (mevcut veya sonraki) katlarda gösterilir!
    // Bir kat geçildiğinde, o katın ödülü KESİNLİKLE çizilmez (kedinin arkasında iz kalmaz).
    if (!this.isSealed && this.floorNumber >= currentFloor) {
      const treatY = (this.floorNumber === 5) ? (this.y - 95) : (this.y - 65);
      const treatX = this.centerX;
      this.drawFloorTreat(ctx, treatX, treatY, this.floorNumber, particles);
    }

    // 2. Kat Duvarı & Tematik Hat
    ctx.fillStyle = this.spec.wallColor || "#1e1438";
    ctx.fillRect(0, this.y - this.height / 2, this.leftPostX, this.height);
    ctx.fillRect(this.rightPostX, this.y - this.height / 2, this.config.CANVAS_WIDTH - this.rightPostX, this.height);

    ctx.strokeStyle = this.spec.themeColor || "#8800ff";
    ctx.shadowColor = this.spec.themeColor || "#8800ff";
    ctx.shadowBlur = 10;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(0, this.y + this.height / 2);
    ctx.lineTo(this.leftPostX, this.y + this.height / 2);
    ctx.moveTo(this.rightPostX, this.y + this.height / 2);
    ctx.lineTo(this.config.CANVAS_WIDTH, this.y + this.height / 2);
    ctx.stroke();

    // 3. Aşama Rozeti & İpucu (Sol Duvar)
    ctx.font = "900 13px -apple-system, monospace";
    ctx.fillStyle = this.spec.themeColor;
    ctx.shadowColor = this.spec.themeColor;
    ctx.shadowBlur = 8;
    ctx.textAlign = "left";
    ctx.fillText(`STAGE 0${this.floorNumber}`, 24, this.y - 18);
    ctx.font = "800 9px sans-serif";
    ctx.fillStyle = "rgba(255, 255, 255, 0.65)";
    ctx.shadowBlur = 0;
    ctx.fillText(this.spec.subtitle || this.spec.name, 24, this.y - 5);

    // Sağ Duvarda Oyuncu Başarı İstatistiği
    ctx.font = "800 9px monospace";
    ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
    ctx.textAlign = "right";
    ctx.fillText(this.spec.percentile || "", this.config.CANVAS_WIDTH - 24, this.y - 10);

    // -----------------------------------------------------------
    // MEKANİZMAYA GÖRE ÖZEL ÇİZİM
    // -----------------------------------------------------------
    if (this.spec.mechanic === "ROTATING_FAN") {
      this.drawRotatingFan(ctx);
    } else if (this.spec.mechanic === "SLIDING_GUILLOTINE") {
      this.drawSlidingGuillotine(ctx);
    } else if (this.spec.mechanic === "WIND_BOUNCE") {
      this.drawWindBouncer(ctx, isCurrentFloor);
    } else if (this.spec.mechanic === "IRIS_APERTURE") {
      this.drawIrisAperture(ctx);
    } else {
      this.drawStandardFlap(ctx);
    }

    // Yan Pervazlar (Sadece Dikdörtgen Kapak ve Giyotin İçin Çizilir — Fan ve İris İçin Çizilmez)
    if (this.spec.mechanic !== "ROTATING_FAN" && this.spec.mechanic !== "IRIS_APERTURE") {
      const drawPost = (x, isLeft, glow) => {
        ctx.fillStyle = "#ffffff";
        ctx.shadowColor = glow > 0 ? "#ffff00" : "#ffffff";
        ctx.shadowBlur = glow > 0 ? 20 : 8;
        ctx.fillRect(x, this.y - 26, 10, 52);

        let postColor = glow > 0 ? "#ffff00" : (this.isOpen ? (this.isWarning ? "#ffcc00" : "#00ff88") : "#ff0055");
        ctx.fillStyle = postColor;
        ctx.shadowColor = postColor;
        ctx.shadowBlur = 14;
        ctx.fillRect(isLeft ? x + 3 : x + 1, this.y - 20, 6, 40);
      };
      drawPost(this.leftPostX - 10, true, this.glowLeft);
      drawPost(this.rightPostX, false, this.glowRight);
    }

    ctx.restore();
  }

  // 1. MEKANİZMA: STANDART SARKAÇ KAPAK (KAT 1: KUTU SENDROMU & EV KEDİ KAPISI)
  drawStandardFlap(ctx) {
    this.drawRhythmBar(ctx, this.centerX, this.y - this.height / 2 - 12);

    // Üst Metal Menteşe & Mikro Titreşim (Hinge Rattle Affordance)
    const hingeVibration = (this.isWarning || !this.isOpen) ? Math.sin(Date.now() * 0.04) * 1.5 : 0;
    ctx.save();
    ctx.fillStyle = "#8b9bb4";
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.rect(this.centerX - this.width / 2 + 6 + hingeVibration, this.y - this.height / 2 - 4, 14, 6);
    ctx.rect(this.centerX + this.width / 2 - 20 + hingeVibration, this.y - this.height / 2 - 4, 14, 6);
    ctx.fill(); ctx.stroke();
    ctx.restore();

    const effectiveAngle = this.flapAngle + Math.sin(Date.now() * 0.05) * this.impactRattle;
    ctx.save();
    ctx.translate(this.centerX, this.y - this.height / 2);

    // Açıkken arkadaki sıcacık oturma odasından dökülen altın ışık huzmesi (Living Room Glow)
    if (this.isOpen) {
      const roomGlow = ctx.createRadialGradient(0, 10, 5, 0, 40, 85);
      roomGlow.addColorStop(0, "rgba(255, 215, 100, 0.45)");
      roomGlow.addColorStop(0.7, "rgba(255, 180, 50, 0.15)");
      roomGlow.addColorStop(1, "transparent");
      ctx.fillStyle = roomGlow;
      ctx.beginPath();
      ctx.moveTo(-this.width / 2, 0);
      ctx.lineTo(this.width / 2, 0);
      ctx.lineTo(this.width / 2 + 35, 90);
      ctx.lineTo(-this.width / 2 - 35, 90);
      ctx.closePath();
      ctx.fill();
    }

    ctx.rotate(-effectiveAngle);

    // Sıcak ahşap/akrilik kedi kapısı kapağı
    const flapColor = this.isOpen ? (this.isWarning ? "#ffcc00" : "#00ff88") : "#ff0055";
    ctx.fillStyle = this.isOpen ? "rgba(10, 40, 25, 0.75)" : "rgba(45, 12, 25, 0.85)";
    ctx.strokeStyle = flapColor;
    ctx.lineWidth = 3.0;
    ctx.shadowColor = flapColor;
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(-this.width / 2 + 4, 0, this.width - 8, this.height + 15, 8) : ctx.rect(-this.width / 2 + 4, 0, this.width - 8, this.height + 15);
    ctx.fill(); ctx.stroke();

    // Sevimli Kedi Patisi Amblemi (Paw Print on Flap)
    ctx.fillStyle = flapColor;
    ctx.shadowBlur = 8;
    const pawY = (this.height + 15) / 2 - 4;
    ctx.beginPath();
    ctx.arc(0, pawY, 6, 0, Math.PI * 2);
    ctx.fill();
    [-7, -3, 3, 7].forEach((px, i) => {
      const py = pawY - 9 - (i === 1 || i === 2 ? 2 : 0);
      ctx.beginPath();
      ctx.arc(px, py, 2.8, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.font = "900 10.5px sans-serif";
    ctx.fillStyle = flapColor;
    ctx.textAlign = "center";
    ctx.fillText(this.isOpen ? "▲ ENTER ▲" : "🔒 LOCKED", 0, this.height + 11);
    ctx.restore();
  }

  // 2. MEKANİZMA: LÜKS OTEL DÖNER CAMI (KAT 2: REVOLVING GLASS DOOR & SWEEPING HAZARD)
  // Selin (Görsel Netlik & Sıfır Metin) ve Mert (Geometrik İllüstrasyon)
  drawRotatingFan(ctx) {
    const gateColor = this.isOpen ? (this.isWarning ? "#ffb700" : "#00ff88") : "#ff0055";

    // 1. Üst Ritim LED Barı (Oyuncunun ritmi okuyabilmesi için)
    this.drawRhythmBar(ctx, this.centerX, this.y - 74);

    ctx.save();
    ctx.translate(this.centerX, this.y);

    // 2. Ağır Çelik Portal Kasası (Dairesel Dış Çerçeve — Alt Giriş Portu Açık)
    const fanR = this.spec.fanRadius || 64;
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 7;
    ctx.beginPath();
    // Alt giriş kapısı (Math.PI * 0.35 - Math.PI * 0.65) açık bırakılır
    ctx.arc(0, 0, fanR, Math.PI * 0.68, Math.PI * 2.32);
    ctx.stroke();

    // Dairesel Neon Durum Halkası
    ctx.strokeStyle = gateColor;
    ctx.lineWidth = 3.5;
    ctx.shadowColor = gateColor;
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.arc(0, 0, fanR - 3, Math.PI * 0.68, Math.PI * 2.32);
    ctx.stroke();

    ctx.fillStyle = "rgba(10, 14, 24, 0.88)";
    ctx.fill();

    // 3. Alt Giriş Eşiği (Kapalıyken Kırmızı Lazer Bariyer, Açıkken Açık Giriş Portu)
    ctx.save();
    if (!this.isOpen || this.isWarning) {
      // Kapalı / Uyarı: Alt girişe lazer bariyer çekilir
      ctx.strokeStyle = gateColor;
      ctx.lineWidth = 5;
      ctx.shadowColor = gateColor;
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(0, 0, fanR - 3, Math.PI * 0.36, Math.PI * 0.64);
      ctx.stroke();
    } else {
      // Açık: Giriş ağzı tamamen açıktır; yeşil neon kılavuz pilonları parlar
      ctx.fillStyle = "#00ff88";
      ctx.shadowColor = "#00ff88";
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(-26, fanR - 6, 3.5, 0, Math.PI * 2);
      ctx.arc(26, fanR - 6, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // 4. Dönen 3 Güçlendirilmiş Cam Kanat (Revolving Glass Wings with Titanium Frame & Hazard Edge)
    ctx.save();
    ctx.rotate(this.fanAngle);

    for (let b = 0; b < 3; b++) {
      // Kanat Arka Planı (Şeffaf Kristal Emniyet Camı)
      ctx.fillStyle = this.isOpen ? "rgba(0, 255, 136, 0.16)" : "rgba(255, 0, 85, 0.22)";
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, 52, -0.22, 0.22);
      ctx.closePath();
      ctx.fill();

      // Cam Işık Yansıması Çizgileri
      ctx.strokeStyle = "rgba(255, 255, 255, 0.55)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(14, -6);
      ctx.lineTo(42, 10);
      ctx.stroke();

      // Kanat Titanyum Taşıyıcı Omurga Çubuğu (Spine Segment)
      ctx.strokeStyle = "#cbd5e1";
      ctx.lineWidth = 3.5;
      ctx.shadowColor = gateColor;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(52, 0);
      ctx.stroke();

      // Dış Kanat Ucu Süpüren Tehlike Tamponu (Hazard Sweeper Bumper at Tip)
      ctx.fillStyle = gateColor;
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(50, 0, 6, 0, Math.PI * 2);
      ctx.fill();

      // Sarı/Siyah Uyarı İkaz Halkası
      ctx.strokeStyle = "#ffd166";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(50, 0, 3.5, 0, Math.PI * 2);
      ctx.stroke();

      ctx.rotate((Math.PI * 2) / 3);
    }
    ctx.restore();

    // 5. Merkez Rulman Hub Başlığı
    ctx.fillStyle = "#1e293b";
    ctx.strokeStyle = gateColor;
    ctx.lineWidth = 2.5;
    ctx.shadowColor = gateColor;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(0, 0, 4, 0, Math.PI * 2);
    ctx.fill();

    // 6. Cam Darbe Çatlağı (Eğer bonk olduysa örümcek ağı çatlak efekti)
    if (this.impactRattle > 0) {
      ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
      ctx.lineWidth = 1.5;
      ctx.shadowColor = "#ffffff";
      ctx.shadowBlur = 8;
      for (let cr = 0; cr < 5; cr++) {
        const cAngle = cr * 1.25;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(cAngle) * 36, Math.sin(cAngle) * 36);
        ctx.stroke();
      }
    }

    // 7. Durum Metni (Zero-Text destekli net görsel durum)
    ctx.font = "900 11px -apple-system, monospace";
    ctx.fillStyle = gateColor;
    ctx.shadowColor = gateColor;
    ctx.shadowBlur = 8;
    ctx.textAlign = "center";
    ctx.fillText(
      this.isOpen ? (this.isWarning ? "⚠ SWEEPING ⚠" : "▲ PASSAGE OPEN ▲") : "⛔ BLOCKED - ROTATING ⛔",
      0,
      78
    );

    ctx.restore();
  }

  // 3. MEKANİZMA: SİBER X-RAY GÜVENLİK TARAYICISI (KAT 3: CYBER LUGGAGE SCANNER)
  drawSlidingGuillotine(ctx) {
    const trackY = this.y - this.height / 2 - 14;
    // 🩻 Siber X-Ray Bagaj Tarayıcı Ray Hattı
    ctx.strokeStyle = "rgba(0, 255, 255, 0.35)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(this.config.CANVAS_WIDTH / 2 - 95, trackY);
    ctx.lineTo(this.config.CANVAS_WIDTH / 2 + 95, trackY);
    ctx.stroke();

    // Ray Rulman Kılavuz Dişleri
    ctx.strokeStyle = "rgba(0, 255, 255, 0.6)";
    ctx.lineWidth = 1.5;
    for (let rx = this.config.CANVAS_WIDTH / 2 - 90; rx <= this.config.CANVAS_WIDTH / 2 + 90; rx += 15) {
      ctx.beginPath();
      ctx.moveTo(rx, trackY - 3); ctx.lineTo(rx, trackY + 3);
      ctx.stroke();
    }

    // 2. Kayan Hidrolik Lazer Çerçevesi
    const gateColor = this.isOpen ? (this.isWarning ? "#ffcc00" : "#00ff88") : "#ff0055";
    ctx.save();
    ctx.translate(this.centerX, this.y);

    // Dikey Parlayan Cyan Lazer Röntgen Perdesi (X-Ray Scanner Curtain)
    ctx.strokeStyle = "rgba(0, 255, 255, 0.75)";
    ctx.shadowColor = "#00ffff";
    ctx.shadowBlur = 14;
    ctx.lineWidth = 2.0;
    ctx.setLineDash([6, 3]);
    ctx.beginPath();
    ctx.moveTo(0, -this.height / 2);
    ctx.lineTo(0, this.height + 250);
    ctx.stroke();
    ctx.setLineDash([]);

    // Açıklık Çerçevesi
    ctx.strokeStyle = gateColor;
    ctx.lineWidth = 3.5;
    ctx.shadowColor = gateColor;
    ctx.shadowBlur = 14;
    ctx.fillStyle = this.isOpen ? "rgba(0, 255, 255, 0.22)" : "rgba(255, 0, 85, 0.35)";
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(-this.width / 2 + 4, -this.height / 2, this.width - 8, this.height + 15, 6) : ctx.rect(-this.width / 2 + 4, -this.height / 2, this.width - 8, this.height + 15);
    ctx.fill(); ctx.stroke();

    // Sarı/Siyah Tehlike Çizgileri (Hazard Stripes)
    ctx.strokeStyle = "rgba(255, 209, 102, 0.55)";
    ctx.lineWidth = 2;
    for (let hx = -this.width / 2 + 10; hx < this.width / 2 - 10; hx += 16) {
      ctx.beginPath();
      ctx.moveTo(hx, -this.height / 2 + 2);
      ctx.lineTo(hx + 8, -this.height / 2 + 12);
      ctx.stroke();
    }

    // Durum Başlığı
    ctx.font = "900 11px sans-serif";
    ctx.fillStyle = gateColor;
    ctx.textAlign = "center";
    ctx.fillText(this.isOpen ? "🩻 X-RAY OPEN" : "⚡ SCANNER SCANNING", 0, this.height + 6);

    ctx.restore();
  }

  // 4. MEKANİZMA: FIRTINA MENFEZİ & KADİFE KOLTUK TRICKSHOT (KAT 4: VELVET SOFA BOUNCER)
  drawWindBouncer(ctx, isCurrentFloor) {
    this.drawStandardFlap(ctx);

    // 🌪️ Lüks Yaylı Kadife Kedi Koltuğu (Velvet Scratcher Sofa Bouncer)
    const isHit = this.bouncerHitTimer > 0;
    const compression = isHit ? Math.sin(this.bouncerHitTimer * Math.PI * 4) * 14 : 0;
    const bx = this.bouncerX - compression;
    const by = this.y + (this.bouncerYOffset !== undefined ? this.bouncerYOffset : 90);
    const bh = this.bouncerH || 180;

    ctx.save();

    // Koltuğun arkasındaki 3 Çelik Helezon Yay (Heavy Compression Springs)
    ctx.strokeStyle = "#ffd700";
    ctx.lineWidth = 2.5;
    [by + 28, by + bh / 2, by + bh - 28].forEach(sy => {
      ctx.beginPath();
      ctx.moveTo(bx, sy);
      ctx.lineTo(bx + 12, sy - 4);
      ctx.lineTo(bx + 16, sy + 4);
      ctx.lineTo(this.config.CANVAS_WIDTH, sy);
      ctx.stroke();
    });

    // Kadife Kapitoneli Koltuk Yastığı Gövdesi (Deep Tufted Velvet Cushion)
    const sofaGrad = ctx.createLinearGradient(bx - 24, by, bx, by);
    sofaGrad.addColorStop(0, isHit ? "#ff007f" : "#a8165b");
    sofaGrad.addColorStop(1, isHit ? "#ffffff" : "#ff2a6d");
    ctx.fillStyle = sofaGrad;
    ctx.strokeStyle = isHit ? "#ffffff" : "#ff007f";
    ctx.lineWidth = 3.5;
    ctx.shadowColor = isHit ? "#ffff00" : "#ff007f";
    ctx.shadowBlur = isHit ? 30 : 16;

    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(bx - 22, by, 22, bh, 10) : ctx.rect(bx - 22, by, 22, bh);
    ctx.fill(); ctx.stroke();

    // Kapitone Düğmeleri (Diamond Tufting Buttons)
    ctx.fillStyle = "#ffffff";
    ctx.shadowBlur = 6;
    for (let ty = by + 22; ty < by + bh - 10; ty += 26) {
      ctx.beginPath();
      ctx.arc(bx - 11, ty, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // 💥 Dairesel Nabız Halesi (Trickshot Visual Affordance Wave)
    if (!isHit && isCurrentFloor) {
      const pulseWave = (Date.now() * 0.005) % 1;
      ctx.strokeStyle = `rgba(0, 229, 255, ${1.0 - pulseWave})`;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(bx - 22, by + bh / 2, 16 + pulseWave * 28, -Math.PI / 2, Math.PI / 2, true);
      ctx.stroke();

      ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
      ctx.font = "900 11px monospace";
      ctx.textAlign = "right";
      ctx.fillText("◀ AIM HERE!", bx - 26, by + bh / 2 + 4);
    }

    // 🛡️ 4. Kat Fırtına Sundurması (Balcony Storm Canopy & Glass Deflector)
    // SIFIR METİN KURALI: Doğrudan dikey geçiş yolunun kapalı olduğunu, tek yolun sağdaki menfez olduğunu anında gösterir!
    const canopyY = this.y + (this.canopyYOffset !== undefined ? this.canopyYOffset : 190);
    const canopyW = this.canopyW || 295;
    const canopyH = this.canopyH || 22;

    // 1. Ağır Çelik Taşıyıcı Konsol Kirişleri
    ctx.strokeStyle = "#162842";
    ctx.lineWidth = 3.5;
    [32, 105, 180, 255].forEach(gx => {
      ctx.beginPath();
      ctx.moveTo(gx, canopyY + canopyH);
      ctx.lineTo(gx - 18, canopyY + canopyH + 28);
      ctx.stroke();
    });

    // 2. Sundurma Gövdesi (Siyah Titanyum ve Neon Cam)
    const canopyGrad = ctx.createLinearGradient(0, canopyY, 0, canopyY + canopyH);
    canopyGrad.addColorStop(0, "#0c1524");
    canopyGrad.addColorStop(0.5, "#182c48");
    canopyGrad.addColorStop(1, "#0a111c");
    ctx.fillStyle = canopyGrad;
    ctx.strokeStyle = "#00e5ff";
    ctx.lineWidth = 2.5;
    ctx.shadowColor = "#00e5ff";
    ctx.shadowBlur = 14;

    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(0, canopyY, canopyW, canopyH, [0, 8, 8, 0]) : ctx.rect(0, canopyY, canopyW, canopyH);
    ctx.fill(); ctx.stroke();

    // 3. Tehlike Şeritleri (Cyan Hazard Warning Stripes)
    ctx.fillStyle = "rgba(0, 229, 255, 0.40)";
    for (let hx = 12; hx < canopyW - 14; hx += 24) {
      ctx.beginPath();
      ctx.moveTo(hx, canopyY + 3);
      ctx.lineTo(hx + 10, canopyY + 3);
      ctx.lineTo(hx + 4, canopyY + canopyH - 3);
      ctx.lineTo(hx - 6, canopyY + canopyH - 3);
      ctx.closePath();
      ctx.fill();
    }

    // 4. Mimari Titanyum Perçinler & Neon Emniyet Göstergesi (Sıfır Metin Kuralı)
    ctx.fillStyle = "#00e5ff";
    ctx.shadowColor = "#00e5ff";
    ctx.shadowBlur = 6;
    for (let rx = 18; rx < canopyW - 10; rx += 36) {
      ctx.beginPath();
      ctx.arc(rx, canopyY + canopyH / 2, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Dinamik Uçuşan Çoraplar & Kağıtlar (Flying Laundry Swirls in Gale Wind)
    if (isCurrentFloor) {
      const now = Date.now();
      const totalWidth = this.config.CANVAS_WIDTH + 140;

      // 8 Katmanlı Rüzgar Akımı
      for (let i = 0; i < 8; i++) {
        const streamSpeed = 220 + (i % 3) * 60;
        const wy = this.y + 20 + i * 46;
        const progress = ((now * (streamSpeed / 1000) + i * 73) % totalWidth);
        const wx = this.config.CANVAS_WIDTH + 80 - progress;
        const streamLen = 50 + (i % 4) * 25;
        const waveY = Math.sin(wx * 0.02 + now * 0.004) * 4;

        const grad = ctx.createLinearGradient(wx, wy + waveY, wx + streamLen, wy + waveY);
        grad.addColorStop(0, "rgba(0, 229, 255, 0.75)");
        grad.addColorStop(0.7, "rgba(0, 229, 255, 0.25)");
        grad.addColorStop(1, "rgba(0, 229, 255, 0)");

        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(wx, wy + waveY);
        ctx.lineTo(wx + streamLen, wy + waveY);
        ctx.stroke();
      }

      ctx.font = "800 10px monospace";
      ctx.fillStyle = "rgba(0, 229, 255, 0.75)";
      ctx.textAlign = "left";
      ctx.fillText("◀ GALE WIND (-520G)", 24, this.y + 45);
    }
    ctx.restore();
  }

  // 5. MEKANİZMA: KRALİYET KASASI: 3 HALKALI ŞİFRE ÇARKI & ALTIN SOMON (KAT 5: THE VAULT ECLIPSE)
  drawIrisAperture(ctx) {
    ctx.save();
    ctx.translate(this.centerX, this.y);

    // 👑 KRALİYET KASASI: 3 Eşmerkezli Dönen Şifre Çarkı & Altın Somon (The Vault Eclipse)
    const now = Date.now();

    // 1. Dış Dişli Çark (Outer Gear Ring)
    ctx.save();
    ctx.rotate(now * 0.0006);
    ctx.strokeStyle = "#ffd700";
    ctx.lineWidth = 3.5;
    ctx.shadowColor = "#ffd700";
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.arc(0, 0, 56, 0, Math.PI * 2);
    ctx.stroke();
    // Dişli tırnakları
    for (let g = 0; g < 12; g++) {
      const ga = (g * Math.PI * 2) / 12;
      ctx.strokeRect(Math.cos(ga) * 54 - 3, Math.sin(ga) * 54 - 3, 6, 6);
    }
    ctx.restore();

    // 2. Orta Şifre Halkası (Middle Roman Cipher Dial)
    ctx.save();
    ctx.rotate(-now * 0.0008);
    ctx.strokeStyle = "rgba(255, 215, 0, 0.55)";
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.arc(0, 0, 47, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // 3. ✨ AÇIKKEN DIŞARIYA FIŞKIRAN ALTIN IŞIK HÜZMELERİ (God Rays of the Royal Vault)
    if (this.isOpen) {
      ctx.save();
      ctx.rotate(now * 0.0012);
      for (let r = 0; r < 8; r++) {
        const ra = (r * Math.PI * 2) / 8;
        ctx.fillStyle = "rgba(255, 215, 0, 0.18)";
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(ra - 0.12) * 120, Math.sin(ra - 0.12) * 120);
        ctx.lineTo(Math.cos(ra + 0.12) * 120, Math.sin(ra + 0.12) * 120);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

    // Diyafram Bıçakları (6 Ağır Altın Plaka)
    const r = this.irisRadius;
    ctx.fillStyle = "rgba(28, 18, 8, 0.95)";
    ctx.strokeStyle = "#ffd700";
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(0, 0, 44, 0, Math.PI * 2);
    ctx.arc(0, 0, Math.max(0, r), 0, Math.PI * 2, true);
    ctx.fill(); ctx.stroke();

    // Açıklık İbaresi
    ctx.font = "900 10.5px sans-serif";
    ctx.fillStyle = this.isOpen ? "#ffd700" : "#ff0055";
    ctx.textAlign = "center";
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 10;
    ctx.fillText(this.isOpen ? "👑 ECLIPSE OPEN" : "🔒 VAULT LOCKED", 0, 4);

    ctx.restore();
  }

  // LED Ritim Barı
  drawRhythmBar(ctx, cx, cy) {
    ctx.save();
    const barW = this.width + 12;
    const barH = 7;

    ctx.fillStyle = "rgba(10, 6, 20, 0.88)";
    ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(cx - barW / 2, cy - barH / 2, barW, barH, 4) : ctx.rect(cx - barW / 2, cy - barH / 2, barW, barH);
    ctx.fill(); ctx.stroke();

    const ledCount = 5;
    const step = (barW - 14) / (ledCount - 1);
    const startX = cx - barW / 2 + 7;

    for (let i = 0; i < ledCount; i++) {
      const lx = startX + i * step;
      let ledColor = this.isOpen ? (this.isWarning ? "#ffcc00" : "#00ff88") : "#ff0055";
      ctx.fillStyle = ledColor;
      ctx.shadowColor = ledColor;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(lx, cy, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // Kat Hedef Ödülleri — 5 AŞAMAYA ÖZEL BENZERSİZ KADEMELİ GÖRSELLER
  drawFloorTreat(ctx, x, y, floor, particles) {
    ctx.save();
    if (particles && Math.random() < 0.22) {
      particles.spawnBowlSteam(x, y - 8);
    }

    if (floor === 1) {
      // 🥛 1. AŞAMA: Porselen Taze Süt Çanağı & Çıtır Balık Krakeri
      ctx.fillStyle = "rgba(56, 189, 248, 0.15)";
      ctx.beginPath(); ctx.arc(x, y, 42, 0, Math.PI * 2); ctx.fill();

      // Porselen Kase
      ctx.fillStyle = "#e2e8f0";
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, 22, 0, Math.PI); ctx.closePath(); ctx.fill(); ctx.stroke();

      // Süt Yüzeyi
      ctx.fillStyle = "#ffffff";
      ctx.beginPath(); ctx.ellipse(x, y - 2, 19, 5, 0, 0, Math.PI * 2); ctx.fill();

      // Yanında Çıtır Balık Krakeri
      ctx.fillStyle = "#f59e0b";
      ctx.beginPath(); ctx.ellipse(x + 16, y - 10, 8, 4, 0.3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(x + 22, y - 10); ctx.lineTo(x + 28, y - 14); ctx.lineTo(x + 28, y - 6); ctx.closePath(); ctx.fill();

      ctx.font = "900 11px sans-serif";
      ctx.fillStyle = "#38bdf8";
      ctx.textAlign = "center";
      ctx.fillText("🥛 FRESH MILK", x, y - 24);
    } else if (floor === 2) {
      // 🍗 2. AŞAMA: Çıtır Şef Tavuk Budu & Havalı Güneş Gözlüğü
      ctx.fillStyle = "rgba(245, 158, 11, 0.18)";
      ctx.beginPath(); ctx.arc(x, y, 46, 0, Math.PI * 2); ctx.fill();

      // Çıtır Kızarmış Tavuk But
      ctx.fillStyle = "#d97706";
      ctx.beginPath(); ctx.ellipse(x - 2, y, 18, 12, -0.2, 0, Math.PI * 2); ctx.fill();

      // Kemik Ucu
      ctx.fillStyle = "#f8fafc";
      ctx.beginPath(); ctx.arc(x + 16, y - 6, 4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x + 19, y - 1, 3.5, 0, Math.PI * 2); ctx.fill();

      // Havalı Güneş Gözlüğü (Kazanılacak Aksesuar)
      ctx.fillStyle = "#0f172a";
      ctx.strokeStyle = "#ffd700";
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x - 18, y - 18, 12, 7, 2) : ctx.rect(x - 18, y - 18, 12, 7); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x - 3, y - 18, 12, 7, 2) : ctx.rect(x - 3, y - 18, 12, 7); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - 6, y - 15); ctx.lineTo(x - 3, y - 15); ctx.stroke();

      ctx.font = "900 11px sans-serif";
      ctx.fillStyle = "#ffd700";
      ctx.textAlign = "center";
      ctx.fillText("🍗 CRISPY CHICKEN", x, y - 24);
    } else if (floor === 3) {
      // 🍣 3. AŞAMA: Somon Nigiri Suşi & Ninja Bandanası
      ctx.fillStyle = "rgba(239, 68, 68, 0.18)";
      ctx.beginPath(); ctx.arc(x, y, 48, 0, Math.PI * 2); ctx.fill();

      // Suşi Pirinci
      ctx.fillStyle = "#f8fafc";
      ctx.beginPath(); ctx.ellipse(x, y + 2, 20, 8, 0, 0, Math.PI * 2); ctx.fill();

      // Taze Somon Dilimi
      ctx.fillStyle = "#f97316";
      ctx.beginPath(); ctx.ellipse(x, y - 2, 22, 7, 0, 0, Math.PI * 2); ctx.fill();

      // Somon Yağ Çizgileri
      ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
      ctx.lineWidth = 1.2;
      for (let sx = -12; sx <= 12; sx += 8) {
        ctx.beginPath(); ctx.moveTo(x + sx, y - 7); ctx.lineTo(x + sx + 4, y + 3); ctx.stroke();
      }

      // Nori Yosun Bandı
      ctx.fillStyle = "#14532d";
      ctx.fillRect(x - 4, y - 8, 8, 16);

      // Kırmızı Ninja Bandanası Kuyruğu
      ctx.fillStyle = "#ef4444";
      ctx.beginPath(); ctx.moveTo(x + 18, y - 14); ctx.lineTo(x + 28, y - 18); ctx.lineTo(x + 25, y - 8); ctx.closePath(); ctx.fill();

      ctx.font = "900 11px sans-serif";
      ctx.fillStyle = "#ff0055";
      ctx.textAlign = "center";
      ctx.fillText("🍣 SALMON NIGIRI", x, y - 24);
    } else if (floor === 4) {
      // 🦞 4. AŞAMA: Zümrüt Maine Istakozu & Süper Kahraman Pelerini
      ctx.fillStyle = "rgba(0, 229, 255, 0.20)";
      ctx.beginPath(); ctx.arc(x, y, 52, 0, Math.PI * 2); ctx.fill();

      // Zümrüt/Kızıl Istakoz Gövdesi
      ctx.fillStyle = "#ea580c";
      ctx.beginPath(); ctx.ellipse(x, y, 16, 12, 0, 0, Math.PI * 2); ctx.fill();

      // Dev Kıskaçlar
      ctx.fillStyle = "#c2410c";
      ctx.beginPath(); ctx.arc(x - 16, y - 6, 8, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x + 16, y - 6, 8, 0, Math.PI * 2); ctx.fill();

      // Zümrüt Parlaması
      ctx.fillStyle = "#10b981";
      ctx.shadowColor = "#10b981";
      ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.arc(x, y - 2, 4, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;

      // Uçuşan Kahraman Pelerini
      ctx.fillStyle = "#a855f7";
      ctx.beginPath(); ctx.moveTo(x - 14, y - 14); ctx.lineTo(x - 26, y - 22); ctx.lineTo(x - 18, y - 6); ctx.closePath(); ctx.fill();

      ctx.font = "900 11px sans-serif";
      ctx.fillStyle = "#00e5ff";
      ctx.textAlign = "center";
      ctx.fillText("🦞 MAINE LOBSTER", x, y - 26);
    } else {
      // 👑 5. AŞAMA: KRALİYET ALTIN SOMON BALIĞI TAHTI & ELMAS TAÇ!
      ctx.fillStyle = "rgba(255, 215, 0, 0.28)";
      ctx.beginPath(); ctx.arc(x, y, 68, 0, Math.PI * 2); ctx.fill();

      // Altın Balık Gövdesi
      ctx.fillStyle = "#ffd700";
      ctx.shadowColor = "#ffd700";
      ctx.shadowBlur = 28;
      ctx.beginPath(); ctx.ellipse(x, y, 36, 18, 0, 0, Math.PI * 2); ctx.fill();

      // Kuyruk
      ctx.beginPath();
      ctx.moveTo(x + 32, y);
      ctx.lineTo(x + 54, y - 18);
      ctx.lineTo(x + 54, y + 18);
      ctx.closePath();
      ctx.fill();

      // Balık Gözü
      ctx.fillStyle = "#0a0a1a";
      ctx.beginPath(); ctx.arc(x - 22, y - 4, 3.5, 0, Math.PI * 2); ctx.fill();

      // 👑 Altın & Elmas Kedi Tacı
      ctx.fillStyle = "#ffd700";
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x - 14, y - 22);
      ctx.lineTo(x - 14, y - 34);
      ctx.lineTo(x - 6, y - 26);
      ctx.lineTo(x, y - 38);
      ctx.lineTo(x + 6, y - 26);
      ctx.lineTo(x + 14, y - 34);
      ctx.lineTo(x + 14, y - 22);
      ctx.closePath();
      ctx.fill(); ctx.stroke();

      ctx.font = "900 13px sans-serif";
      ctx.fillStyle = "#ffd700";
      ctx.shadowColor = "#ffd700";
      ctx.shadowBlur = 14;
      ctx.textAlign = "center";
      ctx.fillText("👑 ROYAL SALMON", x, y - 44);
    }
    ctx.restore();
  }
}

class TowerManager {
  constructor(config = CONFIG) {
    this.config = config;
    this.doors = [];
    this.currentFloor = 1;
    this.setupTower();
  }

  setupTower() {
    this.doors = [];
    const total = this.config.TOTAL_STORY_FLOORS;
    for (let f = 1; f <= total; f++) {
      const spec = this.config.FLOORS[f - 1];
      const doorY = this.config.DOOR_Y - (f - 1) * this.config.FLOOR_HEIGHT;
      this.doors.push(new FloorDoor(f, doorY, spec, this.config));
    }
  }

  getCurrentDoor() {
    return this.doors[this.currentFloor - 1] || this.doors[this.doors.length - 1];
  }

  sealFloor(floorNum) {
    if (this.doors[floorNum - 1]) {
      this.doors[floorNum - 1].sealFloor();
    }
  }

  reset() {
    this.currentFloor = 1;
    this.doors.forEach(door => {
      door.isSealed = false;
      door.cycleTimer = 0;
      door.isOpen = false;
      door.isWarning = false;
      door.isSnapping = false;
      door.flapAngle = 0;
      door.targetFlapAngle = 0;
      door.wasOpenOnCatEntry = false;
      door.irisRadius = 0;
      door.snapSoundPlayed = false;
      door.fanAngle = 0;
      door.impactRattle = 0;
      door.glowLeft = 0;
      door.glowRight = 0;
    });
  }

  update(dt, audio, particles) {
    this.doors.forEach(door => {
      const isCurrent = (door.floorNumber === this.currentFloor);
      door.update(dt, audio, particles, isCurrent);
    });
  }

  draw(ctx, particles, cameraY) {
    this.drawTowerGirders(ctx, cameraY);

    this.doors.forEach(door => {
      const screenY = door.y - cameraY;
      if (screenY > -420 && screenY < this.config.CANVAS_HEIGHT + 420) {
        const isCurrent = (door.floorNumber === this.currentFloor);
        // Platform çizimi (Mühürlü ve kilitli taban kontrolü)
        door.drawPlatform(ctx, this.currentFloor);
        // Kapı mekanizması çizimi (Aktif kat bilgisi ile alt katların ödülü gizlenir)
        door.draw(ctx, particles, isCurrent, this.currentFloor);
      }
    });
  }

  drawTowerGirders(ctx, cameraY) {
    ctx.save();
    const minY = cameraY - 100;
    const maxY = cameraY + this.config.CANVAS_HEIGHT + 100;

    // Minimalist Yan Raylar
    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(14, minY); ctx.lineTo(14, maxY);
    ctx.moveTo(this.config.CANVAS_WIDTH - 14, minY); ctx.lineTo(this.config.CANVAS_WIDTH - 14, maxY);
    ctx.stroke();

    ctx.restore();
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { FloorDoor, TowerManager };
}
