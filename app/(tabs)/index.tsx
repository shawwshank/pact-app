import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'expo-router';
import { theme } from '@/constants/theme';

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
    const gq = query(collection(db(), 'groups'), where('memberIds', 'array-contains', user.uid));
    const gSnap = await getDocs(gq);
    const g = gSnap.docs.map(d => ({ id: d.id, ...d.data() } as Group));
    setGroups(g);

    if (g.length === 0) return;

    const allMemberIds = [...new Set(g.flatMap(gr => gr.memberIds))];
    const cq = query(
      collection(db(), 'checkins'),
      where('userId', 'in', allMemberIds.slice(0, 10)),
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
      <View style={styles.container}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>👥</Text>
          <Text style={styles.emptyTitle}>No groups yet</Text>
          <Text style={styles.emptySub}>Create a group and invite your friends</Text>
          <TouchableOpacity style={styles.createBtn} onPress={() => router.push('/group/create')}>
            <Text style={styles.createBtnText}>Create a Group</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {groups.map(group => (
        <View key={group.id} style={styles.groupCard}>
          <Text style={styles.groupName}>{group.name}</Text>
          <View style={styles.table}>
            {/* Header */}
            <View style={styles.tableRow}>
              <View style={styles.nameCol} />
              {DAY_LABELS.map((d, i) => (
                <View key={i} style={styles.dayCol}>
                  <Text style={[styles.dayLabel, weekDates[i] === today && styles.dayLabelToday]}>{d}</Text>
                </View>
              ))}
            </View>
            {/* Members */}
            {group.memberIds.map(memberId => (
              <View key={memberId} style={styles.tableRow}>
                <View style={styles.nameCol}>
                  <Text style={styles.memberName} numberOfLines={1}>
                    {memberId === user?.uid ? 'You' : memberId.slice(0, 5)}
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
                        {status !== '·' && (
                          <Text style={styles.dotText}>{status}</Text>
                        )}
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
  groupCard: {
    backgroundColor: theme.colors.card, borderRadius: theme.radius.lg,
    padding: theme.spacing.lg, marginBottom: theme.spacing.md,
    borderWidth: 1, borderColor: theme.colors.cardBorder,
  },
  groupName: {
    fontSize: theme.font.size.lg, fontWeight: theme.font.weight.bold,
    color: theme.colors.text, marginBottom: theme.spacing.md,
  },
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
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: theme.spacing.xl },
  emptyIcon: { fontSize: 48, marginBottom: theme.spacing.md },
  emptyTitle: { fontSize: theme.font.size.xl, fontWeight: theme.font.weight.bold, color: theme.colors.text },
  emptySub: { fontSize: theme.font.size.md, color: theme.colors.textSecondary, marginTop: theme.spacing.sm },
  createBtn: {
    backgroundColor: theme.colors.accent, borderRadius: theme.radius.md,
    paddingVertical: theme.spacing.md, paddingHorizontal: theme.spacing.xl, marginTop: theme.spacing.lg,
  },
  createBtnText: { color: '#fff', fontSize: theme.font.size.md, fontWeight: theme.font.weight.semibold },
});
