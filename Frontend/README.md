<div align="center">
  <img width="120" alt="UK CONDO Logo" src="src/assets/images/uk_condo_logo_1781450064023.jpg" />
  <h1>UK CONDO — Property Collection Management System</h1>
  <p>Telegram-powered payment collection and reminder automation for property managers</p>
</div>

---

## Overview

PCMC is a single-page enterprise web application that centralises property fee collection across multiple condo locations. Property managers can track resident payment statuses, schedule automated Telegram reminder sequences, and broadcast notifications through bot accounts — all from one dashboard.

The app ships with an **interactive 10-step demo walkthrough** that demonstrates the full end-to-end flow without any external dependencies.

## Features

| Module | Description |
|---|---|
| **Dashboard** | Live KPI summary — outstanding balances, pending reminders, recent activity log |
| **Telegram Accounts** | Manage and connect bot accounts assigned per location |
| **Locations** | Overview of all properties (UK 313, UK 618, UK 548, UK 271) with balance and activity |
| **Residents** | Full resident directory with payment status, unit, and Telegram handle |
| **Services** | Configure billable service types and their reminder message templates |
| **AR Ledger** | Accounts receivable view — per-bill status (Paid / Due / Overdue), CSV export |
| **Reminder Scheduler** | Configure chronological offset-based reminder sequences (e.g. 5 days before due) |
| **Message Center** | Pending notification queue, bulk broadcast, and per-resident Telegram message preview |
| **Reports** | Collection performance reports and analytics |
| **Demo Walkthrough** | Guided 10-step interactive playbook showcasing the full collection workflow |

## Tech Stack

- **React 19** — UI, hooks-based state (all state centralised in `App.tsx`)
- **TypeScript ~5.8** — strict types across all components
- **Vite 6** — build tooling, dev server on port 3000
- **Tailwind CSS v4** — styling via `@tailwindcss/vite` plugin
- **Lucide React** — icon set
- **Motion** — UI animations
- **@google/genai** — Gemini API integration for AI-assisted features
- **Express** — lightweight backend server

## Run Locally

**Prerequisites:** Node.js 18+

1. Install dependencies:
   ```bash
   npm install
   ```

2. Copy the example env file and set your Gemini API key:
   ```bash
   cp .env.example .env.local
   ```
   Edit `.env.local` and replace `MY_GEMINI_API_KEY` with your key from [Google AI Studio](https://aistudio.google.com/apikey).

3. Start the dev server:
   ```bash
   npm run dev
   ```
   App runs at **http://localhost:3000**

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server (port 3000, all interfaces) |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview production build locally |
| `npm run lint` | TypeScript type check (`tsc --noEmit`) |
| `npm run clean` | Remove `dist/` and `server.js` |

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `GEMINI_API_KEY` | Yes | Google Gemini API key for AI features |
| `APP_URL` | No | Public URL of the hosted app (used for self-referential links) |

## Data & Persistence

All data is **in-memory only** — refreshing the browser resets the state to seed data. The demo walkthrough has a dedicated **Restart** button to reset back to the initial demo state without a full page reload.

Locations and their Telegram bot assignments:

| Location | Bot Username |
|---|---|
| UK 313 | `@condo_diamond_bot` |
| UK 618 | `@condo_skyview_bot` |
| UK 548 | `@borey_greenpark_bot` |
| UK 271 | `@estate_riverside_bot` |

## Project Structure

```
src/
├── App.tsx                    # Root — all state, tab routing, playbook logic
├── data.ts                    # Seed data + avatarMap + formatTemplate()
├── types.ts                   # TypeScript interfaces
├── vite-env.d.ts              # Vite image module declarations
├── assets/images/             # Resident avatars + location logos
└── components/
    ├── LoginScreen.tsx
    ├── WalkthroughGuide.tsx   # Interactive demo playbook
    ├── DashboardView.tsx
    ├── TelegramAccountsView.tsx
    ├── LocationsView.tsx
    ├── ResidentsView.tsx
    ├── ServicesView.tsx
    ├── ARView.tsx
    ├── ReminderSchedulerView.tsx
    ├── MessageCenterView.tsx
    └── ReportsView.tsx
```
