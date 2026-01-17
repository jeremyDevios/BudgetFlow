import { useState } from 'react';
import { Category } from '@/types';

interface AddExpenseModalProps {
  categories: Category[];
  onClose: () => void;
  onSubmit: (categoryId: string, amount: number, description?: string) => void;
}

export default function AddExpenseModal({ categories, onClose, onSubmit }: AddExpenseModalProps) {
  const [categoryId, setCategoryId] = useState(categories[0]?.id || '');
  const [amount, setAmount] = useState<number>(0);
  const [description, setDescription] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (categoryId && amount > 0) {
      onSubmit(categoryId, amount, description || undefined);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Ajouter une dépense</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
            aria-label="Fermer"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Category Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Catégorie
            </label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-indigo-600"
              required
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.icon} {category.name}
                </option>
              ))}
            </select>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Montant
            </label>
            <div className="relative">
              <input
                type="number"
                value={amount === 0 ? '' : amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="w-full px-4 py-3 text-xl border-2 border-gray-300 rounded-lg focus:outline-none focus:border-indigo-600"
                placeholder="0"
                min="0.01"
                step="0.01"
                required
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xl text-gray-400">
                €
              </span>
            </div>
          </div>

          {/* Description (Optional) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description (optionnel)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-indigo-600"
              placeholder="Ex: Restaurant, Essence..."
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={!categoryId || amount <= 0}
              className="flex-1 py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
            >
              Ajouter
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
