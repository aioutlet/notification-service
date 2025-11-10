/**
 * Dapr Routes
 * Routes for Dapr integration endpoints
 */

import express from 'express';
import { subscribe } from '../controllers/dapr.controller.js';

const router = express.Router();

// Dapr subscription endpoint
router.get('/dapr/subscribe', subscribe);

export default router;
