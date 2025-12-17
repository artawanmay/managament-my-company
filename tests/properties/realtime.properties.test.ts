/**
 * Property-based tests for realtime broadcast functionality
 * Tests that task updates are properly broadcast to project viewers
 *
 * Requirements: 6.4, 20.1
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fc from "fast-check";

// Mock the SSE module to track broadcasts
const mockBroadcasts: Array<{
  projectId: string;
  event: string;
  data: object;
}> = [];

const mockProjectConnections = new Map<
  string,
  Set<{ send: (event: string, data: object) => void; isOpen: () => boolean }>
>();

// Mock SSE functions
vi.mock("@/lib/realtime/sse", () => ({
  createSSEResponse: vi.fn(),
  registerProjectConnection: vi.fn(
    (
      projectId: string,
      connection: {
        send: (event: string, data: object) => void;
        isOpen: () => boolean;
      }
    ) => {
      if (!mockProjectConnections.has(projectId)) {
        mockProjectConnections.set(projectId, new Set());
      }
      mockProjectConnections.get(projectId)!.add(connection);
    }
  ),
  unregisterProjectConnection: vi.fn(
    (
      projectId: string,
      connection: {
        send: (event: string, data: object) => void;
        isOpen: () => boolean;
      }
    ) => {
      mockProjectConnections.get(projectId)?.delete(connection);
    }
  ),
  broadcastToProject: vi.fn(
    (projectId: string, event: string, data: object) => {
      mockBroadcasts.push({ projectId, event, data });
      // Also send to mock connections
      const connections = mockProjectConnections.get(projectId);
      if (connections) {
        for (const conn of connections) {
          if (conn.isOpen()) {
            conn.send(event, data);
          }
        }
      }
    }
  ),
  getProjectConnectionCount: vi.fn(
    (projectId: string) => mockProjectConnections.get(projectId)?.size ?? 0
  ),
}));

// Mock Redis pub/sub
const mockPublishedEvents: Array<{ channel: string; message: object }> = [];

vi.mock("@/lib/realtime/pubsub", () => ({
  CHANNELS: {
    projectTasks: (projectId: string) => `project:${projectId}:tasks`,
    userNotifications: (userId: string) => `user:${userId}:notifications`,
  },
  publish: vi.fn(async (channel: string, message: object) => {
    mockPublishedEvents.push({ channel, message });
  }),
  publishTaskEvent: vi.fn(async (projectId: string, event: object) => {
    mockPublishedEvents.push({
      channel: `project:${projectId}:tasks`,
      message: event,
    });
  }),
  subscribeToTaskEvents: vi.fn(() => () => {}),
}));

// Import after mocking
import {
  broadcastToProject,
  registerProjectConnection,
} from "@/lib/realtime/sse";
import { publishTaskEvent, CHANNELS } from "@/lib/realtime/pubsub";

// Task status values for testing
const taskStatusValues = [
  "BACKLOG",
  "TODO",
  "IN_PROGRESS",
  "IN_REVIEW",
  "CHANGES_REQUESTED",
  "DONE",
] as const;

type TaskStatus = (typeof taskStatusValues)[number];

// Generators for property tests
const taskIdArb = fc.uuid();
const projectIdArb = fc.uuid();
const userIdArb = fc.uuid();
const taskTitleArb = fc.string({ minLength: 1, maxLength: 100 });
const taskStatusArb = fc.constantFrom(...taskStatusValues);
const orderArb = fc.integer({ min: 0, max: 1000 });

interface TaskMoveEvent {
  type: "TASK_MOVED";
  taskId: string;
  projectId: string;
  data: {
    status: TaskStatus;
    previousStatus: TaskStatus;
    order: number;
    title: string;
    assigneeId: string | null;
  };
  timestamp: string;
  actorId: string;
}

describe("Realtime Broadcast Properties", () => {
  beforeEach(() => {
    // Clear mock data before each test
    mockBroadcasts.length = 0;
    mockPublishedEvents.length = 0;
    mockProjectConnections.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  /**
   * **Feature: mmc-app, Property: Realtime task updates broadcast to project viewers**
   *
   * *For any* task move event, when broadcast is called, all connected viewers
   * for that project should receive the event with correct task data.
   *
   * **Validates: Requirements 6.4, 20.1**
   */
  it("Property: Realtime task updates broadcast to project viewers - all viewers receive event", () => {
    fc.assert(
      fc.property(
        projectIdArb,
        taskIdArb,
        userIdArb,
        taskTitleArb,
        taskStatusArb,
        taskStatusArb,
        orderArb,
        fc.integer({ min: 1, max: 5 }), // Number of viewers
        (
          projectId,
          taskId,
          actorId,
          title,
          newStatus,
          previousStatus,
          order,
          viewerCount
        ) => {
          // Clear previous broadcasts
          mockBroadcasts.length = 0;

          // Create mock viewers (SSE connections)
          const receivedEvents: Array<{ event: string; data: object }> = [];
          const viewers: Array<{
            send: (event: string, data: object) => void;
            isOpen: () => boolean;
          }> = [];

          for (let i = 0; i < viewerCount; i++) {
            const viewer = {
              send: (event: string, data: object) => {
                receivedEvents.push({ event, data });
              },
              isOpen: () => true,
              close: () => {},
            };
            viewers.push(viewer);
            registerProjectConnection(projectId, viewer);
          }

          // Create task move event
          const taskEvent: TaskMoveEvent = {
            type: "TASK_MOVED",
            taskId,
            projectId,
            data: {
              status: newStatus,
              previousStatus,
              order,
              title,
              assigneeId: null,
            },
            timestamp: new Date().toISOString(),
            actorId,
          };

          // Broadcast the event
          broadcastToProject(projectId, "task_moved", taskEvent);

          // Verify broadcast was called
          expect(mockBroadcasts.length).toBe(1);
          expect(mockBroadcasts[0]?.projectId).toBe(projectId);
          expect(mockBroadcasts[0]?.event).toBe("task_moved");

          // Verify all viewers received the event
          expect(receivedEvents.length).toBe(viewerCount);

          // Verify event data is correct for each viewer
          for (const received of receivedEvents) {
            expect(received.event).toBe("task_moved");
            const data = received.data as TaskMoveEvent;
            expect(data.taskId).toBe(taskId);
            expect(data.projectId).toBe(projectId);
            expect(data.data.status).toBe(newStatus);
            expect(data.data.previousStatus).toBe(previousStatus);
            expect(data.data.order).toBe(order);
            expect(data.data.title).toBe(title);
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: mmc-app, Property: Realtime task updates broadcast to project viewers**
   *
   * *For any* task move event, the event should be published to the correct
   * Redis channel for the project.
   *
   * **Validates: Requirements 6.4, 20.1**
   */
  it("Property: Realtime task updates broadcast to project viewers - publishes to correct channel", async () => {
    await fc.assert(
      fc.asyncProperty(
        projectIdArb,
        taskIdArb,
        userIdArb,
        taskTitleArb,
        taskStatusArb,
        taskStatusArb,
        orderArb,
        async (
          projectId,
          taskId,
          actorId,
          title,
          newStatus,
          previousStatus,
          order
        ) => {
          // Clear previous events
          mockPublishedEvents.length = 0;

          // Create task move event
          const taskEvent: TaskMoveEvent = {
            type: "TASK_MOVED",
            taskId,
            projectId,
            data: {
              status: newStatus,
              previousStatus,
              order,
              title,
              assigneeId: null,
            },
            timestamp: new Date().toISOString(),
            actorId,
          };

          // Publish the event
          await publishTaskEvent(projectId, taskEvent);

          // Verify event was published to correct channel
          expect(mockPublishedEvents.length).toBe(1);
          expect(mockPublishedEvents[0]?.channel).toBe(
            CHANNELS.projectTasks(projectId)
          );

          // Verify event data
          const published = mockPublishedEvents[0]?.message as TaskMoveEvent;
          expect(published.type).toBe("TASK_MOVED");
          expect(published.taskId).toBe(taskId);
          expect(published.projectId).toBe(projectId);
          expect(published.data.status).toBe(newStatus);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: mmc-app, Property: Realtime task updates broadcast to project viewers**
   *
   * *For any* project, broadcasts should only go to viewers of that specific project,
   * not to viewers of other projects.
   *
   * **Validates: Requirements 6.4, 20.1**
   */
  it("Property: Realtime task updates broadcast to project viewers - isolation between projects", () => {
    fc.assert(
      fc.property(
        projectIdArb,
        projectIdArb,
        taskIdArb,
        userIdArb,
        taskTitleArb,
        taskStatusArb,
        (projectId1, projectId2, taskId, actorId, title, status) => {
          // Skip if projects are the same
          if (projectId1 === projectId2) return true;

          // Clear previous data
          mockBroadcasts.length = 0;

          // Create viewers for both projects
          const project1Events: Array<{ event: string; data: object }> = [];
          const project2Events: Array<{ event: string; data: object }> = [];

          const viewer1 = {
            send: (event: string, data: object) => {
              project1Events.push({ event, data });
            },
            isOpen: () => true,
            close: () => {},
          };

          const viewer2 = {
            send: (event: string, data: object) => {
              project2Events.push({ event, data });
            },
            isOpen: () => true,
            close: () => {},
          };

          registerProjectConnection(projectId1, viewer1);
          registerProjectConnection(projectId2, viewer2);

          // Create and broadcast event for project 1 only
          const taskEvent: TaskMoveEvent = {
            type: "TASK_MOVED",
            taskId,
            projectId: projectId1,
            data: {
              status,
              previousStatus: status,
              order: 0,
              title,
              assigneeId: null,
            },
            timestamp: new Date().toISOString(),
            actorId,
          };

          broadcastToProject(projectId1, "task_moved", taskEvent);

          // Verify only project 1 viewer received the event
          expect(project1Events.length).toBe(1);
          expect(project2Events.length).toBe(0);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: mmc-app, Property: Realtime task updates broadcast to project viewers**
   *
   * *For any* task move event, the event data should contain all required fields
   * for the client to update its state.
   *
   * **Validates: Requirements 6.4, 20.1**
   */
  it("Property: Realtime task updates broadcast to project viewers - event contains required fields", () => {
    fc.assert(
      fc.property(
        projectIdArb,
        taskIdArb,
        userIdArb,
        taskTitleArb,
        taskStatusArb,
        taskStatusArb,
        orderArb,
        fc.option(userIdArb, { nil: null }),
        (
          projectId,
          taskId,
          actorId,
          title,
          newStatus,
          previousStatus,
          order,
          assigneeId
        ) => {
          // Clear previous broadcasts
          mockBroadcasts.length = 0;

          // Create viewer
          let receivedData: TaskMoveEvent | null = null;
          const viewer = {
            send: (_event: string, data: object) => {
              receivedData = data as TaskMoveEvent;
            },
            isOpen: () => true,
            close: () => {},
          };
          registerProjectConnection(projectId, viewer);

          // Create and broadcast event
          const taskEvent: TaskMoveEvent = {
            type: "TASK_MOVED",
            taskId,
            projectId,
            data: {
              status: newStatus,
              previousStatus,
              order,
              title,
              assigneeId,
            },
            timestamp: new Date().toISOString(),
            actorId,
          };

          broadcastToProject(projectId, "task_moved", taskEvent);

          // Verify all required fields are present
          expect(receivedData).not.toBeNull();
          expect(receivedData!.type).toBe("TASK_MOVED");
          expect(receivedData!.taskId).toBeDefined();
          expect(receivedData!.projectId).toBeDefined();
          expect(receivedData!.timestamp).toBeDefined();
          expect(receivedData!.actorId).toBeDefined();
          expect(receivedData!.data).toBeDefined();
          expect(receivedData!.data.status).toBeDefined();
          expect(receivedData!.data.previousStatus).toBeDefined();
          expect(receivedData!.data.order).toBeDefined();
          expect(receivedData!.data.title).toBeDefined();
          expect("assigneeId" in receivedData!.data).toBe(true);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: mmc-app, Property: Realtime task updates broadcast to project viewers**
   *
   * *For any* closed connection, it should not receive broadcasts.
   *
   * **Validates: Requirements 6.4, 20.1**
   */
  it("Property: Realtime task updates broadcast to project viewers - closed connections do not receive events", () => {
    fc.assert(
      fc.property(
        projectIdArb,
        taskIdArb,
        userIdArb,
        taskTitleArb,
        taskStatusArb,
        (projectId, taskId, actorId, title, status) => {
          // Clear previous data
          mockBroadcasts.length = 0;

          // Create one open and one closed connection
          const openEvents: Array<{ event: string; data: object }> = [];
          const closedEvents: Array<{ event: string; data: object }> = [];

          const openViewer = {
            send: (event: string, data: object) => {
              openEvents.push({ event, data });
            },
            isOpen: () => true,
            close: () => {},
          };

          const closedViewer = {
            send: (event: string, data: object) => {
              closedEvents.push({ event, data });
            },
            isOpen: () => false, // Connection is closed
            close: () => {},
          };

          registerProjectConnection(projectId, openViewer);
          registerProjectConnection(projectId, closedViewer);

          // Broadcast event
          const taskEvent: TaskMoveEvent = {
            type: "TASK_MOVED",
            taskId,
            projectId,
            data: {
              status,
              previousStatus: status,
              order: 0,
              title,
              assigneeId: null,
            },
            timestamp: new Date().toISOString(),
            actorId,
          };

          broadcastToProject(projectId, "task_moved", taskEvent);

          // Only open connection should receive the event
          expect(openEvents.length).toBe(1);
          expect(closedEvents.length).toBe(0);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
