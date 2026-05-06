import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { collection, query, where, getDocs, setDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/auth';

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

    // Load today's check-ins
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

  if (goals.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No goals yet.</Text>
        <Text style={styles.emptySubtext}>Create a group and add goals from the Profile tab.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.date}>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</Text>
      {goals.map(goal => {
        const done = checkins[goal.id] === true;
        return (
          <View key={goal.id} style={styles.card}>
            <Text style={styles.goalTitle}>{goal.title}</Text>
            <View style={styles.row}>
              <TouchableOpacity
                style={[styles.btn, done && styles.btnDone]}
                onPress={() => toggleCheckin(goal.id, true)}>
                <Text style={[styles.btnText, done && styles.btnTextDone]}>✓ Done</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, checkins[goal.id] === false && styles.btnMissed]}
                onPress={() => toggleCheckin(goal.id, false)}>
                <Text style={[styles.btnText, checkins[goal.id] === false && styles.btnTextDone]}>✗ Missed</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, paddingTop: 16 },
  date: { fontSize: 18, fontWeight: '600', marginBottom: 20 },
  card: {
    backgroundColor: '#f9f9f9', borderRadius: 12, padding: 16, marginBottom: 12,
  },
  goalTitle: { fontSize: 18, fontWeight: '600', marginBottom: 12 },
  row: { flexDirection: 'row', gap: 12 },
  btn: {
    flex: 1, padding: 14, borderRadius: 8, borderWidth: 1,
    borderColor: '#ddd', alignItems: 'center',
  },
  btnDone: { backgroundColor: '#22c55e', borderColor: '#22c55e' },
  btnMissed: { backgroundColor: '#ef4444', borderColor: '#ef4444' },
  btnText: { fontSize: 16, fontWeight: '600' },
  btnTextDone: { color: '#fff' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  emptyText: { fontSize: 20, fontWeight: '600' },
  emptySubtext: { fontSize: 14, color: '#666', marginTop: 8, textAlign: 'center' },
});
