/**
 * TİLTOPİA — "KEDİ KAPI" v5.0
 * src/physics.js — Soft-Body Fizik Çekirdeği (Verlet/Euler Noktaları & Yaylar)
 * Sorumlu: Mert (Yazılım & Fizik Motoru Lideri)
 */

class CatPoint {
  constructor(x, y, radius = 12, mass = 1.0) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.radius = radius;
    this.mass = mass;
  }

  update(dt, config) {
    this.vy += config.GRAVITY * dt;
    const drag = Math.pow(config.AIR_DRAG, dt * 60);
    this.vx *= drag;
    this.vy *= drag;

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // Zemin Çarpışması (Kendi kat platformundan aşağı düşemez)
    const activeGroundY = (config && config.CURRENT_PLATFORM_Y !== undefined) ? config.CURRENT_PLATFORM_Y : (config ? config.GROUND_Y : 710);
    if (this.y > activeGroundY - this.radius) {
      this.y = activeGroundY - this.radius;
      this.vy = -this.vy * 0.22;
      this.vx *= 0.85;
    }

    // Yan Duvarlar
    if (this.x < this.radius) {
      this.x = this.radius;
      this.vx = -this.vx * 0.4;
    } else if (this.x > config.CANVAS_WIDTH - this.radius) {
      this.x = config.CANVAS_WIDTH - this.radius;
      this.vx = -this.vx * 0.4;
    }
  }
}

class Spring {
  constructor(p1, p2, restLength, stiffness, damping) {
    this.p1 = p1;
    this.p2 = p2;
    this.restLength = restLength;
    this.stiffness = stiffness;
    this.damping = damping;
  }

  update(dt) {
    const dx = this.p2.x - this.p1.x;
    const dy = this.p2.y - this.p1.y;
    const dist = Math.hypot(dx, dy) || 0.001;
    const delta = dist - this.restLength;

    const nx = dx / dist;
    const ny = dy / dist;

    const relVx = this.p2.vx - this.p1.vx;
    const relVy = this.p2.vy - this.p1.vy;

    const springForce = delta * this.stiffness;
    const dampingForce = (relVx * nx + relVy * ny) * this.damping;
    const totalForce = (springForce + dampingForce) * dt;

    this.p1.vx += (totalForce * nx) / this.p1.mass;
    this.p1.vy += (totalForce * ny) / this.p1.mass;

    this.p2.vx -= (totalForce * nx) / this.p2.mass;
    this.p2.vy -= (totalForce * ny) / this.p2.mass;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CatPoint, Spring };
}
