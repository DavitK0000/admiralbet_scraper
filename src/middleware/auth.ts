import { Request, Response, NextFunction } from 'express';

// Hardcoded password - change this to your desired password
const ADMIN_PASSWORD = 'admin123';

export const requireAuth = (req: Request, res: Response, next: NextFunction): void => {
  if (req.session && req.session.authenticated) {
    next();
  } else {
    res.redirect('/login');
  }
};

export const checkPassword = (password: string): boolean => {
  return password === ADMIN_PASSWORD;
};

// Extend Express Session interface
declare module 'express-session' {
  interface SessionData {
    authenticated: boolean;
  }
}
