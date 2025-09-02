'use client';

import { useAuthStore } from '@/stores/auth';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { categoriesApi, budgetsApi, Category } from '@/lib/api';
import { formatCurrency, getCurrencyByCode } from '@/lib/currency';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Save, 
  Plus, 
  Trash2,
  ArrowLeft
} from 'lucide-react';
import { toast } from 'sonner';

interface CategoryBudget {
  categoryId: number;
  categoryName: string;
  categoryColor: string;
  categoryIcon: string;
  budgetAmount: number;
}

export default function BudgetSetupPage() {
  const { isAuthenticated, user } = useAuthStore();
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [totalBudget, setTotalBudget] = useState<number>(0);
  const [categoryBudgets, setCategoryBudgets] = useState<CategoryBudget[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM format

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }

    const fetchData = async () => {
      try {
        // Fetch categories
        const categoriesResponse = await categoriesApi.getAll();
        const expenseCategories = categoriesResponse.data.filter(cat => cat.type === 'expense');
        setCategories(expenseCategories);

        // Initialize category budgets
        setCategoryBudgets(
          expenseCategories.map(cat => ({
            categoryId: cat.id,
            categoryName: cat.name,
            categoryColor: cat.color,
            categoryIcon: cat.icon,
            budgetAmount: 0
          }))
        );

        // Try to fetch existing budget for current month
        try {
          const budgetResponse = await budgetsApi.getByMonth(currentMonth);
          const budget = budgetResponse.data;
          setTotalBudget(budget.totalBudget);
          
          // Update category budgets with existing values
          setCategoryBudgets(prev => 
            prev.map(cb => {
              const existingBudget = budget.categoryBudgets.find(cb2 => cb2.categoryId === cb.categoryId);
              return existingBudget ? { ...cb, budgetAmount: existingBudget.budgetAmount } : cb;
            })
          );
        } catch (error) {
          // No existing budget, that's fine
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        toast.error('Error fetching categories');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [isAuthenticated, router, currentMonth]);

  const handleCategoryBudgetChange = (categoryId: number, amount: number) => {
    setCategoryBudgets(prev =>
      prev.map(cb =>
        cb.categoryId === categoryId ? { ...cb, budgetAmount: amount } : cb
      )
    );
  };

  const totalAllocated = categoryBudgets.reduce((sum, cb) => sum + cb.budgetAmount, 0);
  const remaining = totalBudget - totalAllocated;

  const handleSave = async () => {
    if (totalBudget <= 0) {
      toast.error('Please enter a total budget amount');
      return;
    }

    if (totalAllocated > totalBudget) {
      toast.error('Category budgets cannot exceed total budget');
      return;
    }

    setSaving(true);
    try {
      const budgetData = {
        month: currentMonth,
        totalBudget,
        categoryBudgets: categoryBudgets
          .filter(cb => cb.budgetAmount > 0)
          .map(cb => ({
            categoryId: cb.categoryId,
            budgetAmount: cb.budgetAmount
          }))
      };

      await budgetsApi.create(budgetData);
      toast.success('Budget saved successfully!');
      router.push('/dashboard');
    } catch (error: any) {
      console.error('Error saving budget:', error);
      toast.error(error.response?.data?.error || 'Error saving budget');
    } finally {
      setSaving(false);
    }
  };

  const formatAmount = (amount: number) => {
    return formatCurrency(amount, user?.currency || 'USD');
  };

  const getCurrencySymbol = () => {
    const currency = getCurrencyByCode(user?.currency || 'USD');
    return currency?.symbol || user?.currency || 'USD';
  };

  if (!isAuthenticated) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center space-x-4">
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Budget Setup</h1>
          <p className="text-gray-600">Set up your budget for {currentMonth}</p>
        </div>
      </div>

      {/* Total Budget */}
      <Card>
        <CardHeader>
          <CardTitle>Monthly Budget</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label htmlFor="totalBudget">Total Monthly Budget ({getCurrencySymbol()})</Label>
              <Input
                id="totalBudget"
                type="number"
                step="0.01"
                min="0"
                value={totalBudget || ''}
                onChange={(e) => setTotalBudget(parseFloat(e.target.value) || 0)}
                placeholder="Enter your total budget"
                className="mt-1"
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
              <div className="text-center">
                <div className="text-sm text-gray-600">Total Budget</div>
                <div className="text-lg font-bold text-blue-600">
                  {formatAmount(totalBudget)}
                </div>
              </div>
              <div className="text-center">
                <div className="text-sm text-gray-600">Allocated</div>
                <div className="text-lg font-bold text-green-600">
                  {formatAmount(totalAllocated)}
                </div>
              </div>
              <div className="text-center">
                <div className="text-sm text-gray-600">Remaining</div>
                <div className={`text-lg font-bold ${remaining >= 0 ? 'text-gray-800' : 'text-red-600'}`}>
                  {formatAmount(remaining)}
                </div>
              </div>
            </div>
            
            {remaining < 0 && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-red-800 text-sm">
                  ⚠️ You've allocated more than your total budget. Please adjust the amounts.
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Category Budgets */}
      <Card>
        <CardHeader>
          <CardTitle>Category Budgets</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {categoryBudgets.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-600 mb-4">
                  No expense categories found. You need to create some categories first.
                </p>
                <Button onClick={() => router.push('/categories')}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Categories
                </Button>
              </div>
            ) : (
              categoryBudgets.map((category) => (
                <div key={category.categoryId} className="flex items-center space-x-4 p-4 border rounded-lg">
                  <div className="flex items-center space-x-3 flex-1">
                    <div 
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: category.categoryColor }}
                    />
                    <span className="font-medium">{category.categoryName}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Label htmlFor={`budget-${category.categoryId}`} className="sr-only">
                      Budget for {category.categoryName}
                    </Label>
                    <Input
                      id={`budget-${category.categoryId}`}
                      type="number"
                      step="0.01"
                      min="0"
                      value={category.budgetAmount || ''}
                      onChange={(e) => 
                        handleCategoryBudgetChange(category.categoryId, parseFloat(e.target.value) || 0)
                      }
                      placeholder="0.00"
                      className="w-32"
                    />
                    <span className="text-gray-500 text-sm">{getCurrencySymbol()}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end space-x-4">
        <Button variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button 
          onClick={handleSave} 
          disabled={saving || totalBudget <= 0 || remaining < 0}
        >
          <Save className="w-4 h-4 mr-2" />
          {saving ? 'Saving...' : 'Save Budget'}
        </Button>
      </div>
    </div>
  );
}