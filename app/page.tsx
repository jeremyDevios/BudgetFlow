'use client';

import { useState, useEffect } from 'react';
import Onboarding from '@/components/Onboarding';
import Dashboard from '@/components/Dashboard';
import { User, Expense } from '@/types';
import { saveUser, getUser, addExpense, getUserExpenses } from '@/lib/firebaseService';

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  // Check for existing user in localStorage
  useEffect(() => {
    const loadUser = async () => {
      const userId = localStorage.getItem('budgetFlowUserId');
      
      if (userId) {
        try {
          const userData = await getUser(userId);
          if (userData) {
            setUser(userData);
            const userExpenses = await getUserExpenses(userId, new Date());
            setExpenses(userExpenses);
          } else {
            localStorage.removeItem('budgetFlowUserId');
          }
        } catch (error) {
          console.error('Error loading user:', error);
          // If Firebase is not configured, use local storage as fallback
          const localUser = localStorage.getItem('budgetFlowUser');
          if (localUser) {
            const parsedUser = JSON.parse(localUser);
            parsedUser.createdAt = new Date(parsedUser.createdAt);
            parsedUser.updatedAt = new Date(parsedUser.updatedAt);
            setUser(parsedUser);
            
            const localExpenses = localStorage.getItem('budgetFlowExpenses');
            if (localExpenses) {
              const parsedExpenses = JSON.parse(localExpenses);
              parsedExpenses.forEach((exp: Expense) => {
                exp.date = new Date(exp.date);
              });
              setExpenses(parsedExpenses);
            }
          }
        }
      }
      
      setLoading(false);
    };

    loadUser();
  }, []);

  const handleOnboardingComplete = async (newUser: User) => {
    try {
      // Try Firebase with a timeout
      await Promise.race([
        saveUser(newUser),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Firebase timeout')), 3000))
      ]);
      localStorage.setItem('budgetFlowUserId', newUser.id);
      localStorage.setItem('budgetFlowUser', JSON.stringify(newUser));
      setUser(newUser);
    } catch (error) {
      console.error('Error saving user, using localStorage:', error);
      // Fallback to localStorage if Firebase fails
      localStorage.setItem('budgetFlowUserId', newUser.id);
      localStorage.setItem('budgetFlowUser', JSON.stringify(newUser));
      setUser(newUser);
    }
  };

  const handleAddExpense = async (expense: Omit<Expense, 'id' | 'date'>) => {
    if (!user) return;

    try {
      // Try Firebase with a timeout
      const newExpense = await Promise.race([
        addExpense(user.id, expense),
        new Promise<Expense>((_, reject) => setTimeout(() => reject(new Error('Firebase timeout')), 3000))
      ]);
      setExpenses([...expenses, newExpense]);
      localStorage.setItem('budgetFlowExpenses', JSON.stringify([...expenses, newExpense]));
    } catch (error) {
      console.error('Error adding expense, using localStorage:', error);
      // Fallback to localStorage if Firebase fails
      const newExpense: Expense = {
        id: Date.now().toString(),
        ...expense,
        date: new Date(),
      };
      const updatedExpenses = [...expenses, newExpense];
      setExpenses(updatedExpenses);
      localStorage.setItem('budgetFlowExpenses', JSON.stringify(updatedExpenses));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Onboarding onComplete={handleOnboardingComplete} />;
  }

  return <Dashboard user={user} expenses={expenses} onAddExpense={handleAddExpense} />;
}
