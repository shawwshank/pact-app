import { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { collection, query, where, getDocs, doc, getDoc, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/auth';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { theme } from '@/constants/theme';

type Group = { id: string; name: string; memberIds: string[]; inviteCode: string };
type Challenge = { id: string; groupId: string; title: string; target: number; unit: string; current: number; endDate: string; contributions: Record<string, number> };
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

function getLastNDays(n: number): string[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return localDateStr(d);
  });
}

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export default function GroupDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const [group, setGroup] = useState<Group | null>(null);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [rankings, setRankings] = useState<{ uid: string; name: string; rate: number }[]>([]);
  const weekDates = getWeekDates();
  const today = localDateStr(new Date());

  useFocusEffect(useCallback(() => {
    if (!user || !id) return;
    loadData();
  }, [user, id]));

  async function loadData() {
    if (!user || !id) return;

    // Load group
    const gDoc = await getDoc(doc(db(), 'groups', id));
    if (!gDoc.exists()) return;
    const g = { id: gDoc.id, ...gDoc.data() } as Group;
    setGroup(g);

    // Load names
    const nameMap: Record<string, string> = {};
    for (const uid of g.memberIds) {
      try {
        const uDoc = await getDoc(doc(db(), 'users', uid));
        nameMap[uid] = uDoc.exists() ? uDoc.data().displayName || uid.slice(0, 5) : uid.slice(0, 5);
      } catch { nameMap[uid] = uid.slice(0, 5); }
    }
    setNames(nameMap);

    // Load challenge
    const cq = query(collection(db(), 'challenges'), where('groupId', '==', id), where('isActive', '==', true));
    const cSnap = await getDocs(cq);
    if (!cSnap.empty) {
      setChallenge({ id: cSnap.docs[0].id, ...cSnap.docs[0].data() } as Challenge);
    }

    // Load week's check-ins
    const checkQ = query(
      collection(db(), 'checkins'),
      where('groupId', '==', id),
      where('date', '>=', weekDates[0]),
      where('date', '<=', weekDates[6]),
    );
    const checkSnap = await getDocs(checkQ);
    setCheckins(checkSnap.docs.map(d => d.data() as Checkin));

    // Calculate rankings (last 7 days)
    const last7 = getLastNDays(7);
    const ranks: { uid: string; name: string; rate: number }[] = [];
    for (const uid of g.memberIds) {
      const memberCheckins = checkSnap.docs.filter(d => d.data().userId === uid);
      const done = memberCheckins.filter(d => d.data().completed).length;
      const total = memberCheckins.length || 1;
      ranks.push({ uid, name: uid === user.uid ? 'You' : (nameMap[uid] || uid.slice(0, 5)), rate: Math.round((done / total) * 100) });
    }
    ranks.sort((a, b) => b.rate - a.rate);
    setRankings(ranks);
  }

  async function sendNudge(toUserId: string) {
    if (!user) return;
    await addDoc(collection(db(), 'nudges'), {
      fromUserId: user.uid, toUserId,
      fromName: user.displayName || 'Someone',
      date: today, createdAt: new Date(),
    });
    Alert.alert('Nudged!', `${names[toUserId]} will see your nudge 👀`);
  }

  function getMemberStatus(memberId: string, date: string): '✓' | '✗' | '·' {
    const mc = checkins.filter(c => c.userId === memberId && c.date === date);
    if (mc.length === 0) return '·';
    return mc.every(c => c.completed) ? '✓' : '✗';
  }

  if (!group) return <View style={styles.container} />;

  const medals = ['🥇', '🥈', '🥉'];
  const daysLeft = challenge?.endDate ? Math.max(0, Math.ceil((new Date(challenge.endDate).getTime() - Date.now()) / 86400000)) : 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Challenge */}
      {challenge ? (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>CHALLENGE</Text>
          <Text style={styles.challengeTitle}>🎯 {challenge.title}</Text>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${Math.min((challenge.current / challenge.target) * 100, 100)}%` }]} />
          </View>
          <Text style={styles.progressText}>{challenge.current}/{challenge.target} {challenge.unit} · {daysLeft} days left</Text>
          {challenge.contributions && Object.keys(challenge.contributions).length > 0 && (
            <View style={styles.contributions}>
              {Object.entries(challenge.contributions).sort((a, b) => b[1] - a[1]).map(([uid, amount]) => (
                <Text key={uid} style={styles.contribText}>
                  {uid === user?.uid ? 'You' : (names[uid] || uid.slice(0, 5))}: {amount} {challenge.unit}
                </Text>
              ))}
            </View>
          )}
        </View>
      ) : (
        <TouchableOpacity style={styles.section} onPress={() => router.push(`/group/create-challenge?groupId=${id}`)}>
          <Text style={styles.createChallengeText}>+ Create a Challenge</Text>
        </TouchableOpacity>
      )}

      {/* Weekly Grid */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>THIS WEEK</Text>
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
                const status = getMemberStatus(memberId, date);
                return (
                  <View key={i} style={styles.dayCol}>
                    <View style={[styles.dot, status === '✓' && styles.dotDone, status === '✗' && styles.dotMissed]}>
                      {status !== '·' && <Text style={styles.dotText}>{status}</Text>}
                    </View>
                  </View>
                );
              })}
            </View>
          ))}
        </View>
      </View>

      {/* Leaderboard */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>LEADERBOARD (7 DAYS)</Text>
        {rankings.map((r, i) => (
          <View key={r.uid} style={styles.rankRow}>
            <Text style={styles.rankMedal}>{medals[i] || `${i + 1}`}</Text>
            <Text style={styles.rankName}>{r.name}</Text>
            <View style={styles.rankBarContainer}>
              <View style={[styles.rankBar, { width: `${r.rate}%` }]} />
            </View>
            <Text style={styles.rankPct}>{r.rate}%</Text>
          </View>
        ))}
      </View>

      {/* Members */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>MEMBERS ({group.memberIds.length})</Text>
        {group.memberIds.map(memberId => {
          const hasCheckedIn = getMemberStatus(memberId, today) !== '·';
          return (
            <View key={memberId} style={styles.memberRow}>
              <Text style={styles.memberRowName}>
                {memberId === user?.uid ? 'You' : (names[memberId] || '...')}
              </Text>
              {memberId !== user?.uid && !hasCheckedIn && (
                <TouchableOpacity style={styles.nudgeBtn} onPress={() => sendNudge(memberId)}>
                  <Text style={styles.nudgeBtnText}>👉 Nudge</Text>
                </TouchableOpacity>
              )}
              {hasCheckedIn && <Text style={styles.checkedIn}>✓</Text>}
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  content: { padding: theme.spacing.lg },
  section: {
    backgroundColor: theme.colors.card, borderRadius: theme.radius.lg,
    padding: theme.spacing.lg, marginBottom: theme.spacing.md,
    borderWidth: 1, borderColor: theme.colors.cardBorder,
  },
  sectionLabel: { fontSize: theme.font.size.xs, fontWeight: theme.font.weight.semibold, color: theme.colors.textMuted, letterSpacing: 1, marginBottom: theme.spacing.md },
  challengeTitle: { fontSize: theme.font.size.lg, fontWeight: theme.font.weight.bold, color: theme.colors.text, marginBottom: theme.spacing.md },
  progressBar: { height: 10, backgroundColor: theme.colors.cardBorder, borderRadius: 5, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: theme.colors.success, borderRadius: 5 },
  progressText: { fontSize: theme.font.size.sm, color: theme.colors.textSecondary, marginTop: theme.spacing.sm },
  contributions: { marginTop: theme.spacing.md },
  contribText: { fontSize: theme.font.size.sm, color: theme.colors.textSecondary, marginBottom: 2 },
  createChallengeText: { color: theme.colors.accent, fontSize: theme.font.size.md, fontWeight: theme.font.weight.medium, textAlign: 'center' },
  // Grid
  table: { gap: theme.spacing.sm },
  tableRow: { flexDirection: 'row', alignItems: 'center' },
  nameCol: { width: 50 },
  memberName: { fontSize: theme.font.size.xs, color: theme.colors.textSecondary },
  dayCol: { flex: 1, alignItems: 'center' },
  dayLabel: { fontSize: theme.font.size.xs, color: theme.colors.textMuted, fontWeight: theme.font.weight.medium },
  dayLabelToday: { color: theme.colors.accent, fontWeight: theme.font.weight.bold },
  dot: { width: 28, height: 28, borderRadius: 14, backgroundColor: theme.colors.cardBorder, alignItems: 'center', justifyContent: 'center' },
  dotDone: { backgroundColor: theme.colors.success },
  dotMissed: { backgroundColor: theme.colors.danger },
  dotText: { color: '#fff', fontSize: 12, fontWeight: theme.font.weight.bold },
  // Leaderboard
  rankRow: { flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing.sm },
  rankMedal: { width: 28, fontSize: theme.font.size.md },
  rankName: { width: 55, fontSize: theme.font.size.sm, color: theme.colors.text },
  rankBarContainer: { flex: 1, height: 8, backgroundColor: theme.colors.cardBorder, borderRadius: 4, marginHorizontal: theme.spacing.sm, overflow: 'hidden' },
  rankBar: { height: '100%', backgroundColor: theme.colors.success, borderRadius: 4 },
  rankPct: { width: 38, fontSize: theme.font.size.sm, color: theme.colors.textSecondary, textAlign: 'right' },
  // Members
  memberRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: theme.spacing.sm, borderTopWidth: 1, borderTopColor: theme.colors.cardBorder },
  memberRowName: { fontSize: theme.font.size.md, color: theme.colors.text },
  nudgeBtn: { backgroundColor: theme.colors.accent + '20', borderRadius: theme.radius.full, paddingHorizontal: theme.spacing.sm, paddingVertical: theme.spacing.xs },
  nudgeBtnText: { fontSize: theme.font.size.sm, color: theme.colors.accentLight },
  checkedIn: { color: theme.colors.success, fontSize: theme.font.size.md },
});
