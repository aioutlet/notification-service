import TemplateService, { TemplateVariables, NotificationTemplate } from '../../src/services/template.service';

// Mock logger
jest.mock('../../src/observability/logging/index.js');
import logger from '../../src/observability/logging/index.js';

describe('TemplateService', () => {
  let templateService: TemplateService;

  beforeEach(() => {
    jest.clearAllMocks();
    templateService = new TemplateService();
  });

  describe('Constructor and Initialization', () => {
    it('should load default templates on initialization', () => {
      expect(logger.info).toHaveBeenCalledWith(expect.stringMatching(/Loaded \d+ default templates/));
    });

    it('should create templates map', () => {
      expect(templateService).toBeDefined();
      expect(templateService).toBeInstanceOf(TemplateService);
    });
  });

  describe('getTemplate', () => {
    it('should retrieve template for auth.user.registered email', async () => {
      const template = await templateService.getTemplate('auth.user.registered', 'email');

      expect(template).toBeDefined();
      expect(template?.event_type).toBe('auth.user.registered');
      expect(template?.channel).toBe('email');
      expect(template?.template_name).toBe('User Registration');
      expect(template?.subject).toBe('Welcome to AI Outlet!');
      expect(template?.message_template).toContain('Welcome to AI Outlet');
      expect(template?.is_active).toBe(true);
    });

    it('should retrieve template for auth.email.verification.requested', async () => {
      const template = await templateService.getTemplate('auth.email.verification.requested', 'email');

      expect(template).toBeDefined();
      expect(template?.event_type).toBe('auth.email.verification.requested');
      expect(template?.subject).toBe('Verify your email address');
      expect(template?.message_template).toContain('{{verificationUrl}}');
    });

    it('should retrieve template for auth.password.reset.requested', async () => {
      const template = await templateService.getTemplate('auth.password.reset.requested', 'email');

      expect(template).toBeDefined();
      expect(template?.subject).toBe('Reset your password');
      expect(template?.message_template).toContain('{{resetUrl}}');
    });

    it('should retrieve template for order.placed', async () => {
      const template = await templateService.getTemplate('order.placed', 'email');

      expect(template).toBeDefined();
      expect(template?.event_type).toBe('order.placed');
      expect(template?.subject).toContain('{{orderNumber}}');
      expect(template?.message_template).toContain('{{orderId}}');
    });

    it('should return null for non-existent template', async () => {
      const template = await templateService.getTemplate('non.existent.event', 'email');

      expect(template).toBeNull();
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringMatching(/No template found for event: non.existent.event/)
      );
    });

    it('should return null for wrong channel', async () => {
      const template = await templateService.getTemplate('auth.user.registered', 'sms');

      expect(template).toBeNull();
    });
  });

  describe('renderTemplate', () => {
    it('should render template with simple variables', () => {
      const template: NotificationTemplate = {
        event_type: 'test.event',
        channel: 'email',
        template_name: 'Test Template',
        subject: 'Hello {{username}}',
        message_template: 'Welcome {{username}}, your email is {{email}}',
        is_active: true,
      };

      const variables: TemplateVariables = {
        username: 'John Doe',
        email: 'john@example.com',
      };

      const rendered = templateService.renderTemplate(template, variables);

      expect(rendered.subject).toBe('Hello John Doe');
      expect(rendered.message).toBe('Welcome John Doe, your email is john@example.com');
    });

    it('should handle missing variables by leaving them as placeholders', () => {
      const template: NotificationTemplate = {
        event_type: 'test.event',
        channel: 'email',
        template_name: 'Test Template',
        subject: 'Hello {{username}}',
        message_template: 'Welcome {{username}}, your code is {{code}}',
        is_active: true,
      };

      const variables: TemplateVariables = {
        username: 'John Doe',
        // code is missing
      };

      const rendered = templateService.renderTemplate(template, variables);

      expect(rendered.subject).toBe('Hello John Doe');
      expect(rendered.message).toBe('Welcome John Doe, your code is {{code}}');
    });

    it('should render auth.user.registered template', () => {
      const template: NotificationTemplate = {
        event_type: 'auth.user.registered',
        channel: 'email',
        template_name: 'User Registration',
        subject: 'Welcome to AI Outlet!',
        message_template: 'Hello {{name}},\n\nWelcome to AI Outlet!',
        is_active: true,
      };

      const variables: TemplateVariables = {
        name: 'Jane Smith',
      };

      const rendered = templateService.renderTemplate(template, variables);

      expect(rendered.subject).toBe('Welcome to AI Outlet!');
      expect(rendered.message).toContain('Hello Jane Smith');
    });

    it('should render order.placed template with multiple variables', () => {
      const template: NotificationTemplate = {
        event_type: 'order.placed',
        channel: 'email',
        template_name: 'Order Confirmation',
        subject: 'Order Confirmed - #{{orderNumber}}',
        message_template:
          'Order #{{orderNumber}} placed.\nOrder ID: {{orderId}}\nAmount: ${{amount}}',
        is_active: true,
      };

      const variables: TemplateVariables = {
        orderNumber: 'ORD-12345',
        orderId: 'abc123',
        amount: '99.99',
      };

      const rendered = templateService.renderTemplate(template, variables);

      expect(rendered.subject).toBe('Order Confirmed - #ORD-12345');
      expect(rendered.message).toContain('Order #ORD-12345');
      expect(rendered.message).toContain('Order ID: abc123');
      expect(rendered.message).toContain('Amount: $99.99');
    });

    it('should handle null values in variables', () => {
      const template: NotificationTemplate = {
        event_type: 'test.event',
        channel: 'email',
        template_name: 'Test',
        subject: 'Subject',
        message_template: 'Hello {{username}}, status: {{status}}',
        is_active: true,
      };

      const variables: TemplateVariables = {
        username: 'Test User',
        status: null,
      };

      const rendered = templateService.renderTemplate(template, variables);

      expect(rendered.message).toBe('Hello Test User, status: ');
    });

    it('should handle undefined values in variables', () => {
      const template: NotificationTemplate = {
        event_type: 'test.event',
        channel: 'email',
        template_name: 'Test',
        subject: 'Subject',
        message_template: 'Hello {{username}}, value: {{value}}',
        is_active: true,
      };

      const variables: TemplateVariables = {
        username: 'Test User',
        value: undefined,
      };

      const rendered = templateService.renderTemplate(template, variables);

      expect(rendered.message).toBe('Hello Test User, value: ');
    });

    it('should handle numeric values in variables', () => {
      const template: NotificationTemplate = {
        event_type: 'test.event',
        channel: 'email',
        template_name: 'Test',
        subject: 'Order {{orderNumber}}',
        message_template: 'Amount: ${{amount}}, Quantity: {{quantity}}',
        is_active: true,
      };

      const variables: TemplateVariables = {
        orderNumber: 12345,
        amount: 99.99,
        quantity: 5,
      };

      const rendered = templateService.renderTemplate(template, variables);

      expect(rendered.subject).toBe('Order 12345');
      expect(rendered.message).toBe('Amount: $99.99, Quantity: 5');
    });

    it('should handle boolean values in variables', () => {
      const template: NotificationTemplate = {
        event_type: 'test.event',
        channel: 'email',
        template_name: 'Test',
        subject: 'Subject',
        message_template: 'Active: {{active}}, Verified: {{verified}}',
        is_active: true,
      };

      const variables: TemplateVariables = {
        active: true,
        verified: false,
      };

      const rendered = templateService.renderTemplate(template, variables);

      expect(rendered.message).toBe('Active: true, Verified: false');
    });

    it('should replace multiple occurrences of the same variable', () => {
      const template: NotificationTemplate = {
        event_type: 'test.event',
        channel: 'email',
        template_name: 'Test',
        subject: '{{username}} - {{username}}',
        message_template: 'Hello {{username}}, welcome {{username}}!',
        is_active: true,
      };

      const variables: TemplateVariables = {
        username: 'John',
      };

      const rendered = templateService.renderTemplate(template, variables);

      expect(rendered.subject).toBe('John - John');
      expect(rendered.message).toBe('Hello John, welcome John!');
    });

    it('should handle empty template', () => {
      const template: NotificationTemplate = {
        event_type: 'test.event',
        channel: 'email',
        template_name: 'Empty Template',
        subject: '',
        message_template: '',
        is_active: true,
      };

      const variables: TemplateVariables = {
        username: 'Test User',
      };

      const rendered = templateService.renderTemplate(template, variables);

      expect(rendered.subject).toBe('');
      expect(rendered.message).toBe('');
    });

    it('should handle template without subject', () => {
      const template: NotificationTemplate = {
        event_type: 'test.event',
        channel: 'sms',
        template_name: 'SMS Template',
        message_template: 'Your code is {{code}}',
        is_active: true,
      };

      const variables: TemplateVariables = {
        code: '123456',
      };

      const rendered = templateService.renderTemplate(template, variables);

      expect(rendered.subject).toBe('');
      expect(rendered.message).toBe('Your code is 123456');
    });
  });

  describe('All default templates', () => {
    const defaultTemplates = [
      'auth.user.registered',
      'auth.email.verification.requested',
      'auth.password.reset.requested',
      'auth.password.reset.completed',
      'order.placed',
      'order.cancelled',
      'order.delivered',
      'payment.received',
      'payment.failed',
    ];

    defaultTemplates.forEach((eventType) => {
      it(`should have template for ${eventType}`, async () => {
        const template = await templateService.getTemplate(eventType, 'email');

        expect(template).toBeDefined();
        expect(template?.event_type).toBe(eventType);
        expect(template?.is_active).toBe(true);
        expect(template?.message_template).toBeTruthy();
      });
    });
  });
});
