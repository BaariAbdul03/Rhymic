# Rhymic Enterprise – AI Context & Project Documentation 

> **NOTICE FOR AI WORKERS:** This document (`GEMINI.md`) contains the architectural blueprint, state management logic, design principles, and historical bug fixes for the **Rhymic** music streaming application. Please read this file to gain immediate context on the codebase before offering solutions or modifying structural logic.

---

## 🚀 1. Project Overview & Tech Stack
Rhymic is a full-stack, enterprise-grade music streaming platform designed to mimic the premium aesthetics and dynamic functionality of applications like Spotify. It emphasizes a mobile-first, glassmorphism-heavy UI, powered by a robust state engine and intelligent backend integrations (including Google's Gemini Neural Networks).

### **Frontend**
- **Framework:** React 19 + Vite
- **State Management:** Zustand (`musicStore`, `uiStore`, `authStore`)
- **Audio Engine:** Native Web Audio API (`AudioContext`, `AnalyserNode`, `BiquadFilterNodes`) orchestrating global FX and feeding Canvas 2D render loops.
- **Styling:** Vanilla CSS Modules (`.module.css`) extensively utilizing CSS variables (`var(--accent-primary)`, etc.). *Note: We intentionally avoid Tailwind for complex UI overlays to maintain absolute pixel control.*
- **Animations:** `framer-motion` (used heavily in page transitions and Mobile Player overlays).
- **Icons:** `lucide-react`
- **Drag & Drop:** `@hello-pangea/dnd` (used in the Queue menu).

### **Backend**
- **Framework:** Python Flask (structured using Blueprints for `routes/`)
- **Database:** SQLite (managed via SQLAlchemy and Flask-Migrate `alembic`)
- **Authentication:** JWT (JSON Web Tokens), TOTP-based Two-Factor Authentication (2FA), and secure code-based password recovery.
- **AI Integrations:** Gemini 2.5 Flash API directly interfacing with Python via `google.generativeai`.

---

## 🧠 2. Global State Management (Zustand)
The core of the React application's logic is cleanly separated from the DOM and securely housed inside the `src/store/` directory. If you are modifying logic, do it here, not inside React components.

1. **`musicStore.js`**: The beating heart of the application. 
   - Manages the `queue` array, `currentSong` object, `isPlaying` boolean, and the global audio lifecycle hooks (`duration`, `currentTime`, `volume`).
   - Houses the Web Audio tracking state including the `analyserNode`, 10-band `eqBands`, and FX variables.
   - Handles the absolute logic for fetching from the backend API (`fetchSongs`, `fetchPlaylists`).
   - Caches backend AI generations (e.g., `aiCategories`) to prevent infinite UI re-rendering.
2. **`uiStore.js`**: Strictly manages UI boolean toggles for absolute/fixed layers (e.g., `isSidebarOpen`, `isRightPanelOpen` (Queue drawer), `isPlayerOpen` (Mobile Player)).
3. **`authStore.js`**: Pure authentication logic, local-storage token persistence, and login/logout REST calls.

---

## 🏗️ 3. Core Architecture & Render Flow
If you are modifying components, please respect the established `z-index` and Layout rules. The application uses a complex, layered DOM tree to achieve responsive overlays.

### CSS Z-Index Hierarchy:
- `10`: Sidebar / Topbar
- `50`: Desktop ProgressBar 
- `1000`: Modals
- `9999`: `<MobilePlayer />` (The immersive, fullscreen player overlay triggered on mobile *and* desktop).
- `15000`: `<RightPanel className={styles.desktopOverlay} />` (The queue drawer which must slide securely over *everything*, including the Mobile Player).

### Key Component Relationships:
- **`useAudioEngine.js` & `useVisualizer.js`**: The central audio processing nervous system. `useAudioEngine` intercepts the raw HTML `<audio>` elements, feeding it through an array of filter nodes (EQ, Bass) before broadcasting an `AnalyserNode` to the store. `useVisualizer` then consumes that analyzer blindly and paints its data to a Canvas element.
- **`App.jsx`**: The root layout container mapping structural boundaries. Uses React Router `AnimatePresence` for smooth `<PageWrapper>` transitions.
- **`ProgressBar.jsx`**: The persistent bottom player. Houses the global `<Audio>` HTML5 hook execution logic.
- **`RightPanel.jsx`**: A complex contextual drawer handling the Queue. On desktop, it's a native grid column, but dynamically transforms into a `.desktopOverlay` (z-index 15000) when overlapping the fullscreen player.
- **`Discover.jsx` & `CategoryRow.jsx`**: Intersects with the Python `/api/ai/categorize-genres` route to autonomously cluster thousands of application tracks into intelligent, Gemini-driven contextual playlists rather than iterating blind string matches.

---

## 🎨 4. Aesthetic & Design Philosophy
- **Glassmorphism:** The overarching UI design relies on intense backdrop-filters (`backdrop-filter: blur(40px)`) over deeply translucent dark elements (`rgba(18, 18, 18, 0.7)`).
- **Golden Identity:** The primary accent across play buttons, active icons, and progress sliders is mapped explicitly to `var(--accent-primary)` (a golden/amber hue). *Do not inject Spotify-green `#1db954` hardcodes.*
- **Responsive Physics:** Desktop uses complex flex grids. Viewports `< 1200px` morph modules into fixed position fullscreen arrays (e.g., the Queue and the Mobile Player).

---

## 🔧 5. Historical Bug Resolutions (Do Not Revert)
When working on the application, please be aware of these foundational structural fixes that have already been resolved:
1. **Desktop Queue Layer Overlap:** Do not strip `isOverlay` props from `RightPanel`. The `<MobilePlayer>` renders unconditionally as an overlay on Desktop via `isPlayerOpen`; the `RightPanel` requires `isOverlay` to manually jack its `z-index` so it successfully covers the player.
2. **CSS `url()` Background Crashing:** When dynamically interpolating album covers into CSS (e.g., in `MobilePlayer.jsx`), always wrap the interpolation in double quotes `url("{var}")`. Local file structures contain blank spaces (e.g., `Alan Walker - Faded.mp3`) which natively crashes CSS string parsing if left unquoted.
3. **Category Deduplication Errors:** The `musicStore` logic has explicit duplicate-verification mechanisms when triggering `playNext()` or "Add to Queue". Do not mutate the queue array blindly without `findIndex()` safety nets.
4. **AI Blocking State:** The frontend `Discover.jsx` fetches the `aiCategories` purely in the background via Zustand, immediately reverting to visual fallback arrays. Do not attach `isAiLoading` blocking spinners to the main DOM thread.
5. **Web Audio Graph Disconnects (Phase 4):** Never recreate the `AudioContext` or `MediaElementSourceNode` dynamically inside render components. It is securely created as a singleton in `useAudioEngine.js`. Rebinding or dropping graph connections causes silent playback or extreme volume spikes.
6. **Canvas Retinal Scaling (Phase 3):** To support high-DPI mobile screens, `Visualizer.jsx` scales its drawing buffer by `devicePixelRatio`. However, when calculating absolute coordinates during drawing algorithms in `useVisualizer.js` (e.g. `centerX`), you MUST explicitly divide the hardware canvas properties by the active `DPR` or use `<canvas>.clientWidth`, otherwise the elements will be drawn violently off-screen.
7. **Image Proxy Stability (Phase 21):** To prevent CDN flagging and 403 errors, the backend proxy (`/api/stream/thumbnail`) now spoofes browser headers (including `Referer: https://music.youtube.com/`). It also implements an automatic resolution fallback—if a high-res (`=s0`) fetch fails, it retries with the original thumbnail URL before failing. 
8. **Frontend Circuit Breaker (Phase 21):** `SongCover.jsx` has a built-in circuit breaker. If the backend proxy fails (e.g., server IP is blocked), the component automatically extracts the `fallback` parameter from the proxy URL and attempts a direct client-side load.
9. **Persistent Thumbnail Cache (Phase 21):** Backend `cache_service.py` implements atomic disk writes (write-to-tmp then rename) to prevent corrupted image cache entries.
10. **Resizable Queue UI (Phase 21):** `RightPanel.jsx` is resizable on Desktop. It calculates width via `window.innerWidth - e.clientX` and persists the user preference in `localStorage.queueWidth`. The resize handle uses `z-index: 20000` to remain interactable above all overlays.
11. **Multi-Step Auth UI & 2FA (Phase 22):** The authentication flow is a multi-step UI supporting login, registration, TOTP 2FA verification, and a "Forgot Password" code-based recovery mechanism. Do not revert to the single-page basic auth form.
12. **Smart DJ Fallback (Phase 22):** The AI-driven mood engine has been replaced with a high-performance rotational color cycle for better reliability. The Smart DJ interface explicitly uses the `<SongCover />` component to resolve image loading failures.
13. **Local Database & Clean State (Phase 22):** External streaming data has been purged. The database relies strictly on local metadata and direct YouTube Music integrations. Do not reintroduce stale configurations or orphaned components.

---

## 🚀 6. Performance & UX Standards
- **Golden Placeholders:** All images MUST use the `<SongCover />` component. This ensures the "Liquid Gold" animated fallback is visible during the loading phase (`!loaded`), preventing black-box layout shifts.
- **Atomic Caching:** Never write direct to cache files; use `ThumbnailCache.save_to_cache` to ensure atomic operations.
- **Resize Constraints:** The Queue panel resize is constrained between `300px` and `600px` for layout stability.

---

*This document was generated automatically post-Phase 22 overhaul to ensure seamless integration for subsequent AI engineers executing contextual commands over the Rhymic project matrix.*
