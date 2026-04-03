# VisionTalk 🤟

A real-time ASL (American Sign Language) video communication platform for deaf and hard of hearing people. Features AI-powered sign language detection, peer-to-peer video calls, and an interactive learning system.

## Features

- **🎓 Learn ASL** — Interactive reference grid of all 36 supported signs (A-Z, 0-9)
- **🎮 Practice Mode** — Real-time camera feedback with AI recognition and challenge mode
- **📹 Video Call** — WebRTC peer-to-peer calls with live ASL-to-text translation
- **🔊 Text-to-Speech** — Hear what the other person is signing
- **💬 In-Call Chat** — Text messaging during video calls
- **🖥️ Screen Sharing** — Share your screen during calls

## Architecture

```
┌─────────────┐     ┌──────────────────┐     ┌───────────────┐
│  React/Vite │────▶│  Node.js Signal  │────▶│  Flask ML API │
│  Client     │     │  Server (:3001)  │     │  Server(:5000)│
│  (:5173)    │     │  Socket.IO       │     │  model1.p     │
└─────────────┘     └──────────────────┘     └───────────────┘
```

## Quick Start

### 1. Flask Backend (ASL Inference)
```bash
cd server
pip install -r requirements.txt
python app.py
```

### 2. Signaling Server (WebRTC)
```bash
cd signaling
npm install
node index.js
```

### 3. React Frontend
```bash
cd client
npm install
npm run dev
```

Open **http://localhost:5173** in your browser.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, React Router |
| ML Inference | MediaPipe Hands (browser), scikit-learn Random Forest (server) |
| Video Calls | WebRTC, Socket.IO |
| Backend | Flask, Node.js/Express |
| UI | Glassmorphism dark theme, CSS animations, Canvas particles |

## Model

`model1.p` is a pre-trained **Random Forest classifier** on mediapipe hand landmark coordinates (42 features: 21 landmarks × x,y) supporting 36 ASL signs (A-Z, 0-9).
