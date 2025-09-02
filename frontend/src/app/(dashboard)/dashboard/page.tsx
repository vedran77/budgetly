'use client';

import { useAuthStore } from '@/stores/auth';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { dashboardApi, BudgetOverview } from '@/lib/api';
import { formatCurrency } from '@/lib/currency';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { 
  Wallet, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle,
  Plus,
  DollarSign
} from 'lucide-react';

export default function DashboardPage() {
  const { user, isAuthenticated } = useAuthStore();
  const router = useRouter();
  const [budgetOverview, setBudgetOverview] = useState<BudgetOverview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }

    const fetchBudgetOverview = async () => {
      try {
        const response = await dashboardApi.getBudgetOverview();
        setBudgetOverview(response.data);
      } catch (error) {
        console.error('Error fetching budget overview:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchBudgetOverview();
  }, [isAuthenticated, router]);

  const formatAmount = (amount: number) => {
    return formatCurrency(amount, user?.currency || 'USD');
  };

  const getStatusColor = (status: 'good' | 'warning' | 'over') => {
    switch (status) {
      case 'good': return 'text-green-600';
      case 'warning': return 'text-yellow-600';
      case 'over': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusIcon = (status: 'good' | 'warning' | 'over') => {
    switch (status) {
      case 'good': return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
      case 'over': return <AlertTriangle className="w-4 h-4 text-red-600" />;
      default: return null;
    }
  };

  if (!isAuthenticated) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading dashboard...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-gray-600">Welcome back, {user?.name}!</p>
        </div>
        <Button onClick={() => router.push('/budget-setup')}>
          <Plus className="w-4 h-4 mr-2" />
          Setup Budget
        </Button>
      </div>

      {!budgetOverview?.hasBudget ? (
        <Card>
          <CardHeader>
            <CardTitle>No Budget Set</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">
              You haven't set up a budget for this month yet. Create one to start tracking your expenses.
            </p>
            <Button onClick={() => router.push('/budget-setup')}>
              <Plus className="w-4 h-4 mr-2" />
              Create Monthly Budget
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Budget Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Budget</CardTitle>
                <Wallet className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatAmount(budgetOverview.totalBudget || 0)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Spent</CardTitle>
                <TrendingDown className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatAmount(budgetOverview.totalSpent || 0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {budgetOverview.budgetUsedPercentage}% of budget used
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Remaining</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatAmount(budgetOverview.remainingBudget || 0)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Status</CardTitle>
                {getStatusIcon(budgetOverview.status || 'good')}
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${getStatusColor(budgetOverview.status || 'good')}`}>
                  {budgetOverview.status === 'good' ? 'On Track' : 
                   budgetOverview.status === 'warning' ? 'Warning' : 'Over Budget'}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Budget Progress */}
          <Card>
            <CardHeader>
              <CardTitle>Monthly Budget Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Overall Budget Usage</span>
                  <span>{budgetOverview.budgetUsedPercentage}%</span>
                </div>
                <Progress 
                  value={budgetOverview.budgetUsedPercentage} 
                  className="w-full"
                />
              </div>
            </CardContent>
          </Card>

          {/* Category Budgets */}
          <Card>
            <CardHeader>
              <CardTitle>Category Budget Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {budgetOverview.categoryBudgets?.map((category) => (
                  <div key={category.categoryId} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center space-x-2">
                        <div 
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: category.categoryColor }}
                        />
                        <span className="font-medium">{category.categoryName}</span>
                        {getStatusIcon(category.status)}
                      </div>
                      <div className="text-right">
                        <div className="text-sm">
                          {formatAmount(category.spent)} / {formatAmount(category.budgetAmount)}
                        </div>
                        <div className="text-xs text-gray-500">
                          {formatAmount(category.remaining)} remaining
                        </div>
                      </div>
                    </div>
                    <Progress 
                      value={category.percentage}
                      className="w-full"
                    />
                    <div className="text-xs text-right text-gray-500">
                      {category.percentage}% used
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}