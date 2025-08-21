import { Request, Response } from 'express';
import TemplateService, { NotificationTemplate } from '../services/template.service.js';
import logger from '../utils/logger.js';

const templateService = new TemplateService();

// GET /api/templates - Get all templates
export async function getAllTemplates(req: Request, res: Response): Promise<void> {
  try {
    const activeOnly = req.query.active !== 'false'; // Default to true unless explicitly set to false
    const templates = await templateService.getAllTemplates(activeOnly);

    res.status(200).json({
      success: true,
      message: 'Templates retrieved successfully',
      data: templates,
      count: templates.length,
      filters: { activeOnly },
    });
  } catch (error) {
    logger.error('Error getting templates:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get templates',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// GET /api/templates/:eventType/:channel - Get specific template
export async function getTemplate(req: Request, res: Response): Promise<void> {
  try {
    const { eventType, channel } = req.params;

    if (!eventType || !channel) {
      res.status(400).json({
        success: false,
        message: 'eventType and channel are required',
      });
      return;
    }

    const template = await templateService.getTemplate(eventType, channel);

    if (!template) {
      res.status(404).json({
        success: false,
        message: 'Template not found',
        eventType,
        channel,
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Template retrieved successfully',
      data: template,
    });
  } catch (error) {
    logger.error('Error getting template:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get template',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// POST /api/templates - Create new template
export async function createTemplate(req: Request, res: Response): Promise<void> {
  try {
    const { event_type, channel, template_name, subject, message_template, is_active = true } = req.body;

    // Validation
    if (!event_type || !channel || !template_name || !message_template) {
      res.status(400).json({
        success: false,
        message: 'event_type, channel, template_name, and message_template are required',
      });
      return;
    }

    // Validate channel
    const validChannels = ['email', 'sms', 'push', 'webhook'];
    if (!validChannels.includes(channel)) {
      res.status(400).json({
        success: false,
        message: 'Invalid channel. Must be one of: ' + validChannels.join(', '),
      });
      return;
    }

    const templateData: Omit<NotificationTemplate, 'id' | 'created_at' | 'updated_at'> = {
      event_type,
      channel,
      template_name,
      subject,
      message_template,
      is_active,
    };

    const templateId = await templateService.createTemplate(templateData);

    res.status(201).json({
      success: true,
      message: 'Template created successfully',
      data: {
        id: templateId,
        ...templateData,
      },
    });
  } catch (error) {
    logger.error('Error creating template:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create template',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// PUT /api/templates/:id - Update template
export async function updateTemplate(req: Request, res: Response): Promise<void> {
  try {
    const templateId = parseInt(req.params.id);

    if (isNaN(templateId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid template ID',
      });
      return;
    }

    const { event_type, channel, template_name, subject, message_template, is_active } = req.body;

    // Validate channel if provided
    if (channel) {
      const validChannels = ['email', 'sms', 'push', 'webhook'];
      if (!validChannels.includes(channel)) {
        res.status(400).json({
          success: false,
          message: 'Invalid channel. Must be one of: ' + validChannels.join(', '),
        });
        return;
      }
    }

    const updates: Partial<NotificationTemplate> = {};
    if (event_type !== undefined) updates.event_type = event_type;
    if (channel !== undefined) updates.channel = channel;
    if (template_name !== undefined) updates.template_name = template_name;
    if (subject !== undefined) updates.subject = subject;
    if (message_template !== undefined) updates.message_template = message_template;
    if (is_active !== undefined) updates.is_active = is_active;

    const success = await templateService.updateTemplate(templateId, updates);

    if (!success) {
      res.status(404).json({
        success: false,
        message: 'Template not found or no changes made',
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Template updated successfully',
      data: {
        id: templateId,
        ...updates,
      },
    });
  } catch (error) {
    logger.error('Error updating template:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update template',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// DELETE /api/templates/:id - Delete template
export async function deleteTemplate(req: Request, res: Response): Promise<void> {
  try {
    const templateId = parseInt(req.params.id);

    if (isNaN(templateId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid template ID',
      });
      return;
    }

    const success = await templateService.deleteTemplate(templateId);

    if (!success) {
      res.status(404).json({
        success: false,
        message: 'Template not found',
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Template deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting template:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete template',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// POST /api/templates/test/render - Test template rendering
export async function testTemplateRendering(req: Request, res: Response): Promise<void> {
  try {
    const { event_type, channel, variables = {} } = req.body;

    if (!event_type || !channel) {
      res.status(400).json({
        success: false,
        message: 'event_type and channel are required',
      });
      return;
    }

    const template = await templateService.getTemplate(event_type, channel);

    if (!template) {
      res.status(404).json({
        success: false,
        message: 'Template not found for the specified event and channel',
        event_type,
        channel,
      });
      return;
    }

    const rendered = templateService.renderTemplate(template, variables);

    res.status(200).json({
      success: true,
      message: 'Template rendered successfully',
      data: {
        template: {
          id: template.id,
          event_type: template.event_type,
          channel: template.channel,
          template_name: template.template_name,
        },
        variables,
        rendered,
      },
    });
  } catch (error) {
    logger.error('Error testing template rendering:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to test template rendering',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// POST /api/templates/test/render - Test template rendering with custom data
export async function renderTemplateTest(req: Request, res: Response): Promise<void> {
  try {
    const { eventType, channel, variables } = req.body;

    if (!eventType || !channel || !variables) {
      res.status(400).json({
        success: false,
        message: 'eventType, channel, and variables are required',
      });
      return;
    }

    const template = await templateService.getTemplate(eventType, channel);

    if (!template) {
      res.status(404).json({
        success: false,
        message: 'Template not found',
        eventType,
        channel,
      });
      return;
    }

    const rendered = templateService.renderTemplate(template, variables);

    res.status(200).json({
      success: true,
      message: 'Template rendered successfully',
      data: {
        template: {
          id: template.id,
          event_type: template.event_type,
          channel: template.channel,
          template_name: template.template_name,
        },
        variables,
        rendered,
      },
    });
  } catch (error) {
    logger.error('Error testing template rendering:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to test template rendering',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
