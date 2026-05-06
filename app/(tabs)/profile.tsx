import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { collection, query, where, getDocs, doc, updateDoc, arrayRemove } from 'firebase/firestore';
import * as Clipboard from 'expo-clipboard';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'expo-router';
import { calculateStreak } from '@/lib/streaks';
import { theme } from '@/constants/theme';
import { Swipeable } from 'react-native-gesture-handler';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

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

  async function deleteGoal(goalId: string, title: string) {
    Alert.alert('Remove Goal', `Remove "${title}"? Your streak will be lost.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        await updateDoc(doc(db(), 'goals', goalId), { isActive: false });
        setGoals(prev => prev.filter(g => g.id !== goalId));
      }},
    ]);
  }

  async function leaveGroup(groupId: string, groupName: string) {
    Alert.alert('Leave Group', `Leave "${groupName}"? You can rejoin with the invite code.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: async () => {
        if (!user) return;
        await updateDoc(doc(db(), 'groups', groupId), { memberIds: arrayRemove(user.uid) });
        setGroups(prev => prev.filter(g => g.id !== groupId));
      }},
    ]);
  }

  function renderDeleteAction() {
    return (
      <View style={styles.deleteAction}>
        <Text style={styles.deleteText}>Delete</Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
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
            <Swipeable key={goal.id} renderRightActions={renderDeleteAction} onSwipeableOpen={() => deleteGoal(goal.id, goal.title)}>
              <View style={styles.goalRow}>
                <Text style={styles.goalTitle}>{goal.title}</Text>
                <View style={styles.streakBadge}>
                  <Text style={styles.streakText}>🔥 {streaks[goal.id] ?? 0}</Text>
                </View>
              </View>
            </Swipeable>
          ))}
          <TouchableOpacity style={styles.addGoalBtn} onPress={() => router.push(`/group/add-goal?groupId=${g.id}`)}>
            <Text style={styles.addGoalText}>+ Add Goal</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.inviteBtn} onPress={() => { Clipboard.setStringAsync(g.inviteCode); Alert.alert('Copied!', `Invite code "${g.inviteCode}" copied to clipboard. Share it with friends!`); }}>
            <Text style={styles.inviteBtnText}>📋 Tap to copy invite code</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => leaveGroup(g.id, g.name)}>
            <Text style={styles.leaveText}>Leave group</Text>
          </TouchableOpacity>
        </View>
      ))}

      <TouchableOpacity style={styles.outlineBtn} onPress={() => router.push('/group/create')}>
        <Text style={styles.outlineBtnText}>+ Create Group</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.outlineBtn} onPress={() => router.push('/group/join')}>
        <Text style={styles.outlineBtnText}>Join with Invite Code</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.signOutBtn} onPress={() => signOut()}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
    </GestureHandlerRootView>
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
  inviteBtn: { marginTop: theme.spacing.sm, paddingVertical: theme.spacing.sm },
  inviteBtnText: { fontSize: theme.font.size.xs, color: theme.colors.textMuted },
  leaveText: { fontSize: theme.font.size.xs, color: theme.colors.danger, marginTop: theme.spacing.sm },
  outlineBtn: {
    borderWidth: 1, borderColor: theme.colors.cardBorder, borderRadius: theme.radius.md,
    padding: theme.spacing.md, alignItems: 'center', marginTop: theme.spacing.sm,
  },
  outlineBtnText: { fontSize: theme.font.size.md, color: theme.colors.textSecondary },
  signOutBtn: { marginTop: theme.spacing.xxl, alignItems: 'center', padding: theme.spacing.md },
  signOutText: { color: theme.colors.danger, fontSize: theme.font.size.md },
  deleteAction: {
    backgroundColor: theme.colors.danger, justifyContent: 'center', alignItems: 'center',
    width: 80, borderRadius: theme.radius.md, marginVertical: 1,
  },
  deleteText: { color: '#fff', fontSize: theme.font.size.sm, fontWeight: theme.font.weight.semibold },
});
