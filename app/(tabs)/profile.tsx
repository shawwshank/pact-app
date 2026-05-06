import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'expo-router';
import { calculateStreak } from '@/lib/streaks';
import { theme } from '@/constants/theme';

type Goal = { id: string; title: string; frequency: string; groupId: string };
type Group = { id: string; name: string; memberIds: string[]; inviteCode: string };

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [groups, setGroups] = useState<Group[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [streaks, setStreaks] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user]);

  async function loadData() {
    if (!user) return;
    const gq = query(collection(db(), 'groups'), where('memberIds', 'array-contains', user.uid));
    const gSnap = await getDocs(gq);
    setGroups(gSnap.docs.map(d => ({ id: d.id, ...d.data() } as Group)));

    const goalsQ = query(collection(db(), 'goals'), where('userId', '==', user.uid), where('isActive', '==', true));
    const goalsSnap = await getDocs(goalsQ);
    const g = goalsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Goal));
    setGoals(g);

    const s: Record<string, number> = {};
    for (const goal of g) {
      s[goal.id] = await calculateStreak(user.uid, goal.id);
    }
    setStreaks(s);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.email}>{user?.email}</Text>
      </View>

      <Text style={styles.section}>Groups</Text>
      {groups.map(g => (
        <View key={g.id} style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>{g.name}</Text>
            <Text style={styles.badge}>{g.memberIds.length} 👤</Text>
          </View>
          {goals.filter(goal => goal.groupId === g.id).map(goal => (
            <View key={goal.id} style={styles.goalRow}>
              <Text style={styles.goalTitle}>{goal.title}</Text>
              <View style={styles.streakBadge}>
                <Text style={styles.streakText}>🔥 {streaks[goal.id] ?? 0}</Text>
              </View>
            </View>
          ))}
          <TouchableOpacity style={styles.addGoalBtn} onPress={() => router.push(`/group/add-goal?groupId=${g.id}`)}>
            <Text style={styles.addGoalText}>+ Add Goal</Text>
          </TouchableOpacity>
          <Text style={styles.inviteCode}>Invite: {g.inviteCode}</Text>
        </View>
      ))}

      <TouchableOpacity style={styles.outlineBtn} onPress={() => router.push('/group/create')}>
        <Text style={styles.outlineBtnText}>+ Create Group</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.signOutBtn} onPress={() => signOut()}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  content: { padding: theme.spacing.lg },
  header: { marginBottom: theme.spacing.lg },
  email: { fontSize: theme.font.size.md, color: theme.colors.textSecondary },
  section: {
    fontSize: theme.font.size.sm, fontWeight: theme.font.weight.semibold,
    color: theme.colors.textMuted, textTransform: 'uppercase',
    letterSpacing: 1, marginBottom: theme.spacing.md,
  },
  card: {
    backgroundColor: theme.colors.card, borderRadius: theme.radius.lg,
    padding: theme.spacing.lg, marginBottom: theme.spacing.md,
    borderWidth: 1, borderColor: theme.colors.cardBorder,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.md },
  cardTitle: { fontSize: theme.font.size.lg, fontWeight: theme.font.weight.bold, color: theme.colors.text },
  badge: { fontSize: theme.font.size.sm, color: theme.colors.textSecondary },
  goalRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: theme.spacing.sm, borderTopWidth: 1, borderTopColor: theme.colors.cardBorder,
  },
  goalTitle: { fontSize: theme.font.size.md, color: theme.colors.text },
  streakBadge: {
    backgroundColor: theme.colors.accent + '20', borderRadius: theme.radius.full,
    paddingHorizontal: theme.spacing.sm, paddingVertical: theme.spacing.xs,
  },
  streakText: { fontSize: theme.font.size.sm, color: theme.colors.accentLight },
  addGoalBtn: { marginTop: theme.spacing.md },
  addGoalText: { color: theme.colors.accent, fontSize: theme.font.size.sm, fontWeight: theme.font.weight.medium },
  inviteCode: { fontSize: theme.font.size.xs, color: theme.colors.textMuted, marginTop: theme.spacing.sm },
  outlineBtn: {
    borderWidth: 1, borderColor: theme.colors.cardBorder, borderRadius: theme.radius.md,
    padding: theme.spacing.md, alignItems: 'center', marginTop: theme.spacing.sm,
  },
  outlineBtnText: { fontSize: theme.font.size.md, color: theme.colors.textSecondary },
  signOutBtn: { marginTop: theme.spacing.xxl, alignItems: 'center', padding: theme.spacing.md },
  signOutText: { color: theme.colors.danger, fontSize: theme.font.size.md },
});
