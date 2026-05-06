import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'expo-router';
import { calculateStreak } from '@/lib/streaks';

type Goal = { id: string; title: string; frequency: string; groupId: string };
type Group = { id: string; name: string; memberIds: string[] };

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

    // Calculate streaks
    const s: Record<string, number> = {};
    for (const goal of g) {
      s[goal.id] = await calculateStreak(user.uid, goal.id);
    }
    setStreaks(s);
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.name}>{user?.email}</Text>

      <Text style={styles.section}>My Groups</Text>
      {groups.map(g => (
        <View key={g.id} style={styles.card}>
          <Text style={styles.cardTitle}>{g.name}</Text>
          <Text style={styles.cardSub}>{g.memberIds.length} members</Text>
          {goals.filter(goal => goal.groupId === g.id).map(goal => (
            <Text key={goal.id} style={styles.goalItem}>
              • {goal.title} ({goal.frequency}) · 🔥 {streaks[goal.id] ?? 0}
            </Text>
          ))}
          <TouchableOpacity onPress={() => router.push(`/group/add-goal?groupId=${g.id}`)}>
            <Text style={styles.link}>+ Add Goal</Text>
          </TouchableOpacity>
        </View>
      ))}
      <TouchableOpacity style={styles.outlineBtn} onPress={() => router.push('/group/create')}>
        <Text style={styles.outlineBtnText}>+ Create Group</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.signOut} onPress={() => signOut()}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24 },
  name: { fontSize: 20, fontWeight: 'bold', marginBottom: 24 },
  section: { fontSize: 16, fontWeight: '600', color: '#666', marginTop: 24, marginBottom: 12 },
  card: { backgroundColor: '#f9f9f9', borderRadius: 12, padding: 16, marginBottom: 8 },
  cardTitle: { fontSize: 16, fontWeight: '600' },
  cardSub: { fontSize: 14, color: '#666', marginTop: 4 },
  link: { color: '#2563eb', marginTop: 8, fontWeight: '500' },
  goalItem: { fontSize: 14, color: '#333', marginTop: 6 },
  outlineBtn: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 8,
    padding: 14, alignItems: 'center', marginTop: 8,
  },
  outlineBtnText: { fontSize: 16, color: '#666' },
  signOut: { marginTop: 40, alignItems: 'center', padding: 16 },
  signOutText: { color: '#ef4444', fontSize: 16 },
});
