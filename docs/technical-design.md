# Pact — Technical Design Document

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────┐
│                   Client (iOS)                   │
│              React Native + Expo                 │
│                                                  │
│  ┌──────────┐ ┌──────────┐ ┌────────────────┐  │
│  │ Firebase │ │ HealthKit│ │  Expo Push      │  │
│  │ SDK      │ │ Bridge   │ │  Notifications  │  │
│  └────┬─────┘ └────┬─────┘ └───────┬────────┘  │
└───────┼─────────────┼───────────────┼────────────┘
        │             │               │
        ▼             ▼               ▼
┌──────────────┐ ┌─────────┐ ┌──────────────────┐
│   Firebase   │ │  Apple  │ │  Expo Push       │
│  ┌─────────┐ │ │HealthKit│ │  Service (or FCM)│
│  │  Auth   │ │ │  (local)│ └──────────────────┘
│  ├─────────┤ │ └─────────┘
│  │Firestore│ │
│  ├─────────┤ │
│  │ Cloud   │ │
│  │Functions│ │
│  └─────────┘ │
└──────────────┘
```

**Key decisions:**
- **React Native + Expo** — fastest path to a working iOS app with minimal native config
- **Firebase** — handles auth, database, and serverless functions in one platform
- **Firestore** — realtime sync means the group feed updates live when someone checks in
- **Cloud Functions** — handles push notifications, streak calculations, and scheduled jobs

---

## 2. Data Models (Firestore)

### Collection: `users`
```
/users/{userId}
{
  displayName: string,
  email: string,
  avatarUrl: string | null,
  createdAt: timestamp,
  pushToken: string | null,
  notificationSettings: {
    dailyReminder: boolean,
    dailyReminderTime: string,       // "20:00"
    nudgeIfNotCheckedIn: boolean,
    nudgeAfterTime: string,          // "22:00"
    weeklySummary: boolean
  }
}
```

### Collection: `groups`
```
/groups/{groupId}
{
  name: string,
  createdBy: userId,
  inviteCode: string,               // short unique code for invite links
  memberIds: string[],              // array of userIds
  createdAt: timestamp
}
```

### Collection: `goals`
```
/goals/{goalId}
{
  userId: string,
  groupId: string,
  title: string,                    // "Work out"
  frequency: "daily" | "weekly",
  restDays: number[],               // [0, 6] = Sunday, Saturday (0=Sun, 6=Sat)
  isActive: boolean,
  createdAt: timestamp
}
```

### Collection: `checkins`
```
/checkins/{checkinId}
{
  userId: string,
  goalId: string,
  groupId: string,
  date: string,                     // "2026-05-07" (ISO date, or week start for weekly)
  completed: boolean,
  source: "manual" | "healthkit",
  createdAt: timestamp,
  updatedAt: timestamp
}
```
- **Composite index**: `userId + goalId + date` (unique — one check-in per goal per day)
- **Query pattern**: Get all check-ins for a group for a date range

### Collection: `streaks`
```
/streaks/{streakId}
{
  userId: string,
  goalId: string,
  currentStreak: number,            // consecutive days/weeks
  longestStreak: number,
  lastCompletedDate: string,        // "2026-05-07"
  updatedAt: timestamp
}
```
- Denormalized for fast reads on leaderboard/feed
- Updated by Cloud Function when a check-in is written

### Collection: `nudges` (P1)
```
/nudges/{nudgeId}
{
  fromUserId: string,
  toUserId: string,
  groupId: string,
  date: string,
  createdAt: timestamp
}
```

---

## 3. Firestore Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Users can read/write their own profile
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth.uid == userId;
    }

    // Group members can read group data
    match /groups/{groupId} {
      allow read: if request.auth.uid in resource.data.memberIds;
      allow create: if request.auth != null;
      allow update: if request.auth.uid in resource.data.memberIds;
    }

    // Goals: owner can write, group members can read
    match /goals/{goalId} {
      allow read: if request.auth != null;
      allow write: if request.auth.uid == resource.data.userId
                   || request.auth.uid == request.resource.data.userId;
    }

    // Check-ins: owner can write, group members can read
    match /checkins/{checkinId} {
      allow read: if request.auth != null;
      allow create: if request.auth.uid == request.resource.data.userId;
      allow update: if request.auth.uid == resource.data.userId;
    }

    // Streaks: read by group members, written only by Cloud Functions
    match /streaks/{streakId} {
      allow read: if request.auth != null;
      allow write: if false; // only Cloud Functions (admin SDK)
    }
  }
}
```

---

## 4. Authentication

**Provider:** Firebase Auth

**Methods:**
1. **Apple Sign-In** (primary) — required for iOS App Store
2. **Email/Password** (fallback)

**Flow:**
```
App Launch
  → Check Firebase Auth state
  → If authenticated → load user doc → Home
  → If not → show Welcome screen → sign in → create user doc → Onboarding
```

**Invite link handling:**
- Invite links use format: `https://pact.app/join/{inviteCode}`
- Deep link opens app → if authenticated, auto-join group
- If not authenticated, store invite code → join after sign-in

---

## 5. Push Notifications

**Service:** Expo Push Notifications (wraps APNs)

**Why Expo Push over raw FCM/APNs:**
- No need to manage APNs certificates manually
- Simple HTTP API from Cloud Functions
- Works seamlessly with Expo-built apps

### Notification Types

| Type | Trigger | Message |
|------|---------|---------|
| Daily reminder | Scheduled (user's chosen time) | "Time to check in on your goals!" |
| Missed check-in | Scheduled (user's nudge time) | "You haven't checked in today — still time!" |
| Nudge from friend (P1) | On nudge creation | "{Name} is wondering if you hit your goals 👀" |
| Weekly summary (P1) | Monday morning | "Last week: you hit 85% of your goals. See how your group did →" |

### Cloud Function: Scheduled Notifications

```javascript
// Runs every hour via Cloud Scheduler
exports.sendDailyReminders = functions.pubsub
  .schedule('0 * * * *')  // every hour
  .onRun(async () => {
    // 1. Query users whose dailyReminderTime matches current hour
    // 2. Check if they've already checked in today
    // 3. If not, send push via Expo Push API
  });
```

### Push Token Management
- On app launch / foreground, register for push → get Expo push token
- Store token in `/users/{userId}.pushToken`
- Cloud Functions read token when sending

---

## 6. Cloud Functions

### Function: `onCheckinWrite`
**Trigger:** Firestore `onCreate` / `onUpdate` on `/checkins/{id}`

**Logic:**
1. Read the goal (daily vs weekly, rest days)
2. Calculate if streak continues or breaks
3. Update `/streaks/{userId_goalId}` document
4. If streak breaks → reset `currentStreak` to 0

### Function: `sendDailyReminders`
**Trigger:** Cloud Scheduler (hourly)

**Logic:**
1. Get current hour (UTC)
2. Query users where `notificationSettings.dailyReminderTime` matches
3. For each user, check if they have pending (uncompleted) goals today
4. Send Expo push notification if they haven't checked in

### Function: `sendNudge` (P1)
**Trigger:** Firestore `onCreate` on `/nudges/{id}`

**Logic:**
1. Look up target user's push token
2. Look up sender's display name
3. Send push: "{sender} is wondering if you hit your goals 👀"

### Function: `joinGroup`
**Trigger:** HTTPS callable

**Logic:**
1. Validate invite code
2. Add user to group's `memberIds` array
3. Return group data

---

## 7. HealthKit Integration (P1)

**Library:** `react-native-health` (Expo plugin available)

**Data read:**
- `HKWorkoutType` — any logged workout
- `HKQuantityType.activeEnergyBurned`
- `HKQuantityType.appleExerciseTime`

**Flow:**
```
User enables HealthKit in Settings
  → App requests read permission for workout data
  → Background task checks for workouts daily
  → If workout ≥ 20 min detected AND user has unchecked exercise goal
    → Auto-mark as completed (source: "healthkit")
    → Show in-app confirmation: "We detected a workout — marked as done!"
```

**Oura / Whoop:** Both sync to Apple HealthKit, so no separate API integration needed.

---

## 8. Project Structure

```
pact-app/
├── app/                        # Expo Router (file-based routing)
│   ├── (tabs)/                 # Tab navigator
│   │   ├── index.tsx           # Home (Group Feed)
│   │   ├── checkin.tsx         # Check-in
│   │   ├── leaderboard.tsx     # Leaderboard
│   │   └── profile.tsx         # Profile
│   ├── (auth)/                 # Auth screens
│   │   ├── welcome.tsx
│   │   └── onboarding.tsx
│   ├── group/
│   │   ├── [id].tsx            # Group detail
│   │   └── settings.tsx        # Group settings
│   └── _layout.tsx             # Root layout
├── components/
│   ├── CheckinCard.tsx
│   ├── StreakBadge.tsx
│   ├── GroupTable.tsx
│   └── LeaderboardRow.tsx
├── lib/
│   ├── firebase.ts             # Firebase init + helpers
│   ├── auth.ts                 # Auth context/hooks
│   ├── notifications.ts        # Push notification setup
│   └── healthkit.ts            # HealthKit bridge (P1)
├── hooks/
│   ├── useCheckins.ts          # Firestore query hooks
│   ├── useGoals.ts
│   ├── useGroup.ts
│   └── useStreaks.ts
├── functions/                  # Firebase Cloud Functions
│   ├── src/
│   │   ├── onCheckinWrite.ts
│   │   ├── sendDailyReminders.ts
│   │   ├── sendNudge.ts
│   │   └── joinGroup.ts
│   └── package.json
├── app.json                    # Expo config
├── firestore.rules
├── firestore.indexes.json
└── package.json
```

---

## 9. Firestore Indexes

```json
{
  "indexes": [
    {
      "collectionGroup": "checkins",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "groupId", "order": "ASCENDING" },
        { "fieldPath": "date", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "checkins",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "userId", "order": "ASCENDING" },
        { "fieldPath": "goalId", "order": "ASCENDING" },
        { "fieldPath": "date", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "streaks",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "goalId", "order": "ASCENDING" },
        { "fieldPath": "currentStreak", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "goals",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "groupId", "order": "ASCENDING" },
        { "fieldPath": "userId", "order": "ASCENDING" }
      ]
    }
  ]
}
```

---

## 10. Key Query Patterns

| Screen | Query | Index Used |
|--------|-------|-----------|
| Group Feed | `checkins WHERE groupId == X AND date >= weekStart ORDER BY date DESC` | checkins: groupId + date |
| Check-in | `goals WHERE userId == me AND isActive == true` | goals: userId |
| Leaderboard | `streaks WHERE goalId IN [group's goals] ORDER BY currentStreak DESC` | streaks: goalId + currentStreak |
| Profile | `goals WHERE userId == me` | goals: userId |

---

## 11. Streak Calculation Logic

```typescript
function calculateStreak(goal: Goal, checkins: Checkin[]): number {
  // Sort check-ins by date descending
  const sorted = checkins
    .filter(c => c.goalId === goal.id && c.completed)
    .sort((a, b) => b.date.localeCompare(a.date));

  if (sorted.length === 0) return 0;

  let streak = 0;
  let expectedDate = today();

  for (const checkin of sorted) {
    // Skip rest days
    while (isRestDay(expectedDate, goal.restDays)) {
      expectedDate = subtractDay(expectedDate);
    }

    if (checkin.date === expectedDate) {
      streak++;
      expectedDate = subtractDay(expectedDate);
    } else {
      break; // streak broken
    }
  }

  return streak;
}
```

- Rest days are skipped (don't break or extend streak)
- Weekly goals: streak counts consecutive weeks
- Hard reset on miss (per BRD decision)

---

## 12. Invite System

**Flow:**
1. Creator taps "Copy Invite Link"
2. Link format: `https://pact.app/join/ABC123`
3. `ABC123` = `groups/{groupId}.inviteCode` (6-char alphanumeric, generated on group creation)
4. Recipient opens link:
   - If app installed → deep link → `joinGroup` callable function
   - If not installed → App Store → after install, stored invite code triggers join

**Deep linking:** Expo's `expo-linking` + Universal Links (configured in `app.json`)

---

## 13. Offline Support

Firestore provides offline persistence by default:
- Check-ins made offline are queued and synced when back online
- Group feed shows cached data with "offline" indicator
- Streaks may be temporarily stale until sync completes

---

## 14. Cost Estimate (Firebase Free Tier)

For a group of ~10-15 users:

| Resource | Free Tier | Expected Usage |
|----------|-----------|----------------|
| Firestore reads | 50k/day | ~500/day (well within) |
| Firestore writes | 20k/day | ~50/day |
| Cloud Functions invocations | 2M/month | ~1k/month |
| Auth | 10k/month | <20 users |
| Storage | 5GB | Minimal (no media) |

**Verdict:** Entirely free for a side project at this scale.

---

## 15. Development Phases

### Phase 1 (Weeks 1-3): Foundation
- Expo project setup
- Firebase project + auth (Apple Sign-In)
- User creation flow
- Group creation + invite link

### Phase 2 (Weeks 3-5): Core Loop
- Goal CRUD
- Check-in screen + Firestore writes
- Group feed (table view) with realtime updates
- Streak calculation (Cloud Function)

### Phase 3 (Weeks 5-7): Polish
- Leaderboard
- Push notifications (daily reminder)
- Profile + settings
- Missed check-in notifications

### Phase 4 (Week 8): Ship
- TestFlight deployment
- Bug fixes from friend group testing
- App Store submission (optional)

### Phase 5 (Post-launch): P1 Features
- Nudges
- HealthKit integration
- Weekly summary
- Goal history/stats
