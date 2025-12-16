/**
 * Server-Sent Events (SSE) Helpers
 * Provides utilities for creating and managing SSE connections
 *
 * Requirements: 20.1, 20.2, 20.3, 20.4
 */

export interface SSEConnection {
  /** Send an event to the client */
  send: (event: string, data: object) => void;
  /** Close the connection */
  close: () => void;
  /** Check if connection is still open */
  isOpen: () => boolean;
}

// Track active connections for broadcasting
const projectConnections = new Map<string, Set<SSEConnection>>();
const userConnections = new Map<string, Set<SSEConnection>>();

/**
 * Create an SSE response with proper headers and connection management
 * @param onConnect - Callback when connection is established, receives the SSE connection
 * @param onDisconnect - Optional callback when connection is closed
 * @returns Response object for SSE streaming
 */
export function createSSEResponse(
  onConnect: (connection: SSEConnection) => void,
  onDisconnect?: () => void
): Response {
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null;
  let isConnectionOpen = true;

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(ctrl) {
      controller = ctrl;

      const connection: SSEConnection = {
        send: (event: string, data: object) => {
          if (!isConnectionOpen || !controller) return;

          try {
            const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
            controller.enqueue(encoder.encode(message));
          } catch (error) {
            console.error('[SSE] Failed to send message:', error);
          }
        },
        close: () => {
          if (!isConnectionOpen) return;
          isConnectionOpen = false;

          try {
            controller?.close();
          } catch {
            // Controller may already be closed
          }

          onDisconnect?.();
        },
        isOpen: () => isConnectionOpen,
      };

      // Send initial connection event
      connection.send('connected', { timestamp: new Date().toISOString() });

      // Call the onConnect callback with the connection
      onConnect(connection);
    },
    cancel() {
      isConnectionOpen = false;
      onDisconnect?.();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    },
  });
}

/**
 * Register a connection for a project (for task updates)
 * @param projectId - The project ID
 * @param connection - The SSE connection
 */
export function registerProjectConnection(
  projectId: string,
  connection: SSEConnection
): void {
  if (!projectConnections.has(projectId)) {
    projectConnections.set(projectId, new Set());
  }
  projectConnections.get(projectId)!.add(connection);
  console.log(
    `[SSE] Project ${projectId} connection registered. Total: ${projectConnections.get(projectId)!.size}`
  );
}

/**
 * Unregister a connection for a project
 * @param projectId - The project ID
 * @param connection - The SSE connection
 */
export function unregisterProjectConnection(
  projectId: string,
  connection: SSEConnection
): void {
  const connections = projectConnections.get(projectId);
  if (connections) {
    connections.delete(connection);
    console.log(
      `[SSE] Project ${projectId} connection unregistered. Remaining: ${connections.size}`
    );
    if (connections.size === 0) {
      projectConnections.delete(projectId);
    }
  }
}

/**
 * Register a connection for a user (for notifications)
 * @param userId - The user ID
 * @param connection - The SSE connection
 */
export function registerUserConnection(
  userId: string,
  connection: SSEConnection
): void {
  if (!userConnections.has(userId)) {
    userConnections.set(userId, new Set());
  }
  userConnections.get(userId)!.add(connection);
  console.log(
    `[SSE] User ${userId} connection registered. Total: ${userConnections.get(userId)!.size}`
  );
}

/**
 * Unregister a connection for a user
 * @param userId - The user ID
 * @param connection - The SSE connection
 */
export function unregisterUserConnection(
  userId: string,
  connection: SSEConnection
): void {
  const connections = userConnections.get(userId);
  if (connections) {
    connections.delete(connection);
    console.log(
      `[SSE] User ${userId} connection unregistered. Remaining: ${connections.size}`
    );
    if (connections.size === 0) {
      userConnections.delete(userId);
    }
  }
}

/**
 * Broadcast an event to all connections for a project
 * @param projectId - The project ID
 * @param event - The event name
 * @param data - The event data
 */
export function broadcastToProject(
  projectId: string,
  event: string,
  data: object
): void {
  const connections = projectConnections.get(projectId);
  if (!connections || connections.size === 0) {
    console.log(`[SSE] No connections for project ${projectId}`);
    return;
  }

  let sentCount = 0;
  const closedConnections: SSEConnection[] = [];

  for (const connection of connections) {
    if (connection.isOpen()) {
      connection.send(event, data);
      sentCount++;
    } else {
      closedConnections.push(connection);
    }
  }

  // Clean up closed connections
  for (const conn of closedConnections) {
    connections.delete(conn);
  }

  console.log(
    `[SSE] Broadcast to project ${projectId}: ${sentCount} clients, ${closedConnections.length} cleaned up`
  );
}

/**
 * Send an event to all connections for a user
 * @param userId - The user ID
 * @param event - The event name
 * @param data - The event data
 */
export function sendToUser(userId: string, event: string, data: object): void {
  const connections = userConnections.get(userId);
  if (!connections || connections.size === 0) {
    console.log(`[SSE] No connections for user ${userId}`);
    return;
  }

  let sentCount = 0;
  const closedConnections: SSEConnection[] = [];

  for (const connection of connections) {
    if (connection.isOpen()) {
      connection.send(event, data);
      sentCount++;
    } else {
      closedConnections.push(connection);
    }
  }

  // Clean up closed connections
  for (const conn of closedConnections) {
    connections.delete(conn);
  }

  console.log(
    `[SSE] Sent to user ${userId}: ${sentCount} clients, ${closedConnections.length} cleaned up`
  );
}

/**
 * Get the number of active connections for a project
 * @param projectId - The project ID
 * @returns Number of active connections
 */
export function getProjectConnectionCount(projectId: string): number {
  return projectConnections.get(projectId)?.size ?? 0;
}

/**
 * Get the number of active connections for a user
 * @param userId - The user ID
 * @returns Number of active connections
 */
export function getUserConnectionCount(userId: string): number {
  return userConnections.get(userId)?.size ?? 0;
}

/**
 * Get total number of active SSE connections
 * @returns Object with project and user connection counts
 */
export function getConnectionStats(): {
  projectConnections: number;
  userConnections: number;
  totalProjects: number;
  totalUsers: number;
} {
  let projectCount = 0;
  let userCount = 0;

  for (const connections of projectConnections.values()) {
    projectCount += connections.size;
  }

  for (const connections of userConnections.values()) {
    userCount += connections.size;
  }

  return {
    projectConnections: projectCount,
    userConnections: userCount,
    totalProjects: projectConnections.size,
    totalUsers: userConnections.size,
  };
}
