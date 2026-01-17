'use client';

import { useState } from 'react';
import { User, Expense } from '@/types';
import { calculateBudget, formatCurrency } from '@/lib/budgetCalculations';

interface DashboardProps {
  user: User;
  expenses: Expense[];
  onAddExpense: (expense: Omit<Expense, 'id' | 'date'>) => void;
}

export default function Dashboard({ user, expenses, onAddExpense }: DashboardProps) {
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [newExpense, setNewExpense] = useState({
    envelopeId: '',
    amount: '',
    description: '',
  });

  const budget = calculateBudget(user, expenses);

  const handleAddExpense = () => {
    if (newExpense.envelopeId && newExpense.amount) {
      onAddExpense({
        envelopeId: newExpense.envelopeId,
        amount: parseFloat(newExpense.amount),
        description: newExpense.description,
      });
      setNewExpense({ envelopeId: '', amount: '', description: '' });
      setShowAddExpense(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <h1 className="text-2xl font-bold text-gray-800">BudgetFlow</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Reste à vivre Banner */}
        <div className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-2xl shadow-lg p-8 mb-8 text-white">
          <h2 className="text-lg font-medium mb-2">Reste à vivre ce mois</h2>
          <p className="text-5xl font-bold mb-4">{formatCurrency(budget.remainingToLive)}</p>
          <div className="flex gap-6 text-sm">
            <div>
              <p className="opacity-90">Revenus</p>
              <p className="font-semibold">{formatCurrency(budget.totalIncome)}</p>
            </div>
            <div>
              <p className="opacity-90">Frais fixes</p>
              <p className="font-semibold">-{formatCurrency(budget.fixedExpenses)}</p>
            </div>
            <div>
              <p className="opacity-90">Enveloppes</p>
              <p className="font-semibold">-{formatCurrency(budget.totalEnvelopeBudget)}</p>
            </div>
          </div>
        </div>

        {/* Envelopes Grid */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Mes Enveloppes</h2>
          <button
            onClick={() => setShowAddExpense(true)}
            className="bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-lg font-semibold shadow-md transition flex items-center gap-2"
          >
            <span className="text-xl">+</span>
            Ajouter une dépense
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {budget.envelopes.map((envelope) => (
            <div
              key={envelope.id}
              className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-4xl">{envelope.icon}</span>
                  <div>
                    <h3 className="font-bold text-gray-800 text-lg">{envelope.name}</h3>
                    <p className="text-sm text-gray-500">
                      {formatCurrency(envelope.spent)} / {formatCurrency(envelope.limit)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mb-3">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">Dépensé</span>
                  <span className="font-semibold" style={{ color: envelope.percentage > 100 ? '#ef4444' : envelope.color }}>
                    {envelope.percentage.toFixed(0)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min(envelope.percentage, 100)}%`,
                      backgroundColor: envelope.percentage > 100 ? '#ef4444' : envelope.color,
                    }}
                  ></div>
                </div>
              </div>

              {/* Remaining */}
              <div className="flex justify-between items-center pt-3 border-t border-gray-100">
                <span className="text-sm text-gray-600">Reste</span>
                <span className={`font-bold ${envelope.remaining < 0 ? 'text-red-500' : 'text-green-600'}`}>
                  {formatCurrency(envelope.remaining)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Add Expense Modal */}
      {showAddExpense && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Ajouter une dépense</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Catégorie
                </label>
                <select
                  value={newExpense.envelopeId}
                  onChange={(e) => setNewExpense({ ...newExpense, envelopeId: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Sélectionner une catégorie</option>
                  {user.envelopes.map((env) => (
                    <option key={env.id} value={env.id}>
                      {env.icon} {env.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Montant (€)
                </label>
                <input
                  type="number"
                  value={newExpense.amount}
                  onChange={(e) => setNewExpense({ ...newExpense, amount: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ex: 25.50"
                  step="0.01"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description (optionnelle)
                </label>
                <input
                  type="text"
                  value={newExpense.description}
                  onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ex: Achat supermarché"
                />
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  onClick={() => {
                    setShowAddExpense(false);
                    setNewExpense({ envelopeId: '', amount: '', description: '' });
                  }}
                  className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-300 transition"
                >
                  Annuler
                </button>
                <button
                  onClick={handleAddExpense}
                  disabled={!newExpense.envelopeId || !newExpense.amount}
                  className="flex-1 bg-blue-500 text-white py-3 rounded-lg font-semibold hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
                >
                  Ajouter
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
