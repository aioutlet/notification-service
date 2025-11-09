/**
 * Notification Service - Bootstrap Entry Point
 * Loads environment and starts the consumer application
 */

import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Import and start the application
import('./app.js')
  .then((appModule) => appModule.startConsumer())
  .catch((error) => {
    console.error('Failed to start notification service:', error);
    process.exit(1);
  });
