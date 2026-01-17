import { User, Envelope, Expense, BudgetCalculation } from '@/types';

export function calculateBudget(user: User, expenses: Expense[]): BudgetCalculation {
  const totalIncome = user.monthlySalary;
  const fixedExpenses = user.fixedExpenses;
  const totalEnvelopeBudget = user.envelopes.reduce((sum, env) => sum + env.monthlyLimit, 0);
  const remainingToLive = totalIncome - fixedExpenses - totalEnvelopeBudget;

  const envelopes = user.envelopes.map((envelope) => {
    const envelopeExpenses = expenses.filter(exp => exp.envelopeId === envelope.id);
    const spent = envelopeExpenses.reduce((sum, exp) => sum + exp.amount, 0);
    const remaining = envelope.monthlyLimit - spent;
    const percentage = envelope.monthlyLimit > 0 ? (spent / envelope.monthlyLimit) * 100 : 0;

    return {
      id: envelope.id,
      name: envelope.name,
      icon: envelope.icon,
      spent,
      limit: envelope.monthlyLimit,
      remaining,
      percentage: Math.min(percentage, 100),
      color: envelope.color,
    };
  });

  return {
    totalIncome,
    fixedExpenses,
    totalEnvelopeBudget,
    remainingToLive,
    envelopes,
  };
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
}
