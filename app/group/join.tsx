import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { collection, query, where, getDocs, updateDoc, doc, arrayUnion } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'expo-router';
import { theme } from '@/constants/theme';

export default function JoinGroupScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [code, setCode] = useState('');

  async function handleJoin() {
    if (!code.trim() || !user) return;
    try {
      const q = query(collection(db(), 'groups'), where('inviteCode', '==', code.trim().toUpperCase()));
      const snap = await getDocs(q);
      if (snap.empty) {
        Alert.alert('Not Found', 'No group with that invite code.');
        return;
      }
      const groupDoc = snap.docs[0];
      const groupData = groupDoc.data();
      if (groupData.memberIds.includes(user.uid)) {
        Alert.alert('Already Joined', "You're already in this group.");
        return;
      }
      await updateDoc(doc(db(), 'groups', groupDoc.id), {
        memberIds: arrayUnion(user.uid),
      });
      Alert.alert('Joined!', `You're now in "${groupData.name}"`, [
        { text: 'OK', onPress: () => router.replace('/(tabs)') },
      ]);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Join a Group</Text>
      <Text style={styles.subtitle}>Enter the invite code your friend shared</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. ABC123"
        placeholderTextColor={theme.colors.textMuted}
        value={code}
        onChangeText={setCode}
        autoCapitalize="characters"
        maxLength={6}
      />
      <TouchableOpacity style={styles.button} onPress={handleJoin} activeOpacity={0.8}>
        <Text style={styles.buttonText}>Join Group</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: theme.spacing.lg, justifyContent: 'center', backgroundColor: theme.colors.bg },
  title: { fontSize: theme.font.size.xl, fontWeight: theme.font.weight.bold, color: theme.colors.text },
  subtitle: { fontSize: theme.font.size.md, color: theme.colors.textSecondary, marginTop: theme.spacing.sm, marginBottom: theme.spacing.xl },
  input: {
    borderWidth: 1, borderColor: theme.colors.cardBorder, borderRadius: theme.radius.md,
    padding: theme.spacing.md, fontSize: theme.font.size.xl, backgroundColor: theme.colors.card,
    color: theme.colors.text, textAlign: 'center', letterSpacing: 4,
  },
  button: {
    backgroundColor: theme.colors.accent, borderRadius: theme.radius.md,
    padding: theme.spacing.md, alignItems: 'center', marginTop: theme.spacing.lg,
  },
  buttonText: { color: '#fff', fontSize: theme.font.size.md, fontWeight: theme.font.weight.semibold },
});
