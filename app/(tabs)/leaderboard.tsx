import { View, Text, StyleSheet } from 'react-native';
import { theme } from '@/constants/theme';

export default function LeaderboardScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>🏆</Text>
      <Text style={styles.title}>Leaderboard</Text>
      <Text style={styles.subtitle}>Coming soon</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.bg },
  icon: { fontSize: 48, marginBottom: theme.spacing.md },
  title: { fontSize: theme.font.size.xl, fontWeight: theme.font.weight.bold, color: theme.colors.text },
  subtitle: { fontSize: theme.font.size.md, color: theme.colors.textSecondary, marginTop: theme.spacing.sm },
});
