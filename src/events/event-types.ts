// Base event interface
export interface BaseEvent {
  eventType: string;
  userId: string;
  userEmail?: string;
  userPhone?: string;
  timestamp: Date;
  data: any;
}

// Event types enum
export enum EventTypes {
  // Auth events
  AUTH_USER_REGISTERED = 'auth.user.registered',
  AUTH_LOGIN = 'auth.login',
  AUTH_EMAIL_VERIFICATION_REQUESTED = 'auth.email.verification.requested',
  AUTH_PASSWORD_RESET_REQUESTED = 'auth.password.reset.requested',
  AUTH_PASSWORD_RESET_COMPLETED = 'auth.password.reset.completed',
  AUTH_ACCOUNT_REACTIVATION_REQUESTED = 'auth.account.reactivation.requested',

  // Order events
  ORDER_PLACED = 'order.placed',
  ORDER_CANCELLED = 'order.cancelled',
  ORDER_DELIVERED = 'order.delivered',
  PAYMENT_RECEIVED = 'payment.received',
  PAYMENT_FAILED = 'payment.failed',

  // Profile events
  PROFILE_PASSWORD_CHANGED = 'profile.password_changed',
  PROFILE_NOTIFICATION_PREFERENCES_UPDATED = 'profile.notification_preferences_updated',
  PROFILE_BANK_DETAILS_UPDATED = 'profile.bank_details_updated',
}

// Specific event interfaces
export interface AuthEvent extends BaseEvent {
  eventType:
    | EventTypes.AUTH_USER_REGISTERED
    | EventTypes.AUTH_LOGIN
    | EventTypes.AUTH_EMAIL_VERIFICATION_REQUESTED
    | EventTypes.AUTH_PASSWORD_RESET_REQUESTED
    | EventTypes.AUTH_PASSWORD_RESET_COMPLETED
    | EventTypes.AUTH_ACCOUNT_REACTIVATION_REQUESTED;
  data: {
    username?: string;
    email?: string;
    verificationToken?: string;
    resetToken?: string;
    reactivationToken?: string;
    ipAddress?: string;
    userAgent?: string;
  };
}

export interface OrderEvent extends BaseEvent {
  eventType: EventTypes.ORDER_PLACED | EventTypes.ORDER_CANCELLED | EventTypes.ORDER_DELIVERED;
  data: {
    orderId: string;
    orderNumber: string;
    amount?: number;
    items?: any[];
  };
}

export interface PaymentEvent extends BaseEvent {
  eventType: EventTypes.PAYMENT_RECEIVED | EventTypes.PAYMENT_FAILED;
  data: {
    orderId: string;
    paymentId: string;
    amount: number;
    reason?: string; // For failed payments
  };
}

export interface ProfileEvent extends BaseEvent {
  eventType:
    | EventTypes.PROFILE_PASSWORD_CHANGED
    | EventTypes.PROFILE_NOTIFICATION_PREFERENCES_UPDATED
    | EventTypes.PROFILE_BANK_DETAILS_UPDATED;
  data: {
    field: string;
    oldValue?: any;
    newValue?: any;
  };
}

// Union type for all events
export type NotificationEvent = AuthEvent | OrderEvent | PaymentEvent | ProfileEvent;
