#!/usr/bin/env node

import amqp from 'amqplib';

async function setupAndTestRabbitMQ() {
  try {
    console.log('🔌 Connecting to RabbitMQ...');
    const connection = await amqp.connect('amqp://guest:guest@localhost:5672');
    const channel = await connection.createChannel();

    // 1. Create exchanges
    console.log('📡 Creating exchanges...');
    await channel.assertExchange('order.events', 'topic', { durable: true });
    await channel.assertExchange('user.events', 'topic', { durable: true });
    console.log('✅ Exchanges created: order.events, user.events');

    // 2. Create notification queue
    console.log('📬 Creating notification queue...');
    await channel.assertQueue('notifications', { durable: true });
    console.log('✅ Queue created: notifications');

    // 3. Bind queue to exchanges
    console.log('🔗 Binding queue to exchanges...');
    await channel.bindQueue('notifications', 'order.events', 'order.*');
    await channel.bindQueue('notifications', 'user.events', 'user.*');
    console.log('✅ Queue bound to exchanges with patterns: order.*, user.*');

    // 4. Publish test messages
    console.log('📤 Publishing test messages...');

    // Test order.placed event
    const orderEvent = {
      eventType: 'order.placed',
      userId: 'user123',
      timestamp: new Date().toISOString(),
      data: {
        orderId: 'ord_789',
        orderNumber: 'ORD-2025-001',
        amount: 149.99,
        items: [{ name: 'Product A', quantity: 2, price: 74.99 }],
      },
    };

    await channel.publish('order.events', 'order.placed', Buffer.from(JSON.stringify(orderEvent)));
    console.log('✅ Published order.placed event');

    // Test payment.received event
    const paymentEvent = {
      eventType: 'payment.received',
      userId: 'user123',
      timestamp: new Date().toISOString(),
      data: {
        orderId: 'ord_789',
        paymentId: 'pay_456',
        amount: 149.99,
      },
    };

    await channel.publish('order.events', 'payment.received', Buffer.from(JSON.stringify(paymentEvent)));
    console.log('✅ Published payment.received event');

    // Test profile.password_changed event
    const profileEvent = {
      eventType: 'profile.password_changed',
      userId: 'user123',
      timestamp: new Date().toISOString(),
      data: {
        field: 'password',
        newValue: '[HIDDEN]',
      },
    };

    await channel.publish('user.events', 'profile.password_changed', Buffer.from(JSON.stringify(profileEvent)));
    console.log('✅ Published profile.password_changed event');

    console.log('\n🎉 Setup complete! Check your notification service logs to see the processed events.');
    console.log('🌐 You can also visit RabbitMQ Management UI: http://localhost:15672 (guest/guest)');

    await channel.close();
    await connection.close();
  } catch (error) {
    console.error('❌ Error setting up RabbitMQ:', error.message);
    process.exit(1);
  }
}

setupAndTestRabbitMQ();
