import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/auth';
import { theme } from '@/constants/theme';

type Goal = { id: string; title: string; frequency: string; groupId: string; userId: string };
type Group = { id: string; name: string; memberIds: string[] };
type MemberStats = { uid: string; name: string; completionRate: number; totalDone: number; totalGoals: number };

function getLastNDays(n: number): string[] {
  const dates: string[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
  }
  return dates;
}

export default function LeaderboardScreen() {
  const { user } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [rankings, setRankings] = useState<Record<string, MemberStats[]>>({});

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

    const last7 = getLastNDays(7);
    const rankMap: Record<string, MemberStats[]> = {};

    for (const group of g) {
      const stats: MemberStats[] = [];
      for (const memberId of group.memberIds) {
        // Get member name
        let name = memberId.slice(0, 5);
        try {
          const { getDoc, doc } = await import('firebase/firestore');
          const uDoc = await getDoc(doc(db(), 'users', memberId));
          if (uDoc.exists()) name = uDoc.data().displayName || name;
        } catch {}

        // Get check-ins for last 7 days
        const cq = query(
          collection(db(), 'checkins'),
          where('userId', '==', memberId),
          where('groupId', '==', group.id),
          where('date', '>=', last7[last7.length - 1]),
          where('date', '<=', last7[0]),
        );
        const cSnap = await getDocs(cq);
        const totalDone = cSnap.docs.filter(d => d.data().completed).length;
        const totalGoals = cSnap.docs.length || 1;

        stats.push({
          uid: memberId,
          name: memberId === user.uid ? 'You' : name,
          completionRate: Math.round((totalDone / Math.max(totalGoals, 1)) * 100),
          totalDone,
          totalGoals,
        });
      }
      // Sort by completion rate descending
      stats.sort((a, b) => b.completionRate - a.completionRate);
      rankMap[group.id] = stats;
    }
    setRankings(rankMap);
  }

  const medals = ['🥇', '🥈', '🥉'];

  if (groups.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>🏆</Text>
          <Text style={styles.emptyTitle}>No groups yet</Text>
          <Text style={styles.emptySub}>Join a group to see rankings</Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.period}>Last 7 days</Text>
      {groups.map(group => (
        <View key={group.id} style={styles.card}>
          <Text style={styles.groupName}>{group.name}</Text>
          {(rankings[group.id] || []).map((member, i) => (
            <View key={member.uid} style={styles.row}>
              <Text style={styles.rank}>{medals[i] || `${i + 1}`}</Text>
              <Text style={styles.name}>{member.name}</Text>
              <View style={styles.barContainer}>
                <View style={[styles.bar, { width: `${member.completionRate}%` }]} />
              </View>
              <Text style={styles.pct}>{member.completionRate}%</Text>
            </View>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  content: { padding: theme.spacing.lg },
  period: { fontSize: theme.font.size.sm, color: theme.colors.textMuted, marginBottom: theme.spacing.md, textTransform: 'uppercase', letterSpacing: 1 },
  card: {
    backgroundColor: theme.colors.card, borderRadius: theme.radius.lg,
    padding: theme.spacing.lg, marginBottom: theme.spacing.md,
    borderWidth: 1, borderColor: theme.colors.cardBorder,
  },
  groupName: { fontSize: theme.font.size.lg, fontWeight: theme.font.weight.bold, color: theme.colors.text, marginBottom: theme.spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing.md },
  rank: { width: 30, fontSize: theme.font.size.lg },
  name: { width: 60, fontSize: theme.font.size.sm, color: theme.colors.text },
  barContainer: {
    flex: 1, height: 8, backgroundColor: theme.colors.cardBorder,
    borderRadius: 4, marginHorizontal: theme.spacing.sm, overflow: 'hidden',
  },
  bar: { height: '100%', backgroundColor: theme.colors.success, borderRadius: 4 },
  pct: { width: 40, fontSize: theme.font.size.sm, color: theme.colors.textSecondary, textAlign: 'right' },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: theme.spacing.xl },
  emptyIcon: { fontSize: 48, marginBottom: theme.spacing.md },
  emptyTitle: { fontSize: theme.font.size.xl, fontWeight: theme.font.weight.bold, color: theme.colors.text },
  emptySub: { fontSize: theme.font.size.md, color: theme.colors.textSecondary, marginTop: theme.spacing.sm },
});
