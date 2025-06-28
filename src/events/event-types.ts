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
export type NotificationEvent = OrderEvent | PaymentEvent | ProfileEvent;
