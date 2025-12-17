/**
 * Health Check API Route
 * GET /api/health
 *
 * Returns system health status including Redis and database components.
 * This endpoint is designed for monitoring systems and load balancers.
 *
 * Requirements: 2.1, 2.2, 2.3
 */
import { createFileRoute } from "@tanstack/react-router";
import { json } from "@tanstack/react-start";
import {
  performHealthCheck,
  type HealthCheckResponse,
} from "@/lib/realtime/health";

export const Route = createFileRoute("/api/health/")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const healthStatus: HealthCheckResponse = await performHealthCheck();

          // Return appropriate HTTP status code based on health
          // 200 for healthy, 503 for unhealthy, 200 for degraded (still operational)
          const httpStatus = healthStatus.status === "unhealthy" ? 503 : 200;

          return json(healthStatus, { status: httpStatus });
        } catch (error) {
          console.error("[Health Check] Error:", error);

          // Return unhealthy status on error
          const errorResponse: HealthCheckResponse = {
            status: "unhealthy",
            timestamp: new Date().toISOString(),
            components: {
              redis: {
                status: "unhealthy",
                latencyMs: null,
                fallbackActive: false,
                error: "Health check failed",
              },
              database: {
                status: "unhealthy",
                latencyMs: null,
                error: "Health check failed",
              },
            },
          };

          return json(errorResponse, { status: 503 });
        }
      },
    },
  },
});
