/**
 * TİLTOPİA — "KEDİ KAPI: KULE TIRMANIŞI" v8.0
 * src/config.js — 5 Benzersiz Kapı Mekanizması, Fizik Sabitleri & Minimalist Palet
 * Konsorsiyum: Baran, Defne, Mert, Selin, Burak, Kürşat, Ece, Emre, Kaan, Zeynep
 */

const CONFIG = {
  // Ekran & 9:16 Dikey Mobil Oranı
  CANVAS_WIDTH: 450,
  CANVAS_HEIGHT: 800,

  // Fizik & Dünya
  GRAVITY: 420,
  AIR_DRAG: 0.985,
  GROUND_Y: 710,

  // Sapan Mekaniği & Ergonomik Çekme Mesafesi
  MAX_DRAG_DIST: 90,
  MAX_LAUNCH_IMPULSE: 1140,
  // Kule Mimarisi
  FLOOR_HEIGHT: 480,
  TOTAL_STORY_FLOORS: 5,

  // 5 Distinct Stage Mechanisms & Strict Progressive Difficulty
  FLOORS: [
    {
      id: 1,
      name: "BASEMENT ENTRY",
      subtitle: "Classic Flap",
      mechanic: "STANDARD",
      themeColor: "#00ff88",
      wallColor: "#120a1f",
      platformColor: "#1a0e2d",
      doorWidth: 72, // 78px -> 72px (Orantılı %18 tolerans daralması: 27px tolerans)
      cycleLength: 2.50,
      openDuration: 1.12, // 1.30s -> 1.12s (Orantılı %14 zamanlama daralması)
      accessory: null,
      rewardName: "🥛 FRESH MILK & CRACKER (+100 XP)",
      percentile: ""
    },
    {
      id: 2,
      name: "PENTHOUSE REVOLVING DOOR",
      subtitle: "3-Wing Revolving Glass",
      mechanic: "ROTATING_FAN",
      fanSpeed: 1.25, // 0.86 -> 1.25 rad/s (Baran & Ekip Ayarı: Canlı, dinamik ve dikkat isteyen döner kapı ritmi)
      fanRadius: 64,  // 64px açıklık yarıçapı; kedi kütlesinin geçişine olanak tanır
      bladeAngle: 0.28, // 0.26 -> 0.28 rad (Kanat profili güçlendirildi)
      bladeThickness: 10, // 10px sağlam kanat profili
      themeColor: "#ff0055", // Net ve parlak tema rengi
      wallColor: "#170f24",
      platformColor: "#221535",
      doorWidth: 92,
      cycleLength: 1.68, // Bir kanat periyodu ~1.68s
      openDuration: 0.95, // 1.25s -> 0.95s (Açık pencere daraltıldı, kırmızı kapalı kalma oranı %44'e yükseltildi)
      accessory: null,
      rewardName: "🍗 CRISPY CHICKEN (+250 XP)",
      percentile: ""
    },
    {
      id: 3,
      name: "GUILLOTINE HALL",
      subtitle: "Laser Sliding Guillotine",
      mechanic: "SLIDING_GUILLOTINE",
      slideAmp: 62,    // 58 -> 62px (Daha geniş salınım genliği)
      slideSpeed: 2.20, // 1.95 -> 2.20 rad/s (Orantılı %12.8 daha hızlı lazer salınımı)
      themeColor: "#ff0055",
      wallColor: "#1a0818",
      platformColor: "#270d24",
      doorWidth: 70,   // 76px -> 70px (Orantılı daralma: 25px tolerans)
      cycleLength: 2.10,
      openDuration: 0.78, // 0.90s -> 0.78s (Orantılı %13.3 zamanlama daralması)
      accessory: null,
      rewardName: "🍣 SALMON NIGIRI (+500 XP)",
      percentile: ""
    },
    {
      id: 4,
      name: "WINDY BALCONY",
      subtitle: "Gale Wind & Bounce Pad",
      mechanic: "WIND_BOUNCE",
      windForce: -585, // -520G -> -585G (Orantılı %12.5 daha kuvvetli fırtına)
      bouncerX: 416,
      bouncerYOffset: 95, // Kapı ile zemin arasındaki doğal uçuş koridoru orta noktası
      bouncerH: 160, // 180px -> 160px (Daha odaklanmış trambolin temas alanı)
      canopyW: 295, // Doğrudan dikey geçişi engelleyen fırtına sundurması (X: 0-295 kapalı)
      canopyH: 22,
      canopyYOffset: 190, // y = -970 (Platform ve kapı arası orta bariyer)
      themeColor: "#00e5ff",
      wallColor: "#091526",
      platformColor: "#10213b",
      doorWidth: 90, // 96px -> 90px (Orantılı daralma: 45px tolerans)
      cycleLength: 2.10,
      openDuration: 1.18, // 1.35s -> 1.18s (Orantılı %12.6 açık süre)
      accessory: "CAPE",
      rewardName: "🦞 MAINE LOBSTER & CAPE (+1000 XP)",
      percentile: ""
    },
    {
      id: 5,
      name: "ROYAL ROOF",
      subtitle: "Steampunk Iris Vault",
      mechanic: "IRIS_APERTURE",
      irisMaxR: 42, // 46px -> 42px (Orantılı %8.7 diyafram daralması)
      themeColor: "#ffd700",
      wallColor: "#211604",
      platformColor: "#302008",
      doorWidth: 64, // 70px -> 64px (Orantılı daralma: 19px tolerans)
      cycleLength: 2.10,
      openDuration: 0.56, // 0.65s -> 0.56s (Orantılı %13.8 zamanlama daralması; 0.42s uçuşa göre ~0.14s insan refleksi)
      accessory: "CROWN",
      rewardName: "👑 ROYAL SALMON & CROWN (+2500 XP)",
      percentile: ""
    }
  ],

  // Soft-Body Yay Sabitleri
  SPRING_STIFFNESS: 175,
  SPRING_DAMPING: 9.0,

  // Minimalist Cyber-Arcade Renk Paleti
  COLORS: {
    BG_DARK: "#090611",
    BG_MID: "#100a1d",
    BG_LIGHT: "#150d24",
    CAT_BODY: "#00ff88",
    CAT_INNER_EAR: "#6b21a8",
    CAT_NOSE: "#ff007f",
    DOOR_LOCKED: "#ff0055",
    DOOR_OPEN: "#00ff88",
    GOLD: "#ffd700",
    NEAR_MISS_YELLOW: "#ffff00"
  },

  // Kapı Konumu Sabitleri
  DOOR_Y: 280,
  DOOR_HEIGHT: 44
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONFIG;
}
