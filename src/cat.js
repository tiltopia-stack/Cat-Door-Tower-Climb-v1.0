/**
 * TİLTOPİA — "KEDİ KAPI: KULE TIRMANIŞI" v6.0
 * src/cat.js — Canlı Tombul Kedi, Kat Aksesuarları & Yüksek İrtifa Düşüş Fiziği
 * Sorumlular: Selin (Görsel Kimlik), Defne (UX/Psikoloji), Baran (Kat Evrimi)
 */

const CatPointClass = (typeof CatPoint !== 'undefined') ? CatPoint : (typeof require !== 'undefined' ? require('./physics.js').CatPoint : null);
const SpringClass = (typeof Spring !== 'undefined') ? Spring : (typeof require !== 'undefined' ? require('./physics.js').Spring : null);

class Cat {
  constructor(startX, startY, config = CONFIG) {
    this.config = config;
    this.startX = startX;
    this.startY = startY;
    this.currentFloor = 1;

    this.points = {
      head: new CatPointClass(startX, startY - 45, 16, 1.0),
      body_top: new CatPointClass(startX, startY - 15, 20, 1.3),
      body_bottom: new CatPointClass(startX, startY + 22, 24, 1.8),
      leg_l: new CatPointClass(startX - 44, startY + 18, 16, 0.9),
      leg_r: new CatPointClass(startX + 44, startY + 18, 16, 0.9),
      tail: new CatPointClass(startX + 46, startY + 14, 12, 0.6)
    };
    this.pointList = Object.values(this.points);
    this.springs = [];
    this.setupSprings();

    // Durumlar: IDLE, DRAGGING, LAUNCHED, VICTORY_SPIN, FEASTING, TUMBLING, SPLAT
    this.mode = "IDLE";
    this.isLaunched = false;
    this.isSqueezing = false;
    this.isNearMissTriggered = false;
    this.isGlassSmushed = false;
    this.glassSmushTimer = 0;
    this.launchTime = 0;

    // Animasyon Parametreleri
    this.squashFactor = 1.0;
    this.wiggleTimer = 0;
    this.blinkTimer = 0;
    this.isBlinking = false;
    this.spinAngle = 0;
    this.spinVelocity = 0;
    this.tumbleAngle = 0;
    this.tumbleVelocity = 0;
    this.tumbleTimer = 0;
    this.dizzyAngle = 0;
    this.purrTimer = 0;
    this.dragIntensity = 0;

    // Viral Çekim Animasyon Durumları (Meme-Level Expressive Cat)
    this.isXRayActive = false;       // Kat 3 Lazerinden geçerken çıkan neon iskelet & kılçık
    this.xRayTimer = 0;
    this.isGlassSmushed = false;     // Kat 2 Döner camına çarpınca cama yapışan kedi yüzü
    this.glassSmushTimer = 0;
    this.isEyePopped = false;        // Near-Miss anında fırlayan anime gözler
    this.eyePopTimer = 0;
    this.buttWiggleX = 0;
    this.buttWiggleY = 0;
  }

  setupSprings() {
    const p = this.points;
    const addS = (p1, p2, kMult = 1.0) => {
      this.springs.push(new SpringClass(
        p1, p2,
        Math.hypot(p1.x - p2.x, p1.y - p2.y),
        this.config.SPRING_STIFFNESS * kMult,
        this.config.SPRING_DAMPING
      ));
    };

    addS(p.head, p.body_top, 1.2);
    addS(p.body_top, p.leg_l, 1.0);
    addS(p.body_top, p.leg_r, 1.0);
    addS(p.leg_l, p.body_bottom, 1.1);
    addS(p.leg_r, p.body_bottom, 1.1);
    addS(p.body_bottom, p.tail, 1.4);
    addS(p.body_top, p.tail, 1.0);
    addS(p.body_top, p.body_bottom, 1.5);
    addS(p.leg_l, p.leg_r, 1.3);
    addS(p.head, p.leg_l, 0.8);
    addS(p.head, p.leg_r, 0.8);
  }

  getCenter() {
    let sumX = 0, sumY = 0;
    this.pointList.forEach(pt => { sumX += pt.x; sumY += pt.y; });
    return { x: sumX / this.pointList.length, y: sumY / this.pointList.length };
  }

  applyImpulse(ix, iy) {
    this.pointList.forEach(pt => {
      pt.vx += ix / pt.mass;
      pt.vy += iy / pt.mass;
    });
    this.isLaunched = true;
    this.mode = "LAUNCHED";
    this.launchTime = 0;
  }

  // Yeni Kata Yerleşme (Platforma Konma)
  settleOnFloor(floorNumber) {
    this.currentFloor = floorNumber;
    const newPlatformY = this.config.GROUND_Y - (floorNumber - 1) * this.config.FLOOR_HEIGHT;
    this.startX = this.config.CANVAS_WIDTH / 2;
    this.startY = newPlatformY - 45;

    const o = { head: [0, -45], body_top: [0, -15], body_bottom: [0, 22], leg_l: [-44, 18], leg_r: [44, 18], tail: [46, 14] };
    for (const [k, pt] of Object.entries(this.points)) {
      pt.x = this.startX + o[k][0];
      pt.y = this.startY + o[k][1];
      pt.vx = 0;
      pt.vy = 0;
    }
    this.mode = "IDLE";
    this.isLaunched = false;
    this.isSqueezing = false;
    this.isNearMissTriggered = false;
    this.isGlassSmushed = false;
    this.glassSmushTimer = 0;
    this.launchTime = 0;
    this.squashFactor = 1.0;
    this.spinAngle = 0;
    this.tumbleAngle = 0;
  }

  // Teleportasyonsuz Kesintisiz Fiziksel İniş (Parabolic Touchdown & Squash)
  landOnFloor(floorNumber) {
    this.currentFloor = floorNumber;
    const newPlatformY = this.config.GROUND_Y - (floorNumber - 1) * this.config.FLOOR_HEIGHT;
    this.startX = this.config.CANVAS_WIDTH / 2;
    this.startY = newPlatformY - 45;

    // Platforma ayak bastığında tatmin edici elastik iniş yaylanması (squash = 1.38)
    this.squashFactor = 1.38;
    this.mode = "IDLE";
    this.isLaunched = false;
    this.isSqueezing = false;
    this.isNearMissTriggered = false;
    this.isGlassSmushed = false;
    this.glassSmushTimer = 0;
    this.launchTime = 0;
    this.spinAngle = 0;
    this.spinVelocity = 0;
    this.tumbleAngle = 0;
    this.tumbleVelocity = 0;

    const o = { head: [0, -45], body_top: [0, -15], body_bottom: [0, 22], leg_l: [-44, 18], leg_r: [44, 18], tail: [46, 14] };
    for (const [k, pt] of Object.entries(this.points)) {
      pt.x = this.startX + o[k][0];
      pt.y = this.startY + o[k][1];
      pt.vx = 0;
      pt.vy = 0;
    }
  }

  // En Alt Zemine Çakılma (Pancake Splat)
  settleSplat(gx, gy) {
    const cx = Math.max(70, Math.min(this.config.CANVAS_WIDTH - 70, gx));
    const pos = [[0, -16], [0, -14], [0, -10], [-56, -8], [56, -8], [64, -6]];
    this.pointList.forEach((pt, i) => {
      pt.x = cx + pos[i][0];
      pt.y = gy + pos[i][1];
      pt.vx = 0;
      pt.vy = 0;
    });
    this.squashFactor = 1.75;
  }

  update(dt) {
    this.wiggleTimer += dt * 6;
    this.blinkTimer += dt;
    if (this.blinkTimer > 3.2) {
      this.isBlinking = true;
      if (this.blinkTimer > 3.35) {
        this.isBlinking = false;
        this.blinkTimer = 0;
      }
    }

    // Viral Efekt Zamanlayıcıları
    if (this.xRayTimer > 0) {
      this.xRayTimer -= dt;
      this.isXRayActive = (this.xRayTimer > 0);
    }
    if (this.glassSmushTimer > 0) {
      this.glassSmushTimer -= dt;
      this.isGlassSmushed = (this.glassSmushTimer > 0);
    }
    if (this.eyePopTimer > 0) {
      this.eyePopTimer -= dt;
      this.isEyePopped = (this.eyePopTimer > 0);
    }

    // 1. BEKLEME VE SAPAN ÇEKME MODU (IDLE / DRAGGING):
    // VİRAL ÇEKİM: Kediler zıplamadan önce popolarını deli gibi sallar (BUTT WIGGLE)
    if (this.mode === "IDLE" || this.mode === "DRAGGING") {
      const wiggleOffset = (this.mode === "IDLE") ? Math.sin(this.wiggleTimer) * 4 : 0;
      let dragShiftX = 0, dragShiftY = 0;
      let buttWiggleX = 0, buttWiggleY = 0, tailWiggle = 0;

      if (this.mode === "DRAGGING" && this.dragOffset) {
        dragShiftX = this.dragOffset.x * 0.35;
        dragShiftY = this.dragOffset.y * 0.35;

        // İnternet Kültürünün En Sevilen Hareketi: Zıplama Öncesi Popo Sallama
        const wigglePhase = Date.now() * 0.038;
        const wiggleAmp = (4 + this.dragIntensity * 11);
        buttWiggleX = Math.sin(wigglePhase) * wiggleAmp;
        buttWiggleY = Math.abs(Math.cos(wigglePhase * 2)) * (wiggleAmp * 0.35);
        tailWiggle = Math.sin(wigglePhase * 1.5) * (wiggleAmp * 2.4);
      }

      this.buttWiggleX = buttWiggleX;
      this.buttWiggleY = buttWiggleY;

      const o = {
        head: [0 + dragShiftX * 0.3, -45 + dragShiftY * 0.3],
        body_top: [0 + dragShiftX * 0.65 + buttWiggleX * 0.3, -15 + dragShiftY * 0.65],
        body_bottom: [0 + dragShiftX + buttWiggleX, 22 + dragShiftY + buttWiggleY],
        leg_l: [-44 + wiggleOffset + dragShiftX * 0.85 + buttWiggleX * 1.1, 18 + dragShiftY * 0.85 - buttWiggleY],
        leg_r: [44 + wiggleOffset + dragShiftX * 0.85 + buttWiggleX * 1.1, 18 + dragShiftY * 0.85 + buttWiggleY],
        tail: [46 + (this.mode === "DRAGGING" ? tailWiggle : Math.cos(this.wiggleTimer * 1.5) * 8) + dragShiftX * 1.1, 14 + dragShiftY * 1.1]
      };
      for (const [k, pt] of Object.entries(this.points)) {
        pt.x = this.startX + o[k][0];
        pt.y = this.startY + o[k][1];
        pt.vx = 0;
        pt.vy = 0;
      }
      // "Cats Are Liquid": Sapan gerildikçe kedi hamur gibi uzar, yanlardan incelir
      this.squashFactor = (this.mode === "DRAGGING") ? Math.max(0.60, 1.0 - this.dragIntensity * 0.38) : 1.0;
      return;
    }

    // 2. FİZİK SİMÜLASYONU (Sadece fırlatıldığında veya takla atarken çalışır)
    const platformY = this.config.GROUND_Y - (this.currentFloor - 1) * this.config.FLOOR_HEIGHT;

    if (this.mode !== "FEASTING" && this.mode !== "SPLAT") {
      if (this.mode === "LAUNCHED") {
        this.launchTime = (this.launchTime || 0) + dt;
        // Fırlatma esnasında kuyruğu gövdenin sağ yanında aerodinamik olarak tut
        const targetTailX = this.points.body_bottom.x + 28;
        const targetTailY = this.points.body_bottom.y + 4;
        this.points.tail.x += (targetTailX - this.points.tail.x) * Math.min(1, dt * 14);
        this.points.tail.y += (targetTailY - this.points.tail.y) * Math.min(1, dt * 14);
      }

      this.config.CURRENT_PLATFORM_Y = platformY;
      for (let i = 0; i < 4; i++) {
        this.springs.forEach(s => s.update(dt / 4));
      }
      this.pointList.forEach(pt => {
        pt.update(dt, this.config);

        // Kat Zemin Çarpışması: Kedi kendi katının zemininden aşağı düşemez!
        // KRİTİK: SADECE VE SADECE DÜŞÜŞTE OLAN NOKTALAR SEKER (vy > 0).
        // Asla yukarı doğru fırlayan kedinin eksi hızını artı yapma!
        if ((this.mode === "LAUNCHED" || this.mode === "TUMBLING") && pt.y > platformY - pt.radius) {
          pt.y = platformY - pt.radius;
          if (pt.vy > 0) {
            pt.vy = -pt.vy * 0.22;
          }
          pt.vx *= 0.85;
        }
      });
    }

    // Zafer Taklası
    if (this.mode === "VICTORY_SPIN") {
      this.spinAngle += this.spinVelocity * dt;
    }

    // Yüksek İrtifa Taklaları & Düşüş (Mevcut Kat Zeminine İniş)
    if (this.mode === "TUMBLING") {
      this.tumbleAngle += this.tumbleVelocity * dt;
      if (this.tumbleTimer > 0) this.tumbleTimer -= dt;
    }

    if (this.mode === "SPLAT") {
      this.dizzyAngle += dt * 7;
    }

    const targetSquash = this.isSqueezing ? 0.68 : (this.mode === "SPLAT" ? 1.75 : 1.0);
    this.squashFactor += (targetSquash - this.squashFactor) * Math.min(1, dt * 12);
  }

  reset(x = this.startX, y = this.startY) {
    this.settleOnFloor(1);
    this.currentFloor = 1;
    this.dragIntensity = 0;
    this.dizzyAngle = 0;
    this.purrTimer = 0;
  }

  draw(ctx) {
    const p = this.points, sq = this.squashFactor;
    ctx.save();

    // Takla & Döndürme
    if (this.mode === "VICTORY_SPIN" || this.mode === "TUMBLING") {
      const c = this.getCenter();
      ctx.translate(c.x, c.y);
      ctx.rotate(this.mode === "VICTORY_SPIN" ? this.spinAngle : this.tumbleAngle);
      ctx.translate(-c.x, -c.y);

      if (this.mode === "TUMBLING") {
        ctx.strokeStyle = "rgba(255, 255, 255, 0.65)";
        ctx.lineWidth = 2.5;
        ctx.setLineDash([8, 8]);
        ctx.beginPath();
        ctx.arc(c.x, c.y, 54, this.tumbleAngle, this.tumbleAngle + Math.PI * 1.3);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // 0. Kat Evrim Aksesuarı: Süper Kahraman Pelerini (Gövdenin ve bacakların ARKASINDA uçar!)
    if (this.currentFloor >= 4 && this.mode !== "SPLAT") {
      this.drawCape(ctx, p.body_top.x, p.body_top.y);
    }

    // 1. Gövde
    const isXRay = this.isXRayActive;
    ctx.fillStyle = isXRay ? "rgba(8, 28, 38, 0.94)" : "#00ff88";
    ctx.strokeStyle = isXRay ? "#00ffff" : "#ffffff";
    ctx.lineWidth = 3.5;
    ctx.shadowColor = isXRay ? "#00ffff" : ctx.fillStyle;
    ctx.shadowBlur = isXRay ? 24 : 18;
    ctx.beginPath();
    ctx.moveTo(p.head.x - 18, p.head.y);
    ctx.bezierCurveTo(
      p.head.x - 32, p.head.y + 10,
      p.body_top.x - 38 * sq, p.body_top.y - 5,
      p.leg_l.x - 12 * sq, p.leg_l.y
    );
    ctx.quadraticCurveTo(
      p.leg_l.x - 8, p.leg_l.y + 16,
      p.body_bottom.x - 22, p.body_bottom.y + 18
    );
    ctx.quadraticCurveTo(
      p.body_bottom.x, p.body_bottom.y + 24,
      p.body_bottom.x + 22, p.body_bottom.y + 18
    );
    ctx.quadraticCurveTo(
      p.leg_r.x + 8, p.leg_r.y + 16,
      p.leg_r.x + 12 * sq, p.leg_r.y
    );
    ctx.bezierCurveTo(
      p.body_top.x + 38 * sq, p.body_top.y - 5,
      p.head.x + 32, p.head.y + 10,
      p.head.x + 18, p.head.y
    );
    ctx.quadraticCurveTo(p.head.x, p.head.y - 14, p.head.x - 18, p.head.y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 🩻 VİRAL GÖRSEL: Kat 3 X-Ray Lazer Röntgeni (İskelet & Midedeki Balık)
    if (isXRay) {
      ctx.save();
      ctx.strokeStyle = "#00ffff";
      ctx.fillStyle = "#00ffff";
      ctx.shadowColor = "#00ffff";
      ctx.shadowBlur = 12;
      ctx.lineWidth = 2.0;

      // Omurga (Spine)
      ctx.beginPath();
      ctx.moveTo(p.head.x, p.head.y);
      ctx.quadraticCurveTo(p.body_top.x, p.body_top.y, p.body_bottom.x, p.body_bottom.y + 6);
      ctx.stroke();

      // Kaburgalar (Ribs)
      [-12, -4, 4, 12].forEach(offsetY => {
        ctx.beginPath();
        ctx.moveTo(p.body_top.x - 16, p.body_top.y + offsetY);
        ctx.lineTo(p.body_top.x + 16, p.body_top.y + offsetY);
        ctx.stroke();
      });

      // Midedeki Kılçıklı Balık (Fish Bone in Stomach Meme)
      const stomachX = p.body_bottom.x - 4;
      const stomachY = p.body_bottom.y - 4;
      ctx.strokeStyle = "#ffd700";
      ctx.fillStyle = "#ffd700";
      ctx.shadowColor = "#ffd700";
      ctx.lineWidth = 1.8;
      // Balık kılçığı gövdesi
      ctx.beginPath();
      ctx.moveTo(stomachX - 12, stomachY);
      ctx.lineTo(stomachX + 12, stomachY);
      ctx.stroke();
      // Kılçık kolları
      [-6, 0, 6].forEach(fx => {
        ctx.beginPath();
        ctx.moveTo(stomachX + fx - 3, stomachY - 5);
        ctx.lineTo(stomachX + fx + 3, stomachY + 5);
        ctx.stroke();
      });
      // Balık kafası üçgeni
      ctx.beginPath();
      ctx.moveTo(stomachX + 12, stomachY);
      ctx.lineTo(stomachX + 17, stomachY - 4);
      ctx.lineTo(stomachX + 17, stomachY + 4);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // 2. Yan Kuyruk (Sağ yanda belirgin, neşeyle sallanan canlı kıvrımlı kuyruk)
    ctx.save();
    ctx.strokeStyle = "#00ff88";
    ctx.lineWidth = 8;
    ctx.lineCap = "round";
    ctx.shadowColor = "#00ff88";
    ctx.shadowBlur = 14;

    const wiggle = Math.sin(this.wiggleTimer * 1.6) * 10;
    const tailBaseX = p.body_bottom.x + 24;
    const tailBaseY = p.body_bottom.y + 4;
    const tailMidX = p.body_bottom.x + 44 + wiggle * 0.4;
    const tailMidY = p.body_bottom.y - 8;
    const tailTipX = p.body_bottom.x + 56 + wiggle;
    const tailTipY = p.body_bottom.y - 28 + Math.cos(this.wiggleTimer * 1.6) * 4;

    ctx.beginPath();
    ctx.moveTo(tailBaseX, tailBaseY);
    ctx.quadraticCurveTo(tailMidX, tailMidY, tailTipX, tailTipY);
    ctx.stroke();

    // Parlak beyaz kuyruk ucu
    ctx.fillStyle = "#ffffff";
    ctx.shadowColor = "#ffffff";
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(tailTipX, tailTipY, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 3. Kulaklar
    const earTilt = (this.mode === "DRAGGING") ? this.dragIntensity * 6 : 0;
    const drawEar = (tipX, tipY, b1X, b1Y, b2X, b2Y) => {
      ctx.fillStyle = "#00ff88";
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(b1X, b1Y);
      ctx.lineTo(tipX, tipY + earTilt);
      ctx.lineTo(b2X, b2Y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#8800ff";
      ctx.beginPath();
      ctx.moveTo(b1X + 2, b1Y - 1);
      ctx.lineTo(tipX, tipY + earTilt + 4);
      ctx.lineTo(b2X - 2, b2Y - 1);
      ctx.closePath();
      ctx.fill();
    };
    drawEar(p.head.x - 22, p.head.y - 28, p.head.x - 26, p.head.y - 4, p.head.x - 8, p.head.y - 12);
    drawEar(p.head.x + 22, p.head.y - 28, p.head.x + 8, p.head.y - 12, p.head.x + 26, p.head.y - 4);

    // 4. Bıyıklar
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.moveTo(p.head.x - 14, p.head.y + 2); ctx.lineTo(p.head.x - 36, p.head.y - 1);
    ctx.moveTo(p.head.x - 14, p.head.y + 6); ctx.lineTo(p.head.x - 34, p.head.y + 8);
    ctx.moveTo(p.head.x + 14, p.head.y + 2); ctx.lineTo(p.head.x + 36, p.head.y - 1);
    ctx.moveTo(p.head.x + 14, p.head.y + 6); ctx.lineTo(p.head.x + 34, p.head.y + 8);
    ctx.stroke();

    // 5. Yüz Mimikleri
    if (this.mode === "SPLAT") {
      const drawSpiral = (cx, cy) => {
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2.8;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        for (let a = 0; a < Math.PI * 4; a += 0.28) {
          const r = (a / (Math.PI * 4)) * 7.5;
          const sx = cx + Math.cos(a + this.dizzyAngle) * r;
          const sy = cy + Math.sin(a + this.dizzyAngle) * r;
          if (a === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
        }
        ctx.stroke();
      };
      drawSpiral(p.head.x - 9, p.head.y - 3);
      drawSpiral(p.head.x + 9, p.head.y - 3);

      // Dil
      ctx.fillStyle = "#ff007f";
      ctx.shadowColor = "#ff007f";
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.ellipse(p.head.x + 4, p.head.y + 13, 5.5, 9, Math.PI / 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(p.head.x + 4, p.head.y + 6); ctx.lineTo(p.head.x + 5, p.head.y + 16); ctx.stroke();

      // Yıldızlar
      for (let i = 0; i < 4; i++) {
        const a = this.dizzyAngle + (i * Math.PI * 2) / 4;
        this.drawCartoonStar(ctx, p.head.x + Math.cos(a) * 32, p.head.y - 20 + Math.sin(a) * 10, 4, 8, 4, "#ffff00");
      }
    } else if (this.mode === "FEASTING") {
      ctx.strokeStyle = "#0a0a1a";
      ctx.lineWidth = 3.5;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(p.head.x - 13, p.head.y - 2); ctx.lineTo(p.head.x - 8, p.head.y - 7); ctx.lineTo(p.head.x - 3, p.head.y - 2);
      ctx.moveTo(p.head.x + 3, p.head.y - 2); ctx.lineTo(p.head.x + 8, p.head.y - 7); ctx.lineTo(p.head.x + 13, p.head.y - 2);
      ctx.stroke();

      ctx.fillStyle = "#ff3388";
      ctx.beginPath(); ctx.arc(p.head.x - 16, p.head.y + 3, 5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(p.head.x + 16, p.head.y + 3, 5, 0, Math.PI * 2); ctx.fill();

      ctx.strokeStyle = "#0a0a1a";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(p.head.x - 3, p.head.y + 5, 3.5, 0, Math.PI);
      ctx.arc(p.head.x + 3, p.head.y + 5, 3.5, 0, Math.PI);
      ctx.stroke();
    } else if (this.isGlassSmushed) {
      // 🏨 VİRAL: Kat 2 Döner Camına Yüz Yapışması (Glass Smush Meme)
      // Cama yapışıp düzleşmiş komik kedi suratı
      ctx.save();
      // Cam buğulanması (Condensation Fog)
      ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
      ctx.beginPath();
      ctx.ellipse(p.head.x, p.head.y + 2, 28, 18, 0, 0, Math.PI * 2);
      ctx.fill();

      // Cama yapışmış ezik pembe yanaklar
      ctx.fillStyle = "rgba(255, 0, 128, 0.65)";
      ctx.beginPath();
      ctx.ellipse(p.head.x - 14, p.head.y + 4, 9, 6, -0.2, 0, Math.PI * 2);
      ctx.ellipse(p.head.x + 14, p.head.y + 4, 9, 6, 0.2, 0, Math.PI * 2);
      ctx.fill();

      // Düzleşmiş burun
      ctx.fillStyle = "#ff0055";
      ctx.beginPath();
      ctx.ellipse(p.head.x, p.head.y + 4, 5, 3.5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Cama yapışmış düz göz çizgileri
      ctx.strokeStyle = "#0a0a1a";
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(p.head.x - 14, p.head.y - 4); ctx.lineTo(p.head.x - 4, p.head.y - 4);
      ctx.moveTo(p.head.x + 4, p.head.y - 4); ctx.lineTo(p.head.x + 14, p.head.y - 4);
      ctx.stroke();

      // Cama yapışmış 2 beyaz ön pati izi
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(p.head.x - 24, p.head.y + 12, 6, 0, Math.PI * 2);
      ctx.arc(p.head.x + 24, p.head.y + 12, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else if (this.isEyePopped || this.isNearMissTriggered) {
      // ⚡ VİRAL: Near-Miss Anında Gözlerin Yuvalarından Fırlaması (Tex Avery Eye-Bulge)
      ctx.save();
      const popDist = 14;
      const eyeR = 8.5;
      [-10, 10].forEach(side => {
        const ex = p.head.x + side;
        const ey = p.head.y - 4 - popDist;
        // Göz sapı (Eye stalk)
        ctx.strokeStyle = "#00ff88";
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(p.head.x + side * 0.7, p.head.y - 3);
        ctx.lineTo(ex, ey);
        ctx.stroke();

        // Fırlayan koca göz küresi
        ctx.fillStyle = "#ffffff";
        ctx.shadowColor = "#ffff00";
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.arc(ex, ey, eyeR, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#ff0000";
        ctx.lineWidth = 1;
        // Kırmızı şok damarları
        ctx.beginPath();
        ctx.moveTo(ex - 4, ey - 4); ctx.lineTo(ex - 1, ey - 1);
        ctx.moveTo(ex + 4, ey - 4); ctx.lineTo(ex + 1, ey - 1);
        ctx.stroke();

        // Minik şok göz bebeği
        ctx.fillStyle = "#000000";
        ctx.beginPath();
        ctx.arc(ex, ey, 2.2, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();
    } else if (this.isSqueezing || this.mode === "TUMBLING") {
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(p.head.x - 12, p.head.y - 6); ctx.lineTo(p.head.x - 4, p.head.y + 2);
      ctx.moveTo(p.head.x - 4, p.head.y - 6); ctx.lineTo(p.head.x - 12, p.head.y + 2);
      ctx.moveTo(p.head.x + 4, p.head.y - 6); ctx.lineTo(p.head.x + 12, p.head.y + 2);
      ctx.moveTo(p.head.x + 12, p.head.y - 6); ctx.lineTo(p.head.x + 4, p.head.y + 2);
      ctx.stroke();
    } else if (this.mode === "DRAGGING") {
      // 🐱 VİRAL: Avcı Modu — Büyüyen Koca Göz Bebekleri & Anime Işıltıları (Dilated Pupils)
      const eyeR = 6.8 + this.dragIntensity * 2.2;
      ctx.fillStyle = "#ffffff";
      ctx.shadowColor = "#00ff88";
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(p.head.x - 8, p.head.y - 3, eyeR, 0, Math.PI * 2);
      ctx.arc(p.head.x + 8, p.head.y - 3, eyeR, 0, Math.PI * 2);
      ctx.fill();

      // Koca kapkara göz bebeği
      const pupilR = eyeR * 0.78;
      ctx.fillStyle = "#0a0a1a";
      ctx.beginPath();
      ctx.arc(p.head.x - 8, p.head.y - 3, pupilR, 0, Math.PI * 2);
      ctx.arc(p.head.x + 8, p.head.y - 3, pupilR, 0, Math.PI * 2);
      ctx.fill();

      // Sevimli anime ışıltı noktaları (Glitter dots)
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(p.head.x - 10, p.head.y - 5, 2.2, 0, Math.PI * 2);
      ctx.arc(p.head.x + 6, p.head.y - 5, 2.2, 0, Math.PI * 2);
      ctx.arc(p.head.x - 6, p.head.y - 1, 1.2, 0, Math.PI * 2);
      ctx.arc(p.head.x + 10, p.head.y - 1, 1.2, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.mode === "LAUNCHED") {
      // 🚀 VİRAL: Havada Uçarken Rüzgardan Dalgalanan Yanaklar & Açık Ağız
      ctx.fillStyle = "#ffffff";
      ctx.shadowColor = "#ffffff";
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(p.head.x - 8, p.head.y - 3, 5.5, 0, Math.PI * 2);
      ctx.arc(p.head.x + 8, p.head.y - 3, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#0a0a1a";
      ctx.beginPath();
      ctx.arc(p.head.x - 8, p.head.y - 4, 2.5, 0, Math.PI * 2);
      ctx.arc(p.head.x + 8, p.head.y - 4, 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Rüzgarda uçuşan açık ağız & minik vampir dişleri
      ctx.fillStyle = "#880022";
      ctx.beginPath();
      ctx.ellipse(p.head.x, p.head.y + 11, 6, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      // Üst dişler
      ctx.moveTo(p.head.x - 4, p.head.y + 4); ctx.lineTo(p.head.x - 2, p.head.y + 7); ctx.lineTo(p.head.x, p.head.y + 4);
      ctx.moveTo(p.head.x, p.head.y + 4); ctx.lineTo(p.head.x + 2, p.head.y + 7); ctx.lineTo(p.head.x + 4, p.head.y + 4);
      ctx.fill();
    } else {
      if (this.isBlinking) {
        ctx.strokeStyle = "#0a0a1a";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(p.head.x - 12, p.head.y - 3); ctx.lineTo(p.head.x - 4, p.head.y - 3);
        ctx.moveTo(p.head.x + 4, p.head.y - 3); ctx.lineTo(p.head.x + 12, p.head.y - 3);
        ctx.stroke();
      } else {
        ctx.fillStyle = "#ffffff";
        ctx.shadowColor = "#ffffff";
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(p.head.x - 8, p.head.y - 3, 4.5, 0, Math.PI * 2);
        ctx.arc(p.head.x + 8, p.head.y - 3, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#0a0a1a";
        ctx.beginPath();
        ctx.arc(p.head.x - 8, p.head.y - 5, 2.2, 0, Math.PI * 2);
        ctx.arc(p.head.x + 8, p.head.y - 5, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Pembe Burun
    ctx.fillStyle = "#ff007f";
    ctx.shadowColor = "#ff007f";
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.moveTo(p.head.x - 3, p.head.y + 4);
    ctx.lineTo(p.head.x + 3, p.head.y + 4);
    ctx.lineTo(p.head.x, p.head.y + 7);
    ctx.closePath();
    ctx.fill();

    // 6. Kat Evrim Aksesuarları (Kümülatif Dopamin Progresyonu)
    // Not: Bandana ve güneş gözlüğü kedi gözlerinin mimiklerini kapattığı için kaldırıldı; anime gözler %100 görünür!
    if (this.mode !== "SPLAT") {
      // Kat 4+: Pelerin Ön Broşu (Göğüs üzerinde altın kraliyet tokası)
      if (this.currentFloor >= 4) {
        this.drawCapeClasp(ctx, p.body_top.x, p.body_top.y - 6);
      }
      // Kat 5+: Altın Şampiyonluk Tacı (Kulaklar arasında ışıldayan kraliyet tacı)
      if (this.currentFloor >= 5) {
        this.drawCrown(ctx, p.head.x, p.head.y - 34);
      }
    } else {
      // SPLAT Mizahı: Çakılınca yana kaymış eğri taç (Slapstick Comedy)
      if (this.currentFloor >= 5) {
        this.drawCrookedCrown(ctx, p.head.x + 18, p.head.y - 12);
      }
    }

    ctx.restore();
  }

  drawSunglasses(ctx, cx, cy) {
    ctx.save();
    ctx.fillStyle = "#0c0817";
    ctx.strokeStyle = "#ffd700";
    ctx.lineWidth = 2.2;
    ctx.shadowColor = "#ffd700";
    ctx.shadowBlur = 10;

    // Sol Cam
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(cx - 16, cy - 6, 13, 10, 3) : ctx.rect(cx - 16, cy - 6, 13, 10);
    ctx.fill(); ctx.stroke();

    // Sağ Cam
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(cx + 3, cy - 6, 13, 10, 3) : ctx.rect(cx + 3, cy - 6, 13, 10);
    ctx.fill(); ctx.stroke();

    // Köprü
    ctx.beginPath(); ctx.moveTo(cx - 3, cy - 2); ctx.lineTo(cx + 3, cy - 2); ctx.stroke();

    // Anime Parlama Çizgileri (Glint Slash)
    ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
    ctx.lineWidth = 1.5;
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.moveTo(cx - 14, cy - 4); ctx.lineTo(cx - 8, cy + 2);
    ctx.moveTo(cx + 5, cy - 4); ctx.lineTo(cx + 11, cy + 2);
    ctx.stroke();

    ctx.restore();
  }

  // 🦸 KAT 4+: SÜPER KAHRAMAN PELERİNİ (Gövdenin Arkasında Dinamik Uçuşan Zümrüt Pelerin)
  drawCape(ctx, cx, cy) {
    ctx.save();
    const now = Date.now();
    const isLaunched = (this.mode === "LAUNCHED");
    const flutterSpeed = isLaunched ? 0.026 : 0.006;
    const flutterAmp = isLaunched ? 16 : 8;
    const flutter = Math.sin(now * flutterSpeed) * flutterAmp;

    const vx = this.points.body_top.vx || 0;
    const vy = this.points.body_top.vy || 0;
    // Rüzgar ve hız vektörüne göre geriye doğru dinamik savrulma
    const trailOffset = Math.max(-28, Math.min(38, vy * 0.05));
    const sideTrail = Math.max(-24, Math.min(24, -vx * 0.04));

    // Canlı Neon Cyan Pelerin
    ctx.fillStyle = "#00e5ff";
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2.4;
    ctx.shadowColor = "#00e5ff";
    ctx.shadowBlur = 18;

    ctx.beginPath();
    ctx.moveTo(cx - 18, cy - 6);
    ctx.quadraticCurveTo(
      cx - 36 + flutter + sideTrail,
      cy + 24 + trailOffset,
      cx - 26 + flutter * 1.3 + sideTrail,
      cy + 54 + trailOffset
    );
    ctx.lineTo(cx + sideTrail * 0.6, cy + 44 + trailOffset);
    ctx.lineTo(cx + 26 - flutter * 1.3 + sideTrail, cy + 54 + trailOffset);
    ctx.quadraticCurveTo(
      cx + 36 - flutter + sideTrail,
      cy + 24 + trailOffset,
      cx + 18,
      cy - 6
    );
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Pelerin İç Kıvrım Vurgu Çizgileri
    ctx.strokeStyle = "rgba(255, 255, 255, 0.55)";
    ctx.lineWidth = 1.5;
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.moveTo(cx - 8, cy - 2);
    ctx.lineTo(cx - 14 + sideTrail * 0.8, cy + 46 + trailOffset);
    ctx.moveTo(cx + 8, cy - 2);
    ctx.lineTo(cx + 14 + sideTrail * 0.8, cy + 46 + trailOffset);
    ctx.stroke();

    ctx.restore();
  }

  // 🦸 KAT 4+: PELERİN ALTIN BOYUN BROŞU (Gövdenin Önünde Lüks Madalyon)
  drawCapeClasp(ctx, cx, cy) {
    ctx.save();
    ctx.fillStyle = "#ffd700";
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.8;
    ctx.shadowColor = "#ffd700";
    ctx.shadowBlur = 10;

    // Altın Broş Çerçevesi
    ctx.beginPath();
    ctx.arc(cx, cy, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // İç Zümrüt Taşı
    ctx.fillStyle = "#00e5ff";
    ctx.beginPath();
    ctx.arc(cx, cy, 2.8, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  // 👑 KAT 5+: ALTIN KRALİYET TACI (Kulaklar Arasında Işıldayan 24K Şampiyonluk Tacı)
  drawCrown(ctx, cx, cy) {
    ctx.save();
    const now = Date.now();
    ctx.fillStyle = "#ffd700";
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2.4;
    ctx.shadowColor = "#ffd700";
    ctx.shadowBlur = 22;

    // 3 Sivri Uçlu Altın Taç Gövdesi
    ctx.beginPath();
    ctx.moveTo(cx - 18, cy);
    ctx.lineTo(cx - 20, cy - 16);
    ctx.lineTo(cx - 9, cy - 8);
    ctx.lineTo(cx, cy - 22); // Merkez zirve noktası
    ctx.lineTo(cx + 9, cy - 8);
    ctx.lineTo(cx + 20, cy - 16);
    ctx.lineTo(cx + 18, cy);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Taç Taban Kemeri
    ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
    ctx.fillRect(cx - 17, cy - 4, 34, 4);

    // Merkez Yakut Taşı (Ruby Gemstone)
    ctx.fillStyle = "#ff0055";
    ctx.shadowColor = "#ff0055";
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(cx, cy - 8, 4.2, 0, Math.PI * 2);
    ctx.fill();

    // Yan Zümrüt Taşlar
    ctx.fillStyle = "#00e5ff";
    ctx.shadowColor = "#00e5ff";
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(cx - 10, cy - 5, 2.5, 0, Math.PI * 2);
    ctx.arc(cx + 10, cy - 5, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Sivri Uçlarda Parlayan Elmaslar
    ctx.fillStyle = "#ffffff";
    ctx.shadowColor = "#ffffff";
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(cx - 20, cy - 16, 2.2, 0, Math.PI * 2);
    ctx.arc(cx, cy - 22, 3.0, 0, Math.PI * 2);
    ctx.arc(cx + 20, cy - 16, 2.2, 0, Math.PI * 2);
    ctx.fill();

    // ✨ Periyodik Dönen Parlama Yıldızı (Glint Star Effect)
    const glintPhase = (now * 0.0035) % (Math.PI * 2);
    if (glintPhase < 1.4) {
      const glintScale = Math.sin(glintPhase / 1.4 * Math.PI) * 6;
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.5;
      ctx.shadowColor = "#ffffff";
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(cx - glintScale, cy - 22); ctx.lineTo(cx + glintScale, cy - 22);
      ctx.moveTo(cx, cy - 22 - glintScale); ctx.lineTo(cx, cy - 22 + glintScale);
      ctx.stroke();
    }

    ctx.restore();
  }

  // 👑 SPLAT MİHAHI: Çakılınca Yana Eğrilmiş Komik Taç
  drawCrookedCrown(ctx, cx, cy) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(0.55); // 30 derece yana kaymış eğri taç
    this.drawCrown(ctx, 0, 0);
    ctx.restore();
  }

  drawCartoonStar(ctx, cx, cy, spikes, outerRadius, innerRadius, color) {
    let rot = (Math.PI / 2) * 3, step = Math.PI / spikes;
    ctx.save();
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(cx, cy - outerRadius);
    for (let i = 0; i < spikes; i++) {
      ctx.lineTo(cx + Math.cos(rot) * outerRadius, cy + Math.sin(rot) * outerRadius); rot += step;
      ctx.lineTo(cx + Math.cos(rot) * innerRadius, cy + Math.sin(rot) * innerRadius); rot += step;
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Cat;
}
