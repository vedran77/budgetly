import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// Get dashboard summary
router.get('/summary', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const currentDate = new Date();
    const currentMonthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const currentMonthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

    // Get total balance (all time)
    const totalIncome = await prisma.transaction.aggregate({
      where: {
        userId,
        type: 'income'
      },
      _sum: { amount: true }
    });

    const totalExpenses = await prisma.transaction.aggregate({
      where: {
        userId,
        type: 'expense'
      },
      _sum: { amount: true }
    });

    const balance = (totalIncome._sum.amount || 0) - (totalExpenses._sum.amount || 0);

    // Get current month stats
    const monthlyIncome = await prisma.transaction.aggregate({
      where: {
        userId,
        type: 'income',
        date: {
          gte: currentMonthStart,
          lte: currentMonthEnd
        }
      },
      _sum: { amount: true }
    });

    const monthlyExpenses = await prisma.transaction.aggregate({
      where: {
        userId,
        type: 'expense',
        date: {
          gte: currentMonthStart,
          lte: currentMonthEnd
        }
      },
      _sum: { amount: true }
    });

    // Get transaction count
    const transactionCount = await prisma.transaction.count({
      where: { userId }
    });

    // Get recent transactions (last 5)
    const recentTransactions = await prisma.transaction.findMany({
      where: { userId },
      include: {
        category: {
          select: {
            name: true,
            color: true,
            icon: true
          }
        }
      },
      orderBy: { date: 'desc' },
      take: 5
    });

    res.json({
      balance,
      totalIncome: totalIncome._sum.amount || 0,
      totalExpenses: totalExpenses._sum.amount || 0,
      monthlyIncome: monthlyIncome._sum.amount || 0,
      monthlyExpenses: monthlyExpenses._sum.amount || 0,
      transactionCount,
      recentTransactions
    });
  } catch (error) {
    console.error('Dashboard summary error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get monthly statistics
router.get('/monthly-stats', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { months = '12' } = req.query;
    const monthsNum = parseInt(months as string);

    const monthlyStats = await prisma.$queryRaw`
      SELECT 
        DATE_TRUNC('month', date) as month,
        type,
        SUM(amount) as total
      FROM "Transaction"
      WHERE "userId" = ${userId}
        AND date >= NOW() - INTERVAL '${monthsNum} months'
      GROUP BY DATE_TRUNC('month', date), type
      ORDER BY month DESC
    ` as Array<{ month: Date; type: string; total: number }>;

    // Format data for frontend
    const formattedStats = monthlyStats.reduce((acc: any[], stat) => {
      const monthStr = stat.month.toISOString().slice(0, 7); // YYYY-MM format
      let existing = acc.find(item => item.month === monthStr);
      
      if (!existing) {
        existing = { month: monthStr, income: 0, expenses: 0 };
        acc.push(existing);
      }
      
      if (stat.type === 'income') {
        existing.income = Number(stat.total);
      } else {
        existing.expenses = Number(stat.total);
      }
      
      return acc;
    }, []);

    res.json(formattedStats);
  } catch (error) {
    console.error('Monthly stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get category breakdown
router.get('/category-breakdown', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { period = 'month' } = req.query;

    let dateFilter = {};
    if (period === 'month') {
      const currentDate = new Date();
      const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
      dateFilter = {
        date: {
          gte: monthStart,
          lte: monthEnd
        }
      };
    } else if (period === 'year') {
      const yearStart = new Date(new Date().getFullYear(), 0, 1);
      const yearEnd = new Date(new Date().getFullYear(), 11, 31);
      dateFilter = {
        date: {
          gte: yearStart,
          lte: yearEnd
        }
      };
    }

    const categoryBreakdown = await prisma.transaction.groupBy({
      by: ['categoryId', 'type'],
      where: {
        userId,
        ...dateFilter
      },
      _sum: {
        amount: true
      }
    });

    // Get category details
    const categories = await prisma.category.findMany({
      where: { userId }
    });

    const categoryMap = categories.reduce((acc, cat) => {
      acc[cat.id] = cat;
      return acc;
    }, {} as Record<number, any>);

    // Format data
    const formattedBreakdown = categoryBreakdown
      .filter(item => item._sum.amount && item._sum.amount > 0)
      .map(item => ({
        category: categoryMap[item.categoryId],
        type: item.type,
        amount: item._sum.amount,
        percentage: 0 // Will be calculated on frontend
      }))
      .filter(item => item.category); // Remove items with deleted categories

    res.json(formattedBreakdown);
  } catch (error) {
    console.error('Category breakdown error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get spending trends
router.get('/trends', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { period = 'month', type = 'expense' } = req.query;

    let groupBy = 'day';
    let dateFilter = {};
    
    if (period === 'week') {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      dateFilter = { date: { gte: weekAgo } };
      groupBy = 'day';
    } else if (period === 'month') {
      const monthAgo = new Date();
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      dateFilter = { date: { gte: monthAgo } };
      groupBy = 'day';
    } else if (period === 'year') {
      const yearAgo = new Date();
      yearAgo.setFullYear(yearAgo.getFullYear() - 1);
      dateFilter = { date: { gte: yearAgo } };
      groupBy = 'month';
    }

    const trends = await prisma.$queryRaw`
      SELECT 
        DATE_TRUNC(${groupBy}, date) as period,
        SUM(amount) as total,
        COUNT(*) as count
      FROM "Transaction"
      WHERE "userId" = ${userId}
        AND type = ${type}
        AND date >= ${(dateFilter as any).date?.gte || new Date('1900-01-01')}
      GROUP BY DATE_TRUNC(${groupBy}, date)
      ORDER BY period ASC
    ` as Array<{ period: Date; total: number; count: number }>;

    const formattedTrends = trends.map(trend => ({
      period: trend.period.toISOString().split('T')[0],
      total: Number(trend.total),
      count: Number(trend.count)
    }));

    res.json(formattedTrends);
  } catch (error) {
    console.error('Trends error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get budget overview for current month
router.get('/budget-overview', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const currentDate = new Date();
    const currentMonth = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
    
    // Get current month's budget
    const budget = await prisma.budget.findUnique({
      where: {
        userId_month: { userId, month: currentMonth }
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
      res.json({ 
        hasBudget: false,
        message: 'No budget set for current month'
      });
      return;
    }

    // Get spending for current month
    const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

    const transactions = await prisma.transaction.findMany({
      where: {
        userId,
        type: 'expense',
        date: {
          gte: monthStart,
          lte: monthEnd
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

    // Calculate total spending
    const totalSpent = transactions.reduce((sum, t) => sum + t.amount, 0);
    const remainingBudget = budget.totalBudget - totalSpent;
    const budgetUsedPercentage = (totalSpent / budget.totalBudget) * 100;

    // Calculate category budget status
    const categoryBudgetStatus = budget.categoryBudgets.map(cb => {
      const spent = categorySpending[cb.categoryId] || 0;
      const remaining = cb.budgetAmount - spent;
      const percentage = cb.budgetAmount > 0 ? (spent / cb.budgetAmount) * 100 : 0;
      
      let status = 'good';
      if (percentage >= 100) status = 'over';
      else if (percentage >= 80) status = 'warning';

      return {
        categoryId: cb.categoryId,
        categoryName: cb.category.name,
        categoryColor: cb.category.color,
        categoryIcon: cb.category.icon,
        budgetAmount: cb.budgetAmount,
        spent,
        remaining,
        percentage: Math.round(percentage),
        status
      };
    });

    res.json({
      hasBudget: true,
      month: currentMonth,
      totalBudget: budget.totalBudget,
      totalSpent,
      remainingBudget,
      budgetUsedPercentage: Math.round(budgetUsedPercentage),
      status: budgetUsedPercentage >= 100 ? 'over' : budgetUsedPercentage >= 80 ? 'warning' : 'good',
      categoryBudgets: categoryBudgetStatus,
      transactionCount: transactions.length
    });
  } catch (error) {
    console.error('Budget overview error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;