'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { OnboardingData } from '@/types';
import { createUserProfile } from '@/lib/dataService';

const DEFAULT_CATEGORIES = [
  { name: 'Alimentation', icon: '🍔', limit: 0, color: '#10b981' },
  { name: 'Transport', icon: '🚗', limit: 0, color: '#3b82f6' },
  { name: 'Loisirs', icon: '🎮', limit: 0, color: '#8b5cf6' },
  { name: 'Santé', icon: '💊', limit: 0, color: '#ef4444' },
  { name: 'Logement', icon: '🏠', limit: 0, color: '#f59e0b' },
  { name: 'Autres', icon: '📦', limit: 0, color: '#6b7280' },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [salary, setSalary] = useState<number>(0);
  const [fixedCosts, setFixedCosts] = useState<number>(0);
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);

  const availableBudget = salary - fixedCosts;
  const totalLimits = categories.reduce((sum, cat) => sum + cat.limit, 0);
  const remainingBudget = availableBudget - totalLimits;

  const handleCategoryLimitChange = (index: number, limit: number) => {
    const updated = [...categories];
    updated[index].limit = limit;
    setCategories(updated);
  };

  const handleSubmit = async () => {
    const data: OnboardingData = {
      salary,
      fixedCosts,
      categories,
    };

    // Create user profile using the data service
    await createUserProfile(data);
    router.push('/dashboard');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Bienvenue sur BudgetFlow
            </h1>
            <p className="text-gray-600">
              Configurons votre budget en quelques étapes simples
            </p>
          </div>

          {/* Progress indicator */}
          <div className="flex items-center justify-between mb-8">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center flex-1">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                    s <= step
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-200 text-gray-600'
                  }`}
                >
                  {s}
                </div>
                {s < 3 && (
                  <div
                    className={`flex-1 h-1 mx-2 ${
                      s < step ? 'bg-indigo-600' : 'bg-gray-200'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Step 1: Salary */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <label className="block text-lg font-medium text-gray-900 mb-3">
                  Quel est votre salaire mensuel net ?
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={salary || ''}
                    onChange={(e) => setSalary(Number(e.target.value))}
                    className="w-full px-4 py-3 text-2xl border-2 border-gray-300 rounded-lg focus:outline-none focus:border-indigo-600"
                    placeholder="0"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-2xl text-gray-400">
                    €
                  </span>
                </div>
              </div>
              <button
                onClick={() => setStep(2)}
                disabled={salary <= 0}
                className="w-full py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
              >
                Continuer
              </button>
            </div>
          )}

          {/* Step 2: Fixed Costs */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <label className="block text-lg font-medium text-gray-900 mb-3">
                  Quels sont vos frais fixes mensuels ?
                </label>
                <p className="text-sm text-gray-600 mb-3">
                  (Loyer, assurances, abonnements, etc.)
                </p>
                <div className="relative">
                  <input
                    type="number"
                    value={fixedCosts || ''}
                    onChange={(e) => setFixedCosts(Number(e.target.value))}
                    className="w-full px-4 py-3 text-2xl border-2 border-gray-300 rounded-lg focus:outline-none focus:border-indigo-600"
                    placeholder="0"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-2xl text-gray-400">
                    €
                  </span>
                </div>
                {salary > 0 && (
                  <p className="mt-3 text-gray-600">
                    Budget disponible : <span className="font-semibold text-indigo-600">{availableBudget}€</span>
                  </p>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition"
                >
                  Retour
                </button>
                <button
                  onClick={() => setStep(3)}
                  disabled={fixedCosts < 0 || fixedCosts > salary}
                  className="flex-1 py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
                >
                  Continuer
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Categories */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <label className="block text-lg font-medium text-gray-900 mb-3">
                  Définissez vos enveloppes budgétaires
                </label>
                <p className="text-sm text-gray-600 mb-4">
                  Budget disponible : <span className="font-semibold text-indigo-600">{availableBudget}€</span>
                  {' | '}
                  Restant : <span className={`font-semibold ${remainingBudget < 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {remainingBudget}€
                  </span>
                </p>
              </div>

              <div className="space-y-3">
                {categories.map((category, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 p-3 border-2 border-gray-200 rounded-lg hover:border-indigo-300 transition"
                  >
                    <span className="text-3xl">{category.icon}</span>
                    <span className="flex-1 font-medium text-gray-900">
                      {category.name}
                    </span>
                    <div className="relative w-32">
                      <input
                        type="number"
                        value={category.limit || ''}
                        onChange={(e) =>
                          handleCategoryLimitChange(index, Number(e.target.value))
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-indigo-600"
                        placeholder="0"
                        min="0"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                        €
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(2)}
                  className="flex-1 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition"
                >
                  Retour
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={remainingBudget < 0 || totalLimits === 0}
                  className="flex-1 py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
                >
                  Terminer
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
