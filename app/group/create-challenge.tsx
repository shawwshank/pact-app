import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { addDoc, collection } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/auth';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { theme } from '@/constants/theme';

const UNIT_OPTIONS = ['hours', 'workouts', 'days', 'miles', 'sessions'];

export default function CreateChallengeScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const [title, setTitle] = useState('');
  const [target, setTarget] = useState('');
  const [unit, setUnit] = useState('hours');
  const [perCheckin, setPerCheckin] = useState('1');
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });

  async function handleCreate() {
    if (!title.trim()) { Alert.alert('Error', 'Enter a challenge title'); return; }
    if (!target || isNaN(Number(target))) { Alert.alert('Error', 'Enter a valid target number'); return; }
    if (!groupId) { Alert.alert('Error', 'No group selected'); return; }
    try {
      await addDoc(collection(db(), 'challenges'), {
        groupId,
        title: title.trim(),
        target: Number(target),
        unit,
        perCheckin: Number(perCheckin) || 1,
        current: 0,
        contributions: {},
        endDate,
        isActive: true,
        createdBy: user?.uid,
        createdAt: new Date(),
      });
      Alert.alert('Challenge Created! 🎯', '', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create a Challenge</Text>
      <Text style={styles.subtitle}>Set a group goal everyone contributes to</Text>

      <TextInput style={styles.input} placeholder="e.g. 60 hours of working out" placeholderTextColor={theme.colors.textMuted} value={title} onChangeText={setTitle} />

      <View style={styles.row}>
        <TextInput style={[styles.input, { flex: 1 }]} placeholder="Target" placeholderTextColor={theme.colors.textMuted} value={target} onChangeText={setTarget} keyboardType="numeric" />
        <View style={styles.unitPicker}>
          {UNIT_OPTIONS.map(u => (
            <TouchableOpacity key={u} style={[styles.unitBtn, unit === u && styles.unitBtnActive]} onPress={() => setUnit(u)}>
              <Text style={[styles.unitText, unit === u && styles.unitTextActive]}>{u}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <Text style={styles.label}>Per check-in contribution</Text>
      <TextInput style={styles.input} placeholder="1" placeholderTextColor={theme.colors.textMuted} value={perCheckin} onChangeText={setPerCheckin} keyboardType="numeric" />
      <Text style={styles.hint}>Each ✓ check-in adds {perCheckin || '1'} {unit} to the group total</Text>

      <Text style={styles.label}>End date</Text>
      <TextInput style={styles.input} placeholder="YYYY-MM-DD" placeholderTextColor={theme.colors.textMuted} value={endDate} onChangeText={setEndDate} />

      <TouchableOpacity style={styles.button} onPress={handleCreate} activeOpacity={0.8}>
        <Text style={styles.buttonText}>Create Challenge</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: theme.spacing.lg, backgroundColor: theme.colors.bg },
  title: { fontSize: theme.font.size.xl, fontWeight: theme.font.weight.bold, color: theme.colors.text, marginTop: theme.spacing.xl },
  subtitle: { fontSize: theme.font.size.md, color: theme.colors.textSecondary, marginTop: theme.spacing.xs, marginBottom: theme.spacing.xl },
  input: {
    borderWidth: 1, borderColor: theme.colors.cardBorder, borderRadius: theme.radius.md,
    padding: theme.spacing.md, fontSize: theme.font.size.md, backgroundColor: theme.colors.card,
    color: theme.colors.text, marginBottom: theme.spacing.md,
  },
  row: { gap: theme.spacing.sm, marginBottom: theme.spacing.sm },
  label: { fontSize: theme.font.size.sm, color: theme.colors.textSecondary, marginBottom: theme.spacing.xs },
  hint: { fontSize: theme.font.size.xs, color: theme.colors.textMuted, marginBottom: theme.spacing.lg, marginTop: -8 },
  unitPicker: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs, marginBottom: theme.spacing.md },
  unitBtn: { paddingHorizontal: theme.spacing.sm, paddingVertical: theme.spacing.xs, borderRadius: theme.radius.full, borderWidth: 1, borderColor: theme.colors.cardBorder },
  unitBtnActive: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
  unitText: { fontSize: theme.font.size.xs, color: theme.colors.textSecondary },
  unitTextActive: { color: '#fff' },
  button: { backgroundColor: theme.colors.accent, borderRadius: theme.radius.md, padding: theme.spacing.md, alignItems: 'center', marginTop: theme.spacing.md },
  buttonText: { color: '#fff', fontSize: theme.font.size.md, fontWeight: theme.font.weight.semibold },
});
