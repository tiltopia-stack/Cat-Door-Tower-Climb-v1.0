/**
 * TİLTOPİA — "KEDİ KAPI" v5.0
 * src/particles.js — Parçacık Motoru (Altın Balık, Konfeti, Purr Kalpleri, Kıvılcım & Buhar)
 * Sorumlu: Selin (Görsel Kimlik) & Burak (Zirve Standartları)
 */

class ParticleSystem {
  constructor() {
    this.particles = [];
  }

  // Zafer Ziyafeti: Altın Balıklar & Konfeti Patlaması
  spawnVictoryFeast(x, y) {
    const colors = ["#00ff88", "#ffd700", "#ff007f", "#38bdf8", "#ffffff"];
    for (let i = 0; i < 30; i++) {
      const a = (Math.PI * 2 * i) / 30 + (Math.random() - 0.5) * 0.35;
      const spd = 180 + Math.random() * 280;
      const isFish = i % 3 === 0;
      this.particles.push({
        x: x + (Math.random() - 0.5) * 36,
        y: y + (Math.random() - 0.5) * 20,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd - 145,
        size: isFish ? 9 : (5 + Math.random() * 4),
        color: isFish ? "#ffd700" : colors[i % colors.length],
        life: 1.4,
        maxLife: 1.4,
        type: isFish ? "fish" : "confetti"
      });
    }
  }

  // Kat 5 Kraliyet Şampiyonluk Altın Konfeti Yağmuru (Glistening Gold & Fish Cascade)
  spawnGoldenConfettiRain(cameraY) {
    const goldColors = ["#ffd700", "#ffea00", "#fff59d", "#ffffff", "#ffaa00", "#00ff88"];
    for (let i = 0; i < 5; i++) {
      const isFish = Math.random() < 0.22;
      this.particles.push({
        x: Math.random() * CONFIG.CANVAS_WIDTH,
        y: cameraY - 15 - Math.random() * 25,
        vx: (Math.random() - 0.5) * 85,
        vy: 120 + Math.random() * 190,
        size: isFish ? 8.5 : (4 + Math.random() * 5),
        color: goldColors[Math.floor(Math.random() * goldColors.length)],
        life: 2.2,
        maxLife: 2.2,
        type: isFish ? "fish" : "confetti"
      });
    }
  }

  // Mutlu Mırıltı Kalpleri (Purr Hearts)
  spawnPurrHeart(x, y) {
    this.particles.push({
      x: x + (Math.random() - 0.5) * 28,
      y: y - 12,
      vx: (Math.random() - 0.5) * 28,
      vy: -48 - Math.random() * 32,
      size: 9 + Math.random() * 4,
      color: Math.random() > 0.5 ? "#ff3388" : "#ffd700",
      life: 1.25,
      maxLife: 1.25,
      type: "heart"
    });
  }

  // Menteşe ve Çarpışma Kıvılcımları
  spawnSparks(x, y) {
    for (let i = 0; i < 9; i++) {
      const a = (Math.PI * 2 * i) / 9 + (Math.random() - 0.5) * 0.5;
      const spd = 120 + Math.random() * 150;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        size: 5 + Math.random() * 4,
        color: i % 2 === 0 ? "#ffffff" : "#ffff00",
        life: 0.45,
        maxLife: 0.45,
        type: "spark"
      });
    }
  }

  // Yüksek Voltajlı Kıl Payı Elektrik Kıvılcımları (P2 Near-Miss Spark Burst)
  spawnElectricSparks(x, y) {
    const colors = ["#ffff00", "#00ffff", "#ffffff", "#ffd700"];
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = 200 + Math.random() * 260;
      this.particles.push({
        x: x + (Math.random() - 0.5) * 16,
        y: y + (Math.random() - 0.5) * 16,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        size: 4 + Math.random() * 5,
        color: colors[i % colors.length],
        life: 0.35,
        maxLife: 0.35,
        type: "electric_spark"
      });
    }
  }

  // Sıcak Mama Buharı
  spawnBowlSteam(x, y) {
    if (Math.random() > 0.35) return;
    this.particles.push({
      x: x + (Math.random() - 0.5) * 24,
      y: y - 8,
      vx: (Math.random() - 0.5) * 8,
      vy: -22 - Math.random() * 14,
      size: 3 + Math.random() * 3,
      color: "rgba(255, 255, 255, 0.45)",
      life: 0.85,
      maxLife: 0.85,
      type: "steam"
    });
  }

  // Kozmik Seri Parıltısı (Streak Trail)
  spawnCosmicTrail(x, y) {
    this.particles.push({
      x: x + (Math.random() - 0.5) * 20,
      y: y + (Math.random() - 0.5) * 20,
      vx: (Math.random() - 0.5) * 20,
      vy: (Math.random() - 0.5) * 20,
      size: 4 + Math.random() * 4,
      color: Math.random() > 0.5 ? "#00ff88" : "#ffd700",
      life: 0.35,
      maxLife: 0.35,
      type: "trail"
    });
  }

  // Fırtına Rüzgarı Sürtünme Çizgileri (Kat 4 Rüzgar Hissi)
  spawnWindSlipstream(x, y) {
    this.particles.push({
      x: x + 10 + Math.random() * 15,
      y: y + (Math.random() - 0.5) * 26,
      vx: -380 - Math.random() * 180, // Rüzgar yönünde (sola) yüksek hız
      vy: (Math.random() - 0.5) * 30,
      size: 16 + Math.random() * 24,
      color: "rgba(0, 229, 255, 0.85)",
      life: 0.28,
      maxLife: 0.28,
      type: "wind_stream"
    });
  }

  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      if (p.type === "confetti" || p.type === "fish") {
        p.vy += 360 * dt;
        p.vx *= 0.96;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      } else if (p.type === "spark" || p.type === "trail" || p.type === "wind_stream") {
        p.vx *= 0.92;
        p.vy *= 0.92;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      } else if (p.type === "heart" || p.type === "steam") {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }
    }
  }

  draw(ctx) {
    ctx.save();
    this.particles.forEach(p => {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      if (p.type === "confetti") {
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size * 1.4);
      } else if (p.type === "fish") {
        ctx.fillStyle = p.color;
        ctx.shadowColor = "#ffd700";
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, p.size * 1.5, p.size * 0.8, p.vx > 0 ? 0.2 : -0.2, 0, Math.PI * 2);
        ctx.fill();
        const dir = p.vx > 0 ? -1 : 1;
        ctx.beginPath();
        ctx.moveTo(p.x + dir * p.size * 1.2, p.y);
        ctx.lineTo(p.x + dir * (p.size * 2.2), p.y - p.size * 0.9);
        ctx.lineTo(p.x + dir * (p.size * 2.2), p.y + p.size * 0.9);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#0a0a1a";
        ctx.beginPath();
        ctx.arc(p.x - dir * p.size * 0.8, p.y - 1.5, 2, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === "spark" || p.type === "trail" || p.type === "electric_spark") {
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = p.type === "electric_spark" ? 18 : 12;
        ctx.beginPath();
        if (p.type === "electric_spark") {
          // Sharp energetic diamond spark
          const s = p.size;
          ctx.moveTo(p.x, p.y - s);
          ctx.lineTo(p.x + s * 0.6, p.y);
          ctx.lineTo(p.x, p.y + s);
          ctx.lineTo(p.x - s * 0.6, p.y);
          ctx.closePath();
        } else {
          ctx.arc(p.x, p.y, p.size / 2, 0, Math.PI * 2);
        }
        ctx.fill();
      } else if (p.type === "wind_stream") {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2.2;
        ctx.shadowColor = "#00e5ff";
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + p.size, p.y);
        ctx.stroke();
      } else if (p.type === "heart") {
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 10;
        const s = p.size;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y + s * 0.3);
        ctx.bezierCurveTo(p.x, p.y - s * 0.4, p.x - s, p.y - s * 0.4, p.x - s, p.y + s * 0.3);
        ctx.bezierCurveTo(p.x - s, p.y + s * 0.8, p.x, p.y + s * 1.2, p.x, p.y + s * 1.5);
        ctx.bezierCurveTo(p.x, p.y + s * 1.2, p.x + s, p.y + s * 0.8, p.x + s, p.y + s * 0.3);
        ctx.bezierCurveTo(p.x + s, p.y - s * 0.4, p.x, p.y - s * 0.4, p.x, p.y + s * 0.3);
        ctx.fill();
      } else if (p.type === "steam") {
        ctx.fillStyle = p.color;
        ctx.shadowBlur = 4;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    ctx.restore();
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ParticleSystem;
}
