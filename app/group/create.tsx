import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { collection, addDoc, arrayUnion, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'expo-router';

export default function CreateGroupScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [name, setName] = useState('');

  async function handleCreate() {
    if (!name.trim()) { Alert.alert('Error', 'Enter a group name'); return; }
    if (!user) { Alert.alert('Error', 'Not signed in'); return; }
    try {
      const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      const groupRef = await addDoc(collection(db(), 'groups'), {
        name: name.trim(),
        createdBy: user.uid,
        inviteCode,
        memberIds: [user.uid],
        createdAt: new Date(),
      });
      Alert.alert('Group Created!', `Invite code: ${inviteCode}`, [
        { text: 'OK', onPress: () => router.replace('/(tabs)') },
      ]);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create a Group</Text>
      <TextInput
        style={styles.input}
        placeholder='e.g. "Gym Bros"'
        value={name}
        onChangeText={setName}
      />
      <TouchableOpacity style={styles.button} onPress={handleCreate}>
        <Text style={styles.buttonText}>Create Group</Text>
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
  button: {
    backgroundColor: '#000', borderRadius: 8, padding: 16, alignItems: 'center',
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
