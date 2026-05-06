import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'expo-router';

type Group = { id: string; name: string; memberIds: string[] };
type Checkin = { userId: string; goalId: string; groupId: string; date: string; completed: boolean };

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
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const weekDates = getWeekDates();
  const today = localDateStr(new Date());

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user]);

  async function loadData() {
    if (!user) return;
    // Load groups user is in
    const gq = query(collection(db(), 'groups'), where('memberIds', 'array-contains', user.uid));
    const gSnap = await getDocs(gq);
    const g = gSnap.docs.map(d => ({ id: d.id, ...d.data() } as Group));
    setGroups(g);

    if (g.length === 0) return;

    // Load check-ins for this week for all group members
    const allMemberIds = [...new Set(g.flatMap(gr => gr.memberIds))];
    const cq = query(
      collection(db(), 'checkins'),
      where('userId', 'in', allMemberIds.slice(0, 10)), // Firestore 'in' limit is 10
      where('date', '>=', weekDates[0]),
      where('date', '<=', weekDates[6]),
    );
    const cSnap = await getDocs(cq);
    setCheckins(cSnap.docs.map(d => d.data() as Checkin));
  }

  function getMemberStatus(memberId: string, date: string, groupId: string): '✓' | '✗' | '·' {
    const memberCheckins = checkins.filter(c => c.userId === memberId && c.date === date && c.groupId === groupId);
    if (memberCheckins.length === 0) return '·';
    const allDone = memberCheckins.every(c => c.completed);
    if (allDone) return '✓';
    return '✗';
  }

  if (groups.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No groups yet</Text>
        <TouchableOpacity style={styles.createBtn} onPress={() => router.push('/group/create')}>
          <Text style={styles.createBtnText}>Create a Group</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {groups.map(group => (
        <View key={group.id} style={styles.groupCard}>
          <Text style={styles.groupName}>{group.name}</Text>
          {/* Header row */}
          <View style={styles.tableRow}>
            <Text style={styles.nameCol}></Text>
            {DAY_LABELS.map((d, i) => (
              <Text key={i} style={[styles.dayCol, weekDates[i] === today && styles.today]}>{d}</Text>
            ))}
          </View>
          {/* Member rows */}
          {group.memberIds.map(memberId => (
            <View key={memberId} style={styles.tableRow}>
              <Text style={styles.nameCol} numberOfLines={1}>
                {memberId === user?.uid ? 'You' : memberId.slice(0, 6)}
              </Text>
              {weekDates.map((date, i) => {
                const status = getMemberStatus(memberId, date, group.id);
                return (
                  <Text key={i} style={[
                    styles.dayCol,
                    status === '✓' && styles.done,
                    status === '✗' && styles.missed,
                  ]}>{status}</Text>
                );
              })}
            </View>
          ))}
        </View>
      ))}
      <TouchableOpacity style={styles.addBtn} onPress={() => router.push('/group/create')}>
        <Text style={styles.addBtnText}>+ New Group</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  groupCard: { backgroundColor: '#f9f9f9', borderRadius: 12, padding: 16, marginBottom: 16 },
  groupName: { fontSize: 18, fontWeight: 'bold', marginBottom: 12 },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  nameCol: { width: 60, fontSize: 13, color: '#333' },
  dayCol: { flex: 1, textAlign: 'center', fontSize: 14 },
  today: { fontWeight: 'bold' },
  done: { color: '#22c55e', fontWeight: 'bold' },
  missed: { color: '#ef4444', fontWeight: 'bold' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  emptyText: { fontSize: 20, fontWeight: '600', marginBottom: 16 },
  createBtn: { backgroundColor: '#000', borderRadius: 8, padding: 16, paddingHorizontal: 32 },
  createBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  addBtn: { alignItems: 'center', padding: 12 },
  addBtnText: { fontSize: 16, color: '#666' },
});
