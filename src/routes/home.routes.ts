import express from 'express';
import { getWelcomeMessage, getVersion } from '../controllers/home.controller.js';

const router = express.Router();

// Welcome route
router.get('/', getWelcomeMessage);

// Version route
router.get('/version', getVersion);

export default router;
