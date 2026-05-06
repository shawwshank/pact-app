import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { collection, query, where, getDocs, setDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/auth';
import { theme } from '@/constants/theme';

type Goal = { id: string; title: string; frequency: string; groupId: string };
type CheckinMap = Record<string, boolean>;

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function CheckInScreen() {
  const { user } = useAuth();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [checkins, setCheckins] = useState<CheckinMap>({});
  const today = todayStr();

  useEffect(() => {
    if (!user) return;
    loadGoals();
  }, [user]);

  async function loadGoals() {
    if (!user) return;
    const q = query(collection(db(), 'goals'), where('userId', '==', user.uid), where('isActive', '==', true));
    const snap = await getDocs(q);
    const g = snap.docs.map(d => ({ id: d.id, ...d.data() } as Goal));
    setGoals(g);

    const cq = query(
      collection(db(), 'checkins'),
      where('userId', '==', user.uid),
      where('date', '==', today),
    );
    const cSnap = await getDocs(cq);
    const map: CheckinMap = {};
    cSnap.docs.forEach(d => {
      const data = d.data();
      map[data.goalId] = data.completed;
    });
    setCheckins(map);
  }

  async function toggleCheckin(goalId: string, completed: boolean) {
    if (!user) return;
    const checkinId = `${user.uid}_${goalId}_${today}`;
    await setDoc(doc(db(), 'checkins', checkinId), {
      userId: user.uid,
      goalId,
      groupId: goals.find(g => g.id === goalId)?.groupId ?? '',
      date: today,
      completed,
      source: 'manual',
      updatedAt: new Date(),
    }, { merge: true });
    setCheckins(prev => ({ ...prev, [goalId]: completed }));
  }

  const allDone = goals.length > 0 && goals.every(g => checkins[g.id] === true);

  if (goals.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>🎯</Text>
          <Text style={styles.emptyTitle}>No goals yet</Text>
          <Text style={styles.emptySub}>Add goals from the Profile tab to start tracking</Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.date}>
        {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
      </Text>

      {allDone && (
        <View style={styles.successBanner}>
          <Text style={styles.successText}>All done today! 🎉</Text>
        </View>
      )}

      {goals.map(goal => {
        const done = checkins[goal.id] === true;
        const missed = checkins[goal.id] === false;
        return (
          <View key={goal.id} style={styles.card}>
            <Text style={styles.goalTitle}>{goal.title}</Text>
            <Text style={styles.goalFreq}>{goal.frequency}</Text>
            <View style={styles.btnRow}>
              <TouchableOpacity
                style={[styles.btn, done && styles.btnDone]}
                onPress={() => toggleCheckin(goal.id, true)}
                activeOpacity={0.7}>
                <Text style={[styles.btnIcon, done && styles.btnIconActive]}>✓</Text>
                <Text style={[styles.btnLabel, done && styles.btnLabelActive]}>Done</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, missed && styles.btnMissed]}
                onPress={() => toggleCheckin(goal.id, false)}
                activeOpacity={0.7}>
                <Text style={[styles.btnIcon, missed && styles.btnIconActive]}>✗</Text>
                <Text style={[styles.btnLabel, missed && styles.btnLabelActive]}>Missed</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  content: { padding: theme.spacing.lg, paddingTop: theme.spacing.md },
  date: {
    fontSize: theme.font.size.lg, fontWeight: theme.font.weight.semibold,
    color: theme.colors.text, marginBottom: theme.spacing.lg,
  },
  successBanner: {
    backgroundColor: theme.colors.success + '15',
    borderRadius: theme.radius.md, padding: theme.spacing.md,
    marginBottom: theme.spacing.lg, alignItems: 'center',
    borderWidth: 1, borderColor: theme.colors.success + '30',
  },
  successText: { color: theme.colors.success, fontSize: theme.font.size.md, fontWeight: theme.font.weight.semibold },
  card: {
    backgroundColor: theme.colors.card, borderRadius: theme.radius.lg,
    padding: theme.spacing.lg, marginBottom: theme.spacing.md,
    borderWidth: 1, borderColor: theme.colors.cardBorder,
  },
  goalTitle: {
    fontSize: theme.font.size.xl, fontWeight: theme.font.weight.bold, color: theme.colors.text,
  },
  goalFreq: {
    fontSize: theme.font.size.sm, color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs, marginBottom: theme.spacing.lg,
  },
  btnRow: { flexDirection: 'row', gap: theme.spacing.md },
  btn: {
    flex: 1, paddingVertical: theme.spacing.lg, borderRadius: theme.radius.md,
    borderWidth: 1.5, borderColor: theme.colors.cardBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  btnDone: { backgroundColor: theme.colors.success, borderColor: theme.colors.success },
  btnMissed: { backgroundColor: theme.colors.danger, borderColor: theme.colors.danger },
  btnIcon: { fontSize: 28, color: theme.colors.textSecondary },
  btnIconActive: { color: '#fff' },
  btnLabel: {
    fontSize: theme.font.size.sm, color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs, fontWeight: theme.font.weight.medium,
  },
  btnLabelActive: { color: '#fff' },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: theme.spacing.xl },
  emptyIcon: { fontSize: 48, marginBottom: theme.spacing.md },
  emptyTitle: { fontSize: theme.font.size.xl, fontWeight: theme.font.weight.bold, color: theme.colors.text },
  emptySub: { fontSize: theme.font.size.md, color: theme.colors.textSecondary, marginTop: theme.spacing.sm, textAlign: 'center' },
});
