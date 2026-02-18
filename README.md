# 🕺 Wobble Dance

A humorous, physics-reactive dancing game playable entirely in a mobile web browser.

**Live demo:** `https://andrewkillinger.github.io/Dancing-game/`

[![Build & Deploy](https://github.com/andrewkillinger/Dancing-game/actions/workflows/deploy.yml/badge.svg)](https://github.com/andrewkillinger/Dancing-game/actions/workflows/deploy.yml)

---

## 🎮 Game Overview

Drop objects on your dancer, trigger wild dance moves, and rack up crowd hype! Your character wobbles, stumbles, and reacts with hilarious emoji bubbles while you stack combos and complete daily challenges.

**Key Features:**
- 5 unique dance moves (Wiggle, Robot, Worm, Flail, Spin)
- 8 physics-based droppable objects (Beach Ball, Anvil, Rubber Duck, Giant Taco, and more)
- Fully customizable character (skin tone, hair, outfit, accessories)
- Daily challenges with rotating objectives
- Leaderboard backed by Supabase
- My Locker – save and reuse outfit presets
- 60fps target with adaptive quality for older devices
- Web Audio API synthesized sounds – no external audio files
- Works on iPhone Safari and Android Chrome

---

## 📋 Prerequisites

- Node.js 18+ and npm 9+
- A [Supabase](https://supabase.com) project (free tier works)
- A GitHub account with Pages enabled (for deployment)

---

## 🗄️ Supabase Setup

### 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) → New project
2. Note your **Project URL** and **anon/public key** from Settings → API

### 2. Run migrations

In your Supabase dashboard → **SQL Editor**, run both migration files in order:

```sql
-- File 1: supabase/migrations/001_initial_schema.sql
-- File 2: supabase/migrations/002_rls_policies.sql
```

Or paste their contents directly.

### 3. Enable Anonymous Auth

In Supabase → **Authentication** → **Providers** → enable **Anonymous sign-ins**.

This lets guests play without creating an account. They can upgrade to email magic link later.

### 4. (Optional) Enable Email Magic Link

In Supabase → Authentication → Providers → Email → ensure it's enabled.
Add your GitHub Pages URL to **Site URL** and **Redirect URLs** under Authentication → URL Configuration.

### RLS Policy Summary

| Table | Who Can Read | Who Can Write |
|-------|-------------|---------------|
| `profiles` | Owner only | Owner only |
| `scores` | All authenticated (incl. anon) | Owner only |
| `outfits` | Owner only | Owner only |
| `challenge_completions` | Owner only | Owner only |

---

## 💻 Local Development

### 1. Clone and install

```bash
git clone https://github.com/andrewkillinger/Dancing-game.git
cd Dancing-game
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:
```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

> **Note:** Without Supabase credentials, the game runs in guest mode with localStorage fallback. All game features except leaderboard sync work offline.

### 3. Start dev server

```bash
npm run dev
```

Open `http://localhost:5173` in your browser (or on mobile via your local IP).

---

## 🔨 Build

```bash
npm run build
```

Output is in `dist/`. Preview locally:

```bash
npm run preview
```

---

## 🧪 Testing & Linting

```bash
# Run unit tests
npm test

# Run tests in watch mode
npm run test:watch

# Type check
npm run typecheck

# Lint
npm run lint

# Format
npm run format
```

---

## 🚀 Deployment to GitHub Pages

### Step 1: Set GitHub Secrets

In your GitHub repo → **Settings** → **Secrets and variables** → **Actions** → add:

| Secret | Value |
|--------|-------|
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anon key |

### Step 2: Enable GitHub Pages

1. Go to repo **Settings** → **Pages**
2. Under **Source**, select **GitHub Actions**
3. Save

### Step 3: Push to main

```bash
git push origin main
```

The CI pipeline will:
1. Type-check + lint + test
2. Build with Vite (sets `base: '/Dancing-game/'`)
3. Deploy to GitHub Pages

Your game will be live at:
```
https://andrewkillinger.github.io/Dancing-game/
```

---

## 📁 Project Structure

```
wobble-dance/
├── src/
│   ├── game/
│   │   ├── engine.ts          # Game loop, PixiJS + Matter.js, event bus, object pool
│   │   ├── character.ts       # Layered character rendering + spring-joint wobble physics
│   │   ├── objects.ts         # Droppable physics objects (factory + manager)
│   │   ├── scoring.ts         # Score system, combo, daily challenge generator
│   │   └── sounds.ts          # Web Audio API synthesized sound effects
│   ├── ui/
│   │   ├── components/
│   │   │   └── button.ts      # Shared UI helpers (btn, colorPalette, haptic, etc.)
│   │   └── screens/
│   │       ├── home.ts        # Home screen
│   │       ├── customize.ts   # Character customization screen
│   │       ├── dance.ts       # Main dance gameplay screen
│   │       ├── leaderboard.ts # Leaderboard screen
│   │       └── locker.ts      # My Locker (saved outfits)
│   ├── services/
│   │   └── supabase/
│   │       ├── client.ts      # Supabase client factory
│   │       ├── auth.ts        # Auth service (anon + email magic link)
│   │       └── data.ts        # CRUD: scores, outfits, challenges
│   ├── styles/
│   │   └── global.css
│   ├── types/
│   │   └── index.ts           # All TypeScript types + constants
│   └── main.ts                # App entry point + router
├── public/
│   └── assets/                # Static assets (none required – all procedural)
├── supabase/
│   └── migrations/
│       ├── 001_initial_schema.sql
│       └── 002_rls_policies.sql
├── tests/
│   ├── scoring.test.ts
│   └── challenge.test.ts
├── .github/
│   └── workflows/
│       └── deploy.yml         # CI/CD: test → build → deploy to Pages
├── index.html
├── vite.config.ts
├── tsconfig.json
├── vitest.config.ts
├── .eslintrc.json
├── .prettierrc
└── README.md
```

---

## 🎨 Tech Stack

| Layer | Tech |
|-------|------|
| Rendering | [PixiJS v7](https://pixijs.com) – WebGL-accelerated canvas |
| Physics | [Matter.js v0.19](https://brm.io/matter-js/) – rigid body simulation |
| Build | [Vite 5](https://vitejs.dev) + TypeScript 5 |
| Backend | [Supabase](https://supabase.com) – auth, postgres, RLS |
| Testing | [Vitest](https://vitest.dev) |
| Linting | ESLint + Prettier |
| Hosting | GitHub Pages (static) |

---

## ⚡ Performance Features

- **Object pooling** – physics bodies and sprites are reused
- **Adaptive quality** – reduces particles and screen shake below 30 FPS
- **Max 12 objects** on screen at once; auto-despawn after 8s or off-screen
- **Fixed-timestep physics** accumulator (capped at 100ms) prevents spiral of death
- **Code splitting** – PixiJS, Matter.js, and Supabase bundle separately
- **resolution: min(devicePixelRatio, 2)** – avoids 3x rendering on high-DPI phones
- **Synthesized audio** – zero audio file downloads

---

## 🐛 Troubleshooting

| Problem | Solution |
|---------|----------|
| Blank screen on iOS Safari | Enable JavaScript in Safari settings |
| Supabase errors in console | Check that your `.env` has correct URL and key |
| Scores not syncing | Ensure anonymous auth is enabled in Supabase |
| 403 on GitHub Pages | Check that the repo name matches `base` in `vite.config.ts` |
| No sound | Tap anywhere first – browsers require user interaction for audio |
| Laggy on old devices | The game auto-reduces effects when FPS drops below 30 |
| Build fails with TypeScript errors | Run `npm run typecheck` locally and fix errors before pushing |

---

## 📜 Asset Licenses

All character art, backgrounds, and object visuals are **procedurally generated** using PixiJS Graphics API – no external image assets. All sound effects are synthesized via the **Web Audio API**. No third-party assets are included.

---

## 🤝 Contributing

PRs welcome! Please:
1. Fork the repo
2. Create a feature branch
3. Ensure `npm run lint && npm test` pass
4. Open a PR against `main`

---

## 📝 License

MIT – see [LICENSE](LICENSE) for details.
