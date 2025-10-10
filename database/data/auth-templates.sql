-- Auth Event Notification Templates
-- Templates for authentication-related events

-- Insert auth templates
INSERT IGNORE INTO notification_templates (name, event_type, channel, subject_template, message_template) VALUES

-- User Registration
('auth_user_registered_email', 'auth.user.registered', 'email', 
 'Welcome to AI Outlet!', 
 'Hi there,\n\nWelcome to AI Outlet! Your account has been successfully created.\n\nUsername: {{username}}\nEmail: {{email}}\n\nPlease verify your email address to activate your account.\n\nBest regards,\nThe AI Outlet Team'),

-- Email Verification
('auth_email_verification_email', 'auth.email.verification.requested', 'email', 
 'Verify Your Email Address', 
 'Hi {{username}},\n\nPlease verify your email address by clicking the link below:\n\nVerification Link: {{verificationUrl}}\n\nThis link will expire in 24 hours.\n\nIf you didn''t request this verification, please ignore this email.\n\nBest regards,\nThe AI Outlet Team'),

-- Password Reset Request
('auth_password_reset_requested_email', 'auth.password.reset.requested', 'email', 
 'Password Reset Request', 
 'Hi {{username}},\n\nWe received a request to reset your password.\n\nReset Link: {{resetUrl}}\n\nThis link will expire in 1 hour.\n\nIf you didn''t request this password reset, please ignore this email and your password will remain unchanged.\n\nBest regards,\nThe AI Outlet Team'),

-- Password Reset Completed
('auth_password_reset_completed_email', 'auth.password.reset.completed', 'email', 
 'Password Successfully Reset', 
 'Hi {{username}},\n\nYour password has been successfully reset.\n\nEmail: {{email}}\nTime: {{timestamp}}\n\nIf you didn''t make this change, please contact our support team immediately.\n\nBest regards,\nThe AI Outlet Team'),

-- Login Notification (optional - for security alerts)
('auth_login_email', 'auth.login', 'email', 
 'New Login to Your Account', 
 'Hi {{username}},\n\nA new login to your account was detected.\n\nTime: {{timestamp}}\nIP Address: {{ipAddress}}\nDevice: {{userAgent}}\n\nIf this wasn''t you, please reset your password immediately.\n\nBest regards,\nThe AI Outlet Team'),

-- Account Reactivation
('auth_account_reactivation_email', 'auth.account.reactivation.requested', 'email', 
 'Account Reactivation Request', 
 'Hi {{username}},\n\nWe received a request to reactivate your account.\n\nReactivation Link: {{reactivationUrl}}\n\nThis link will expire in 24 hours.\n\nIf you didn''t request this, please ignore this email.\n\nBest regards,\nThe AI Outlet Team');
