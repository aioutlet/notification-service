#!/usr/bin/env node

import amqp from 'amqplib';

async function checkQueue() {
  try {
    console.log('🔌 Connecting to RabbitMQ...');
    const connection = await amqp.connect('amqp://guest:guest@localhost:5672');
    const channel = await connection.createChannel();

    // Check queue status
    const queueInfo = await channel.checkQueue('notifications');
    console.log('📊 Queue Status:');
    console.log(`   Queue: notifications`);
    console.log(`   Messages: ${queueInfo.messageCount}`);
    console.log(`   Consumers: ${queueInfo.consumerCount}`);

    await channel.close();
    await connection.close();
  } catch (error) {
    console.error('❌ Error checking queue:', error.message);
  }
}

checkQueue();
