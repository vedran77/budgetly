'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuthStore } from '@/stores/auth';
import { transactionsApi, categoriesApi, Transaction, Category } from '@/lib/api';
import { formatCurrency } from '@/lib/currency';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Plus, Receipt, Edit, Trash2 } from 'lucide-react';

const transactionSchema = z.object({
  amount: z.string().min(1, 'Amount is required').refine((val) => !isNaN(Number(val)) && Number(val) > 0, 'Amount must be a positive number'),
  description: z.string().optional(),
  date: z.string().min(1, 'Date is required'),
  type: z.enum(['income', 'expense'], { message: 'Please select a transaction type' }),
  categoryId: z.string().min(1, 'Please select a category'),
});

type TransactionForm = z.infer<typeof transactionSchema>;

export default function TransactionsPage() {
  const { user } = useAuthStore();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<TransactionForm>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      date: new Date().toISOString().split('T')[0],
    }
  });

  const selectedType = watch('type');
  const selectedCategoryId = watch('categoryId');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [transactionsRes, categoriesRes] = await Promise.all([
          transactionsApi.getAll({ limit: 20 }),
          categoriesApi.getAll(),
        ]);
        setTransactions(transactionsRes.data.transactions);
        setCategories(categoriesRes.data);
      } catch (error) {
        console.error('Error fetching data:', error);
        toast.error('Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Filter categories based on selected type
  const filteredCategories = categories.filter(cat => 
    selectedType ? cat.type === selectedType : true
  );

  // Clear selected category if it doesn't match the new type
  useEffect(() => {
    if (selectedType && selectedCategoryId) {
      const category = categories.find(cat => cat.id === parseInt(selectedCategoryId));
      if (category && category.type !== selectedType) {
        setValue('categoryId', '');
      }
    }
  }, [selectedType, selectedCategoryId, categories, setValue]);

  const onSubmit = async (data: TransactionForm) => {
    setSubmitting(true);
    try {
      const transactionData = {
        amount: parseFloat(data.amount),
        description: data.description?.trim() || undefined,
        date: data.date,
        type: data.type,
        categoryId: parseInt(data.categoryId),
      };

      if (editingTransaction) {
        const response = await transactionsApi.update(editingTransaction.id, transactionData);
        setTransactions(prev => prev.map(t => 
          t.id === editingTransaction.id ? response.data : t
        ));
        setEditingTransaction(null);
        toast.success('Transaction updated successfully!');
      } else {
        const response = await transactionsApi.create(transactionData);
        setTransactions(prev => [response.data, ...prev]);
        toast.success('Transaction added successfully!');
      }
      reset();
    } catch (error: unknown) {
      console.error('Error saving transaction:', error);
      const errorMessage = error instanceof Error && 'response' in error && 
        typeof error.response === 'object' && error.response && 
        'data' in error.response && 
        typeof error.response.data === 'object' && error.response.data &&
        'error' in error.response.data && 
        typeof error.response.data.error === 'string' 
        ? error.response.data.error 
        : (editingTransaction ? 'Failed to update transaction' : 'Failed to create transaction');
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    setValue('amount', transaction.amount.toString());
    setValue('description', transaction.description || '');
    setValue('date', transaction.date.split('T')[0]);
    setValue('type', transaction.type);
    setValue('categoryId', transaction.categoryId.toString());
  };

  const handleDelete = async (transactionId: number) => {
    if (!confirm('Are you sure you want to delete this transaction?')) return;
    
    try {
      await transactionsApi.delete(transactionId);
      setTransactions(prev => prev.filter(t => t.id !== transactionId));
      toast.success('Transaction deleted successfully!');
    } catch (error: unknown) {
      console.error('Error deleting transaction:', error);
      const errorMessage = error instanceof Error && 'response' in error && 
        typeof error.response === 'object' && error.response && 
        'data' in error.response && 
        typeof error.response.data === 'object' && error.response.data &&
        'error' in error.response.data && 
        typeof error.response.data.error === 'string' 
        ? error.response.data.error 
        : 'Failed to delete transaction';
      toast.error(errorMessage);
    }
  };

  const cancelEdit = () => {
    setEditingTransaction(null);
    reset();
  };

  const formatAmount = (amount: number) => {
    return formatCurrency(amount, user?.currency || 'USD');
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading transactions...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Transactions</h1>
          <p className="text-muted-foreground">
            Manage your income and expense transactions
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Add Transaction Form */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="w-5 h-5" />
                {editingTransaction ? 'Edit Transaction' : 'Add Transaction'}
              </CardTitle>
              <CardDescription>
                {editingTransaction ? 'Update transaction details' : 'Record a new income or expense transaction'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="type">Type</Label>
                  <Select
                    value={watch('type') || ''}
                    onValueChange={(value) => setValue('type', value as 'income' | 'expense')}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select transaction type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="income">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-green-500"></div>
                          Income
                        </div>
                      </SelectItem>
                      <SelectItem value="expense">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-red-500"></div>
                          Expense
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.type && (
                    <p className="text-sm text-red-500">{errors.type.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="categoryId">Category</Label>
                  <Select
                    value={watch('categoryId') || ''}
                    onValueChange={(value) => setValue('categoryId', value)}
                    disabled={!selectedType}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={
                        !selectedType 
                          ? "Select transaction type first" 
                          : "Select a category"
                      } />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredCategories.map((category) => (
                        <SelectItem key={category.id} value={category.id.toString()}>
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: category.color }}
                            />
                            <span>{category.icon}</span>
                            <span>{category.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.categoryId && (
                    <p className="text-sm text-red-500">{errors.categoryId.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="amount">Amount</Label>
                  <Input
                    {...register('amount')}
                    id="amount"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    disabled={submitting}
                  />
                  {errors.amount && (
                    <p className="text-sm text-red-500">{errors.amount.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="date">Date</Label>
                  <Input
                    {...register('date')}
                    id="date"
                    type="date"
                    disabled={submitting}
                  />
                  {errors.date && (
                    <p className="text-sm text-red-500">{errors.date.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description (Optional)</Label>
                  <Textarea
                    {...register('description')}
                    id="description"
                    placeholder="Add a note about this transaction..."
                    disabled={submitting}
                  />
                </div>

                <div className="flex gap-2">
                  <Button type="submit" disabled={submitting} className="flex-1">
                    {submitting ? (editingTransaction ? 'Updating...' : 'Adding...') : (editingTransaction ? 'Update Transaction' : 'Add Transaction')}
                  </Button>
                  {editingTransaction && (
                    <Button type="button" variant="outline" onClick={cancelEdit}>
                      Cancel
                    </Button>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Transaction List */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="w-5 h-5" />
                Recent Transactions
              </CardTitle>
            </CardHeader>
            <CardContent>
              {transactions.length === 0 ? (
                <div className="text-center py-8">
                  <Receipt className="mx-auto w-12 h-12 text-gray-400 mb-4" />
                  <p className="text-gray-500">No transactions yet</p>
                  <p className="text-sm text-gray-400">Add your first transaction using the form</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {transactions.map((transaction) => (
                    <div
                      key={transaction.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                    >
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: transaction.category.color }}
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span>{transaction.category.icon}</span>
                            <span className="font-medium">{transaction.category.name}</span>
                            <span className={`text-xs px-2 py-1 rounded-full ${
                              transaction.type === 'income' 
                                ? 'bg-green-100 text-green-700' 
                                : 'bg-red-100 text-red-700'
                            }`}>
                              {transaction.type}
                            </span>
                          </div>
                          {transaction.description && (
                            <p className="text-sm text-gray-600 mt-1">
                              {transaction.description}
                            </p>
                          )}
                          <p className="text-xs text-gray-500">
                            {new Date(transaction.date).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className={`font-semibold text-lg ${
                          transaction.type === 'income' ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {transaction.type === 'income' ? '+' : '-'}{formatAmount(transaction.amount)}
                        </div>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEdit(transaction)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(transaction.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}