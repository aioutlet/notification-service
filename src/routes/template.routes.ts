import { Router } from 'express';
import {
  getAllTemplates,
  getTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  renderTemplateTest,
} from '../controllers/template.controller.js';
import { validateBody, validateParams } from '../middlewares/validation.middleware.js';
import {
  createTemplateSchema,
  updateTemplateSchema,
  renderTemplateTestSchema,
  templateIdSchema,
  templateParamsSchema,
} from '../validators/schemas.js';
import AuthMiddleware from '../middlewares/auth.middleware.js';

const router = Router();

// GET /api/templates - Get all templates (with optional ?active=false filter)
// Protected: Admin access required
router.get('/', AuthMiddleware.protect, AuthMiddleware.admin, getAllTemplates);

// GET /api/templates/:eventType/:channel - Get specific template
// Protected: Authenticated users can view templates
router.get('/:eventType/:channel', AuthMiddleware.protect, validateParams(templateParamsSchema), getTemplate);

// POST /api/templates - Create new template
// Protected: Admin access required
router.post('/', AuthMiddleware.protect, AuthMiddleware.admin, validateBody(createTemplateSchema), createTemplate);

// PUT /api/templates/:id - Update template
// Protected: Admin access required
router.put(
  '/:id',
  AuthMiddleware.protect,
  AuthMiddleware.admin,
  validateParams(templateIdSchema),
  validateBody(updateTemplateSchema),
  updateTemplate
);

// DELETE /api/templates/:id - Delete template
// Protected: Admin access required
router.delete('/:id', AuthMiddleware.protect, AuthMiddleware.admin, validateParams(templateIdSchema), deleteTemplate);

// POST /api/templates/test/render - Test template rendering
// Protected: Authenticated users can test templates
router.post('/test/render', AuthMiddleware.protect, validateBody(renderTemplateTestSchema), renderTemplateTest);

export default router;
