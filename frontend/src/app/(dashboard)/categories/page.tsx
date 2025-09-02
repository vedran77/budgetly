'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { categoriesApi, Category } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, Edit, Trash2 } from 'lucide-react';

const categorySchema = z.object({
  name: z.string().min(1, 'Category name is required').max(50, 'Name must be less than 50 characters'),
  type: z.enum(['income', 'expense'], { message: 'Please select a category type' }),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Please enter a valid hex color code'),
  icon: z.string().min(1, 'Icon is required').max(10, 'Icon must be less than 10 characters'),
});

type CategoryForm = z.infer<typeof categorySchema>; 

const PRESET_COLORS = [
  '#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', 
  '#6B7280', '#22C55E', '#059669', '#DC2626', '#7C3AED', '#DB2777'
];

const PRESET_ICONS = [
  // Financial & Income
  '💰', '💼', '💳', '🏦', '📊', '💸', '🪙', '💎',
  
  // Housing & Bills
  '🏠', '🏘️', '🔑', '⚡', '💡', '🚰', '📞', '📶', '🌐', '📺',
  
  // Transportation
  '🚗', '⛽', '🔧', '🛡️', '🚙', '🚕', '🚌', '🚇', '✈️', '🛣️',
  
  // Food & Dining
  '🍽️', '🛒', '🥘', '🍕', '☕', '🍔', '🥗', '🍜', '🥖', '🧺',
  
  // Clothing & Personal
  '👕', '👔', '👗', '👠', '🧥', '👜', '💄', '🧴', '💊', '🪒',
  
  // Entertainment & Lifestyle
  '🎬', '🎭', '🎵', '🎮', '📚', '🎨', '🏃', '⚽', '🎪',
  
  // Health & Medical
  '🏥', '🩺', '🦷', '👓', '🧬', '💉', '🏋️',
  
  // Technology
  '📱', '💻', '🖥️', '⌚', '📷', '🎧', '🖨️', '📡',
  
  // Miscellaneous
  '🎁', '📦', '🔒', '📝', '📋', '🎯', '🔍', '⭐', '❓', '🌟'
];

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<CategoryForm>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      color: PRESET_COLORS[0],
      icon: PRESET_ICONS[0],
    }
  });

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await categoriesApi.getAll();
        setCategories(response.data);
      } catch (error) {
        console.error('Error fetching categories:', error);
        toast.error('Failed to load categories');
      } finally {
        setLoading(false);
      }
    };

    fetchCategories();
  }, []);

  const onSubmit = async (data: CategoryForm) => {
    setSubmitting(true);
    try {
      if (editingCategory) {
        const response = await categoriesApi.update(editingCategory.id, data);
        setCategories(prev => prev.map(cat => 
          cat.id === editingCategory.id ? response.data : cat
        ));
        setEditingCategory(null);
        toast.success('Category updated successfully!');
      } else {
        const response = await categoriesApi.create(data);
        setCategories(prev => [...prev, response.data]);
        toast.success('Category created successfully!');
      }
      reset();
    } catch (error: unknown) {
      console.error('Error saving category:', error);
      const errorMessage = error instanceof Error && 'response' in error && 
        typeof error.response === 'object' && error.response && 
        'data' in error.response && 
        typeof error.response.data === 'object' && error.response.data &&
        'error' in error.response.data && 
        typeof error.response.data.error === 'string' 
        ? error.response.data.error 
        : 'Failed to save category';
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setValue('name', category.name);
    setValue('type', category.type);
    setValue('color', category.color);
    setValue('icon', category.icon);
  };

  const handleDelete = async (categoryId: number) => {
    if (!confirm('Are you sure you want to delete this category?')) return;
    
    try {
      await categoriesApi.delete(categoryId);
      setCategories(prev => prev.filter(cat => cat.id !== categoryId));
      toast.success('Category deleted successfully!');
    } catch (error: unknown) {
      console.error('Error deleting category:', error);
      const errorMessage = error instanceof Error && 'response' in error && 
        typeof error.response === 'object' && error.response && 
        'data' in error.response && 
        typeof error.response.data === 'object' && error.response.data &&
        'error' in error.response.data && 
        typeof error.response.data.error === 'string' 
        ? error.response.data.error 
        : 'Failed to delete category';
      toast.error(errorMessage);
    }
  };

  const cancelEdit = () => {
    setEditingCategory(null);
    reset();
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading categories...</div>;
  }

  const incomeCategories = categories.filter(cat => cat.type === 'income');
  const expenseCategories = categories.filter(cat => cat.type === 'expense');

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Categories</h1>
          <p className="text-muted-foreground">
            Manage your income and expense categories
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Add/Edit Category Form */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="w-5 h-5" />
                {editingCategory ? 'Edit Category' : 'Add Category'}
              </CardTitle>
              <CardDescription>
                {editingCategory ? 'Update category details' : 'Create a new category for your transactions'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    {...register('name')}
                    id="name"
                    placeholder="Category name"
                    disabled={submitting}
                  />
                  {errors.name && (
                    <p className="text-sm text-red-500">{errors.name.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="type">Type</Label>
                  <Select
                    value={watch('type') || ''}
                    onValueChange={(value) => setValue('type', value as 'income' | 'expense')}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select category type" />
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
                  <Label htmlFor="color">Color</Label>
                  <div className="grid grid-cols-6 gap-2 mb-2">
                    {PRESET_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setValue('color', color)}
                        className={`w-8 h-8 rounded-md border-2 ${
                          watch('color') === color ? 'border-gray-800' : 'border-gray-200'
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                  <Input
                    {...register('color')}
                    id="color"
                    type="text"
                    placeholder="#000000"
                    disabled={submitting}
                  />
                  {errors.color && (
                    <p className="text-sm text-red-500">{errors.color.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="icon">Icon</Label>
                  <div className="max-h-32 overflow-y-auto border rounded-md p-2 mb-2">
                    <div className="grid grid-cols-8 gap-1">
                      {PRESET_ICONS.map((icon) => (
                        <button
                          key={icon}
                          type="button"
                          onClick={() => setValue('icon', icon)}
                          className={`w-8 h-8 rounded-md border-2 flex items-center justify-center text-lg hover:bg-gray-100 ${
                            watch('icon') === icon ? 'border-gray-800 bg-gray-50' : 'border-gray-200'
                          }`}
                        >
                          {icon}
                        </button>
                      ))}
                    </div>
                  </div>
                  <Input
                    {...register('icon')}
                    id="icon"
                    placeholder="🔥"
                    disabled={submitting}
                  />
                  {errors.icon && (
                    <p className="text-sm text-red-500">{errors.icon.message}</p>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button type="submit" disabled={submitting} className="flex-1">
                    {submitting ? (editingCategory ? 'Updating...' : 'Adding...') : (editingCategory ? 'Update Category' : 'Add Category')}
                  </Button>
                  {editingCategory && (
                    <Button type="button" variant="outline" onClick={cancelEdit}>
                      Cancel
                    </Button>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Category Lists */}
        <div className="lg:col-span-2 space-y-6">
          {/* Income Categories */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                Income Categories ({incomeCategories.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {incomeCategories.length === 0 ? (
                <p className="text-center py-8 text-gray-500">No income categories yet</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {incomeCategories.map((category) => (
                    <div
                      key={category.id}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
                    >
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: category.color }}
                        />
                        <span className="text-lg">{category.icon}</span>
                        <span className="font-medium">{category.name}</span>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEdit(category)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(category.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Expense Categories */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                Expense Categories ({expenseCategories.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {expenseCategories.length === 0 ? (
                <p className="text-center py-8 text-gray-500">No expense categories yet</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {expenseCategories.map((category) => (
                    <div
                      key={category.id}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
                    >
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: category.color }}
                        />
                        <span className="text-lg">{category.icon}</span>
                        <span className="font-medium">{category.name}</span>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEdit(category)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(category.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
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