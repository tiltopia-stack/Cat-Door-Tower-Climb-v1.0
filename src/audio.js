/**
 * TİLTOPİA — "KEDİ KAPI: KULE TIRMANIŞI" v6.0
 * src/audio.js — Kat Bazlı Müzikal Arpejler, Kule Düşüş Islığı & Slapstick Foley
 * Sorumlu: Ece (Ses Tasarımı & Foley Lideri)
 */

class AudioManager {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.initialized = false;
    this.lastStretchTone = 0;
    this.audioPool = {};
    this.buffers = {};
    this.activeHtmlAudios = new Set();
    this.isMuted = (typeof localStorage !== "undefined" && localStorage.getItem("catdoor_muted") === "true");
    this.setupAutoResume();
    this.preloadAudioElements();
    this.init();
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (typeof localStorage !== "undefined") {
      try { localStorage.setItem("catdoor_muted", this.isMuted.toString()); } catch (e) {}
    }
    if (this.isMuted) {
      // 1. Web Audio Master Gain anında 0'a çekilir (Devam eden arpejler/osilatörler susar)
      if (this.ctx && this.masterGain) {
        try { this.masterGain.gain.setValueAtTime(0, this.ctx.currentTime); } catch (e) {}
      }
      // 2. Çalmakta olan tüm HTML5 Audio sesleri derhal durdurulur ve sıfırlanır
      this.stopAllHtmlAudio();
    } else {
      // 1. Web Audio başlatılmamışsa veya askıdaysa bu kullanıcı jesti anında uyandırır
      this.init();
      if (this.ctx && this.masterGain) {
        try { this.masterGain.gain.setValueAtTime(1, this.ctx.currentTime); } catch (e) {}
      }
      // 2. Sesin açıldığını teyit eden anlık neşeli tıkırtı / onay bip sesi
      this.playInstantRestart();
    }
    return this.isMuted;
  }

  stopAllHtmlAudio() {
    if (!this.activeHtmlAudios) return;
    for (const a of this.activeHtmlAudios) {
      try {
        a.pause();
        a.currentTime = 0;
      } catch (e) {}
    }
    this.activeHtmlAudios.clear();
  }

  preloadAudioElements() {
    if (typeof AUDIO_DATA === "undefined") return;
    for (const [key, dataUri] of Object.entries(AUDIO_DATA)) {
      if (typeof Audio !== "undefined") {
        try {
          const a = new Audio(dataUri);
          a.preload = "auto";
          this.audioPool[key] = a;
        } catch (e) {}
      }
    }
  }

  playDataAudio(key, volume = 1.0) {
    if (this.isMuted) return false;
    let played = false;
    // 1. Tarayıcı uyumlu HTML5 Audio oynatma (Askıya alınmış Web Audio'dan bağımsız!)
    if (typeof Audio !== "undefined") {
      try {
        const poolItem = this.audioPool[key];
        const sound = poolItem ? poolItem.cloneNode() : (typeof AUDIO_DATA !== "undefined" && AUDIO_DATA[key] ? new Audio(AUDIO_DATA[key]) : null);
        if (sound) {
          sound.volume = Math.max(0, Math.min(1, volume));
          const p = sound.play();
          if (p && p.catch) p.catch(() => {});
          this.activeHtmlAudios.add(sound);
          sound.onended = () => { if (this.activeHtmlAudios) this.activeHtmlAudios.delete(sound); };
          sound.onerror = () => { if (this.activeHtmlAudios) this.activeHtmlAudios.delete(sound); };
          played = true;
        }
      } catch (e) {}
    }

    // 2. Web Audio AudioBuffer (Mevcutsa sıfır gecikmeli çoklu polifoni)
    if (this.ctx && this.buffers && this.buffers[key]) {
      try {
        this.ensureRunning();
        const src = this.ctx.createBufferSource();
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(volume, this.ctx.currentTime);
        src.buffer = this.buffers[key];
        src.connect(gain);
        gain.connect(this.masterGain || this.ctx.destination);
        src.start(0);
        played = true;
      } catch (e) {}
    }

    return played;
  }

  setupAutoResume() {
    if (typeof window === "undefined") return;
    const resumeHandler = () => {
      this.ensureRunning();
    };
    ["pointerdown", "touchstart", "mousedown", "keydown", "click"].forEach(evt => {
      window.addEventListener(evt, resumeHandler, { passive: true });
    });
  }

  init() {
    if (!this.ctx) {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) {
          this.ctx = new AC();
          this.masterGain = this.ctx.createGain();
          this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 1, this.ctx.currentTime);
          this.masterGain.connect(this.ctx.destination);
        }
      } catch (e) {
        console.warn("Web Audio başlatılamadı:", e);
      }
    }
    this.ensureRunning();
    this.initialized = !!this.ctx;
  }

  ensureRunning() {
    if (!this.ctx) {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) {
          this.ctx = new AC();
          this.masterGain = this.ctx.createGain();
          this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 1, this.ctx.currentTime);
          this.masterGain.connect(this.ctx.destination);
        }
      } catch (e) {
        return;
      }
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
    if (this.ctx && !this.masterGain) {
      try {
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 1, this.ctx.currentTime);
        this.masterGain.connect(this.ctx.destination);
      } catch (e) {}
    }
    if (this.ctx) {
      this.initialized = true;
    }
  }

  synth(type, fStart, fEnd, gStart, dur, delay = 0, gCurve = "exp") {
    if (this.isMuted) return;
    this.ensureRunning();
    if (!this.ctx) return;
    const now = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(10, fStart), now);
    if (fEnd) {
      if (osc.frequency.exponentialRampToValueAtTime) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(10, fEnd), now + dur);
      } else if (osc.frequency.setValueAtTime) {
        osc.frequency.setValueAtTime(Math.max(10, fEnd), now + dur);
      }
    }

    gain.gain.setValueAtTime(gStart, now);
    if (gCurve === "exp" && gain.gain.exponentialRampToValueAtTime) {
      gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    } else if (gain.gain.linearRampToValueAtTime) {
      gain.gain.linearRampToValueAtTime(0, now + dur);
    }

    osc.connect(gain);
    gain.connect(this.masterGain || this.ctx.destination);
    osc.start(now);
    osc.stop(now + dur + 0.03);
  }

  // 1. Taktil Sapan Gerilme Sesi
  playSlingshotStretch(intensity) {
    if (this.isMuted) return;
    if (!this.initialized || !this.ctx) return;
    const now = this.ctx.currentTime;
    if (now - this.lastStretchTone < 0.08) return;
    this.lastStretchTone = now;
    const pitch = 140 + intensity * 340;
    this.synth("triangle", pitch, pitch + 30, 0.09, 0.06);
  }

  // 2. Fırlatma Sesi (Hafif Kauçuk Sapan Tınısı - Miyavlamayı Bastırmaz!)
  playLaunch() {
    this.synth("triangle", 220, 120, 0.16, 0.09);
  }

  // 3. Kat Atlama Zafer Arpeji (Her Katta Ton Yükselir! C -> D -> E -> G -> Mega C6)
  playFloorClear(floorIndex = 1) {
    // Kat numarasına göre temel frekans çarpanı (Adrenalin Tırmanışı!)
    const baseMult = Math.pow(1.122, floorIndex - 1);
    const notes = [
      523.25 * baseMult, // Root
      659.25 * baseMult, // 3rd
      783.99 * baseMult, // 5th
      1046.50 * baseMult // Octave
    ];

    // Şampanya Mantarı POP!
    this.synth("square", 980 + floorIndex * 80, 140, 0.42, 0.06);
    this.synth("sine", 220, 60, 0.35, 0.08, 0.01);

    // Yükselen Melodik Akor
    notes.forEach((freq, idx) => {
      this.synth("triangle", freq, freq, 0.25, 0.24, 0.05 + idx * 0.05);
    });

    if (floorIndex >= 5) {
      // 5. Kat (Kraliyet Çatısı) Büyük Şölen Zili
      setTimeout(() => {
        [1318.51, 1567.98, 2093.00].forEach((f, i) => {
          this.synth("sine", f, f, 0.30, 0.45, i * 0.08);
        });
      }, 250);
    }
  }

  // 4. Kule Düşüş Islığı (Cartoon Falling Whistle) — Yüksek Kattaki Hezimet!
  playFallWhistle(duration = 0.8) {
    if (this.isMuted) return;
    this.ensureRunning();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(2600, now);
      if (osc.frequency.exponentialRampToValueAtTime) {
        osc.frequency.exponentialRampToValueAtTime(160, now + duration);
      } else if (osc.frequency.setValueAtTime) {
        osc.frequency.setValueAtTime(160, now + duration);
      }

      gain.gain.setValueAtTime(0.28, now);
      if (gain.gain.exponentialRampToValueAtTime) {
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
      } else if (gain.gain.linearRampToValueAtTime) {
        gain.gain.linearRampToValueAtTime(0, now + duration);
      }

      osc.connect(gain);
      gain.connect(this.masterGain || this.ctx.destination);
      osc.start(now);
      osc.stop(now + duration + 0.02);
    } catch (e) {
      this.synth("sine", 2400, 200, 0.25, duration);
    }
  }

  // 5. Zemine Çakılma Tok Darbesi (KABOOM Splat!)
  playTowerSplat() {
    this.synth("square", 160, 30, 0.55, 0.28);
    this.synth("triangle", 420, 50, 0.45, 0.20, 0.02);
    // Komik ciyaklama (Squeak)
    this.synth("sawtooth", 900, 1400, 0.18, 0.08, 0.08);
  }

  // 6. Tava Bonk (DOINK!)
  playBonk() {
    this.synth("sine", 640, 520, 0.42, 0.22);
    this.synth("triangle", 480, 75, 0.45, 0.16, 0.01);
    this.synth("square", 190, 45, 0.35, 0.12, 0.02);
  }

  // 7. Mıknatıslı Kilit Sesi (CLACK-clack!)
  playMagnetSnap() {
    this.synth("triangle", 840, 60, 0.50, 0.09);
    this.synth("square", 280, 35, 0.40, 0.12, 0.01);
    this.synth("triangle", 420, 80, 0.18, 0.05, 0.07);
  }

  // 8. Near-Miss Yüksek Voltaj Şoku (⚡ 1 MILIMETRE! ⚡)
  playNearMiss() {
    this.synth("triangle", 1320, 1320, 0.35, 0.25);
    this.synth("sawtooth", 2400, 800, 0.25, 0.15, 0.02);
    this.synth("square", 3600, 1400, 0.28, 0.08, 0.04);
  }

  // 9. Anında Yeniden Başlat Tıklaması (Zero-Lag Hot Restart)
  playInstantRestart() {
    this.synth("sine", 880, 440, 0.12, 0.04);
  }

  // 10. Paskalya Yumurtası (Pofuduk Modu)
  playEasterEgg() {
    [440, 554.37, 659.25, 880, 1108.73].forEach((f, i) => {
      this.synth("sine", f, f + 20, 0.28, 0.35, i * 0.06);
    });
  }
  // 11. Duvardan Yaylı Sekme Sesi (Boing!)
  playBoing() {
    this.synth("sine", 240, 780, 0.40, 0.16);
    this.synth("triangle", 480, 920, 0.30, 0.12, 0.02);
  }

  // 12. Kat Mühürleme & Ağır Çelik Izgara Sesi (CLANG-LATCH!)
  playGrateSlam() {
    this.synth("square", 120, 30, 0.60, 0.22);
    this.synth("triangle", 360, 80, 0.45, 0.18, 0.02);
    this.synth("triangle", 780, 140, 0.25, 0.08, 0.06);
  }

  // 13. Kıl Payı Başarılı Geçiş Akoru (Close Call Joy!)
  playCloseCall() {
    this.synth("sine", 880, 1760, 0.35, 0.18);
    this.synth("triangle", 1174.66, 2349.32, 0.30, 0.22, 0.03);
    this.synth("sine", 1760, 3520, 0.25, 0.15, 0.06);
  }

  // 14. Meraklı Kedi Sesi (Curious "Mrrr-MEW?")
  playCatCuriousMew() {
    if (this.playDataAudio("cat_curious", 0.95)) return;
    this.synth("triangle", 480, 880, 0.35, 0.28);
  }

  // 15. Neşeli Fırlatma Miyavlaması ("MEOWWW!")
  playCatLaunchMeow() {
    if (this.playDataAudio("cat_meow", 1.0)) return;
    this.synth("sawtooth", 520, 920, 0.45, 0.38);
  }

  // 16. Slapstick Çarpışma Ciyaklaması ("YOOOWWWL!")
  playCatBonkYowl() {
    if (this.playDataAudio("cat_yowl", 1.0)) return;
    this.synth("sawtooth", 1100, 320, 0.50, 0.50);
  }

  // 17. Looney Tunes Metalik Tava Bonk Sesi (Tava Darbesi Chime)
  playMetallicBonk() {
    if (this.playDataAudio("metal_bonk", 0.95)) return;
    this.synth("square", 120, 40, 0.55, 0.16);
    this.synth("sine", 480, 460, 0.48, 0.35);
    this.synth("triangle", 920, 870, 0.40, 0.25);
  }

  // 18. Zafer Mırıltı Trilli (Happy Feline Purr)
  playCatHappyPurr() {
    if (this.playDataAudio("cat_purr", 0.95)) return;
    this.synth("sawtooth", 120, 130, 0.24, 0.35);
    [659.25, 783.99, 1046.50, 1318.51].forEach((f, i) => {
      this.synth("triangle", f, f + 50, 0.22, 0.20, 0.08 + i * 0.06);
    });
  }

  // 19. VİRAL: Near-Miss 0.1s Kalp Atışı (Sub-Bass Heartbeat Thump)
  playHeartThump() {
    this.synth("sine", 75, 38, 0.35, 0.45);
    this.synth("triangle", 120, 45, 0.25, 0.25, 0.04);
  }

  // 20. VİRAL: Kat 2 Cama Yüz Yapışma Gıcırtısı (Rubber Glass Smush)
  playGlassSmush() {
    this.synth("triangle", 920, 420, 0.32, 0.28);
    this.synth("sine", 1350, 720, 0.24, 0.20, 0.04);
  }

  // 21. VİRAL: Kat 5 Kraliyet Tacı Düşüş Çınlaması (Crown Clink Chime)
  playCrownClink() {
    [1318.51, 1567.98, 2093.00, 2637.02].forEach((f, i) => {
      this.synth("sine", f, f + 10, 0.55, 0.25, i * 0.07);
    });
  }

  // 22. VİRAL: Şampanya Mantarı Patlaması (Pop Cork)
  playPopCork() {
    this.synth("sine", 180, 880, 0.14, 0.35);
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = AudioManager;
}
