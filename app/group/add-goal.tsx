import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/auth';
import { useRouter, useLocalSearchParams } from 'expo-router';

export default function AddGoalScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const [title, setTitle] = useState('');
  const [frequency, setFrequency] = useState<'daily' | 'weekly'>('daily');

  async function handleAdd() {
    if (!title.trim() || !user || !groupId) return;
    try {
      await addDoc(collection(db, 'goals'), {
        userId: user.uid,
        groupId,
        title: title.trim(),
        frequency,
        restDays: [],
        isActive: true,
        createdAt: new Date(),
      });
      Alert.alert('Goal Added!', '', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Add a Goal</Text>
      <TextInput
        style={styles.input}
        placeholder='e.g. "Work out"'
        value={title}
        onChangeText={setTitle}
      />
      <View style={styles.row}>
        <TouchableOpacity
          style={[styles.freq, frequency === 'daily' && styles.freqActive]}
          onPress={() => setFrequency('daily')}>
          <Text style={frequency === 'daily' ? styles.freqTextActive : styles.freqText}>Daily</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.freq, frequency === 'weekly' && styles.freqActive]}
          onPress={() => setFrequency('weekly')}>
          <Text style={frequency === 'weekly' ? styles.freqTextActive : styles.freqText}>Weekly</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity style={styles.button} onPress={handleAdd}>
        <Text style={styles.buttonText}>Add Goal</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 24 },
  input: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 8,
    padding: 14, fontSize: 16, marginBottom: 16,
  },
  row: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  freq: {
    flex: 1, padding: 12, borderRadius: 8, borderWidth: 1,
    borderColor: '#ddd', alignItems: 'center',
  },
  freqActive: { backgroundColor: '#000', borderColor: '#000' },
  freqText: { fontSize: 16 },
  freqTextActive: { fontSize: 16, color: '#fff', fontWeight: '600' },
  button: {
    backgroundColor: '#000', borderRadius: 8, padding: 16, alignItems: 'center',
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
