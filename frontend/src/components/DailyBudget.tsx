'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/auth';
import { dashboardApi, DailyBudgetOverview } from '@/lib/api';
import { formatCurrency } from '@/lib/currency';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { 
  Calendar,
  TrendingDown, 
  AlertTriangle, 
  CheckCircle,
  Plus,
  DollarSign,
  Clock
} from 'lucide-react';

interface DailyBudgetProps {
  onAddTransaction?: () => void;
}

export default function DailyBudget({ onAddTransaction }: DailyBudgetProps) {
  const { user } = useAuthStore();
  const [dailyBudget, setDailyBudget] = useState<DailyBudgetOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDailyBudget = async () => {
      try {
        const response = await dashboardApi.getDailyBudget();
        setDailyBudget(response.data);
      } catch (error) {
        console.error('Error fetching daily budget:', error);
        setError('Failed to load daily budget data');
      } finally {
        setLoading(false);
      }
    };

    fetchDailyBudget();
  }, []);

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

  const getProgressBarColor = (status: 'good' | 'warning' | 'over') => {
    switch (status) {
      case 'good': return 'bg-green-500';
      case 'warning': return 'bg-yellow-500';  
      case 'over': return 'bg-red-500';
      default: return 'bg-blue-500';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center p-8">
            Loading daily budget...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-red-600 text-center p-4">{error}</div>
        </CardContent>
      </Card>
    );
  }

  if (!dailyBudget?.hasBudget) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Daily Budget Tracking
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600 text-center py-8">
            Set up a monthly budget to track your daily spending limits.
          </p>
        </CardContent>
      </Card>
    );
  }

  const todaySpentPercentage = dailyBudget.adjustedDailyLimit > 0 
    ? (dailyBudget.todaySpent / dailyBudget.adjustedDailyLimit) * 100 
    : 0;

  return (
    <div className="space-y-6">
      {/* Daily Overview Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Today's Budget - Day {dailyBudget.currentDay} of {dailyBudget.daysInMonth}
            </div>
            <div className="flex items-center gap-2">
              {getStatusIcon(dailyBudget.overallStatus)}
              <span className={`text-sm font-medium ${getStatusColor(dailyBudget.overallStatus)}`}>
                {dailyBudget.overallStatus === 'good' ? 'On Track' : 
                 dailyBudget.overallStatus === 'warning' ? 'Warning' : 'Over Budget'}
              </span>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium">Today's Limit</span>
              </div>
              <div className="text-xl md:text-2xl font-bold text-blue-600">
                {formatAmount(dailyBudget.adjustedDailyLimit)}
              </div>
              <div className="text-xs text-gray-500">
                Adjusted for remaining days
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-red-600" />
                <span className="text-sm font-medium">Spent Today</span>
              </div>
              <div className="text-xl md:text-2xl font-bold">
                {formatAmount(dailyBudget.todaySpent)}
              </div>
              <div className="text-xs text-gray-500">
                {dailyBudget.todayTransactionCount} transactions
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span className="text-sm font-medium">Remaining Today</span>
              </div>
              <div className="text-xl md:text-2xl font-bold text-green-600">
                {formatAmount(dailyBudget.todayRemaining)}
              </div>
              <div className="text-xs text-gray-500">
                Available for rest of day
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-600" />
                <span className="text-sm font-medium">Days Left</span>
              </div>
              <div className="text-xl md:text-2xl font-bold">
                {dailyBudget.remainingDaysInMonth}
              </div>
              <div className="text-xs text-gray-500">
                Including today
              </div>
            </div>
          </div>

          {/* Today's Progress Bar */}
          <div className="mt-6 space-y-2">
            <div className="flex justify-between items-center">
              <span className="font-medium">Today's Budget Usage</span>
              <span className={`font-bold ${getStatusColor(dailyBudget.overallStatus)}`}>
                {Math.round(todaySpentPercentage)}%
              </span>
            </div>
            <div className="relative">
              <Progress 
                value={Math.min(todaySpentPercentage, 100)} 
                className="w-full h-3"
              />
              <div 
                className={`absolute top-0 left-0 h-3 rounded-full transition-all ${getProgressBarColor(dailyBudget.overallStatus)}`}
                style={{ width: `${Math.min(todaySpentPercentage, 100)}%` }}
              />
            </div>
          </div>

          {/* Add Transaction Button */}
          {onAddTransaction && (
            <div className="mt-6 flex justify-center">
              <Button onClick={onAddTransaction} className="flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Add Expense
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Category Daily Budgets */}
      <Card>
        <CardHeader>
          <CardTitle>Category Daily Limits</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {dailyBudget.categoryDailyBudgets.map((category) => {
              const percentage = category.adjustedDailyLimit > 0 
                ? (category.todaySpent / category.adjustedDailyLimit) * 100 
                : 0;

              return (
                <div key={category.categoryId} className="space-y-3">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-3">
                      <div 
                        className="w-4 h-4 rounded-full flex items-center justify-center text-white text-xs"
                        style={{ backgroundColor: category.categoryColor }}
                      >
                        <span>{category.categoryIcon}</span>
                      </div>
                      <div>
                        <span className="font-medium">{category.categoryName}</span>
                        {getStatusIcon(category.status)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium">
                        {formatAmount(category.todaySpent)} / {formatAmount(category.adjustedDailyLimit)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {formatAmount(category.todayRemaining)} left today
                      </div>
                    </div>
                  </div>
                  
                  <div className="relative">
                    <Progress 
                      value={Math.min(percentage, 100)} 
                      className="w-full h-2"
                    />
                    <div 
                      className={`absolute top-0 left-0 h-2 rounded-full transition-all ${getProgressBarColor(category.status)}`}
                      style={{ width: `${Math.min(percentage, 100)}%` }}
                    />
                  </div>
                  
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>{Math.round(percentage)}% of today's limit used</span>
                    <span>Monthly: {formatAmount(category.monthlySpent)} / {formatAmount(category.totalBudget)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Monthly Context */}
      <Card>
        <CardHeader>
          <CardTitle>Monthly Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
            <div className="space-y-2">
              <div className="text-sm text-gray-600">Total Monthly Budget</div>
              <div className="text-xl font-bold">{formatAmount(dailyBudget.totalBudget)}</div>
            </div>
            <div className="space-y-2">
              <div className="text-sm text-gray-600">Spent This Month</div>
              <div className="text-xl font-bold text-red-600">{formatAmount(dailyBudget.totalSpentThisMonth)}</div>
            </div>
            <div className="space-y-2">
              <div className="text-sm text-gray-600">Remaining This Month</div>
              <div className="text-xl font-bold text-green-600">{formatAmount(dailyBudget.remainingBudget)}</div>
            </div>
          </div>
          <div className="mt-4 text-center text-sm text-gray-600">
            Original daily average: {formatAmount(dailyBudget.originalDailyLimit)} • 
            Adjusted for remaining days: {formatAmount(dailyBudget.adjustedDailyLimit)}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}