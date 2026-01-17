import { Category } from '@/types';

interface CategoryCardProps {
  category: Category;
}

export default function CategoryCard({ category }: CategoryCardProps) {
  const percentage = category.limit > 0 ? (category.spent / category.limit) * 100 : 0;
  const isOverBudget = percentage > 100;

  return (
    <div className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-4xl">{category.icon}</span>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{category.name}</h3>
            <p className="text-sm text-gray-600">
              {category.spent}€ / {category.limit}€
            </p>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              isOverBudget ? 'bg-red-500' : 'bg-gradient-to-r from-indigo-500 to-purple-500'
            }`}
            style={{ 
              width: `${Math.min(percentage, 100)}%`,
              backgroundColor: !isOverBudget ? category.color : undefined
            }}
          />
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className={`font-medium ${isOverBudget ? 'text-red-600' : 'text-gray-700'}`}>
            {percentage.toFixed(0)}%
          </span>
          <span className={`font-semibold ${isOverBudget ? 'text-red-600' : 'text-green-600'}`}>
            {isOverBudget ? `+${(category.spent - category.limit).toFixed(0)}€` : `${(category.limit - category.spent).toFixed(0)}€ restants`}
          </span>
        </div>
      </div>
    </div>
  );
}
