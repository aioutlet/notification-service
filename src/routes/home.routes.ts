/**
 * Home Routes
 * Routes for service information and version endpoints
 */

import { Router } from 'express';
import * as homeController from '../controllers/home.controller.js';

const router = Router();

// Service information
router.get('/', homeController.info);
router.get('/version', homeController.version);

export default router;
