# 🎵 RhyMic – Enterprise AI Music Streaming

![RhyMic](https://img.shields.io/badge/RhyMic-v4.0-gold) ![React](https://img.shields.io/badge/React-19-blue) ![Python](https://img.shields.io/badge/Backend-Flask-green) ![AI](https://img.shields.io/badge/AI-Groq%20GPT--OSS-orange) ![DB](https://img.shields.io/badge/DB-Neon%20PostgreSQL-cyan)

RhyMic is a premium, full-stack music streaming platform designed with a high-fidelity glassmorphism aesthetic. It features a robust Web Audio engine, AI-driven song categorization, and a suite of enterprise-grade security features.

> [!IMPORTANT]
Online tracks play in YouTube’s embedded player on Render. Some tracks require opening YouTube when the publisher restricts embedding. Bundled songs and uploaded audio use RhyMic’s native player and Audio Lab.

---

## ✨ Key Features

- **💎 Premium Aesthetics**: Mobile-first glassmorphism UI with intensive backdrop filters and dynamic animations powered by `framer-motion`.
- **🎧 Advanced Audio Lab**: 10-band Equalizer, Bass Boost, and seamless crossfading between tracks using the native Web Audio API.
- **🪄 Smart DJ (AI)**: Contextual playlist generation using Groq GPT-OSS models (`openai/gpt-oss-120b` primary, `openai/gpt-oss-20b` fallback), capable of understanding mood, era, and language.
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
- **Database**: PostgreSQL (Neon) with SQLAlchemy.
- **AI**: Groq Cloud — GPT-OSS 120B + 20B (single provider, OpenAI-compatible API).
- **Storage**: Files stored as `bytea` in Neon and served via `/api/files/<hash>` (profile pictures, persistent cover-thumbnail cache).

---

## 🛠️ Installation & Setup

### 1. Prerequisites
- Node.js (v18+)
- Python (v3.10+)
- A free [Neon](https://neon.tech) project
- A free [Groq](https://console.groq.com/keys) API key

### 2. Clone & Setup
```sh
git clone https://github.com/BaariAbdul03/Rhymic.git
cd Rhymic
```

### 3. Backend Setup
```sh
# Create virtual environment
python -m venv .venv
source .venv/bin/activate  # Or .venv\Scripts\activate on Windows

# Install dependencies
pip install -r requirements.txt

# Run migrations before starting the app against a fresh Neon database
python scripts/run_migrations.py

# Start server
flask run -p 5000
```

> **Neon tip:** The app connects with `pool_pre_ping` and recycles connections every 300s, so it survives Neon's auto-suspend (compute sleeps after inactivity and wakes automatically on the next request — the first request after a nap may take a moment). No keep-alive pinging required.

### 4. Frontend Setup
```sh
cd rhymic-react
npm install
npm run dev
```

---

## 🔧 Environment Variables
Create a `.env` file in the root directory (see `.env.example` for the full list):
```env
SECRET_KEY=your_secret
JWT_SECRET_KEY=your_jwt_secret
GROQ_API_KEY=your_groq_key
DATABASE_URL=postgresql://user:pass@ep-xxx-pooler.region.aws.neon.tech/neondb?sslmode=require
```

In Render, set `ONLINE_STREAM_PROVIDER=embed`. Set `DATABASE_URL` to the pooled Neon connection and `DATABASE_URL_UNPOOLED` to the direct connection for build migrations. Keep `JWT_SECRET_KEY` stable across deploys. For legacy accounts, see the [Neon data migration guide](docs/DATA_MIGRATION_SUPABASE_TO_NEON.md).

---

## 📜 License
Licensed under the **MIT License**. Built for the next generation of music lovers.

⭐ If you find RhyMic impressive, give it a star on **GitHub**! ⭐
