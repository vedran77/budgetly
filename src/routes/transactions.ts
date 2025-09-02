import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { validateTransaction } from '../lib/validation';

const router = Router();

// Get transactions with filtering and pagination
router.get('/', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const {
      page = '1',
      limit = '20',
      search = '',
      category = '',
      type = '',
      startDate = '',
      endDate = ''
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Build where clause
    const whereClause: any = {
      userId: req.user!.userId
    };

    if (search) {
      whereClause.description = {
        contains: search as string,
        mode: 'insensitive'
      };
    }

    if (category) {
      whereClause.categoryId = parseInt(category as string);
    }

    if (type && (type === 'income' || type === 'expense')) {
      whereClause.type = type;
    }

    if (startDate || endDate) {
      whereClause.date = {};
      if (startDate) {
        whereClause.date.gte = new Date(startDate as string);
      }
      if (endDate) {
        whereClause.date.lte = new Date(endDate as string);
      }
    }

    // Get transactions with category information
    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where: whereClause,
        include: {
          category: {
            select: {
              id: true,
              name: true,
              color: true,
              icon: true,
              type: true
            }
          }
        },
        orderBy: { date: 'desc' },
        skip,
        take: limitNum
      }),
      prisma.transaction.count({ where: whereClause })
    ]);

    const totalPages = Math.ceil(total / limitNum);

    res.json({
      transactions,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalItems: total,
        itemsPerPage: limitNum,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1
      }
    });
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new transaction
router.post('/', authenticateToken, validateTransaction, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { amount, description, date, type, categoryId } = req.body;

    // Verify category belongs to user and type matches
    const category = await prisma.category.findFirst({
      where: {
        id: categoryId,
        userId: req.user!.userId
      }
    });

    if (!category) {
      res.status(404).json({ error: 'Category not found or does not belong to user' });
      return;
    }

    if (category.type !== type) {
      res.status(400).json({ 
        error: `Category type (${category.type}) does not match transaction type (${type})` 
      });
      return;
    }

    const transaction = await prisma.transaction.create({
      data: {
        amount: parseFloat(amount),
        description: description?.trim() || null,
        date: new Date(date),
        type,
        categoryId,
        userId: req.user!.userId
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            color: true,
            icon: true,
            type: true
          }
        }
      }
    });

    res.status(201).json(transaction);
  } catch (error) {
    console.error('Create transaction error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update transaction
router.put('/:id', authenticateToken, validateTransaction, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { amount, description, date, type, categoryId } = req.body;

    // Check if transaction exists and belongs to user
    const existingTransaction = await prisma.transaction.findFirst({
      where: {
        id: parseInt(id),
        userId: req.user!.userId
      }
    });

    if (!existingTransaction) {
      res.status(404).json({ error: 'Transaction not found' });
      return;
    }

    // Verify category belongs to user and type matches
    const category = await prisma.category.findFirst({
      where: {
        id: categoryId,
        userId: req.user!.userId
      }
    });

    if (!category) {
      res.status(404).json({ error: 'Category not found or does not belong to user' });
      return;
    }

    if (category.type !== type) {
      res.status(400).json({ 
        error: `Category type (${category.type}) does not match transaction type (${type})` 
      });
      return;
    }

    const transaction = await prisma.transaction.update({
      where: { id: parseInt(id) },
      data: {
        amount: parseFloat(amount),
        description: description?.trim() || null,
        date: new Date(date),
        type,
        categoryId
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            color: true,
            icon: true,
            type: true
          }
        }
      }
    });

    res.json(transaction);
  } catch (error) {
    console.error('Update transaction error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete transaction
router.delete('/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Check if transaction exists and belongs to user
    const transaction = await prisma.transaction.findFirst({
      where: {
        id: parseInt(id),
        userId: req.user!.userId
      }
    });

    if (!transaction) {
      res.status(404).json({ error: 'Transaction not found' });
      return;
    }

    await prisma.transaction.delete({
      where: { id: parseInt(id) }
    });

    res.json({ message: 'Transaction deleted successfully' });
  } catch (error) {
    console.error('Delete transaction error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single transaction
router.get('/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const transaction = await prisma.transaction.findFirst({
      where: {
        id: parseInt(id),
        userId: req.user!.userId
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            color: true,
            icon: true,
            type: true
          }
        }
      }
    });

    if (!transaction) {
      res.status(404).json({ error: 'Transaction not found' });
      return;
    }

    res.json(transaction);
  } catch (error) {
    console.error('Get transaction error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;