'use client';

import { useAuthStore } from '@/stores/auth';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DailyBudget from '@/components/DailyBudget';

export default function DailyBudgetPage() {
  const { isAuthenticated } = useAuthStore();
  const router = useRouter();

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
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Daily Budget Tracking</h1>
        <p className="text-gray-600 mt-2">
          Track your daily spending limits and stay within your budget
        </p>
      </div>
      
      <DailyBudget onAddTransaction={handleAddTransaction} />
    </div>
  );
}