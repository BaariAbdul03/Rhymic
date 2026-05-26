# 🎵 RhyMic – Enterprise AI Music Streaming

![RhyMic](https://img.shields.io/badge/RhyMic-v3.1-gold) ![React](https://img.shields.io/badge/React-19-blue) ![Python](https://img.shields.io/badge/Backend-Flask-green) ![AI](https://img.shields.io/badge/AI-Gemini-purple)

RhyMic is a premium, full-stack music streaming platform designed with a high-fidelity glassmorphism aesthetic. It features a robust Web Audio engine, AI-driven song categorization, and a suite of enterprise-grade security features.

> [!IMPORTANT]
> **DEPLOYMENT NOTICE:** The "Online Songs" and "Smart DJ" streaming features are optimized for local development. Due to YouTube's rate limiting and IP blocking on cloud platforms like Render, these features may not function as expected on live deployments.

---

## ✨ Key Features

- **💎 Premium Aesthetics**: Mobile-first glassmorphism UI with intensive backdrop filters and dynamic animations powered by `framer-motion`.
- **🎧 Advanced Audio Lab**: 10-band Equalizer, Bass Boost, and seamless crossfading between tracks using the native Web Audio API.
- **🪄 Smart DJ (AI)**: Contextual playlist generation using Gemini 2.5 Flash and Groq (Llama 3), capable of understanding mood, era, and language.
- **📁 Local Files Support**: Bulk upload your personal MP3 collection with "Play All" and session-based queue management.
- **🔐 Enterprise Security**: Multi-step authentication with TOTP-based Two-Factor Authentication (2FA) and secure recovery.
- **🌓 Dynamic Mood Engine**: Visualizers and UI accents that shift colors based on the current song's vibe (Chill, Energetic, Romantic, etc.).

---

## 🚀 Tech Stack

### Frontend
- **Framework**: React 19 + Vite
- **State**: Zustand (Atomic stores for Music, UI, and Auth)
- **Visuals**: Canvas 2D render loops for high-performance audio visualizers.
- **Styling**: Vanilla CSS Modules (Strict pixel control, no Tailwind).

### Backend
- **Framework**: Python Flask (Blueprints architecture)
- **Database**: PostgreSQL (Supabase) with SQLAlchemy.
- **AI**: Google Gemini Pro & Groq Cloud SDKs.
- **Storage**: Supabase Cloud Storage for persistent thumbnail caching.

---

## 🛠️ Installation & Setup

### 1. Prerequisites
- Node.js (v18+)
- Python (v3.10+)
- Google Gemini API Key

### 2. Clone & Setup
```sh
git clone https://github.com/BaariAbdul03/RhyMic-3.1.git
cd RhyMic-3.1
```

### 3. Backend Setup
```sh
# Create virtual environment
python -m venv .venv
source .venv/bin/activate  # Or .venv\Scripts\activate on Windows

# Install dependencies
pip install -r requirements.txt

# Run migrations
flask db upgrade

# Start server
flask run -p 5000
```

### 4. Frontend Setup
```sh
cd rhymic-react
npm install
npm run dev
```

---

## 🔧 Environment Variables
Create a `.env` file in the root directory:
```env
SECRET_KEY=your_secret
JWT_SECRET_KEY=your_jwt_secret
GOOGLE_API_KEY=your_gemini_key
DATABASE_URL=sqlite:///site.db
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_key
```

---

## 📜 License
Licensed under the **MIT License**. Built for the next generation of music lovers.

⭐ If you find RhyMic impressive, give it a star on **GitHub**! ⭐
