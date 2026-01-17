import { db } from './firebase';
import {
  collection,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  addDoc,
  query,
  where,
  getDocs,
  orderBy,
} from 'firebase/firestore';
import { User, Expense } from '@/types';

const USERS_COLLECTION = 'users';
const EXPENSES_COLLECTION = 'expenses';

export async function saveUser(user: User): Promise<void> {
  const userRef = doc(db, USERS_COLLECTION, user.id);
  await setDoc(userRef, {
    ...user,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  });
}

export async function getUser(userId: string): Promise<User | null> {
  const userRef = doc(db, USERS_COLLECTION, userId);
  const userSnap = await getDoc(userRef);

  if (userSnap.exists()) {
    const data = userSnap.data();
    return {
      ...data,
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt),
    } as User;
  }

  return null;
}

export async function updateUser(user: User): Promise<void> {
  const userRef = doc(db, USERS_COLLECTION, user.id);
  await updateDoc(userRef, {
    ...user,
    updatedAt: new Date().toISOString(),
  });
}

export async function addExpense(userId: string, expense: Omit<Expense, 'id' | 'date'>): Promise<Expense> {
  const expenseData = {
    ...expense,
    userId,
    date: new Date().toISOString(),
  };

  const expenseRef = await addDoc(collection(db, EXPENSES_COLLECTION), expenseData);

  return {
    id: expenseRef.id,
    ...expense,
    date: new Date(),
  };
}

export async function getUserExpenses(userId: string, month?: Date): Promise<Expense[]> {
  let q = query(
    collection(db, EXPENSES_COLLECTION),
    where('userId', '==', userId),
    orderBy('date', 'desc')
  );

  const querySnapshot = await getDocs(q);
  const expenses: Expense[] = [];

  querySnapshot.forEach((doc) => {
    const data = doc.data();
    const expense: Expense = {
      id: doc.id,
      envelopeId: data.envelopeId,
      amount: data.amount,
      description: data.description,
      date: new Date(data.date),
    };

    // Filter by month if specified
    if (!month || isSameMonth(expense.date, month)) {
      expenses.push(expense);
    }
  });

  return expenses;
}

function isSameMonth(date1: Date, date2: Date): boolean {
  return (
    date1.getMonth() === date2.getMonth() &&
    date1.getFullYear() === date2.getFullYear()
  );
}
