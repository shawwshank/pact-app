import { Stack } from 'expo-router';
import { theme } from '@/constants/theme';

export default function GroupLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.bg },
        headerTintColor: theme.colors.text,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: theme.colors.bg },
      }}
    >
      <Stack.Screen name="create" options={{ title: 'Create Group' }} />
      <Stack.Screen name="join" options={{ title: 'Join Group' }} />
      <Stack.Screen name="add-goal" options={{ title: 'Add Goal' }} />
      <Stack.Screen name="create-challenge" options={{ title: 'New Challenge' }} />
      <Stack.Screen name="[id]" options={{ title: '' }} />
    </Stack>
  );
}
