import express from 'express';
import cors from 'cors';
import path from 'path';
import { initializeDatabase } from './db/database';
import { seedDatabase } from './db/seed';

// Routes
import dashboardRouter from './routes/dashboard';
import eventsRouter from './routes/events';
import alertsRouter from './routes/alerts';
import casesRouter from './routes/cases';
import usersRouter from './routes/users';
import simulatorRouter from './routes/simulator';
import reportsRouter from './routes/reports';
import notificationsRouter from './routes/notifications';
import settingsRouter from './routes/settings';
import auditRouter from './routes/audit';
import authRouter from './routes/auth';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging (minimal)
app.use((req, _res, next) => {
  if (req.path.startsWith('/api')) {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  }
  next();
});

// Authentication Routes
app.use('/api/auth', authRouter);

// API Routes
app.use('/api/dashboard', dashboardRouter);
app.use('/api/events', eventsRouter);
app.use('/api/alerts', alertsRouter);
app.use('/api/cases', casesRouter);
app.use('/api/users', usersRouter);
app.use('/api/simulator', simulatorRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/audit', auditRouter);

// Geolocate endpoint
app.get('/api/geolocate/:ip', async (req, res) => {
  const { ip } = req.params;
  try {
    const response = await fetch(`http://ip-api.com/json/${ip}?fields=country,city,lat,lon,status`, {
      signal: AbortSignal.timeout(3000),
    });
    const data = await response.json() as any;
    if (data.status === 'success') {
      res.json({ success: true, country: data.country, city: data.city, lat: data.lat, lng: data.lon });
    } else {
      res.json({ success: false, message: 'External geolocation unavailable. Using local enrichment.' });
    }
  } catch {
    res.json({ success: false, message: 'External geolocation unavailable. Using local enrichment.' });
  }
});

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), service: 'SentinelTrace API' });
});

// 404 handler
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: `API endpoint not found: ${req.path}` });
});

// Error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

// Initialize DB and start
async function start() {
  try {
    initializeDatabase();
    seedDatabase();
    app.listen(PORT, () => {
      console.log(`🛡️  SentinelTrace API running on http://localhost:${PORT}`);
      console.log(`📊 Database: sentineltrace.db`);
      console.log(`🔍 Health: http://localhost:${PORT}/api/health`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
