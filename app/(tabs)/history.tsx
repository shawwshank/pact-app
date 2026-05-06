import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/auth';
import { theme } from '@/constants/theme';

type CheckinDay = { date: string; done: number; total: number };

function getLastNDays(n: number): string[] {
  const dates: string[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
  }
  return dates;
}

export default function HistoryScreen() {
  const { user } = useAuth();
  const [days, setDays] = useState<CheckinDay[]>([]);
  const [totalStreak, setTotalStreak] = useState(0);

  useEffect(() => {
    if (!user) return;
    loadHistory();
  }, [user]);

  async function loadHistory() {
    if (!user) return;
    const last30 = getLastNDays(30);

    // Get all goals
    const gq = query(collection(db(), 'goals'), where('userId', '==', user.uid), where('isActive', '==', true));
    const gSnap = await getDocs(gq);
    const goalCount = gSnap.size;
    if (goalCount === 0) { setDays([]); return; }

    // Get check-ins for last 30 days
    const cq = query(
      collection(db(), 'checkins'),
      where('userId', '==', user.uid),
      where('date', '>=', last30[last30.length - 1]),
      where('date', '<=', last30[0]),
    );
    const cSnap = await getDocs(cq);
    const checkinsByDate: Record<string, { done: number; total: number }> = {};
    cSnap.docs.forEach(d => {
      const data = d.data();
      if (!checkinsByDate[data.date]) checkinsByDate[data.date] = { done: 0, total: 0 };
      checkinsByDate[data.date].total++;
      if (data.completed) checkinsByDate[data.date].done++;
    });

    const result = last30.map(date => ({
      date,
      done: checkinsByDate[date]?.done || 0,
      total: checkinsByDate[date]?.total || 0,
    }));
    setDays(result);

    // Calculate streak
    let streak = 0;
    for (const day of result) {
      if (day.total > 0 && day.done === day.total) streak++;
      else if (day.total > 0) break;
      // Skip days with no check-ins (might be rest days or no goals yet)
    }
    setTotalStreak(streak);
  }

  const completionRate = days.length > 0
    ? Math.round((days.filter(d => d.total > 0 && d.done === d.total).length / Math.max(days.filter(d => d.total > 0).length, 1)) * 100)
    : 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>🔥 {totalStreak}</Text>
          <Text style={styles.statLabel}>Current Streak</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{completionRate}%</Text>
          <Text style={styles.statLabel}>30-Day Rate</Text>
        </View>
      </View>

      {/* Calendar heatmap */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Last 30 Days</Text>
        <View style={styles.grid}>
          {days.map(day => {
            const allDone = day.total > 0 && day.done === day.total;
            const partial = day.total > 0 && day.done > 0 && !allDone;
            const missed = day.total > 0 && day.done === 0;
            return (
              <View key={day.date} style={[
                styles.cell,
                allDone && styles.cellDone,
                partial && styles.cellPartial,
                missed && styles.cellMissed,
              ]} />
            );
          })}
        </View>
        <View style={styles.legend}>
          <View style={styles.legendItem}><View style={[styles.legendDot, styles.cellDone]} /><Text style={styles.legendText}>All done</Text></View>
          <View style={styles.legendItem}><View style={[styles.legendDot, styles.cellPartial]} /><Text style={styles.legendText}>Partial</Text></View>
          <View style={styles.legendItem}><View style={[styles.legendDot, styles.cellMissed]} /><Text style={styles.legendText}>Missed</Text></View>
          <View style={styles.legendItem}><View style={[styles.legendDot]} /><Text style={styles.legendText}>No data</Text></View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  content: { padding: theme.spacing.lg },
  statsRow: { flexDirection: 'row', gap: theme.spacing.md, marginBottom: theme.spacing.lg },
  stat: {
    flex: 1, backgroundColor: theme.colors.card, borderRadius: theme.radius.lg,
    padding: theme.spacing.lg, alignItems: 'center',
    borderWidth: 1, borderColor: theme.colors.cardBorder,
  },
  statValue: { fontSize: theme.font.size.xl, fontWeight: theme.font.weight.bold, color: theme.colors.text },
  statLabel: { fontSize: theme.font.size.xs, color: theme.colors.textSecondary, marginTop: theme.spacing.xs },
  card: {
    backgroundColor: theme.colors.card, borderRadius: theme.radius.lg,
    padding: theme.spacing.lg, borderWidth: 1, borderColor: theme.colors.cardBorder,
  },
  cardTitle: { fontSize: theme.font.size.md, fontWeight: theme.font.weight.semibold, color: theme.colors.text, marginBottom: theme.spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  cell: { width: 18, height: 18, borderRadius: 4, backgroundColor: theme.colors.cardBorder },
  cellDone: { backgroundColor: theme.colors.success },
  cellPartial: { backgroundColor: theme.colors.accent },
  cellMissed: { backgroundColor: theme.colors.danger + '60' },
  legend: { flexDirection: 'row', gap: theme.spacing.md, marginTop: theme.spacing.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 10, height: 10, borderRadius: 2, backgroundColor: theme.colors.cardBorder },
  legendText: { fontSize: theme.font.size.xs, color: theme.colors.textMuted },
});
