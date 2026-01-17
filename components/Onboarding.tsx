'use client';

import { useState } from 'react';
import { User, Envelope } from '@/types';

interface OnboardingProps {
  onComplete: (user: User) => void;
}

export default function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState(1);
  const [monthlySalary, setMonthlySalary] = useState('');
  const [fixedExpenses, setFixedExpenses] = useState('');
  const [envelopes, setEnvelopes] = useState<Envelope[]>([]);
  const [newEnvelope, setNewEnvelope] = useState({
    name: '',
    icon: '💰',
    monthlyLimit: '',
    color: '#3b82f6',
  });

  const icons = ['💰', '🛒', '⛽', '🎮', '🍔', '🏠', '🚗', '💊', '🎉', '🎯'];
  const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

  const handleAddEnvelope = () => {
    if (newEnvelope.name && newEnvelope.monthlyLimit) {
      const envelope: Envelope = {
        id: Date.now().toString(),
        name: newEnvelope.name,
        icon: newEnvelope.icon,
        monthlyLimit: parseFloat(newEnvelope.monthlyLimit),
        spent: 0,
        color: newEnvelope.color,
      };
      setEnvelopes([...envelopes, envelope]);
      setNewEnvelope({ name: '', icon: '💰', monthlyLimit: '', color: '#3b82f6' });
    }
  };

  const handleRemoveEnvelope = (id: string) => {
    setEnvelopes(envelopes.filter(env => env.id !== id));
  };

  const handleComplete = () => {
    if (monthlySalary && fixedExpenses && envelopes.length > 0) {
      const user: User = {
        id: Date.now().toString(),
        monthlySalary: parseFloat(monthlySalary),
        fixedExpenses: parseFloat(fixedExpenses),
        envelopes,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      onComplete(user);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-2xl w-full">
        <h1 className="text-3xl font-bold text-gray-800 mb-6">Configuration de BudgetFlow</h1>
        
        {/* Progress indicator */}
        <div className="flex items-center mb-8">
          <div className={`flex items-center justify-center w-10 h-10 rounded-full ${step >= 1 ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}>1</div>
          <div className={`flex-1 h-1 mx-2 ${step >= 2 ? 'bg-blue-500' : 'bg-gray-200'}`}></div>
          <div className={`flex items-center justify-center w-10 h-10 rounded-full ${step >= 2 ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}>2</div>
          <div className={`flex-1 h-1 mx-2 ${step >= 3 ? 'bg-blue-500' : 'bg-gray-200'}`}></div>
          <div className={`flex items-center justify-center w-10 h-10 rounded-full ${step >= 3 ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}>3</div>
        </div>

        {step === 1 && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-700">Étape 1: Revenus</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Salaire mensuel (€)
              </label>
              <input
                type="number"
                value={monthlySalary}
                onChange={(e) => setMonthlySalary(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Ex: 2500"
              />
            </div>
            <button
              onClick={() => monthlySalary && setStep(2)}
              disabled={!monthlySalary}
              className="w-full bg-blue-500 text-white py-3 rounded-lg font-semibold hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
            >
              Continuer
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-700">Étape 2: Frais fixes</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Dépenses fixes mensuelles (€)
              </label>
              <input
                type="number"
                value={fixedExpenses}
                onChange={(e) => setFixedExpenses(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Ex: 1200 (loyer, assurances, etc.)"
              />
            </div>
            <div className="flex gap-4">
              <button
                onClick={() => setStep(1)}
                className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-300 transition"
              >
                Retour
              </button>
              <button
                onClick={() => fixedExpenses && setStep(3)}
                disabled={!fixedExpenses}
                className="flex-1 bg-blue-500 text-white py-3 rounded-lg font-semibold hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
              >
                Continuer
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-700">Étape 3: Créer vos enveloppes</h2>
            
            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-sm text-gray-700">
                Budget disponible pour les enveloppes: <span className="font-bold">{((parseFloat(monthlySalary) || 0) - (parseFloat(fixedExpenses) || 0)).toFixed(2)} €</span>
              </p>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Nom de la catégorie</label>
                  <input
                    type="text"
                    value={newEnvelope.name}
                    onChange={(e) => setNewEnvelope({ ...newEnvelope, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Ex: Courses, Essence, Loisirs"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Icône</label>
                  <div className="flex gap-2 flex-wrap">
                    {icons.map((icon) => (
                      <button
                        key={icon}
                        onClick={() => setNewEnvelope({ ...newEnvelope, icon })}
                        className={`text-2xl p-2 rounded-lg border-2 ${newEnvelope.icon === icon ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}
                      >
                        {icon}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Couleur</label>
                  <div className="flex gap-2 flex-wrap">
                    {colors.map((color) => (
                      <button
                        key={color}
                        onClick={() => setNewEnvelope({ ...newEnvelope, color })}
                        className={`w-8 h-8 rounded-full border-2 ${newEnvelope.color === color ? 'border-gray-800' : 'border-gray-200'}`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Budget mensuel (€)</label>
                  <input
                    type="number"
                    value={newEnvelope.monthlyLimit}
                    onChange={(e) => setNewEnvelope({ ...newEnvelope, monthlyLimit: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Ex: 300"
                  />
                </div>

                <div className="col-span-2">
                  <button
                    onClick={handleAddEnvelope}
                    className="w-full bg-green-500 text-white py-2 rounded-lg font-semibold hover:bg-green-600 transition"
                  >
                    + Ajouter cette enveloppe
                  </button>
                </div>
              </div>

              {envelopes.length > 0 && (
                <div className="space-y-2 mt-6">
                  <h3 className="font-semibold text-gray-700">Enveloppes créées:</h3>
                  {envelopes.map((env) => (
                    <div key={env.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{env.icon}</span>
                        <div>
                          <p className="font-medium text-gray-800">{env.name}</p>
                          <p className="text-sm text-gray-600">{env.monthlyLimit.toFixed(2)} € / mois</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveEnvelope(env.id)}
                        className="text-red-500 hover:text-red-700 font-bold"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => setStep(2)}
                className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-300 transition"
              >
                Retour
              </button>
              <button
                onClick={handleComplete}
                disabled={envelopes.length === 0}
                className="flex-1 bg-blue-500 text-white py-3 rounded-lg font-semibold hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
              >
                Terminer
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
