import express from 'express';
import cors from 'cors';
import { config } from './config/env.js';
import { initDatabase } from './db/index.js';

// Import routes
import webhookRoutes from './routes/webhook.js';
import messagesRoutes from './routes/messages.js';
import tasksRoutes from './routes/tasks.js';
import propertiesRoutes from './routes/properties.js';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/webhook', webhookRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/properties', propertiesRoutes);

// Error handler
app.use((err, req, res, next) => {
  console.error('[Error]', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// Initialize database and start server
async function start() {
  try {
    await initDatabase();
    console.log('[DB] Database initialized');

    // Railway provides PORT env var - use it directly
    const port = process.env.PORT || 3001;
    const host = '0.0.0.0';
    console.log(`[Server] PORT env var: ${process.env.PORT}`);
    
    app.listen(port, host, () => {
      console.log(`[Server] Running on ${host}:${port}`);
      console.log(`[Server] Environment: ${config.server.nodeEnv}`);
    });
  } catch (error) {
    console.error('[Server] Failed to start:', error);
    process.exit(1);
  }
}

start();

