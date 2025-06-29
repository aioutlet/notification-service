import { Request, Response } from 'express';
import ErrorResponse from '../../src/utils/ErrorResponse';

// Mock dependencies
jest.mock('../../src/utils/logger');

// Mock the service before importing the controller
const mockTemplateService = {
  getAllTemplates: jest.fn(),
  getTemplate: jest.fn(),
  createTemplate: jest.fn(),
  updateTemplate: jest.fn(),
  deleteTemplate: jest.fn(),
  renderTemplate: jest.fn(),
};

jest.mock('../../src/services/template.service', () => {
  return jest.fn().mockImplementation(() => mockTemplateService);
});

// Import after mocking
import {
  getAllTemplates,
  getTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  testTemplateRendering,
  renderTemplateTest,
} from '../../src/controllers/template.controller';
import logger from '../../src/utils/logger';
import { NotificationTemplate } from '../../src/services/template.service';

describe('Template Controller', () => {
  // Create mock response object
  const mockResponse = () => {
    const res = {} as Response;
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  };

  // Create mock request object
  const mockRequest = (overrides: Partial<Request> = {}) => {
    const req = {
      body: {},
      params: {},
      query: {},
      ...overrides,
    } as Request;
    return req;
  };

  // Mock template data
  const mockTemplate: NotificationTemplate = {
    id: 1,
    event_type: 'ORDER_CREATED',
    channel: 'email',
    template_name: 'Order Created Email',
    subject: 'Your Order {{orderId}} has been created',
    message_template: 'Hello {{customerName}}, your order {{orderId}} has been created successfully.',
    is_active: true,
    created_at: new Date('2024-01-01T00:00:00Z'),
    updated_at: new Date('2024-01-01T00:00:00Z'),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset all mock functions
    mockTemplateService.getAllTemplates.mockReset();
    mockTemplateService.getTemplate.mockReset();
    mockTemplateService.createTemplate.mockReset();
    mockTemplateService.updateTemplate.mockReset();
    mockTemplateService.deleteTemplate.mockReset();
    mockTemplateService.renderTemplate.mockReset();
  });

  describe('getAllTemplates', () => {
    it('should return all active templates by default', async () => {
      const req = mockRequest({
        query: {},
      });
      const res = mockResponse();

      const mockTemplates = [mockTemplate, { ...mockTemplate, id: 2 }];
      mockTemplateService.getAllTemplates.mockResolvedValue(mockTemplates);

      await getAllTemplates(req, res);

      expect(mockTemplateService.getAllTemplates).toHaveBeenCalledWith(true);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Templates retrieved successfully',
        data: mockTemplates,
        count: 2,
        filters: { activeOnly: true },
      });
    });

    it('should return all templates when active=false is specified', async () => {
      const req = mockRequest({
        query: { active: 'false' },
      });
      const res = mockResponse();

      const mockTemplates = [mockTemplate, { ...mockTemplate, id: 2, is_active: false }];
      mockTemplateService.getAllTemplates.mockResolvedValue(mockTemplates);

      await getAllTemplates(req, res);

      expect(mockTemplateService.getAllTemplates).toHaveBeenCalledWith(false);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          filters: { activeOnly: false },
        })
      );
    });

    it('should handle service errors', async () => {
      const req = mockRequest();
      const res = mockResponse();

      const mockError = new Error('Database error');
      mockTemplateService.getAllTemplates.mockRejectedValue(mockError);

      await getAllTemplates(req, res);

      expect(logger.error).toHaveBeenCalledWith('Error getting templates:', mockError);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Failed to get templates',
        error: 'Database error',
      });
    });
  });

  describe('getTemplate', () => {
    it('should return template when found', async () => {
      const req = mockRequest({
        params: { eventType: 'ORDER_CREATED', channel: 'email' },
      });
      const res = mockResponse();

      mockTemplateService.getTemplate.mockResolvedValue(mockTemplate);

      await getTemplate(req, res);

      expect(mockTemplateService.getTemplate).toHaveBeenCalledWith('ORDER_CREATED', 'email');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Template retrieved successfully',
        data: mockTemplate,
      });
    });

    it('should return 404 when template not found', async () => {
      const req = mockRequest({
        params: { eventType: 'NONEXISTENT', channel: 'email' },
      });
      const res = mockResponse();

      mockTemplateService.getTemplate.mockResolvedValue(null);

      await getTemplate(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Template not found',
        eventType: 'NONEXISTENT',
        channel: 'email',
      });
    });

    it('should return 400 when eventType is missing', async () => {
      const req = mockRequest({
        params: { channel: 'email' },
      });
      const res = mockResponse();

      await getTemplate(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'eventType and channel are required',
      });
    });

    it('should return 400 when channel is missing', async () => {
      const req = mockRequest({
        params: { eventType: 'ORDER_CREATED' },
      });
      const res = mockResponse();

      await getTemplate(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'eventType and channel are required',
      });
    });

    it('should handle service errors', async () => {
      const req = mockRequest({
        params: { eventType: 'ORDER_CREATED', channel: 'email' },
      });
      const res = mockResponse();

      const mockError = new Error('Database error');
      mockTemplateService.getTemplate.mockRejectedValue(mockError);

      await getTemplate(req, res);

      expect(logger.error).toHaveBeenCalledWith('Error getting template:', mockError);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Failed to get template',
        error: 'Database error',
      });
    });
  });

  describe('createTemplate', () => {
    it('should create template successfully with all required fields', async () => {
      const req = mockRequest({
        body: {
          event_type: 'ORDER_CREATED',
          channel: 'email',
          template_name: 'Order Created Email',
          subject: 'Your Order has been created',
          message_template: 'Hello {{customerName}}, your order has been created.',
          is_active: true,
        },
      });
      const res = mockResponse();

      mockTemplateService.createTemplate.mockResolvedValue(123);

      await createTemplate(req, res);

      expect(mockTemplateService.createTemplate).toHaveBeenCalledWith({
        event_type: 'ORDER_CREATED',
        channel: 'email',
        template_name: 'Order Created Email',
        subject: 'Your Order has been created',
        message_template: 'Hello {{customerName}}, your order has been created.',
        is_active: true,
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Template created successfully',
        data: {
          id: 123,
          event_type: 'ORDER_CREATED',
          channel: 'email',
          template_name: 'Order Created Email',
          subject: 'Your Order has been created',
          message_template: 'Hello {{customerName}}, your order has been created.',
          is_active: true,
        },
      });
    });

    it('should create template with default is_active=true when not provided', async () => {
      const req = mockRequest({
        body: {
          event_type: 'ORDER_CREATED',
          channel: 'email',
          template_name: 'Order Created Email',
          message_template: 'Hello {{customerName}}, your order has been created.',
        },
      });
      const res = mockResponse();

      mockTemplateService.createTemplate.mockResolvedValue(123);

      await createTemplate(req, res);

      expect(mockTemplateService.createTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          is_active: true,
        })
      );
    });

    it('should return 400 when event_type is missing', async () => {
      const req = mockRequest({
        body: {
          channel: 'email',
          template_name: 'Test Template',
          message_template: 'Test message',
        },
      });
      const res = mockResponse();

      await createTemplate(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'event_type, channel, template_name, and message_template are required',
      });
    });

    it('should return 400 when channel is missing', async () => {
      const req = mockRequest({
        body: {
          event_type: 'ORDER_CREATED',
          template_name: 'Test Template',
          message_template: 'Test message',
        },
      });
      const res = mockResponse();

      await createTemplate(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 400 when template_name is missing', async () => {
      const req = mockRequest({
        body: {
          event_type: 'ORDER_CREATED',
          channel: 'email',
          message_template: 'Test message',
        },
      });
      const res = mockResponse();

      await createTemplate(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 400 when message_template is missing', async () => {
      const req = mockRequest({
        body: {
          event_type: 'ORDER_CREATED',
          channel: 'email',
          template_name: 'Test Template',
        },
      });
      const res = mockResponse();

      await createTemplate(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 400 for invalid channel', async () => {
      const req = mockRequest({
        body: {
          event_type: 'ORDER_CREATED',
          channel: 'invalid_channel',
          template_name: 'Test Template',
          message_template: 'Test message',
        },
      });
      const res = mockResponse();

      await createTemplate(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid channel. Must be one of: email, sms, push, webhook',
      });
    });

    it('should handle service errors', async () => {
      const req = mockRequest({
        body: {
          event_type: 'ORDER_CREATED',
          channel: 'email',
          template_name: 'Test Template',
          message_template: 'Test message',
        },
      });
      const res = mockResponse();

      const mockError = new Error('Database error');
      mockTemplateService.createTemplate.mockRejectedValue(mockError);

      await createTemplate(req, res);

      expect(logger.error).toHaveBeenCalledWith('Error creating template:', mockError);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Failed to create template',
        error: 'Database error',
      });
    });
  });

  describe('updateTemplate', () => {
    it('should update template successfully', async () => {
      const req = mockRequest({
        params: { id: '123' },
        body: {
          template_name: 'Updated Template Name',
          subject: 'Updated Subject',
          is_active: false,
        },
      });
      const res = mockResponse();

      mockTemplateService.updateTemplate.mockResolvedValue(true);

      await updateTemplate(req, res);

      expect(mockTemplateService.updateTemplate).toHaveBeenCalledWith(123, {
        template_name: 'Updated Template Name',
        subject: 'Updated Subject',
        is_active: false,
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Template updated successfully',
        data: {
          id: 123,
          template_name: 'Updated Template Name',
          subject: 'Updated Subject',
          is_active: false,
        },
      });
    });

    it('should return 400 for invalid template ID', async () => {
      const req = mockRequest({
        params: { id: 'invalid' },
        body: { template_name: 'Updated Name' },
      });
      const res = mockResponse();

      await updateTemplate(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid template ID',
      });
    });

    it('should return 400 for invalid channel', async () => {
      const req = mockRequest({
        params: { id: '123' },
        body: {
          channel: 'invalid_channel',
          template_name: 'Updated Name',
        },
      });
      const res = mockResponse();

      await updateTemplate(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid channel. Must be one of: email, sms, push, webhook',
      });
    });

    it('should return 404 when template not found', async () => {
      const req = mockRequest({
        params: { id: '999' },
        body: { template_name: 'Updated Name' },
      });
      const res = mockResponse();

      mockTemplateService.updateTemplate.mockResolvedValue(false);

      await updateTemplate(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Template not found or no changes made',
      });
    });

    it('should handle service errors', async () => {
      const req = mockRequest({
        params: { id: '123' },
        body: { template_name: 'Updated Name' },
      });
      const res = mockResponse();

      const mockError = new Error('Database error');
      mockTemplateService.updateTemplate.mockRejectedValue(mockError);

      await updateTemplate(req, res);

      expect(logger.error).toHaveBeenCalledWith('Error updating template:', mockError);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Failed to update template',
        error: 'Database error',
      });
    });
  });

  describe('deleteTemplate', () => {
    it('should delete template successfully', async () => {
      const req = mockRequest({
        params: { id: '123' },
      });
      const res = mockResponse();

      mockTemplateService.deleteTemplate.mockResolvedValue(true);

      await deleteTemplate(req, res);

      expect(mockTemplateService.deleteTemplate).toHaveBeenCalledWith(123);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Template deleted successfully',
      });
    });

    it('should return 400 for invalid template ID', async () => {
      const req = mockRequest({
        params: { id: 'invalid' },
      });
      const res = mockResponse();

      await deleteTemplate(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid template ID',
      });
    });

    it('should return 404 when template not found', async () => {
      const req = mockRequest({
        params: { id: '999' },
      });
      const res = mockResponse();

      mockTemplateService.deleteTemplate.mockResolvedValue(false);

      await deleteTemplate(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Template not found',
      });
    });

    it('should handle service errors', async () => {
      const req = mockRequest({
        params: { id: '123' },
      });
      const res = mockResponse();

      const mockError = new Error('Database error');
      mockTemplateService.deleteTemplate.mockRejectedValue(mockError);

      await deleteTemplate(req, res);

      expect(logger.error).toHaveBeenCalledWith('Error deleting template:', mockError);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Failed to delete template',
        error: 'Database error',
      });
    });
  });

  describe('testTemplateRendering', () => {
    it('should render template successfully', async () => {
      const req = mockRequest({
        body: {
          event_type: 'ORDER_CREATED',
          channel: 'email',
          variables: {
            customerName: 'John Doe',
            orderId: 'ORDER123',
          },
        },
      });
      const res = mockResponse();

      const mockRendered = {
        subject: 'Your Order ORDER123 has been created',
        message: 'Hello John Doe, your order ORDER123 has been created successfully.',
      };

      mockTemplateService.getTemplate.mockResolvedValue(mockTemplate);
      mockTemplateService.renderTemplate.mockReturnValue(mockRendered);

      await testTemplateRendering(req, res);

      expect(mockTemplateService.getTemplate).toHaveBeenCalledWith('ORDER_CREATED', 'email');
      expect(mockTemplateService.renderTemplate).toHaveBeenCalledWith(mockTemplate, {
        customerName: 'John Doe',
        orderId: 'ORDER123',
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Template rendered successfully',
        data: {
          template: {
            id: mockTemplate.id,
            event_type: mockTemplate.event_type,
            channel: mockTemplate.channel,
            template_name: mockTemplate.template_name,
          },
          variables: {
            customerName: 'John Doe',
            orderId: 'ORDER123',
          },
          rendered: mockRendered,
        },
      });
    });

    it('should use empty variables object when not provided', async () => {
      const req = mockRequest({
        body: {
          event_type: 'ORDER_CREATED',
          channel: 'email',
        },
      });
      const res = mockResponse();

      mockTemplateService.getTemplate.mockResolvedValue(mockTemplate);
      mockTemplateService.renderTemplate.mockReturnValue({
        subject: 'Your Order {{orderId}} has been created',
        message: 'Hello {{customerName}}, your order {{orderId}} has been created successfully.',
      });

      await testTemplateRendering(req, res);

      expect(mockTemplateService.renderTemplate).toHaveBeenCalledWith(mockTemplate, {});
    });

    it('should return 400 when event_type is missing', async () => {
      const req = mockRequest({
        body: {
          channel: 'email',
          variables: {},
        },
      });
      const res = mockResponse();

      await testTemplateRendering(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'event_type and channel are required',
      });
    });

    it('should return 400 when channel is missing', async () => {
      const req = mockRequest({
        body: {
          event_type: 'ORDER_CREATED',
          variables: {},
        },
      });
      const res = mockResponse();

      await testTemplateRendering(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'event_type and channel are required',
      });
    });

    it('should return 404 when template not found', async () => {
      const req = mockRequest({
        body: {
          event_type: 'NONEXISTENT',
          channel: 'email',
          variables: {},
        },
      });
      const res = mockResponse();

      mockTemplateService.getTemplate.mockResolvedValue(null);

      await testTemplateRendering(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Template not found for the specified event and channel',
        event_type: 'NONEXISTENT',
        channel: 'email',
      });
    });

    it('should handle service errors', async () => {
      const req = mockRequest({
        body: {
          event_type: 'ORDER_CREATED',
          channel: 'email',
          variables: {},
        },
      });
      const res = mockResponse();

      const mockError = new Error('Template rendering error');
      mockTemplateService.getTemplate.mockRejectedValue(mockError);

      await testTemplateRendering(req, res);

      expect(logger.error).toHaveBeenCalledWith('Error testing template rendering:', mockError);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Failed to test template rendering',
        error: 'Template rendering error',
      });
    });
  });

  describe('renderTemplateTest', () => {
    it('should render template with custom variables successfully', async () => {
      const req = mockRequest({
        body: {
          eventType: 'ORDER_CREATED',
          channel: 'email',
          variables: {
            customerName: 'Jane Doe',
            orderId: 'ORDER456',
          },
        },
      });
      const res = mockResponse();

      const mockRendered = {
        subject: 'Your Order ORDER456 has been created',
        message: 'Hello Jane Doe, your order ORDER456 has been created successfully.',
      };

      mockTemplateService.getTemplate.mockResolvedValue(mockTemplate);
      mockTemplateService.renderTemplate.mockReturnValue(mockRendered);

      await renderTemplateTest(req, res);

      expect(mockTemplateService.getTemplate).toHaveBeenCalledWith('ORDER_CREATED', 'email');
      expect(mockTemplateService.renderTemplate).toHaveBeenCalledWith(mockTemplate, {
        customerName: 'Jane Doe',
        orderId: 'ORDER456',
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Template rendered successfully',
        data: {
          template: {
            id: mockTemplate.id,
            event_type: mockTemplate.event_type,
            channel: mockTemplate.channel,
            template_name: mockTemplate.template_name,
          },
          variables: {
            customerName: 'Jane Doe',
            orderId: 'ORDER456',
          },
          rendered: mockRendered,
        },
      });
    });

    it('should return 400 when eventType is missing', async () => {
      const req = mockRequest({
        body: {
          channel: 'email',
          variables: {},
        },
      });
      const res = mockResponse();

      await renderTemplateTest(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'eventType, channel, and variables are required',
      });
    });

    it('should return 400 when channel is missing', async () => {
      const req = mockRequest({
        body: {
          eventType: 'ORDER_CREATED',
          variables: {},
        },
      });
      const res = mockResponse();

      await renderTemplateTest(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'eventType, channel, and variables are required',
      });
    });

    it('should return 400 when variables is missing', async () => {
      const req = mockRequest({
        body: {
          eventType: 'ORDER_CREATED',
          channel: 'email',
        },
      });
      const res = mockResponse();

      await renderTemplateTest(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'eventType, channel, and variables are required',
      });
    });

    it('should return 404 when template not found', async () => {
      const req = mockRequest({
        body: {
          eventType: 'NONEXISTENT',
          channel: 'email',
          variables: {},
        },
      });
      const res = mockResponse();

      mockTemplateService.getTemplate.mockResolvedValue(null);

      await renderTemplateTest(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Template not found',
        eventType: 'NONEXISTENT',
        channel: 'email',
      });
    });

    it('should handle service errors', async () => {
      const req = mockRequest({
        body: {
          eventType: 'ORDER_CREATED',
          channel: 'email',
          variables: {},
        },
      });
      const res = mockResponse();

      const mockError = new Error('Template rendering error');
      mockTemplateService.getTemplate.mockRejectedValue(mockError);

      await renderTemplateTest(req, res);

      expect(logger.error).toHaveBeenCalledWith('Error testing template rendering:', mockError);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Failed to test template rendering',
        error: 'Template rendering error',
      });
    });
  });
});
