'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { UserProfile, Category } from '@/types';
import { localStorageService } from '@/lib/dataService';
import AddExpenseModal from '@/components/AddExpenseModal';
import CategoryCard from '@/components/CategoryCard';

export default function DashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadProfile = () => {
      const data = localStorageService.load();
      if (!data) {
        router.push('/onboarding');
        return;
      }
      setProfile(data);
      setLoading(false);
    };

    loadProfile();
  }, [router]);

  const handleAddExpense = (categoryId: string, amount: number, description?: string) => {
    if (!profile) return;

    const expense = {
      id: `exp-${Date.now()}`,
      categoryId,
      amount,
      description,
      date: new Date(),
    };

    const updatedCategories = profile.categories.map(cat =>
      cat.id === categoryId ? { ...cat, spent: cat.spent + amount } : cat
    );

    const updatedProfile = {
      ...profile,
      categories: updatedCategories,
      expenses: [...profile.expenses, expense],
    };

    localStorageService.save(updatedProfile);
    setProfile(updatedProfile);
    setIsModalOpen(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-xl text-gray-600">Chargement...</div>
      </div>
    );
  }

  if (!profile) {
    return null;
  }

  const totalSpent = profile.categories.reduce((sum, cat) => sum + cat.spent, 0);
  const totalBudget = profile.categories.reduce((sum, cat) => sum + cat.limit, 0);
  const remaining = totalBudget - totalSpent;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">BudgetFlow</h1>
              <p className="text-gray-600 mt-1">Votre budget du mois</p>
            </div>
            <button
              onClick={() => {
                if (confirm('Êtes-vous sûr de vouloir réinitialiser votre budget ?')) {
                  localStorageService.clear();
                  router.push('/onboarding');
                }
              }}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              Réinitialiser
            </button>
          </div>
        </div>
      </header>

      {/* Summary */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-xl shadow-md p-6">
            <p className="text-sm text-gray-600 mb-1">Budget Total</p>
            <p className="text-3xl font-bold text-gray-900">{totalBudget}€</p>
          </div>
          <div className="bg-white rounded-xl shadow-md p-6">
            <p className="text-sm text-gray-600 mb-1">Dépensé</p>
            <p className="text-3xl font-bold text-indigo-600">{totalSpent}€</p>
          </div>
          <div className="bg-white rounded-xl shadow-md p-6">
            <p className="text-sm text-gray-600 mb-1">Restant</p>
            <p className={`text-3xl font-bold ${remaining < 0 ? 'text-red-600' : 'text-green-600'}`}>
              {remaining}€
            </p>
          </div>
        </div>

        {/* Categories Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {profile.categories.map((category) => (
            <CategoryCard key={category.id} category={category} />
          ))}
        </div>
      </div>

      {/* Add Expense Button */}
      <button
        onClick={() => setIsModalOpen(true)}
        className="fixed bottom-8 right-8 w-16 h-16 bg-indigo-600 text-white rounded-full shadow-lg hover:bg-indigo-700 transition-all hover:scale-110 flex items-center justify-center text-3xl"
        aria-label="Ajouter une dépense"
      >
        +
      </button>

      {/* Add Expense Modal */}
      {isModalOpen && (
        <AddExpenseModal
          categories={profile.categories}
          onClose={() => setIsModalOpen(false)}
          onSubmit={handleAddExpense}
        />
      )}
    </div>
  );
}
