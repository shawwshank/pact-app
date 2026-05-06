import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useAuth } from '@/lib/auth';
import { theme } from '@/constants/theme';

export default function WelcomeScreen() {
  const { signIn, signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);

  async function handleSubmit() {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter email and password');
      return;
    }
    try {
      if (isSignUp) {
        await signUp(email, password);
      } else {
        await signIn(email, password);
      }
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.logo}>Pact</Text>
      <Text style={styles.tagline}>Keep each other honest</Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor={theme.colors.textMuted}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor={theme.colors.textMuted}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <TouchableOpacity style={styles.button} onPress={handleSubmit} activeOpacity={0.8}>
        <Text style={styles.buttonText}>{isSignUp ? 'Sign Up' : 'Sign In'}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => setIsSignUp(!isSignUp)}>
        <Text style={styles.toggle}>
          {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: theme.spacing.lg, backgroundColor: theme.colors.bg },
  logo: {
    fontSize: theme.font.size.hero, fontWeight: theme.font.weight.heavy,
    color: theme.colors.text, textAlign: 'center',
  },
  tagline: {
    fontSize: theme.font.size.md, color: theme.colors.textSecondary,
    textAlign: 'center', marginBottom: theme.spacing.xxl,
  },
  input: {
    borderWidth: 1, borderColor: theme.colors.cardBorder, borderRadius: theme.radius.md,
    padding: theme.spacing.md, fontSize: theme.font.size.md, marginBottom: theme.spacing.md,
    backgroundColor: theme.colors.card, color: theme.colors.text,
  },
  button: {
    backgroundColor: theme.colors.accent, borderRadius: theme.radius.md,
    padding: theme.spacing.md, alignItems: 'center', marginTop: theme.spacing.sm,
  },
  buttonText: { color: '#fff', fontSize: theme.font.size.md, fontWeight: theme.font.weight.semibold },
  toggle: { textAlign: 'center', marginTop: theme.spacing.lg, color: theme.colors.textSecondary },
});
