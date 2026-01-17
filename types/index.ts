export interface Category {
  id: string;
  name: string;
  icon: string;
  limit: number;
  spent: number;
  color: string;
}

export interface Expense {
  id: string;
  categoryId: string;
  amount: number;
  description?: string;
  date: Date;
}

export interface UserProfile {
  id: string;
  salary: number;
  fixedCosts: number;
  categories: Category[];
  expenses: Expense[];
  createdAt: Date;
}

export interface OnboardingData {
  salary: number;
  fixedCosts: number;
  categories: Omit<Category, 'id' | 'spent'>[];
}
