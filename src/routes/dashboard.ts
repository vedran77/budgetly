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

// Get daily budget tracking
router.get('/daily-budget', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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

    // Calculate days in current month
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const currentDay = currentDate.getDate();
    const remainingDaysInMonth = daysInMonth - currentDay + 1;

    // Get spending for current month
    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 0);
    
    // Get today's spending
    const todayStart = new Date(year, month, currentDay);
    const todayEnd = new Date(year, month, currentDay, 23, 59, 59);

    const [monthlyTransactions, todayTransactions] = await Promise.all([
      prisma.transaction.findMany({
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
      }),
      prisma.transaction.findMany({
        where: {
          userId,
          type: 'expense',
          date: {
            gte: todayStart,
            lte: todayEnd
          }
        },
        include: {
          category: true
        }
      })
    ]);

    // Calculate spending by category for the month
    const categorySpending = monthlyTransactions.reduce((acc, transaction) => {
      if (!acc[transaction.categoryId]) {
        acc[transaction.categoryId] = 0;
      }
      acc[transaction.categoryId] += transaction.amount;
      return acc;
    }, {} as Record<number, number>);

    // Calculate today's spending by category
    const todaySpending = todayTransactions.reduce((acc, transaction) => {
      if (!acc[transaction.categoryId]) {
        acc[transaction.categoryId] = 0;
      }
      acc[transaction.categoryId] += transaction.amount;
      return acc;
    }, {} as Record<number, number>);

    // Calculate total spending
    const totalSpentThisMonth = monthlyTransactions.reduce((sum, t) => sum + t.amount, 0);
    const totalSpentToday = todayTransactions.reduce((sum, t) => sum + t.amount, 0);
    
    // Calculate remaining budget
    const remainingBudget = budget.totalBudget - totalSpentThisMonth;
    
    // Calculate daily budget limits
    const dailyBudgetLimit = budget.totalBudget / daysInMonth;
    const adjustedDailyLimit = remainingBudget / remainingDaysInMonth;

    // Calculate category daily budgets
    const categoryDailyBudgets = budget.categoryBudgets.map(cb => {
      const monthlySpent = categorySpending[cb.categoryId] || 0;
      const todaySpent = todaySpending[cb.categoryId] || 0;
      const remainingCategoryBudget = cb.budgetAmount - monthlySpent;
      
      // Calculate daily limits
      const originalDailyLimit = cb.budgetAmount / daysInMonth;
      const adjustedDailyLimit = remainingCategoryBudget / remainingDaysInMonth;
      
      let status = 'good';
      if (todaySpent > adjustedDailyLimit) {
        status = 'over';
      } else if (todaySpent > (adjustedDailyLimit * 0.8)) {
        status = 'warning';
      }

      return {
        categoryId: cb.categoryId,
        categoryName: cb.category.name,
        categoryColor: cb.category.color,
        categoryIcon: cb.category.icon,
        totalBudget: cb.budgetAmount,
        monthlySpent,
        remainingBudget: remainingCategoryBudget,
        originalDailyLimit,
        adjustedDailyLimit: Math.max(0, adjustedDailyLimit),
        todaySpent,
        todayRemaining: Math.max(0, adjustedDailyLimit - todaySpent),
        status
      };
    });

    // Calculate overall daily status
    let overallStatus = 'good';
    if (totalSpentToday > adjustedDailyLimit) {
      overallStatus = 'over';
    } else if (totalSpentToday > (adjustedDailyLimit * 0.8)) {
      overallStatus = 'warning';
    }

    res.json({
      hasBudget: true,
      currentDate: currentDate.toISOString().split('T')[0],
      currentDay,
      daysInMonth,
      remainingDaysInMonth,
      totalBudget: budget.totalBudget,
      totalSpentThisMonth,
      remainingBudget,
      originalDailyLimit: dailyBudgetLimit,
      adjustedDailyLimit: Math.max(0, adjustedDailyLimit),
      todaySpent: totalSpentToday,
      todayRemaining: Math.max(0, adjustedDailyLimit - totalSpentToday),
      overallStatus,
      categoryDailyBudgets,
      todayTransactionCount: todayTransactions.length
    });
  } catch (error) {
    console.error('Daily budget error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get daily budget history for a specific month
router.get('/daily-budget-history', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { month } = req.query;
    const currentDate = new Date();
    
    // Default to current month if no month specified
    const targetMonth = month as string || `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
    
    // Parse the month string (YYYY-MM)
    const [yearStr, monthStr] = targetMonth.split('-');
    const year = parseInt(yearStr);
    const monthNum = parseInt(monthStr) - 1; // JavaScript months are 0-based
    
    // Get budget for the specified month
    const budget = await prisma.budget.findUnique({
      where: {
        userId_month: { userId, month: targetMonth }
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
        error: 'No budget found for the specified month',
        month: targetMonth,
        year,
        totalBudget: 0,
        totalSpent: 0,
        averageDailySpent: 0,
        originalDailyLimit: 0,
        dailyData: []
      });
      return;
    }

    // Calculate days in the specified month
    const daysInMonth = new Date(year, monthNum + 1, 0).getDate();
    const monthStart = new Date(year, monthNum, 1);
    const monthEnd = new Date(year, monthNum + 1, 0);
    
    // Get all transactions for the month
    const monthlyTransactions = await prisma.transaction.findMany({
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

    // Group transactions by day
    const transactionsByDay = monthlyTransactions.reduce((acc, transaction) => {
      const day = new Date(transaction.date).getDate();
      if (!acc[day]) {
        acc[day] = [];
      }
      acc[day].push(transaction);
      return acc;
    }, {} as Record<number, typeof monthlyTransactions>);

    // Calculate totals
    const totalSpent = monthlyTransactions.reduce((sum, t) => sum + t.amount, 0);
    const originalDailyLimit = budget.totalBudget / daysInMonth;
    
    // Generate daily data
    const dailyData = [];
    const isCurrentMonth = year === currentDate.getFullYear() && monthNum === currentDate.getMonth();
    const currentDay = isCurrentMonth ? currentDate.getDate() : daysInMonth;
    
    for (let day = 1; day <= daysInMonth; day++) {
      const dayTransactions = transactionsByDay[day] || [];
      const actualSpent = dayTransactions.reduce((sum, t) => sum + t.amount, 0);
      const isToday = isCurrentMonth && day === currentDate.getDate();
      const isPastDay = day <= currentDay;
      
      // Calculate remaining budget up to this day for adjusted daily limit
      const daysElapsed = day - 1;
      const spentSoFar = monthlyTransactions
        .filter(t => new Date(t.date).getDate() < day)
        .reduce((sum, t) => sum + t.amount, 0);
      const remainingBudget = budget.totalBudget - spentSoFar;
      const remainingDays = daysInMonth - daysElapsed;
      const adjustedDailyLimit = remainingDays > 0 ? remainingBudget / remainingDays : originalDailyLimit;
      
      // Calculate spending by category for this day
      const daySpendingByCategory = dayTransactions.reduce((acc, transaction) => {
        if (!acc[transaction.categoryId]) {
          acc[transaction.categoryId] = 0;
        }
        acc[transaction.categoryId] += transaction.amount;
        return acc;
      }, {} as Record<number, number>);
      
      // Create category breakdown for this day
      const categoryBreakdown = budget.categoryBudgets.map(cb => {
        const categoryDailyLimit = cb.budgetAmount / daysInMonth;
        const categorySpentToday = daySpendingByCategory[cb.categoryId] || 0;
        const categoryRemaining = categoryDailyLimit - categorySpentToday;
        
        let categoryStatus = 'good';
        if (categorySpentToday > categoryDailyLimit) {
          categoryStatus = 'over';
        } else if (categorySpentToday > (categoryDailyLimit * 0.8)) {
          categoryStatus = 'warning';
        }
        
        return {
          categoryId: cb.categoryId,
          categoryName: cb.category.name,
          categoryColor: cb.category.color,
          categoryIcon: cb.category.icon,
          dailyLimit: categoryDailyLimit,
          spent: categorySpentToday,
          remaining: categoryRemaining,
          status: categoryStatus as 'good' | 'warning' | 'over'
        };
      });
      
      // Calculate overall status for this day
      let dayStatus = 'good';
      if (actualSpent > adjustedDailyLimit) {
        dayStatus = 'over';
      } else if (actualSpent > (adjustedDailyLimit * 0.8)) {
        dayStatus = 'warning';
      }
      
      dailyData.push({
        date: new Date(year, monthNum, day).toISOString().split('T')[0],
        day,
        isToday,
        isPastDay,
        dailyLimit: adjustedDailyLimit,
        actualSpent,
        remaining: adjustedDailyLimit - actualSpent,
        status: dayStatus as 'good' | 'warning' | 'over',
        transactionCount: dayTransactions.length,
        categoryBreakdown: categoryBreakdown.filter(cb => cb.spent > 0 || cb.dailyLimit > 0)
      });
    }
    
    // Calculate average daily spending (only for past days)
    const pastDays = dailyData.filter(d => d.isPastDay && !d.isToday).length + (dailyData.find(d => d.isToday) ? 1 : 0);
    const averageDailySpent = pastDays > 0 ? totalSpent / pastDays : 0;

    res.json({
      month: targetMonth,
      year,
      totalBudget: budget.totalBudget,
      totalSpent,
      averageDailySpent,
      originalDailyLimit,
      dailyData
    });
  } catch (error) {
    console.error('Daily budget history error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;