import { Router, Request, Response } from 'express';
import { checkPassword } from '../middleware/auth';

const router = Router();

// Login endpoint
router.post('/login', (req: Request, res: Response): void => {
  try {
    const { password } = req.body;

    if (!password) {
      res.status(400).json({
        success: false,
        error: 'Password is required'
      });
      return;
    }

    if (checkPassword(password)) {
      // Set session as authenticated
      req.session!.authenticated = true;
      
      res.json({
        success: true,
        message: 'Login successful'
      });
    } else {
      res.status(401).json({
        success: false,
        error: 'Invalid password'
      });
    }
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Login failed'
    });
  }
});

// Logout endpoint
router.post('/logout', (req: Request, res: Response): void => {
  try {
    req.session!.destroy((err) => {
      if (err) {
        console.error('Logout error:', err);
        res.status(500).json({
          success: false,
          error: 'Logout failed'
        });
        return;
      }
      
      res.json({
        success: true,
        message: 'Logged out successfully'
      });
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      error: 'Logout failed'
    });
  }
});

// Check authentication status
router.get('/status', (req: Request, res: Response): void => {
  res.json({
    success: true,
    authenticated: !!(req.session && req.session.authenticated)
  });
});

export default router;
