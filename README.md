# 🎮 CODE SABOTAGE

> **Real-time multiplayer retro coding party game** where Crewmates race against the clock to repair HTML/CSS/JS missions while hidden Imposters stealthily sabotage syntax and corrupt code!

---

## 🕹️ Game Overview

- **Crewmates (Civilians):** Work together to write correct HTML/CSS code that solves each mission task. Click **RUN CODE** (or press `Ctrl+Enter`) to verify. Repair all tasks before time runs out to win!
- **Imposter:** Blend in with the crew! Secretly edit code or trigger quick sabotage abilities (Glitch Injection, Character Scramble, Line Wipe) to stall progress and let the timer hit zero.

---

## ✨ Features

- ⚡ **Real-time Multiplayer:** Instant synchronization powered by Socket.io and Node.js.
- 🎨 **Retro Pixel Aesthetics:** Authentic 8-bit visual themes, retro palettes, and responsive layout.
- 🔊 **Zero-Dependency 8-bit Audio:** Built-in retro sound effects synthesizer using the Web Audio API with volume toggle.
- 👁️ **Live Code Preview & Split Screen:** Seamlessly toggle between Code Editor, Split Screen, and Live Browser Preview.
- 💬 **Integrated Comms & Activity Log:** Real-time team chat and automated mission alert logs.
- 💥 **Interactive Sabotage Deck:** Imposters have specialized tools to glitch, scramble, and erase code.
- 🛠️ **Solo Practice & Multiplayer Support:** Play solo to practice HTML missions or play with up to 10 players in a party.
- 🔄 **One-Click Rematch:** Reset room for another round without rejoining or re-typing player names.

---

## 🚀 Quick Start (Running Locally)

### Prerequisites
- [Node.js](https://nodejs.org/) (version 18 or newer)
- npm

### 1. Install Dependencies
```bash
npm install
```

### 2. Run the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

> **Tip for local testing:** Open two different browser tabs (or an incognito window) with the same Room Code to test multiplayer mechanics locally!

---

## 📦 Building & Publishing for Production

### 1. Build the Application
```bash
npm run build
```
This compiles the React frontend with Vite into `dist/` and bundles the Node.js server with esbuild into `dist/server.cjs`.

### 2. Start Production Server
```bash
npm start
```
The server will run on port `3000` (or the port defined in `process.env.PORT`).

---

## 🚢 Deployment Guides

### Deploying to Render
1. Push your repository to GitHub / GitLab.
2. Create a new **Web Service** on [Render](https://render.com).
3. Set the following settings:
   - **Environment:** Node
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
4. Deploy!

### Deploying to Railway
1. Link your GitHub repository in [Railway](https://railway.app).
2. Railway will automatically detect the Node project.
3. In service settings, verify:
   - **Build Command:** `npm run build`
   - **Start Command:** `npm start`
4. Set environment variable `PORT` (Railway provides this automatically).

### Deploying with Docker
A standard `Dockerfile` can be used:
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
EXPOSE 3000
CMD ["npm", "start"]
```

---

## ⌨️ Controls & Keyboard Shortcuts

| Key Combination | Action |
|-----------------|--------|
| `Ctrl + Enter` (or `Cmd + Enter`) | Run Code / Verify Active Task |
| `Tab` | Indent code (2 spaces) |

---

## 📄 License
MIT License. Free to use, modify, and distribute.
