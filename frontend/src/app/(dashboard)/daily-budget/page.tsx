'use client';

import { useAuthStore } from '@/stores/auth';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DailyBudget from '@/components/DailyBudget';
import DailyBudgetHistory from '@/components/DailyBudgetHistory';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, BarChart3, Plus } from 'lucide-react';

export default function DailyBudgetPage() {
  const { isAuthenticated } = useAuthStore();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('today');

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, router]);

  const handleAddTransaction = () => {
    router.push('/transactions?add=true');
  };

  if (!isAuthenticated) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  return (
    <div className="space-y-4 md:space-y-6 p-4 md:p-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Daily Budget Tracking</h1>
          <p className="text-gray-600 text-sm md:text-base mt-2">
            Track your daily spending limits and stay within your budget
          </p>
        </div>
        <Button onClick={handleAddTransaction} className="sm:w-auto w-full">
          <Plus className="w-4 h-4 mr-2" />
          Add Transaction
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="today" className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            <span className="hidden sm:inline">Today's Budget</span>
            <span className="sm:hidden">Today</span>
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            <span className="hidden sm:inline">Budget History</span>
            <span className="sm:hidden">History</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="today" className="mt-6">
          <DailyBudget onAddTransaction={handleAddTransaction} />
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <DailyBudgetHistory />
        </TabsContent>
      </Tabs>
    </div>
  );
}