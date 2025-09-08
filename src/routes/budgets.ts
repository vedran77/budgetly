import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth';
import { body, param, query, validationResult } from 'express-validator';

const router = express.Router();
const prisma = new PrismaClient();

// Get user's budgets (with optional month filter)
router.get('/', authenticateToken, [
  query('month').optional().isString().matches(/^\d{4}-\d{2}$/).withMessage('Month must be in YYYY-MM format')
], async (req: any, res: any) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Invalid input', details: errors.array() });
    }

    const userId = req.user!.userId;
    const { month } = req.query;

    const whereCondition: any = { userId };
    if (month) {
      whereCondition.month = month as string;
    }

    const budgets = await prisma.budget.findMany({
      where: whereCondition,
      include: {
        categoryBudgets: {
          include: {
            category: true
          }
        }
      },
      orderBy: { month: 'desc' }
    });

    res.json(budgets);
  } catch (error) {
    console.error('Error fetching budgets:', error);
    res.status(500).json({ error: 'Failed to fetch budgets' });
  }
});

// Get specific budget by month
router.get('/:month', authenticateToken, [
  param('month').isString().matches(/^\d{4}-\d{2}$/).withMessage('Month must be in YYYY-MM format')
], async (req: any, res: any) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Invalid input', details: errors.array() });
    }

    const userId = req.user!.userId;
    const { month } = req.params;

    const budget = await prisma.budget.findUnique({
      where: {
        userId_month: {
          userId,
          month
        }
      },
      include: {
        categoryBudgets: {
          include: {
            category: true
          }
        }
      }
    });

    if (!budget) {
      return res.status(404).json({ error: 'Budget not found' });
    }

    // Get spending data for this budget month
    const startDate = new Date(`${month}-01`);
    const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);

    const transactions = await prisma.transaction.findMany({
      where: {
        userId,
        type: 'expense',
        date: {
          gte: startDate,
          lte: endDate
        }
      },
      include: {
        category: true
      }
    });

    // Calculate spending by category
    const categorySpending = transactions.reduce((acc, transaction) => {
      if (!acc[transaction.categoryId]) {
        acc[transaction.categoryId] = 0;
      }
      acc[transaction.categoryId] += transaction.amount;
      return acc;
    }, {} as Record<number, number>);

    // Add spending data to category budgets
    const budgetWithSpending = {
      ...budget,
      categoryBudgets: budget.categoryBudgets.map(cb => ({
        ...cb,
        spent: categorySpending[cb.categoryId] || 0,
        remaining: cb.budgetAmount - (categorySpending[cb.categoryId] || 0)
      }))
    };

    res.json(budgetWithSpending);
  } catch (error) {
    console.error('Error fetching budget:', error);
    res.status(500).json({ error: 'Failed to fetch budget' });
  }
});

// Create or update budget
router.post('/', authenticateToken, [
  body('month').isString().matches(/^\d{4}-\d{2}$/).withMessage('Month must be in YYYY-MM format'),
  body('totalBudget').isFloat({ min: 0 }).withMessage('Total budget must be a positive number'),
  body('categoryBudgets').isArray().withMessage('Category budgets must be an array'),
  body('categoryBudgets.*.categoryId').isInt({ min: 1 }).withMessage('Category ID must be a positive integer'),
  body('categoryBudgets.*.budgetAmount').isFloat({ min: 0 }).withMessage('Budget amount must be a positive number')
], async (req: any, res: any) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Invalid input', details: errors.array() });
    }

    const userId = req.user!.userId;
    const { month, totalBudget, categoryBudgets } = req.body;

    // Validate that all categories belong to the user
    const categoryIds = categoryBudgets.map((cb: any) => cb.categoryId);
    const userCategories = await prisma.category.findMany({
      where: {
        id: { in: categoryIds },
        userId
      }
    });

    if (userCategories.length !== categoryIds.length) {
      return res.status(400).json({ error: 'Some categories do not exist or do not belong to user' });
    }

    // Validate that total of category budgets doesn't exceed total budget
    const totalCategoryBudget = categoryBudgets.reduce((sum: number, cb: any) => sum + cb.budgetAmount, 0);
    if (totalCategoryBudget > totalBudget) {
      return res.status(400).json({ error: 'Sum of category budgets cannot exceed total budget' });
    }

    // Use transaction to ensure data consistency
    const result = await prisma.$transaction(async (tx) => {
      // Delete existing budget if it exists
      await tx.budget.deleteMany({
        where: { userId, month }
      });

      // Create new budget
      const budget = await tx.budget.create({
        data: {
          month,
          totalBudget,
          userId,
          categoryBudgets: {
            create: categoryBudgets.map((cb: any) => ({
              categoryId: cb.categoryId,
              budgetAmount: cb.budgetAmount
            }))
          }
        },
        include: {
          categoryBudgets: {
            include: {
              category: true
            }
          }
        }
      });

      return budget;
    });

    res.json({ message: 'Budget created successfully', budget: result });
  } catch (error) {
    console.error('Error creating budget:', error);
    res.status(500).json({ error: 'Failed to create budget' });
  }
});

// Update budget
router.put('/:month', authenticateToken, [
  param('month').isString().matches(/^\d{4}-\d{2}$/).withMessage('Month must be in YYYY-MM format'),
  body('totalBudget').optional().isFloat({ min: 0 }).withMessage('Total budget must be a positive number'),
  body('categoryBudgets').optional().isArray().withMessage('Category budgets must be an array'),
  body('categoryBudgets.*.categoryId').optional().isInt({ min: 1 }).withMessage('Category ID must be a positive integer'),
  body('categoryBudgets.*.budgetAmount').optional().isFloat({ min: 0 }).withMessage('Budget amount must be a positive number')
], async (req: any, res: any) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Invalid input', details: errors.array() });
    }

    const userId = req.user!.userId;
    const { month } = req.params;
    const { totalBudget, categoryBudgets } = req.body;

    // Check if budget exists
    const existingBudget = await prisma.budget.findUnique({
      where: {
        userId_month: { userId, month }
      }
    });

    if (!existingBudget) {
      return res.status(404).json({ error: 'Budget not found' });
    }

    const updateData: any = {};
    if (totalBudget !== undefined) {
      updateData.totalBudget = totalBudget;
    }

    if (categoryBudgets) {
      // Validate categories belong to user
      const categoryIds = categoryBudgets.map((cb: any) => cb.categoryId);
      const userCategories = await prisma.category.findMany({
        where: {
          id: { in: categoryIds },
          userId
        }
      });

      if (userCategories.length !== categoryIds.length) {
        return res.status(400).json({ error: 'Some categories do not exist or do not belong to user' });
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      // Update budget
      const updatedBudget = await tx.budget.update({
        where: {
          userId_month: { userId, month }
        },
        data: updateData
      });

      // Update category budgets if provided
      if (categoryBudgets) {
        // Delete existing category budgets
        await tx.categoryBudget.deleteMany({
          where: { budgetId: updatedBudget.id }
        });

        // Create new category budgets
        await tx.categoryBudget.createMany({
          data: categoryBudgets.map((cb: any) => ({
            budgetId: updatedBudget.id,
            categoryId: cb.categoryId,
            budgetAmount: cb.budgetAmount
          }))
        });
      }

      // Return updated budget with relations
      return await tx.budget.findUnique({
        where: { id: updatedBudget.id },
        include: {
          categoryBudgets: {
            include: {
              category: true
            }
          }
        }
      });
    });

    res.json({ message: 'Budget updated successfully', budget: result });
  } catch (error) {
    console.error('Error updating budget:', error);
    res.status(500).json({ error: 'Failed to update budget' });
  }
});

// Delete budget
router.delete('/:month', authenticateToken, [
  param('month').isString().matches(/^\d{4}-\d{2}$/).withMessage('Month must be in YYYY-MM format')
], async (req: any, res: any) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Invalid input', details: errors.array() });
    }

    const userId = req.user!.userId;
    const { month } = req.params;

    const deletedBudget = await prisma.budget.deleteMany({
      where: { userId, month }
    });

    if (deletedBudget.count === 0) {
      return res.status(404).json({ error: 'Budget not found' });
    }

    res.json({ message: 'Budget deleted successfully' });
  } catch (error) {
    console.error('Error deleting budget:', error);
    res.status(500).json({ error: 'Failed to delete budget' });
  }
});

export default router;