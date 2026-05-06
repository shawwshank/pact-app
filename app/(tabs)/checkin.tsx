import { StyleSheet, Text, View } from 'react-native';

export default function CheckInScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Check In</Text>
      <Text style={styles.subtitle}>Daily goal tracking will go here</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: 'bold' },
  subtitle: { fontSize: 16, color: '#666', marginTop: 8 },
});
