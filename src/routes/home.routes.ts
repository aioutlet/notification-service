import express from 'express';
import { getWelcomeMessage, getVersion, health } from '../controllers/home.controller';

const router = express.Router();

// Welcome route
router.get('/', getWelcomeMessage);

// Version route
router.get('/version', getVersion);

// Health check route
router.get('/health', health);

export default router;
