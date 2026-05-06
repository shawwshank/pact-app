# Pact — Screen Flows & Wireframes

## Navigation Structure

```
Tab Bar (bottom):
├── Home (Group Feed)
├── Check-in
├── Leaderboard
└── Profile
```

Plus modal/push screens:
- Onboarding (shown once)
- Group Settings
- Create/Join Group
- Notifications

---

## 1. Onboarding Flow (First Launch Only)

### Screen 1.1 — Welcome
```
┌─────────────────────────────┐
│                             │
│         [Pact Logo]         │
│                             │
│   "Keep each other honest"  │
│                             │
│   [Sign in with Apple]      │
│   [Sign in with Email]      │
│                             │
└─────────────────────────────┘
```
- Apple Sign-In is primary (one tap, no password)
- Email/password as fallback

### Screen 1.2 — Set Display Name
```
┌─────────────────────────────┐
│  What should we call you?   │
│                             │
│  ┌───────────────────────┐  │
│  │ Display name           │  │
│  └───────────────────────┘  │
│                             │
│  [Continue →]               │
└─────────────────────────────┘
```
- Pre-filled from Apple ID if available

### Screen 1.3 — Create or Join
```
┌─────────────────────────────┐
│                             │
│  How do you want to start?  │
│                             │
│  ┌───────────────────────┐  │
│  │ 🆕 Create a group      │  │
│  └───────────────────────┘  │
│  ┌───────────────────────┐  │
│  │ 🔗 Join with a link    │  │
│  └───────────────────────┘  │
│                             │
└─────────────────────────────┘
```

### Screen 1.4 — Create Group
```
┌─────────────────────────────┐
│  Name your group            │
│                             │
│  ┌───────────────────────┐  │
│  │ e.g. "Gym Bros"        │  │
│  └───────────────────────┘  │
│                             │
│  [Create & Invite Friends]  │
└─────────────────────────────┘
```
- After creation → shows share sheet with invite link

### Screen 1.5 — Set Your Goals
```
┌─────────────────────────────┐
│  Set your goals for         │
│  "Gym Bros"                 │
│                             │
│  ┌───────────────────────┐  │
│  │ Goal: Work out          │  │
│  │ Frequency: Daily        │  │
│  │ Rest days: Sat, Sun     │  │
│  └───────────────────────┘  │
│                             │
│  [+ Add another goal]      │
│                             │
│  [Done ✓]                   │
└─────────────────────────────┘
```
- Goal name: free text
- Frequency: daily or weekly (picker)
- Rest days: optional multi-select (Mon-Sun)

---

## 2. Home — Group Feed (Primary Tab)

### Screen 2.1 — Group Feed (Table View)
```
┌─────────────────────────────┐
│  ← Gym Bros        [⚙️]     │
│                             │
│  This Week (May 4 - May 10)│
│                             │
│        Mon Tue Wed Thu Fri  │
│  Alex   ✓   ✓   ✓   ·   · │
│  Sam    ✓   ✓   ·   ·   · │
│  Jordan ✓   ·   ·   ·   · │
│                             │
│  ─── Streaks ───            │
│  🔥 Alex: 12 days          │
│  🔥 Sam: 9 days            │
│  🔥 Jordan: 3 days         │
│                             │
│  [Tab: Home] [Check-in]    │
│  [Leaderboard] [Profile]   │
└─────────────────────────────┘
```
- **Header**: Group name + settings gear icon
- **Group switcher**: Tap group name → dropdown if user is in multiple groups
- **Table**: Rows = members, Columns = days of current week
  - ✓ = completed all goals for that day
  - ✗ = missed (day has passed, not completed)
  - · = today or future (not yet due)
  - 😴 = rest day
- **Streaks section**: Quick view of everyone's current streak
- Tapping a member's row → expands to show individual goal breakdown

### Screen 2.2 — Member Detail (Expanded)
```
┌─────────────────────────────┐
│  ← Back                     │
│                             │
│  Sam's Goals                │
│                             │
│  "Work out"     🔥 9 days   │
│  Mon ✓  Tue ✓  Wed ·       │
│                             │
│  "No alcohol"   🔥 2 weeks  │
│  This week: ✓               │
│                             │
│  [Send Nudge 👉]            │
└─────────────────────────────┘
```
- Shows each goal separately with its own streak
- Nudge button (P1 — greyed out in MVP or hidden)

---

## 3. Check-in Tab

### Screen 3.1 — Today's Check-in
```
┌─────────────────────────────┐
│  Wednesday, May 7           │
│                             │
│  ── Gym Bros ──             │
│                             │
│  Work out today?            │
│  ┌─────────┐ ┌─────────┐   │
│  │   ✓     │ │    ✗    │   │
│  │  Done   │ │ Missed  │   │
│  └─────────┘ └─────────┘   │
│                             │
│  No alcohol this week?      │
│  ┌─────────┐ ┌─────────┐   │
│  │   ✓     │ │    ✗    │   │
│  │ On track│ │ Broke it│   │
│  └─────────┘ └─────────┘   │
│                             │
│  ── Running Club ──         │
│                             │
│  Run 3 miles?               │
│  ┌─────────┐ ┌─────────┐   │
│  │   ✓     │ │    ✗    │   │
│  └─────────┘ └─────────┘   │
│                             │
│  [All done for today! 🎉]  │
└─────────────────────────────┘
```
- Grouped by group (if user is in multiple)
- Large tap targets — one tap to mark done
- Weekly goals show "on track" / "broke it" language
- Rest days show "😴 Rest day — enjoy!" (no action needed)
- Once all goals are checked → celebratory state at bottom
- Can edit past days (tap calendar icon in header to pick a date)

---

## 4. Leaderboard Tab

### Screen 4.1 — Leaderboard
```
┌─────────────────────────────┐
│  Leaderboard                │
│  [This Week ▾]  [Gym Bros ▾]│
│                             │
│  🥇 Alex         100%  🔥12│
│  🥈 Sam           85%  🔥9 │
│  🥉 Jordan        60%  🔥3 │
│                             │
│  ── Your Stats ──           │
│  Completion rate: 85%       │
│  Current streak: 9 days     │
│  Best streak: 14 days       │
│                             │
└─────────────────────────────┘
```
- **Filters**: Time period (this week / this month / all time) + group selector
- **Ranking**: By completion rate (% of goals met)
- Streak shown as secondary metric
- "Your Stats" section always visible at bottom

---

## 5. Profile Tab

### Screen 5.1 — Profile
```
┌─────────────────────────────┐
│  Sam                        │
│  Member since May 2026      │
│                             │
│  ── My Groups ──            │
│  Gym Bros (4 members)    →  │
│  Running Club (3 members)→  │
│  [+ Join/Create Group]      │
│                             │
│  ── My Goals ──             │
│  Work out (daily)     [✏️]  │
│  No alcohol (weekly)  [✏️]  │
│  [+ Add Goal]               │
│                             │
│  ── Settings ──             │
│  Notifications           →  │
│  Connected Devices       →  │
│  Account                 →  │
│                             │
└─────────────────────────────┘
```
- Edit goals inline (tap pencil → edit name, frequency, rest days)
- Add new goals → assigns to a group (picker)
- Groups list → tap to go to that group's feed

### Screen 5.2 — Notification Settings
```
┌─────────────────────────────┐
│  ← Notifications            │
│                             │
│  Daily reminder             │
│  [Toggle: ON]  Time: 8:00pm│
│                             │
│  Nudge if not checked in    │
│  [Toggle: ON]  After: 10pm │
│                             │
│  Weekly summary             │
│  [Toggle: ON]  Day: Monday  │
│                             │
└─────────────────────────────┘
```

---

## 6. Group Settings (Modal)

### Screen 6.1 — Group Settings
```
┌─────────────────────────────┐
│  ← Gym Bros Settings        │
│                             │
│  Group Name                 │
│  ┌───────────────────────┐  │
│  │ Gym Bros               │  │
│  └───────────────────────┘  │
│                             │
│  ── Members (4) ──          │
│  Alex (admin)               │
│  Sam                        │
│  Jordan                     │
│  Taylor                     │
│                             │
│  ── Invite ──               │
│  [Copy Invite Link]        │
│  [Share...]                 │
│                             │
│  ── Danger Zone ──          │
│  [Leave Group]              │
│                             │
└─────────────────────────────┘
```

---

## 7. User Journeys

### Journey A: New User (Invited)
1. Receives invite link via iMessage
2. Opens link → App Store (or opens app if installed)
3. Signs in with Apple
4. Sets display name
5. Auto-joined to group
6. Sets personal goals for that group
7. Lands on Group Feed

### Journey B: Daily Check-in
1. Receives push notification at 8pm: "Time to check in!"
2. Opens app → lands on Check-in tab
3. Taps ✓ or ✗ for each goal
4. Sees updated streak count
5. Switches to Home to see friends' status

### Journey C: Nudging a Friend (P1)
1. Opens Home → sees Jordan hasn't checked in
2. Taps Jordan's row → detail view
3. Taps "Send Nudge"
4. Jordan receives push: "Sam is wondering if you worked out today 👀"

### Journey D: Checking Past Days
1. Opens Check-in tab
2. Taps calendar icon in header
3. Selects yesterday's date
4. Marks goals as done/missed
5. Streak recalculates

---

## 8. State Definitions

| State | Visual | Meaning |
|-------|--------|---------|
| Completed | ✓ (green) | Goal met for that day/week |
| Missed | ✗ (red) | Day passed without completion |
| Pending | · (gray) | Today or future, not yet logged |
| Rest day | 😴 (blue) | User-designated rest day, doesn't affect streak |
| Auto-completed | ✓ + ⌚ icon | Marked via HealthKit (P1) |
