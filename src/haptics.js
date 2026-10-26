/**
 * TİLTOPİA — "KEDİ KAPI" v9.0
 * src/haptics.js — Mobil Dokunsal Titreşim Motoru (Web Vibration API)
 * Sorumlu: Kaan (Fizik & Mekanik) & Burak (Game Feel)
 */

class HapticsEngine {
  constructor(engine = null) {
    this.engine = engine;
    this.enabled = true;
  }

  isSupported() {
    return typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
  }

  // Güvenli titreşim çalıştırıcı (Sessiz mod ve cihaz desteğini denetler)
  vibrate(pattern) {
    if (!this.enabled || !this.isSupported()) return false;
    // Oyuncu oyunu sessize almışsa, sessiz ortam nezaketi için titreşimi de pasif yap
    if (this.engine && this.engine.audio && this.engine.audio.isMuted) return false;
    try {
      return navigator.vibrate(pattern);
    } catch (e) {
      return false;
    }
  }

  // 1. Sapan Gerilme Direnci (8ms Mikro Haptic Tık)
  pull() {
    return this.vibrate(8);
  }

  // 2. Fırlatma (18ms Keskin Net Tetikleme)
  launch() {
    return this.vibrate(18);
  }

  // 3. Sert Çarpma / Bonk (45ms, 30ms, 20ms Tok Geri Tepme)
  bonk() {
    return this.vibrate([45, 30, 20]);
  }

  // 4. Milimetrik Sıyrılma / Near-Miss (Çift Kalp Atışı Nabzı)
  nearMiss() {
    return this.vibrate([35, 45, 65]);
  }

  // 5. Normal Kat Geçişi (Sevinç Titreşimi)
  floorClear() {
    return this.vibrate([30, 40, 50]);
  }

  // 6. Kat 5 Kule Zirvesi Zafer Ritmi (Altın Şampiyonluk Dizisi)
  victory() {
    return this.vibrate([70, 40, 90, 50, 140]);
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = HapticsEngine;
}
