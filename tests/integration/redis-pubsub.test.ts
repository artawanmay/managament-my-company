/**
 * Integration tests for Redis Pub/Sub with real Redis
 *
 * Tests message delivery between publisher and subscriber.
 * Uses testcontainers to provide a real Redis instance.
 *
 * Requirements: 5.3
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import Redis from "ioredis";
import {
  startRedisContainer,
  stopRedisContainer,
  clearRedisData,
  type RedisTestContext,
} from "../setup/redis-container";

// Extend timeout for container startup
const CONTAINER_TIMEOUT = 120000;

/**
 * Check if Docker is available for testcontainers
 */
async function isDockerAvailable(): Promise<boolean> {
  try {
    const ctx = await startRedisContainer({ startupTimeout: 30000 });
    await stopRedisContainer(ctx);
    return true;
  } catch {
    return false;
  }
}

// Check Docker availability before running tests
let dockerAvailable = false;
let skipReason = "";

beforeAll(async () => {
  try {
    dockerAvailable = await isDockerAvailable();
  } catch (error) {
    dockerAvailable = false;
    skipReason = error instanceof Error ? error.message : "Unknown error";
  }
}, CONTAINER_TIMEOUT);

describe("Redis Pub/Sub Integration Tests", () => {
  let ctx: RedisTestContext | undefined;
  let publisherClient: Redis | undefined;
  let subscriberClient: Redis | undefined;

  beforeAll(async () => {
    if (!dockerAvailable) {
      console.log(
        `Skipping Redis pub/sub integration tests: Docker not available. ${skipReason}`
      );
      return;
    }
    ctx = await startRedisContainer({ startupTimeout: CONTAINER_TIMEOUT });

    // Create separate publisher and subscriber clients
    publisherClient = new Redis({
      host: ctx.host,
      port: ctx.port,
      maxRetriesPerRequest: 3,
    });

    subscriberClient = new Redis({
      host: ctx.host,
      port: ctx.port,
      maxRetriesPerRequest: 3,
    });

    // Wait for clients to be ready
    await Promise.all([
      new Promise<void>((resolve) => publisherClient!.once("ready", resolve)),
      new Promise<void>((resolve) => subscriberClient!.once("ready", resolve)),
    ]);
  }, CONTAINER_TIMEOUT);

  afterAll(async () => {
    if (publisherClient) {
      await publisherClient.quit().catch(() => {});
    }
    if (subscriberClient) {
      await subscriberClient.quit().catch(() => {});
    }
    if (ctx) {
      await stopRedisContainer(ctx);
    }
  });

  beforeEach(async () => {
    if (ctx) {
      await clearRedisData(ctx);
    }
  });

  describe("Basic Pub/Sub Message Delivery", () => {
    /**
     * Requirement 5.3: Test message delivery between publisher and subscriber
     */
    it("should deliver a message from publisher to subscriber", async () => {
      if (!ctx || !publisherClient || !subscriberClient) {
        console.log("Skipping: Docker not available");
        return;
      }

      const channel = "test:channel";
      const testMessage = { type: "TEST", data: "hello world" };
      const receivedMessages: unknown[] = [];

      // Set up subscriber
      await subscriberClient.subscribe(channel);
      subscriberClient.on("message", (ch, message) => {
        if (ch === channel) {
          receivedMessages.push(JSON.parse(message));
        }
      });

      // Give subscriber time to be ready
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Publish message
      await publisherClient.publish(channel, JSON.stringify(testMessage));

      // Wait for message delivery
      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(receivedMessages).toHaveLength(1);
      expect(receivedMessages[0]).toEqual(testMessage);
    });

    /**
     * Requirement 5.3: Test multiple messages are delivered in order
     */
    it("should deliver multiple messages in order", async () => {
      if (!ctx || !publisherClient || !subscriberClient) {
        console.log("Skipping: Docker not available");
        return;
      }

      const channel = "test:order";
      const messages = [
        { seq: 1, data: "first" },
        { seq: 2, data: "second" },
        { seq: 3, data: "third" },
      ];
      const receivedMessages: { seq: number; data: string }[] = [];

      // Set up subscriber
      await subscriberClient.subscribe(channel);
      subscriberClient.on("message", (ch, message) => {
        if (ch === channel) {
          receivedMessages.push(JSON.parse(message));
        }
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Publish messages
      for (const msg of messages) {
        await publisherClient.publish(channel, JSON.stringify(msg));
      }

      // Wait for all messages
      await new Promise((resolve) => setTimeout(resolve, 300));

      expect(receivedMessages).toHaveLength(3);
      expect(receivedMessages.map((m) => m.seq)).toEqual([1, 2, 3]);
    });
  });

  describe("Multiple Subscribers", () => {
    /**
     * Requirement 5.3: Test message delivery to multiple subscribers
     */
    it("should deliver message to all subscribers on the same channel", async () => {
      if (!ctx || !publisherClient) {
        console.log("Skipping: Docker not available");
        return;
      }

      const channel = "test:broadcast";
      const testMessage = { type: "BROADCAST", content: "hello all" };

      // Create additional subscribers
      const subscriber1 = new Redis({ host: ctx.host, port: ctx.port });
      const subscriber2 = new Redis({ host: ctx.host, port: ctx.port });

      const received1: unknown[] = [];
      const received2: unknown[] = [];

      try {
        await Promise.all([
          new Promise<void>((resolve) => subscriber1.once("ready", resolve)),
          new Promise<void>((resolve) => subscriber2.once("ready", resolve)),
        ]);

        // Subscribe both clients
        await subscriber1.subscribe(channel);
        await subscriber2.subscribe(channel);

        subscriber1.on("message", (ch, msg) => {
          if (ch === channel) received1.push(JSON.parse(msg));
        });
        subscriber2.on("message", (ch, msg) => {
          if (ch === channel) received2.push(JSON.parse(msg));
        });

        await new Promise((resolve) => setTimeout(resolve, 100));

        // Publish message
        await publisherClient.publish(channel, JSON.stringify(testMessage));

        await new Promise((resolve) => setTimeout(resolve, 200));

        expect(received1).toHaveLength(1);
        expect(received1[0]).toEqual(testMessage);
        expect(received2).toHaveLength(1);
        expect(received2[0]).toEqual(testMessage);
      } finally {
        await subscriber1.quit().catch(() => {});
        await subscriber2.quit().catch(() => {});
      }
    });
  });

  describe("Channel Isolation", () => {
    /**
     * Requirement 5.3: Test that messages are isolated to their channels
     */
    it("should only deliver messages to subscribers of the specific channel", async () => {
      if (!ctx || !publisherClient || !subscriberClient) {
        console.log("Skipping: Docker not available");
        return;
      }

      const channel1 = "test:channel1";
      const channel2 = "test:channel2";
      const message1 = { channel: "channel1", data: "for channel 1" };
      const message2 = { channel: "channel2", data: "for channel 2" };

      const receivedOnChannel1: unknown[] = [];
      const receivedOnChannel2: unknown[] = [];

      // Create separate subscriber for channel2
      const subscriber2 = new Redis({ host: ctx.host, port: ctx.port });

      try {
        await new Promise<void>((resolve) =>
          subscriber2.once("ready", resolve)
        );

        // Subscribe to different channels
        await subscriberClient.subscribe(channel1);
        await subscriber2.subscribe(channel2);

        subscriberClient.on("message", (ch, msg) => {
          if (ch === channel1) receivedOnChannel1.push(JSON.parse(msg));
        });
        subscriber2.on("message", (ch, msg) => {
          if (ch === channel2) receivedOnChannel2.push(JSON.parse(msg));
        });

        await new Promise((resolve) => setTimeout(resolve, 100));

        // Publish to both channels
        await publisherClient.publish(channel1, JSON.stringify(message1));
        await publisherClient.publish(channel2, JSON.stringify(message2));

        await new Promise((resolve) => setTimeout(resolve, 200));

        // Each subscriber should only receive their channel's message
        expect(receivedOnChannel1).toHaveLength(1);
        expect(receivedOnChannel1[0]).toEqual(message1);
        expect(receivedOnChannel2).toHaveLength(1);
        expect(receivedOnChannel2[0]).toEqual(message2);
      } finally {
        await subscriber2.quit().catch(() => {});
      }
    });
  });

  describe("Task Event Channel Pattern", () => {
    /**
     * Requirement 5.3: Test task event message delivery pattern
     */
    it("should deliver task events to project channel subscribers", async () => {
      if (!ctx || !publisherClient || !subscriberClient) {
        console.log("Skipping: Docker not available");
        return;
      }

      const projectId = "project-123";
      const channel = `project:${projectId}:tasks`;
      const taskEvent = {
        type: "TASK_CREATED",
        taskId: "task-456",
        projectId,
        data: {
          title: "New Task",
          status: "todo",
        },
        timestamp: new Date().toISOString(),
        actorId: "user-789",
      };

      const receivedEvents: unknown[] = [];

      await subscriberClient.subscribe(channel);
      subscriberClient.on("message", (ch, msg) => {
        if (ch === channel) receivedEvents.push(JSON.parse(msg));
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      await publisherClient.publish(channel, JSON.stringify(taskEvent));

      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(receivedEvents).toHaveLength(1);
      expect(receivedEvents[0]).toEqual(taskEvent);
    });
  });

  describe("Notification Event Channel Pattern", () => {
    /**
     * Requirement 5.3: Test notification event message delivery pattern
     */
    it("should deliver notification events to user channel subscribers", async () => {
      if (!ctx || !publisherClient || !subscriberClient) {
        console.log("Skipping: Docker not available");
        return;
      }

      const userId = "user-123";
      const channel = `user:${userId}:notifications`;
      const notificationEvent = {
        type: "NOTIFICATION_CREATED",
        notificationId: "notif-456",
        userId,
        data: {
          title: "New Comment",
          message: "Someone commented on your task",
          notificationType: "comment",
          entityType: "task",
          entityId: "task-789",
        },
        timestamp: new Date().toISOString(),
      };

      const receivedEvents: unknown[] = [];

      await subscriberClient.subscribe(channel);
      subscriberClient.on("message", (ch, msg) => {
        if (ch === channel) receivedEvents.push(JSON.parse(msg));
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      await publisherClient.publish(channel, JSON.stringify(notificationEvent));

      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(receivedEvents).toHaveLength(1);
      expect(receivedEvents[0]).toEqual(notificationEvent);
    });
  });

  describe("Unsubscribe Behavior", () => {
    /**
     * Requirement 5.3: Test that unsubscribed clients don't receive messages
     */
    it("should stop receiving messages after unsubscribe", async () => {
      if (!ctx || !publisherClient || !subscriberClient) {
        console.log("Skipping: Docker not available");
        return;
      }

      const channel = "test:unsubscribe";
      const receivedMessages: unknown[] = [];

      await subscriberClient.subscribe(channel);
      subscriberClient.on("message", (ch, msg) => {
        if (ch === channel) receivedMessages.push(JSON.parse(msg));
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Send first message
      await publisherClient.publish(channel, JSON.stringify({ seq: 1 }));
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(receivedMessages).toHaveLength(1);

      // Unsubscribe
      await subscriberClient.unsubscribe(channel);
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Send second message
      await publisherClient.publish(channel, JSON.stringify({ seq: 2 }));
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Should still only have the first message
      expect(receivedMessages).toHaveLength(1);
    });
  });
});
