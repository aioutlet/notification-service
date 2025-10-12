-- =====================================================================================
-- Email Templates for User Events
-- =====================================================================================
-- This script adds email templates for user-related events:
-- - user.user.created: Welcome email when a new user is created
-- - user.email.verified: Confirmation email when user verifies their email
-- - user.password.changed: Notification when password is changed
-- =====================================================================================

-- Welcome Email Template (user.user.created)
INSERT INTO notification_templates (
  name,
  event_type,
  channel,
  subject_template,
  message_template,
  is_active
) VALUES (
  'Welcome Email',
  'user.user.created',
  'email',
  'Welcome to AI Outlet, {{name}}!',
  '<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
    .content { background-color: #f9f9f9; padding: 30px; border: 1px solid #ddd; border-top: none; }
    .button { display: inline-block; padding: 12px 24px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 5px; margin: 10px 5px; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
    ul { padding-left: 20px; }
    li { margin: 10px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Welcome to AI Outlet!</h1>
    </div>
    <div class="content">
      <p>Hi {{name}},</p>
      
      <p>Thank you for joining <strong>AI Outlet</strong>! We''re thrilled to have you as part of our community.</p>
      
      <p>Your account has been successfully created with the email: <strong>{{email}}</strong></p>
      
      <h3>Get Started</h3>
      <p>Here are some quick links to help you get started:</p>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="{{dashboardUrl}}" class="button">Visit Dashboard</a>
        <a href="{{profileUrl}}" class="button">Complete Profile</a>
      </div>
      
      {{#unless isEmailVerified}}
      <div style="background-color: #FEF3C7; padding: 15px; border-left: 4px solid #F59E0B; margin: 20px 0;">
        <p><strong>⚠️ Action Required:</strong> Please verify your email address to unlock all features.</p>
        <a href="{{verifyEmailUrl}}" class="button" style="background-color: #F59E0B;">Verify Email Now</a>
      </div>
      {{/unless}}
      
      <h3>What''s Next?</h3>
      <ul>
        <li>Browse our extensive product catalog</li>
        <li>Set up your preferences and notifications</li>
        <li>Start shopping and enjoy exclusive deals</li>
      </ul>
      
      <p>If you have any questions or need assistance, our support team is here to help. Simply reply to this email or visit our help center.</p>
      
      <p>Happy shopping!</p>
      
      <p>Best regards,<br>
      <strong>The AI Outlet Team</strong></p>
    </div>
    <div class="footer">
      <p>© 2025 AI Outlet. All rights reserved.</p>
      <p>This is an automated message. Please do not reply directly to this email.</p>
    </div>
  </div>
</body>
</html>',
  1
);

-- Email Verified Template (user.email.verified)
INSERT INTO notification_templates (
  name,
  event_type,
  channel,
  subject_template,
  message_template,
  is_active
) VALUES (
  'Email Verified Confirmation',
  'user.email.verified',
  'email',
  'Email Verified Successfully!',
  '<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #10B981; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
    .content { background-color: #f9f9f9; padding: 30px; border: 1px solid #ddd; border-top: none; }
    .success-icon { font-size: 48px; text-align: center; color: #10B981; margin: 20px 0; }
    .button { display: inline-block; padding: 12px 24px; background-color: #10B981; color: white; text-decoration: none; border-radius: 5px; margin: 10px 5px; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>✅ Email Verified!</h1>
    </div>
    <div class="content">
      <div class="success-icon">🎉</div>
      
      <p>Hi {{name}},</p>
      
      <p>Great news! Your email address <strong>{{email}}</strong> has been successfully verified.</p>
      
      <p>You now have full access to all AI Outlet features, including:</p>
      <ul>
        <li>Complete your purchases</li>
        <li>Save items to your wishlist</li>
        <li>Receive order updates and notifications</li>
        <li>Access exclusive member benefits</li>
      </ul>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="{{dashboardUrl}}" class="button">Go to Dashboard</a>
      </div>
      
      <p>Thank you for verifying your account!</p>
      
      <p>Best regards,<br>
      <strong>The AI Outlet Team</strong></p>
    </div>
    <div class="footer">
      <p>© 2025 AI Outlet. All rights reserved.</p>
    </div>
  </div>
</body>
</html>',
  1
);

-- Password Changed Template (user.password.changed)
INSERT INTO notification_templates (
  name,
  event_type,
  channel,
  subject_template,
  message_template,
  is_active
) VALUES (
  'Password Changed Notification',
  'user.password.changed',
  'email',
  'Your Password Has Been Changed',
  '<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #F59E0B; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
    .content { background-color: #f9f9f9; padding: 30px; border: 1px solid #ddd; border-top: none; }
    .warning-box { background-color: #FEE2E2; padding: 15px; border-left: 4px solid #EF4444; margin: 20px 0; }
    .button { display: inline-block; padding: 12px 24px; background-color: #EF4444; color: white; text-decoration: none; border-radius: 5px; margin: 10px 5px; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔐 Password Changed</h1>
    </div>
    <div class="content">
      <p>Hi {{name}},</p>
      
      <p>This is to confirm that your password for your AI Outlet account (<strong>{{email}}</strong>) was successfully changed.</p>
      
      <p><strong>Change Details:</strong></p>
      <ul>
        <li>Date: {{timestamp}}</li>
        <li>Account: {{email}}</li>
      </ul>
      
      <div class="warning-box">
        <p><strong>⚠️ Did you make this change?</strong></p>
        <p>If you did not change your password, please secure your account immediately by clicking the button below.</p>
        <div style="text-align: center;">
          <a href="{{profileUrl}}" class="button">Secure My Account</a>
        </div>
      </div>
      
      <p>If you made this change, you can safely ignore this email.</p>
      
      <p>For your security, we recommend:</p>
      <ul>
        <li>Using a strong, unique password</li>
        <li>Never sharing your password with anyone</li>
        <li>Enabling two-factor authentication (if available)</li>
      </ul>
      
      <p>Best regards,<br>
      <strong>The AI Outlet Security Team</strong></p>
    </div>
    <div class="footer">
      <p>© 2025 AI Outlet. All rights reserved.</p>
      <p>This is a security notification. If you need help, contact support immediately.</p>
    </div>
  </div>
</body>
</html>',
  1
);

-- Verify the templates were inserted
SELECT name, event_type, channel, is_active
FROM notification_templates
WHERE event_type LIKE 'user.%'
ORDER BY created_at DESC;
