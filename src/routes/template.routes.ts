import { Router } from 'express';
import {
  getAllTemplates,
  getTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  renderTemplateTest,
} from '../controllers/template.controller';

const router = Router();

// GET /api/templates - Get all templates (with optional ?active=false filter)
router.get('/', getAllTemplates);

// GET /api/templates/:eventType/:channel - Get specific template
router.get('/:eventType/:channel', getTemplate);

// POST /api/templates - Create new template
router.post('/', createTemplate);

// PUT /api/templates/:id - Update template
router.put('/:id', updateTemplate);

// DELETE /api/templates/:id - Delete template
router.delete('/:id', deleteTemplate);

// POST /api/templates/test/render - Test template rendering
router.post('/test/render', renderTemplateTest);

export default router;
