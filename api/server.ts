/**
 * local server entry file, for local development
 */
import app from './app.js';
import { initDb } from './db.js';

/**
 * start server with port
 */
const PORT = process.env.PORT || 8086;

async function start() {
  await initDb();
  const server = app.listen(PORT, () => {
    console.log(`Server ready on port ${PORT}`);
  });

  process.on('SIGTERM', () => {
    console.log('SIGTERM signal received');
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  });

  process.on('SIGINT', () => {
    console.log('SIGINT signal received');
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  });
}

start();