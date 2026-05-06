import { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { collection, query, where, getDocs, setDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'expo-router';
import { theme } from '@/constants/theme';

type Goal = { id: string; title: string; frequency: string; groupId: string };
type Group = { id: string; name: string; memberIds: string[] };
type Checkin = { userId: string; goalId: string; groupId: string; date: string; completed: boolean };
type CheckinMap = Record<string, boolean>;

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
  const weekDates = getWeekDates();
  const today = localDateStr(new Date());

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user]);

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
    // Update local checkins for grid
    setCheckins(prev => {
      const filtered = prev.filter(c => !(c.userId === user.uid && c.goalId === goalId && c.date === today));
      return [...filtered, { userId: user.uid, goalId, groupId, date: today, completed }];
    });
  }

  function getMemberStatus(memberId: string, date: string, groupId: string): '✓' | '✗' | '·' {
    const mc = checkins.filter(c => c.userId === memberId && c.date === date && c.groupId === groupId);
    if (mc.length === 0) return '·';
    return mc.every(c => c.completed) ? '✓' : '✗';
  }

  const allDoneToday = goals.length > 0 && goals.every(g => myCheckins[g.id] === true);
  const checkedInCount = goals.filter(g => myCheckins[g.id] !== undefined).length;

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
                <Text style={styles.goalTitle}>{goal.title}</Text>
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

      {/* Group Grids */}
      {groups.map(group => (
        <View key={group.id} style={styles.groupCard}>
          <Text style={styles.groupName}>{group.name}</Text>
          <View style={styles.table}>
            <View style={styles.tableRow}>
              <View style={styles.nameCol} />
              {DAY_LABELS.map((d, i) => (
                <View key={i} style={styles.dayCol}>
                  <Text style={[styles.dayLabel, weekDates[i] === today && styles.dayLabelToday]}>{d}</Text>
                </View>
              ))}
            </View>
            {group.memberIds.map(memberId => (
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
              </View>
            ))}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  content: { padding: theme.spacing.lg },
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
});
