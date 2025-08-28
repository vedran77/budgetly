import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { validateCategory } from '../lib/validation';

const router = Router();

// Get all categories for authenticated user
router.get('/', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const categories = await prisma.category.findMany({
      where: { userId: req.user!.userId },
      orderBy: [
        { type: 'asc' },
        { name: 'asc' }
      ]
    });

    res.json(categories);
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new category
router.post('/', authenticateToken, validateCategory, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { name, type, color, icon } = req.body;

    // Check if category with same name already exists for user
    const existingCategory = await prisma.category.findFirst({
      where: {
        userId: req.user!.userId,
        name: name.trim()
      }
    });

    if (existingCategory) {
      res.status(400).json({ error: 'Category with this name already exists' });
      return;
    }

    const category = await prisma.category.create({
      data: {
        name: name.trim(),
        type,
        color,
        icon,
        userId: req.user!.userId
      }
    });

    res.status(201).json(category);
  } catch (error) {
    console.error('Create category error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update category
router.put('/:id', authenticateToken, validateCategory, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, type, color, icon } = req.body;

    // Check if category exists and belongs to user
    const existingCategory = await prisma.category.findFirst({
      where: {
        id: parseInt(id),
        userId: req.user!.userId
      }
    });

    if (!existingCategory) {
      res.status(404).json({ error: 'Category not found' });
      return;
    }

    // Check if another category with same name exists for user (excluding current)
    const duplicateCategory = await prisma.category.findFirst({
      where: {
        userId: req.user!.userId,
        name: name.trim(),
        id: { not: parseInt(id) }
      }
    });

    if (duplicateCategory) {
      res.status(400).json({ error: 'Category with this name already exists' });
      return;
    }

    const category = await prisma.category.update({
      where: { id: parseInt(id) },
      data: {
        name: name.trim(),
        type,
        color,
        icon
      }
    });

    res.json(category);
  } catch (error) {
    console.error('Update category error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete category
router.delete('/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Check if category exists and belongs to user
    const category = await prisma.category.findFirst({
      where: {
        id: parseInt(id),
        userId: req.user!.userId
      },
      include: {
        _count: {
          select: { transactions: true }
        }
      }
    });

    if (!category) {
      res.status(404).json({ error: 'Category not found' });
      return;
    }

    // Prevent deletion if category has transactions
    if (category._count.transactions > 0) {
      res.status(400).json({ 
        error: 'Cannot delete category with existing transactions',
        transactionCount: category._count.transactions
      });
      return;
    }

    await prisma.category.delete({
      where: { id: parseInt(id) }
    });

    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    console.error('Delete category error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;