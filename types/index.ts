export interface User {
  id: string;
  monthlySalary: number;
  fixedExpenses: number;
  envelopes: Envelope[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Envelope {
  id: string;
  name: string;
  icon: string;
  monthlyLimit: number;
  spent: number;
  color: string;
}

export interface Expense {
  id: string;
  envelopeId: string;
  amount: number;
  description: string;
  date: Date;
}

export interface BudgetCalculation {
  totalIncome: number;
  fixedExpenses: number;
  totalEnvelopeBudget: number;
  remainingToLive: number;
  envelopes: {
    id: string;
    name: string;
    icon: string;
    spent: number;
    limit: number;
    remaining: number;
    percentage: number;
    color: string;
  }[];
}
