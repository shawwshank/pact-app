import { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { collection, query, where, getDocs, setDoc, doc, addDoc, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { theme } from '@/constants/theme';

type Goal = { id: string; title: string; frequency: string; groupId: string };
type Group = { id: string; name: string; memberIds: string[] };
type Checkin = { userId: string; goalId: string; groupId: string; date: string; completed: boolean };
type CheckinMap = Record<string, boolean>;
type Nudge = { fromUserId: string; toUserId: string; fromName: string; date: string };
type Challenge = { id: string; groupId: string; title: string; target: number; unit: string; current: number; perCheckin: number; contributions: Record<string, number> };

function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getWeekDates(): string[] {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((day + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return localDateStr(d);
  });
}

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export default function HomeScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [groups, setGroups] = useState<Group[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [myCheckins, setMyCheckins] = useState<CheckinMap>({});
  const [names, setNames] = useState<Record<string, string>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [streak, setStreak] = useState(0);
  const [nudgesReceived, setNudgesReceived] = useState<Nudge[]>([]);
  const [nudgesSent, setNudgesSent] = useState<Set<string>>(new Set());
  const [challenges, setChallenges] = useState<Record<string, Challenge>>({});
  const [showContrib, setShowContrib] = useState<{ goalId: string; groupId: string } | null>(null);
  const [reactedTo, setReactedTo] = useState<Set<string>>(new Set());
  const [milestone, setMilestone] = useState<string | null>(null);
  const [weeklyWinner, setWeeklyWinner] = useState<string | null>(null);
  const weekDates = getWeekDates();
  const today = localDateStr(new Date());

  useFocusEffect(useCallback(() => {
    if (!user) return;
    loadData();
  }, [user]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [user]);

  async function loadData() {
    if (!user) return;

    // Load groups
    const gq = query(collection(db(), 'groups'), where('memberIds', 'array-contains', user.uid));
    const gSnap = await getDocs(gq);
    const g = gSnap.docs.map(d => ({ id: d.id, ...d.data() } as Group));
    setGroups(g);

    // Load my goals
    const goalsQ = query(collection(db(), 'goals'), where('userId', '==', user.uid), where('isActive', '==', true));
    const goalsSnap = await getDocs(goalsQ);
    setGoals(goalsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Goal)));

    // Load my today check-ins
    const myQ = query(collection(db(), 'checkins'), where('userId', '==', user.uid), where('date', '==', today));
    const mySnap = await getDocs(myQ);
    const map: CheckinMap = {};
    mySnap.docs.forEach(d => { const data = d.data(); map[data.goalId] = data.completed; });
    setMyCheckins(map);

    if (g.length === 0) return;

    // Fetch display names
    const allMemberIds = [...new Set(g.flatMap(gr => gr.memberIds))];
    const nameMap: Record<string, string> = {};
    for (const uid of allMemberIds.slice(0, 10)) {
      try {
        const userDoc = await getDocs(query(collection(db(), 'users'), where('__name__', '==', uid)));
        // Simpler: use getDoc
        const { getDoc } = await import('firebase/firestore');
        const uDoc = await getDoc(doc(db(), 'users', uid));
        nameMap[uid] = uDoc.exists() ? uDoc.data().displayName || uid.slice(0, 5) : uid.slice(0, 5);
      } catch {
        nameMap[uid] = uid.slice(0, 5);
      }
    }
    setNames(nameMap);

    // Load all check-ins for the week
    const cq = query(
      collection(db(), 'checkins'),
      where('userId', 'in', allMemberIds.slice(0, 10)),
      where('date', '>=', weekDates[0]),
      where('date', '<=', weekDates[6]),
    );
    const cSnap = await getDocs(cq);
    setCheckins(cSnap.docs.map(d => d.data() as Checkin));

    // Load nudges received today
    const nq = query(collection(db(), 'nudges'), where('toUserId', '==', user.uid), where('date', '==', today));
    const nSnap = await getDocs(nq);
    setNudgesReceived(nSnap.docs.map(d => d.data() as Nudge));

    // Load active challenges
    const cMap: Record<string, Challenge> = {};
    for (const group of g) {
      const cq2 = query(collection(db(), 'challenges'), where('groupId', '==', group.id), where('isActive', '==', true));
      const cSnap2 = await getDocs(cq2);
      if (!cSnap2.empty) cMap[group.id] = { id: cSnap2.docs[0].id, ...cSnap2.docs[0].data() } as Challenge;
    }
    setChallenges(cMap);

    // Calculate weekly winner (last week's top performer)
    const isMonday = new Date().getDay() === 1;
    if (isMonday || true) { // Show winner banner early in the week
      const lastWeekStart = new Date();
      lastWeekStart.setDate(lastWeekStart.getDate() - 7 - ((lastWeekStart.getDay() + 6) % 7));
      const lastWeekEnd = new Date(lastWeekStart);
      lastWeekEnd.setDate(lastWeekStart.getDate() + 6);
      const lwStart = `${lastWeekStart.getFullYear()}-${String(lastWeekStart.getMonth() + 1).padStart(2, '0')}-${String(lastWeekStart.getDate()).padStart(2, '0')}`;
      const lwEnd = `${lastWeekEnd.getFullYear()}-${String(lastWeekEnd.getMonth() + 1).padStart(2, '0')}-${String(lastWeekEnd.getDate()).padStart(2, '0')}`;

      const allMembers = [...new Set(g.flatMap(gr => gr.memberIds))];
      let bestUid = '';
      let bestRate = 0;
      for (const uid of allMembers.slice(0, 10)) {
        const memberCheckins = cSnap.docs.filter(d => d.data().userId === uid);
        const done = memberCheckins.filter(d => d.data().completed).length;
        const rate = memberCheckins.length > 0 ? done / memberCheckins.length : 0;
        if (rate > bestRate) { bestRate = rate; bestUid = uid; }
      }
      if (bestUid && bestRate > 0 && bestUid !== user.uid) {
        setWeeklyWinner(`🏆 Last week's champion: ${nameMap[bestUid] || bestUid.slice(0, 5)} (${Math.round(bestRate * 100)}%)`);
      } else if (bestUid === user.uid && bestRate > 0) {
        setWeeklyWinner(`🏆 You were last week's champion! (${Math.round(bestRate * 100)}%)`);
      }
    }
  }

  async function sendNudge(toUserId: string) {
    if (!user) return;
    await addDoc(collection(db(), 'nudges'), {
      fromUserId: user.uid,
      toUserId,
      fromName: user.displayName || 'Someone',
      date: today,
      createdAt: new Date(),
    });
    setNudgesSent(prev => new Set([...prev, toUserId]));
  }

  async function sendReaction(toUserId: string, emoji: string) {
    if (!user) return;
    await addDoc(collection(db(), 'reactions'), {
      fromUserId: user.uid, toUserId, emoji,
      fromName: user.displayName || user.email?.split('@')[0] || 'Someone',
      date: today, createdAt: new Date(),
    });
    setReactedTo(prev => new Set([...prev, toUserId]));
  }

  async function toggleCheckin(goalId: string, completed: boolean) {
    if (!user) return;
    const checkinId = `${user.uid}_${goalId}_${today}`;
    const groupId = goals.find(g => g.id === goalId)?.groupId ?? '';
    await setDoc(doc(db(), 'checkins', checkinId), {
      userId: user.uid, goalId, groupId, date: today,
      completed, source: 'manual', updatedAt: new Date(),
    }, { merge: true });
    setMyCheckins(prev => ({ ...prev, [goalId]: completed }));
    setCheckins(prev => {
      const filtered = prev.filter(c => !(c.userId === user.uid && c.goalId === goalId && c.date === today));
      return [...filtered, { userId: user.uid, goalId, groupId, date: today, completed }];
    });
    // If completed and group has a challenge, show contribution prompt
    if (completed && challenges[groupId]) {
      setShowContrib({ goalId, groupId });
    }
    // Check for streak milestone
    if (completed) {
      checkStreakMilestone(goalId);
    }
  }

  async function checkStreakMilestone(goalId: string) {
    if (!user) return;
    const q = query(
      collection(db(), 'checkins'),
      where('userId', '==', user.uid),
      where('goalId', '==', goalId),
      where('completed', '==', true),
      orderBy('date', 'desc'),
    );
    const snap = await getDocs(q);
    const dates = snap.docs.map(d => d.data().date as string);
    // Count consecutive days
    let streak = 0;
    const now = new Date();
    for (let i = 0; i < dates.length; i++) {
      const expected = new Date(now);
      expected.setDate(now.getDate() - i);
      const expectedStr = `${expected.getFullYear()}-${String(expected.getMonth() + 1).padStart(2, '0')}-${String(expected.getDate()).padStart(2, '0')}`;
      if (dates.includes(expectedStr)) streak++;
      else break;
    }
    const milestones = [30, 14, 7];
    for (const m of milestones) {
      if (streak === m) {
        setMilestone(`🔥 ${m}-day streak! You're on fire!`);
        setTimeout(() => setMilestone(null), 5000);
        break;
      }
    }
  }

  async function logContribution(amount: number) {
    if (!user || !showContrib) return;
    const challenge = challenges[showContrib.groupId];
    if (!challenge) return;
    const { updateDoc: updateD } = await import('firebase/firestore');
    const newCurrent = challenge.current + amount;
    const newContributions = { ...challenge.contributions, [user.uid]: (challenge.contributions[user.uid] || 0) + amount };
    await updateD(doc(db(), 'challenges', challenge.id), { current: newCurrent, contributions: newContributions });
    setChallenges(prev => ({
      ...prev,
      [showContrib.groupId]: { ...challenge, current: newCurrent, contributions: newContributions },
    }));
    setShowContrib(null);
  }

  function getMemberStatus(memberId: string, date: string, groupId: string): '✓' | '✗' | '·' {
    const mc = checkins.filter(c => c.userId === memberId && c.date === date && c.groupId === groupId);
    if (mc.length === 0) return '·';
    return mc.every(c => c.completed) ? '✓' : '✗';
  }

  const allDoneToday = goals.length > 0 && goals.every(g => myCheckins[g.id] === true);
  const checkedInCount = goals.filter(g => myCheckins[g.id] !== undefined).length;

  const firstName = user?.displayName?.split(' ')[0] || user?.email?.split('@')[0] || 'there';
  const hour = new Date().getHours();
  const goalsLeft = goals.filter(g => myCheckins[g.id] === undefined).length;
  let greeting: string;
  if (allDoneToday) {
    greeting = `All done today, ${firstName} 🔥`;
  } else if (goals.length === 0) {
    greeting = `Welcome, ${firstName}`;
  } else if (hour >= 20 && goalsLeft > 0) {
    greeting = `${firstName}, don't break your streak`;
  } else if (goalsLeft > 0) {
    greeting = `Hey ${firstName} — ${goalsLeft} goal${goalsLeft !== 1 ? 's' : ''} left`;
  } else {
    greeting = `Done for today, ${firstName} 👊`;
  }

  if (groups.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>👥</Text>
          <Text style={styles.emptyTitle}>No groups yet</Text>
          <Text style={styles.emptySub}>Create a group or join one with an invite code</Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => router.push('/group/create')}>
            <Text style={styles.primaryBtnText}>Create a Group</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.push('/group/join')}>
            <Text style={styles.secondaryBtnText}>Join with Code</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.accent} />}
    >
      {/* Greeting */}
      <Text style={styles.greeting}>{greeting}</Text>

      {/* Milestone celebration */}
      {milestone && (
        <View style={styles.milestoneBanner}>
          <Text style={styles.milestoneText}>{milestone}</Text>
        </View>
      )}

      {/* Weekly winner */}
      {weeklyWinner && !milestone && (
        <View style={styles.winnerBanner}>
          <Text style={styles.winnerText}>{weeklyWinner}</Text>
        </View>
      )}

      {/* Nudge received banner */}
      {nudgesReceived.length > 0 && (
        <View style={styles.nudgeBanner}>
          <Text style={styles.nudgeText}>
            👀 {nudgesReceived[nudgesReceived.length - 1].fromName} nudged you — have you checked in?
          </Text>
        </View>
      )}

      {/* Today's Check-in Section */}
      {goals.length > 0 && (
        <View style={styles.checkinSection}>
          <View style={styles.checkinHeader}>
            <Text style={styles.sectionTitle}>Today</Text>
            {allDoneToday && <Text style={styles.allDone}>All done! 🎉</Text>}
            {!allDoneToday && goals.length > 0 && (
              <Text style={styles.progress}>{checkedInCount}/{goals.length}</Text>
            )}
          </View>
          {goals.map(goal => {
            const done = myCheckins[goal.id] === true;
            const missed = myCheckins[goal.id] === false;
            return (
              <View key={goal.id} style={styles.goalRow}>
                <View style={styles.goalInfo}>
                  <Text style={styles.goalTitle}>{goal.title}</Text>
                  <Text style={styles.goalGroup}>{groups.find(g => g.id === goal.groupId)?.name}</Text>
                </View>
                <View style={styles.goalBtns}>
                  <TouchableOpacity
                    style={[styles.miniBtn, done && styles.miniBtnDone]}
                    onPress={() => toggleCheckin(goal.id, true)}>
                    <Text style={[styles.miniBtnText, done && styles.miniBtnTextActive]}>✓</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.miniBtn, missed && styles.miniBtnMissed]}
                    onPress={() => toggleCheckin(goal.id, false)}>
                    <Text style={[styles.miniBtnText, missed && styles.miniBtnTextActive]}>✗</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Contribution Prompt */}
      {showContrib && challenges[showContrib.groupId] && (
        <View style={styles.contribPrompt}>
          <Text style={styles.contribTitle}>Log contribution</Text>
          <Text style={styles.contribSub}>How much to add to "{challenges[showContrib.groupId].title}"?</Text>
          <View style={styles.contribBtns}>
            {[0.5, 1, 1.5, 2].map(amt => (
              <TouchableOpacity key={amt} style={styles.contribBtn} onPress={() => logContribution(amt)}>
                <Text style={styles.contribBtnText}>{amt} {challenges[showContrib.groupId].unit}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity onPress={() => { logContribution(challenges[showContrib.groupId].perCheckin); }}>
            <Text style={styles.contribSkip}>Use default ({challenges[showContrib.groupId].perCheckin} {challenges[showContrib.groupId].unit})</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Group Grids */}
      {groups.map(group => (
        <View key={group.id} style={styles.groupCard}>
          <TouchableOpacity onPress={() => router.push(`/group/${group.id}`)}>
            <Text style={styles.groupName}>{group.name}</Text>
          </TouchableOpacity>
          {challenges[group.id] && (
            <View style={styles.compactChallenge}>
              <Text style={styles.compactChallengeText}>🎯 {challenges[group.id].current}/{challenges[group.id].target} {challenges[group.id].unit}</Text>
              <View style={styles.compactBar}>
                <View style={[styles.compactBarFill, { width: `${Math.min((challenges[group.id].current / challenges[group.id].target) * 100, 100)}%` }]} />
              </View>
            </View>
          )}
          <View style={styles.table}>
            <View style={styles.tableRow}>
              <View style={styles.nameCol} />
              {DAY_LABELS.map((d, i) => (
                <View key={i} style={styles.dayCol}>
                  <Text style={[styles.dayLabel, weekDates[i] === today && styles.dayLabelToday]}>{d}</Text>
                </View>
              ))}
            </View>
            {group.memberIds.map(memberId => {
              const todayStatus = getMemberStatus(memberId, today, group.id);
              const canNudge = memberId !== user?.uid && todayStatus === '·' && !nudgesSent.has(memberId);
              return (
              <View key={memberId} style={styles.tableRow}>
                <View style={styles.nameCol}>
                  <Text style={styles.memberName} numberOfLines={1}>
                    {memberId === user?.uid ? 'You' : (names[memberId] || '...')}
                  </Text>
                </View>
                {weekDates.map((date, i) => {
                  const status = getMemberStatus(memberId, date, group.id);
                  return (
                    <View key={i} style={styles.dayCol}>
                      <View style={[
                        styles.dot,
                        status === '✓' && styles.dotDone,
                        status === '✗' && styles.dotMissed,
                      ]}>
                        {status !== '·' && <Text style={styles.dotText}>{status}</Text>}
                      </View>
                    </View>
                  );
                })}
                {canNudge && (
                  <TouchableOpacity style={styles.nudgeBtn} onPress={() => sendNudge(memberId)}>
                    <Text style={styles.nudgeBtnText}>👉</Text>
                  </TouchableOpacity>
                )}
                {nudgesSent.has(memberId) && memberId !== user?.uid && (
                  <Text style={styles.nudgedLabel}>sent</Text>
                )}
                {memberId !== user?.uid && todayStatus === '✓' && !reactedTo.has(memberId) && (
                  <View style={styles.reactionBtns}>
                    <TouchableOpacity onPress={() => sendReaction(memberId, '🔥')}>
                      <Text style={styles.reactionBtn}>🔥</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => sendReaction(memberId, '👏')}>
                      <Text style={styles.reactionBtn}>👏</Text>
                    </TouchableOpacity>
                  </View>
                )}
                {reactedTo.has(memberId) && memberId !== user?.uid && (
                  <Text style={styles.reactedLabel}>👍</Text>
                )}
              </View>
              );
            })}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  content: { padding: theme.spacing.lg },
  greeting: { fontSize: theme.font.size.xl, fontWeight: theme.font.weight.bold, color: theme.colors.text, marginBottom: theme.spacing.lg },
  milestoneBanner: {
    backgroundColor: '#FF9500' + '20', borderRadius: theme.radius.md,
    padding: theme.spacing.md, marginBottom: theme.spacing.lg, alignItems: 'center',
    borderWidth: 1, borderColor: '#FF9500' + '40',
  },
  milestoneText: { color: '#FF9500', fontSize: theme.font.size.md, fontWeight: theme.font.weight.bold },
  winnerBanner: {
    backgroundColor: theme.colors.success + '15', borderRadius: theme.radius.md,
    padding: theme.spacing.md, marginBottom: theme.spacing.lg, alignItems: 'center',
    borderWidth: 1, borderColor: theme.colors.success + '30',
  },
  winnerText: { color: theme.colors.success, fontSize: theme.font.size.sm, fontWeight: theme.font.weight.semibold },
  // Check-in section
  checkinSection: {
    backgroundColor: theme.colors.card, borderRadius: theme.radius.lg,
    padding: theme.spacing.lg, marginBottom: theme.spacing.lg,
    borderWidth: 1, borderColor: theme.colors.cardBorder,
  },
  checkinHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.md },
  sectionTitle: { fontSize: theme.font.size.lg, fontWeight: theme.font.weight.bold, color: theme.colors.text },
  allDone: { fontSize: theme.font.size.sm, color: theme.colors.success },
  progress: { fontSize: theme.font.size.sm, color: theme.colors.textSecondary },
  goalRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: theme.spacing.sm, borderTopWidth: 1, borderTopColor: theme.colors.cardBorder,
  },
  goalTitle: { fontSize: theme.font.size.md, color: theme.colors.text, flex: 1 },
  goalInfo: { flex: 1 },
  goalGroup: { fontSize: theme.font.size.xs, color: theme.colors.textMuted, marginTop: 2 },
  goalBtns: { flexDirection: 'row', gap: theme.spacing.sm },
  miniBtn: {
    width: 40, height: 40, borderRadius: 20, borderWidth: 1.5,
    borderColor: theme.colors.cardBorder, alignItems: 'center', justifyContent: 'center',
  },
  miniBtnDone: { backgroundColor: theme.colors.success, borderColor: theme.colors.success },
  miniBtnMissed: { backgroundColor: theme.colors.danger, borderColor: theme.colors.danger },
  miniBtnText: { fontSize: 18, color: theme.colors.textSecondary },
  miniBtnTextActive: { color: '#fff' },
  // Group grid
  groupCard: {
    backgroundColor: theme.colors.card, borderRadius: theme.radius.lg,
    padding: theme.spacing.lg, marginBottom: theme.spacing.md,
    borderWidth: 1, borderColor: theme.colors.cardBorder,
  },
  groupName: { fontSize: theme.font.size.lg, fontWeight: theme.font.weight.bold, color: theme.colors.text, marginBottom: theme.spacing.md },
  table: { gap: theme.spacing.sm },
  tableRow: { flexDirection: 'row', alignItems: 'center' },
  nameCol: { width: 50 },
  memberName: { fontSize: theme.font.size.xs, color: theme.colors.textSecondary },
  dayCol: { flex: 1, alignItems: 'center' },
  dayLabel: { fontSize: theme.font.size.xs, color: theme.colors.textMuted, fontWeight: theme.font.weight.medium },
  dayLabelToday: { color: theme.colors.accent, fontWeight: theme.font.weight.bold },
  dot: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: theme.colors.cardBorder, alignItems: 'center', justifyContent: 'center',
  },
  dotDone: { backgroundColor: theme.colors.success },
  dotMissed: { backgroundColor: theme.colors.danger },
  dotText: { color: '#fff', fontSize: 12, fontWeight: theme.font.weight.bold },
  // Empty state
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: theme.spacing.xl },
  emptyIcon: { fontSize: 48, marginBottom: theme.spacing.md },
  emptyTitle: { fontSize: theme.font.size.xl, fontWeight: theme.font.weight.bold, color: theme.colors.text },
  emptySub: { fontSize: theme.font.size.md, color: theme.colors.textSecondary, marginTop: theme.spacing.sm, textAlign: 'center' },
  primaryBtn: {
    backgroundColor: theme.colors.accent, borderRadius: theme.radius.md,
    paddingVertical: theme.spacing.md, paddingHorizontal: theme.spacing.xl, marginTop: theme.spacing.lg,
  },
  primaryBtnText: { color: '#fff', fontSize: theme.font.size.md, fontWeight: theme.font.weight.semibold },
  secondaryBtn: { marginTop: theme.spacing.md },
  secondaryBtnText: { color: theme.colors.textSecondary, fontSize: theme.font.size.md },
  // Nudge styles
  nudgeBanner: {
    backgroundColor: theme.colors.accent + '15', borderRadius: theme.radius.md,
    padding: theme.spacing.md, marginBottom: theme.spacing.lg,
    borderWidth: 1, borderColor: theme.colors.accent + '30',
  },
  nudgeText: { color: theme.colors.accentLight, fontSize: theme.font.size.sm, textAlign: 'center' },
  nudgeBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: theme.colors.accent + '20', alignItems: 'center', justifyContent: 'center', marginLeft: 4 },
  nudgeBtnText: { fontSize: 14 },
  nudgedLabel: { fontSize: theme.font.size.xs, color: theme.colors.textMuted, marginLeft: 4 },
  // Reactions
  reactionBtns: { flexDirection: 'row', marginLeft: 4, gap: 2 },
  reactionBtn: { fontSize: 16 },
  reactedLabel: { fontSize: 14, marginLeft: 4 },
  // Contribution prompt
  contribPrompt: {
    backgroundColor: theme.colors.card, borderRadius: theme.radius.lg,
    padding: theme.spacing.lg, marginBottom: theme.spacing.lg,
    borderWidth: 1, borderColor: theme.colors.accent + '40',
  },
  contribTitle: { fontSize: theme.font.size.md, fontWeight: theme.font.weight.bold, color: theme.colors.text },
  contribSub: { fontSize: theme.font.size.sm, color: theme.colors.textSecondary, marginTop: theme.spacing.xs, marginBottom: theme.spacing.md },
  contribBtns: { flexDirection: 'row', gap: theme.spacing.sm, flexWrap: 'wrap' },
  contribBtn: { backgroundColor: theme.colors.accent, borderRadius: theme.radius.md, paddingVertical: theme.spacing.sm, paddingHorizontal: theme.spacing.md },
  contribBtnText: { color: '#fff', fontSize: theme.font.size.sm, fontWeight: theme.font.weight.medium },
  contribSkip: { color: theme.colors.textMuted, fontSize: theme.font.size.sm, marginTop: theme.spacing.md, textAlign: 'center' },
  // Compact challenge
  compactChallenge: { marginBottom: theme.spacing.sm },
  compactChallengeText: { fontSize: theme.font.size.xs, color: theme.colors.textSecondary, marginBottom: theme.spacing.xs },
  compactBar: { height: 4, backgroundColor: theme.colors.cardBorder, borderRadius: 2, overflow: 'hidden' },
  compactBarFill: { height: '100%', backgroundColor: theme.colors.success, borderRadius: 2 },
});
