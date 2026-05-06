import { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { theme } from '@/constants/theme';

type Group = { id: string; name: string; memberIds: string[] };
type Challenge = { id: string; groupId: string; title: string; target: number; unit: string; current: number };

export default function GroupsScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [groups, setGroups] = useState<Group[]>([]);
  const [challenges, setChallenges] = useState<Record<string, Challenge>>({});

  useFocusEffect(useCallback(() => {
    if (!user) return;
    loadData();
  }, [user]));

  async function loadData() {
    if (!user) return;
    const gq = query(collection(db(), 'groups'), where('memberIds', 'array-contains', user.uid));
    const gSnap = await getDocs(gq);
    const g = gSnap.docs.map(d => ({ id: d.id, ...d.data() } as Group));
    setGroups(g);

    // Load active challenges
    const cMap: Record<string, Challenge> = {};
    for (const group of g) {
      const cq = query(collection(db(), 'challenges'), where('groupId', '==', group.id), where('isActive', '==', true));
      const cSnap = await getDocs(cq);
      if (!cSnap.empty) {
        const c = cSnap.docs[0];
        cMap[group.id] = { id: c.id, ...c.data() } as Challenge;
      }
    }
    setChallenges(cMap);
  }

  if (groups.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>👥</Text>
          <Text style={styles.emptyTitle}>No groups yet</Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => router.push('/group/create')}>
            <Text style={styles.primaryBtnText}>Create a Group</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.push('/group/join')}>
            <Text style={styles.secondaryBtnText}>Join with Code</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {groups.map(group => {
        const challenge = challenges[group.id];
        const progress = challenge ? Math.min(challenge.current / challenge.target, 1) : 0;
        return (
          <TouchableOpacity key={group.id} style={styles.card} onPress={() => router.push(`/group/${group.id}`)} activeOpacity={0.7}>
            <View style={styles.cardHeader}>
              <Text style={styles.groupName}>{group.name}</Text>
              <Text style={styles.memberCount}>{group.memberIds.length} 👤</Text>
            </View>
            {challenge && (
              <View style={styles.challengePreview}>
                <Text style={styles.challengeTitle}>🎯 {challenge.title}</Text>
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
                </View>
                <Text style={styles.progressText}>{challenge.current}/{challenge.target} {challenge.unit}</Text>
              </View>
            )}
            {!challenge && (
              <TouchableOpacity onPress={() => router.push(`/group/create-challenge?groupId=${group.id}`)}>
                <Text style={styles.createChallenge}>🎯 Set a group challenge →</Text>
                <Text style={styles.createChallengeSub}>Rally your team around a shared goal</Text>
              </TouchableOpacity>
            )}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  content: { padding: theme.spacing.lg },
  card: {
    backgroundColor: theme.colors.card, borderRadius: theme.radius.lg,
    padding: theme.spacing.lg, marginBottom: theme.spacing.md,
    borderWidth: 1, borderColor: theme.colors.cardBorder,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  groupName: { fontSize: theme.font.size.lg, fontWeight: theme.font.weight.bold, color: theme.colors.text },
  memberCount: { fontSize: theme.font.size.sm, color: theme.colors.textSecondary },
  challengePreview: { marginTop: theme.spacing.md },
  challengeTitle: { fontSize: theme.font.size.sm, color: theme.colors.textSecondary, marginBottom: theme.spacing.sm },
  progressBar: { height: 8, backgroundColor: theme.colors.cardBorder, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: theme.colors.success, borderRadius: 4 },
  progressText: { fontSize: theme.font.size.xs, color: theme.colors.textMuted, marginTop: theme.spacing.xs },
  noChallenge: { fontSize: theme.font.size.sm, color: theme.colors.textMuted, marginTop: theme.spacing.sm },
  createChallenge: { fontSize: theme.font.size.sm, color: theme.colors.accent, fontWeight: theme.font.weight.medium, marginTop: theme.spacing.md },
  createChallengeSub: { fontSize: theme.font.size.xs, color: theme.colors.textMuted, marginTop: 2 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: theme.spacing.xl },
  emptyIcon: { fontSize: 48, marginBottom: theme.spacing.md },
  emptyTitle: { fontSize: theme.font.size.xl, fontWeight: theme.font.weight.bold, color: theme.colors.text },
  primaryBtn: { backgroundColor: theme.colors.accent, borderRadius: theme.radius.md, paddingVertical: theme.spacing.md, paddingHorizontal: theme.spacing.xl, marginTop: theme.spacing.lg },
  primaryBtnText: { color: '#fff', fontSize: theme.font.size.md, fontWeight: theme.font.weight.semibold },
  secondaryBtn: { marginTop: theme.spacing.md },
  secondaryBtnText: { color: theme.colors.textSecondary, fontSize: theme.font.size.md },
});
