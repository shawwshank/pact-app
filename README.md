# Pact

**A social fitness accountability app that turns shared goal tracking into a daily habit.**

## The Problem

Friend groups use shared iPhone Notes to track daily goals — but people forget to update, there's no visibility into streaks, and there's zero social reinforcement. The experience is clunky and unmotivating.

## The Solution

Pact replaces the shared Notes table with a purpose-built mobile app that makes accountability effortless, visible, and social. Users create groups, set personal goals (daily or weekly), and check in with a single tap. Everyone in the group can see each other's progress in a weekly grid — creating natural accountability through transparency.

## Key Features

- **One-tap check-ins** — Mark goals as done or missed in seconds
- **Group accountability** — See your friends' progress in a weekly grid
- **Streaks** — Track consecutive days of goal completion
- **Flexible goals** — Daily or weekly, with rest days built in
- **Multiple groups** — Separate groups for gym, nutrition, habits, etc.
- **Invite system** — Share a code to add friends to your group

## Product Decisions

| Decision | Rationale |
|----------|-----------|
| Binary goals (done/not done) | Reduces friction — no need to log reps, minutes, etc. |
| Hard streak reset on miss | Creates urgency and real accountability |
| Rest days don't break streaks | Prevents burnout, encourages sustainable habits |
| Weekly reset on Monday | Aligns with how people think about their week |
| All check-ins visible to group | Transparency is the core accountability mechanic |

## Roadmap

| Phase | Features | Status |
|-------|----------|--------|
| **P0 — MVP** | Auth, groups, goals, check-ins, weekly grid, streaks | ✅ Shipped |
| **P1 — Engagement** | Nudges, Apple HealthKit auto-check-in, weekly summary | 🔜 Next |
| **P2 — Retention** | Leaderboard, challenges, reactions, gamification | 📋 Planned |

## Tech Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Frontend | React Native (Expo) | Single codebase, fast iteration, iOS-first |
| Backend | Firebase (Firestore, Auth) | Realtime sync, zero server management |
| Auth | Firebase REST API | Compatible with Expo Go, no native dependencies |
| Routing | Expo Router (file-based) | Clean navigation, deep linking ready |

## Screenshots

*Coming soon — dark theme with purple accent, Zero-inspired UI*

## Running Locally

```bash
npm install
npx expo start
```

Scan the QR code with Expo Go on your iPhone, or press `i` for iOS Simulator.

## Documentation

- [Screen Flows & Wireframes](docs/screen-flows.md)
- [Technical Design](docs/technical-design.md)

## Author

Built as a side project to solve a real problem with my friend group — and to demonstrate end-to-end product thinking from BRD → design → shipped app.
