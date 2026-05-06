import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from './firebase';

export async function calculateStreak(userId: string, goalId: string): Promise<number> {
  const q = query(
    collection(db(), 'checkins'),
    where('userId', '==', userId),
    where('goalId', '==', goalId),
    where('completed', '==', true),
    orderBy('date', 'desc'),
  );
  const snap = await getDocs(q);
  if (snap.empty) return 0;

  const dates = snap.docs.map(d => d.data().date as string);
  let streak = 0;
  const today = new Date();

  for (let i = 0; i <= dates.length; i++) {
    const expected = new Date(today);
    expected.setDate(today.getDate() - i);
    const expectedStr = expected.toISOString().split('T')[0];

    if (dates.includes(expectedStr)) {
      streak++;
    } else if (i === 0) {
      // Today hasn't been checked in yet — that's ok, check from yesterday
      continue;
    } else {
      break;
    }
  }

  return streak;
}
