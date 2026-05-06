# Pact

A fitness accountability app for friend groups. Replace your shared Notes table with streaks, leaderboards, and nudges.

## Tech Stack

- **Frontend:** React Native (Expo) with TypeScript
- **Backend:** Firebase (Auth, Firestore, Cloud Functions)
- **Routing:** Expo Router (file-based)
- **Wearables:** Apple HealthKit (P1)

## Getting Started

```bash
npm install
npx expo start
```

Scan the QR code with Expo Go on your iPhone, or press `i` to open in iOS Simulator.

## Project Structure

```
app/
├── (tabs)/          # Main tab screens (Home, Check In, Leaderboard, Profile)
├── (auth)/          # Auth screens (welcome, onboarding)
└── group/           # Group detail and settings
lib/                 # Firebase config, auth helpers, notifications
hooks/               # Firestore query hooks
docs/                # BRD, screen flows, technical design
```

## Firebase Setup

1. Create a Firebase project at https://console.firebase.google.com
2. Enable Authentication (Apple + Email/Password)
3. Create a Firestore database
4. Copy your config into `lib/firebase.ts`

## Docs

- [Screen Flows & Wireframes](docs/screen-flows.md)
- [Technical Design](docs/technical-design.md)
