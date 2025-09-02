import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { validateCategory } from '../lib/validation';

const router = Router();

// Default categories based on specifications
const DEFAULT_CATEGORIES = [
  { name: 'Hrana i namirnice', type: 'expense', color: '#10B981', icon: 'shopping-cart' },
  { name: 'Stanovanje (kirija, režije)', type: 'expense', color: '#3B82F6', icon: 'home' },
  { name: 'Transport', type: 'expense', color: '#F59E0B', icon: 'car' },
  { name: 'Zdravlje', type: 'expense', color: '#EF4444', icon: 'heart-pulse' },
  { name: 'Zabava i izlasci', type: 'expense', color: '#8B5CF6', icon: 'party-popper' },
  { name: 'Odjeća', type: 'expense', color: '#EC4899', icon: 'shirt' },
  { name: 'Ostalo', type: 'expense', color: '#6B7280', icon: 'more-horizontal' },
  { name: 'Plata', type: 'income', color: '#10B981', icon: 'banknote' },
  { name: 'Bonus', type: 'income', color: '#22C55E', icon: 'gift' },
  { name: 'Ostali prihodi', type: 'income', color: '#059669', icon: 'plus-circle' }
];

// Seed default categories for a user
router.post('/seed-default', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    
    // Check if user already has categories
    const existingCategories = await prisma.category.findMany({
      where: { userId }
    });

    if (existingCategories.length > 0) {
      res.status(400).json({ error: 'User already has categories' });
      return;
    }

    // Create default categories
    const categories = await prisma.category.createMany({
      data: DEFAULT_CATEGORIES.map(cat => ({
        ...cat,
        userId
      }))
    });

    res.json({ 
      message: 'Default categories created successfully', 
      count: categories.count 
    });
  } catch (error) {
    console.error('Seed categories error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all categories for authenticated user
router.get('/', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const categories = await prisma.category.findMany({
      where: { userId },
      orderBy: [
        { type: 'asc' },
        { name: 'asc' }
      ]
    });

    // If no categories exist, create default ones
    if (categories.length === 0) {
      await prisma.category.createMany({
        data: DEFAULT_CATEGORIES.map(cat => ({
          ...cat,
          userId
        }))
      });

      // Fetch the newly created categories
      const newCategories = await prisma.category.findMany({
        where: { userId },
        orderBy: [
          { type: 'asc' },
          { name: 'asc' }
        ]
      });

      res.json(newCategories);
      return;
    }

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

export default router;