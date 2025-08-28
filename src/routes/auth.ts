import { Router } from 'express';
import bcrypt from 'bcrypt';
import prisma from '../lib/prisma';
import { generateToken } from '../lib/jwt';
import { validateRegistration, validateLogin } from '../lib/validation';

const router = Router();

// Register new user
router.post('/register', validateRegistration, async (req, res) => {
  try {
    const { email, name, password } = req.body;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        name,
        password: hashedPassword
      }
    });

    // Create default categories for new user
    const defaultCategories = [
      { name: 'Salary', type: 'income', color: '#10B981', icon: '💰' },
      { name: 'Freelance', type: 'income', color: '#8B5CF6', icon: '💼' },
      { name: 'Food & Dining', type: 'expense', color: '#EF4444', icon: '🍽️' },
      { name: 'Transportation', type: 'expense', color: '#F59E0B', icon: '🚗' },
      { name: 'Shopping', type: 'expense', color: '#EC4899', icon: '🛒' },
      { name: 'Bills & Utilities', type: 'expense', color: '#6B7280', icon: '⚡' },
      { name: 'Healthcare', type: 'expense', color: '#14B8A6', icon: '🏥' },
      { name: 'Entertainment', type: 'expense', color: '#F97316', icon: '🎬' }
    ];

    await prisma.category.createMany({
      data: defaultCategories.map(cat => ({
        ...cat,
        userId: user.id
      }))
    });

    // Generate token
    const token = generateToken({ userId: user.id, email: user.email });

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Login user
router.post('/login', validateLogin, async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await prisma.user.findUnique({
      where: { email }
    });

    console.log(user);

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Generate token
    const token = generateToken({ userId: user.id, email: user.email });

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Logout (client-side token removal)
router.post('/logout', (req, res) => {
  res.json({ message: 'Logged out successfully' });
});

module.exports = router;