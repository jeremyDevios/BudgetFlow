import { db } from './firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  arrayUnion,
  Timestamp 
} from 'firebase/firestore';
import { UserProfile, Category, Expense, OnboardingData } from '@/types';

const USERS_COLLECTION = 'users';
const DEFAULT_USER_ID = 'default-user'; // For simplicity, using a single user

export async function createUserProfile(data: OnboardingData): Promise<UserProfile> {
  const userProfile: UserProfile = {
    id: DEFAULT_USER_ID,
    salary: data.salary,
    fixedCosts: data.fixedCosts,
    categories: data.categories.map((cat, index) => ({
      ...cat,
      id: `cat-${index}-${Date.now()}`,
      spent: 0,
    })),
    expenses: [],
    createdAt: new Date(),
  };

  await setDoc(doc(db, USERS_COLLECTION, DEFAULT_USER_ID), {
    ...userProfile,
    createdAt: Timestamp.fromDate(userProfile.createdAt),
  });

  return userProfile;
}

export async function getUserProfile(): Promise<UserProfile | null> {
  const docRef = doc(db, USERS_COLLECTION, DEFAULT_USER_ID);
  const docSnap = await getDoc(docRef);

  if (docSnap.exists()) {
    const data = docSnap.data();
    return {
      ...data,
      createdAt: data.createdAt.toDate(),
      expenses: data.expenses.map((exp: any) => ({
        ...exp,
        date: exp.date.toDate(),
      })),
    } as UserProfile;
  }

  return null;
}

export async function addExpense(categoryId: string, amount: number, description?: string): Promise<void> {
  const userProfile = await getUserProfile();
  if (!userProfile) throw new Error('User profile not found');

  const expense: Expense = {
    id: `exp-${Date.now()}`,
    categoryId,
    amount,
    description,
    date: new Date(),
  };

  // Update category spent amount
  const updatedCategories = userProfile.categories.map(cat =>
    cat.id === categoryId ? { ...cat, spent: cat.spent + amount } : cat
  );

  await updateDoc(doc(db, USERS_COLLECTION, DEFAULT_USER_ID), {
    categories: updatedCategories,
    expenses: arrayUnion({
      ...expense,
      date: Timestamp.fromDate(expense.date),
    }),
  });
}

// Local storage fallback for development without Firebase
export const localStorageService = {
  save(profile: UserProfile) {
    if (typeof window !== 'undefined') {
      localStorage.setItem('budgetflow-profile', JSON.stringify(profile));
    }
  },

  load(): UserProfile | null {
    if (typeof window !== 'undefined') {
      const data = localStorage.getItem('budgetflow-profile');
      if (data) {
        const profile = JSON.parse(data);
        return {
          ...profile,
          createdAt: new Date(profile.createdAt),
          expenses: profile.expenses.map((exp: any) => ({
            ...exp,
            date: new Date(exp.date),
          })),
        };
      }
    }
    return null;
  },

  clear() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('budgetflow-profile');
    }
  },
};
