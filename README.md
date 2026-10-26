# Cat Door: Tower Climb (Kedi Kapı) — Tiltopia v1.0

> **A Minimalist Physics-Based Vertical Mobile Web Arcade Game by Tiltopia Media & Game Studio**

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Platform: Web / Mobile](https://img.shields.io/badge/Platform-Web%20%2F%20Mobile-blue.svg)](index.html)
[![Zero Dependency](https://img.shields.io/badge/Dependencies-0%20(Pure%20Vanilla%20JS)-orange.svg)](index.html)

**Cat Door: Tower Climb** is an addictive, rage-inducing, 5-stage physics arcade game built for high-retention mobile and desktop web gameplay. Pull, aim, and slingshot a squishy soft-body ragdoll cat through dangerous security mechanisms to reach the Penthouse milk feast!

---

## 🎮 How to Play

### Zero-Install Instant Play:
Simply clone or download this repository and open `index.html` in any web browser (Chrome, Safari, Edge, Firefox). **No build steps or npm install required!**

```bash
# Clone the repository
git clone https://github.com/your-username/cat-door-tower-climb.git

# Open directly in browser
open index.html   # On macOS
start index.html  # On Windows
```

Or run with any local static server:
```bash
npx serve .
```

---

## 🕹️ Controls

- **Touch / Mouse Drag:** Pull backward from the cat to aim the slingshot. Release to launch!
- **Trajectory Beam:** Dotted guide line shows real-time launch trajectory.
- **`Space` or `R` Key:** Instant Hot-Retry without delay.
- **Top Bar Controls:**
  - `🔊 Audio Toggle:` Instant Mute/Unmute.
  - `⚔️ Challenge Button:` Generate an instant URL challenge link to challenge your friends!
  - `🎬 Devlog Button:` Link to the official development video.

---

## ⚙️ 5 Distinct Physics Mechanisms & Progressive Difficulty

Strict progressive difficulty hierarchy ($K_1 < K_2 < K_3 < K_4 < K_5$):

| Stage | Name | Mechanism & Hazard | Passing Window | Reward |
| :---: | :--- | :--- | :---: | :--- |
| **1** | **BASEMENT ENTRY** | **Classic Pendulum Flap:** Rhythmic swinging door teaching launch timing. | 1.12s Open | 🥛 Fresh Milk & Cracker |
| **2** | **REVOLVING HAZARD DOOR** | **3-Wing Revolving Glass Fan:** Time your jump through the rotating blades. | 0.95s Open | 🍗 Crispy Chicken & Shades |
| **3** | **GUILLOTINE HALL** | **Laser Sliding Gate:** Gate glides horizontally on hydraulic rails ($\pm 62\text{px}$). | 0.78s Open | 🍣 Salmon Nigiri & Headband |
| **4** | **WINDY BALCONY** | **Gale Wind & Bounce Pad:** Strong crosswind ($-585G$); bounce off the wall trampoline! | 1.18s Window | 🦞 Maine Lobster & Cape |
| **5** | **ROYAL PENTHOUSE** | **Steampunk Iris Aperture:** Snapping metal iris with a razor-thin passing window. | 0.56s Open | 👑 Royal Crown & Feast |

---

## 💎 Features & Engineering

- **Pure Vanilla Web Architecture:** Zero external framework dependencies. 60 FPS Canvas rendering.
- **Soft-Body Ragdoll Physics:** Custom point-mass spring-damper mesh for natural cat squash, stretch, and slapstick splat reactions.
- **Near-Miss Excitement:** 0.22s dynamic slow-motion zoom when grazing door edges, triggering adrenaline-pumping near-miss feedback.
- **Synthesized Zero-Latency Audio:** 100% offline-ready embedded Web Audio synthesis and base64 audio data. Never fails due to network or CORS.
- **Viral URL Challenge Engine:** Dynamic URL parameters (`?challenger=Player&floor=4&tries=12`) to send score challenges to friends.
- **Mobile Native Share Sheet:** Integrates Web Share API (`navigator.share`) on mobile devices with automatic clipboard fallback on desktop.
- **Frosted Obsidian Glass UI:** Minimalist luxury HUD design with responsive `100dvh` mobile layout.

---

## 📂 Repository Structure

```
kedi-kapi/
├── index.html          # Game entry point with Open Graph cards & SVG favicon
├── css/
│   └── style.css       # Obsidian Frosted Glass UI & responsive 9:16 layout
├── src/
│   ├── config.js       # 5 Stage specs, color tokens, physics parameters
│   ├── audio.js        # Web Audio manager with synthesizer & mute control
│   ├── audio_data.js   # Embedded zero-latency base64 audio assets
│   ├── haptics.js      # Mobile tactile vibration engine
│   ├── particles.js    # Sparkles, confetti, and victory ambient dust
│   ├── physics.js      # Spring-damper point-mass physics engine
│   ├── cat.js          # Soft-body jelly cat mesh, tail, and facial animations
│   ├── door.js         # 5 Stage door mechanisms (swing, fan, slide, wind, iris)
│   ├── input.js        # Ergonomic slingshot touch & mouse drag controller
│   └── game.js         # Game loop, camera tracking, and challenge manager
├── audio/              # Master WAV audio source assets
├── game.js             # Pre-built standalone single-file bundle
├── build.js            # Standalone bundler script (node build.js)
├── package.json        # Project metadata
├── LICENSE             # MIT License
└── README.md           # Documentation
```

---

## 🛠️ Building the Standalone Bundle

The game runs directly from `src/` modular files in `index.html`. If you want to regenerate the single-file distribution bundle (`game.js`):

```bash
# Run build script
node build.js
```

---

## 📄 License

This project is open-source and available under the [MIT License](LICENSE).

Developed with ❤️ by the **Tiltopia Media & Game Studio** team.
