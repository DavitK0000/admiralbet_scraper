import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import session from 'express-session';
import liveFeedRoutes from './routes/liveFeedRoutes';
import preGamesRoutes from './routes/preGamesRoutes';
import authRoutes from './routes/authRoutes';
import { requireAuth } from './middleware/auth';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session middleware
app.use(session({
  secret: process.env.SESSION_SECRET || 'betting-data-processor-secret-key-2024',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Set to true in production with HTTPS
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/live-feed', liveFeedRoutes);
app.use('/api/pre-games', preGamesRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Betting Scraper API is running',
    timestamp: new Date().toISOString()
  });
});

// Login page (no auth required)
app.get('/login', (req, res) => {
  res.sendFile('login.html', { root: 'public' });
});

// Serve login.html as static file (no auth required)
app.get('/login.html', (req, res) => {
  res.sendFile('login.html', { root: 'public' });
});

// Root endpoint (protected)
app.get('/', requireAuth, (req, res) => {
  res.sendFile('index.html', { root: 'public' });
});

// Protect main page - redirect any direct access to index.html
app.get('/index.html', requireAuth, (req, res) => {
  res.sendFile('index.html', { root: 'public' });
});

// Serve static files only for authenticated users
app.use(requireAuth);
app.use(express.static('public'));

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found'
  });
});

export default app;
