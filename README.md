# StudyGuru (Next.js App Router)

Welcome to **StudyGuru Next**, the modern Next.js 15 implementation of the [StudyGuru](https://www.studyguru.me/) student collaboration platform.

StudyGuru integrates real-time channel communication, voice/video WebRTC rooms, shared study resources, semantic document search with pgvector, and grounded AI study tools into a unified, high-performance workspace.

---

## 🎨 Theme & Design System

StudyGuru Next features a crafted dual-theme design system engineered with **Vanilla CSS** tokens and responsive micro-interactions:

- **Cogni-Aligned Color Palette**: Harmonized with vibrant royal brand blue (`#1D4ED8`), clean slate backgrounds (`#F8FAFC`), elevated surfaces (`#FFFFFF` / `#F1F5F9`), and warm amber accents (`#F59E0B`), providing an engaging visual synergy across the platform.
- **StudyGuru Brand Emblem**: Features the redesigned Guru Wisdom & Intellect head mark with an enlightened radiant knowledge star and core, paired with modern typography in Plus Jakarta Sans and Inter.
- **Cogni-Inspired Auth Experience**: Sleek two-column split authentication screen on desktop featuring a centered, distraction-free form on the left (Google OAuth, clean email/password inputs) and a rich royal-blue branded panel on the right with ambient orbs, the StudyGuru Wisdom emblem, and streamlined product highlights. Fully collapsible and mobile-responsive on smaller screens.
- **Light Mode by Default**: Light Mode is the default primary aesthetic across all public and authenticated routes, featuring clean slate surfaces, crisp typography, and refined border contrast.
- **Dark Mode Support**: Users can toggle between Light and Dark mode at any time. Dark Mode delivers deep slate tones (`#0F172A`, `#1E293B`) designed for late-night study sessions.
- **Instant Persistence & No FOUC**: The user's active theme selection is stored in `localStorage` under `'studycord-theme'`. An inline initialization script in `<head>` applies the `data-theme` attribute synchronously before page render to eliminate any Flash of Unstyled Content (FOUC).
- **Accessible Controls**: A dedicated `ThemeToggle` button is accessible across the entire application:
  - Header navigation on all public pages (`/`, `/about`, `/features`, `/technology`, `/team`, `/faq`, `/privacy`, `/terms`).
  - Floating access on authentication pages (`/login`, `/signup`).
  - Quick-switch icon on the left server rail in the authenticated dashboard.
- **Harmonized Design Tokens**: Color palettes, borders, elevated surfaces, hover states, scrollbars, and buttons adapt dynamically via CSS custom properties defined in `src/app/globals.css`.

---

## 🚀 Key Features

- **Servers & Channels**: Community spaces with organized text and voice channels.
- **Real-Time Messaging**: Dynamic chat messaging, file attachments, pinned messages, and jump-to-message highlights.
- **Voice & Video Collaboration**: WebRTC peer media calls with camera, microphone controls, and screen sharing with system audio support.
- **Advanced Semantic Search**: Server-scoped document discovery powered by pgvector, matching content by meaning rather than keywords alone.
- **AI Study Assistant**: Personal document Q&A, automatic summaries, flashcard generation, and revision quizzes.
- **Authentication**: Email/password, Google OAuth, and secure session management via Supabase Auth and NextAuth.
- **Responsive Layout**: Optimized for both high-resolution desktop workspaces and mobile browsers.

---

## 📁 Project Structure

```text
studycord-next/
├── public/                 # Static assets, branding, and icons
├── src/
│   ├── app/                # Next.js App Router routes & layouts
│   │   ├── (public)/       # Marketing, features, team, tech, and legal pages
│   │   ├── dashboard/      # Authenticated workspace, channels & voice
│   │   ├── login/          # Split-screen authentication
│   │   ├── signup/         # Split-screen account creation
│   │   ├── globals.css     # Design system tokens (Light & Dark) and app styles
│   │   └── layout.js       # Root layout with ThemeProvider & FOUC prevention
│   ├── components/         # Reusable UI components & panels
│   │   ├── ThemeToggle.jsx # Theme switcher component (Sun/Moon icons)
│   │   ├── ServerSidebar.jsx
│   │   ├── ChannelSidebar.jsx
│   │   ├── VoicePanel.jsx
│   │   ├── ResourceWorkspacePanel.jsx
│   │   └── ...
│   ├── context/            # React context providers (ThemeContext, etc.)
│   │   └── ThemeContext.jsx# Theme management & persistence logic
│   └── lib/                # Supabase client, utilities, and helper functions
├── package.json
└── README.md
```

---

## 🛠️ Getting Started

### Prerequisites

- **Node.js 18.17+** or newer
- **npm** (or pnpm / yarn)
- Configured Supabase project (for authentication and database)

### Installation

1. Navigate to the project directory:
   ```bash
   cd studycord-next
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables:
   Copy `.env.example` to `.env.local` and add your project keys:
   ```bash
   cp .env.example .env.local
   ```

   Required variables:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
   ```

4. Run the development server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧑‍💻 Founding Developer

StudyCord was designed and developed by:

- **Adewale Olaitan** — Founding Developer of StudyCord

---

## 📄 License

StudyCord is proprietary software. All rights reserved.
