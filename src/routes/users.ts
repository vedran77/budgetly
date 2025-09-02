import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// Get user profile
router.get('/profile', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    
    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        currency: true,
        createdAt: true,
        updatedAt: true,
      }
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({ user });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user profile
router.put('/profile', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const { name, currency } = req.body;
    
    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    // Validate input
    if (name && typeof name !== 'string') {
      res.status(400).json({ error: 'Name must be a string' });
      return;
    }

    if (currency && typeof currency !== 'string') {
      res.status(400).json({ error: 'Currency must be a string' });
      return;
    }

    // Validate currency code (basic validation)
    if (currency && currency.length !== 3) {
      res.status(400).json({ error: 'Currency code must be 3 characters' });
      return;
    }

    const updateData: { name?: string; currency?: string } = {};
    if (name) updateData.name = name;
    if (currency) updateData.currency = currency.toUpperCase();

    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        currency: true,
        updatedAt: true,
      }
    });

    res.json({
      message: 'Profile updated successfully',
      user
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user currency
router.put('/currency', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const { currency } = req.body;
    
    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    if (!currency || typeof currency !== 'string') {
      res.status(400).json({ error: 'Currency code is required' });
      return;
    }

    if (currency.length !== 3) {
      res.status(400).json({ error: 'Currency code must be 3 characters' });
      return;
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: { currency: currency.toUpperCase() },
      select: {
        id: true,
        email: true,
        name: true,
        currency: true,
        updatedAt: true,
      }
    });

    res.json({
      message: 'Currency updated successfully',
      user
    });
  } catch (error) {
    console.error('Update currency error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;