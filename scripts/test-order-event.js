#!/usr/bin/env node

import amqp from 'amqplib';

async function publishOrderEvent() {
  try {
    console.log('🔌 Connecting to RabbitMQ to publish order event...');
    const connection = await amqp.connect('amqp://guest:guest@localhost:5672');
    const channel = await connection.createChannel();

    // Create order event that matches your event types
    const orderEvent = {
      eventType: 'order.placed',
      userId: 'user123',
      userEmail: 'honrao.prasad@gmail.com', // Replace with your real email
      userPhone: '+1234567890',
      timestamp: new Date(),
      data: {
        orderId: 'ORD-' + Math.random().toString(36).substr(2, 9),
        orderNumber: 'ORDER-2025-' + Math.floor(Math.random() * 1000),
        amount: 99.99,
        items: ['Product A', 'Product B'],
      },
    };

    console.log('📤 Publishing order event:', orderEvent);

    // Publish to order.events exchange with routing key order.placed
    await channel.publish('order.events', 'order.placed', Buffer.from(JSON.stringify(orderEvent)), {
      persistent: true,
    });

    console.log('✅ Order event published successfully!');
    console.log('📧 Check your email and notification service logs...');

    await channel.close();
    await connection.close();
  } catch (error) {
    console.error('❌ Error publishing order event:', error);
  }
}

publishOrderEvent();
