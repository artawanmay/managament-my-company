/**
 * Property-based tests for input validation
 * **Feature: mmc-app, Property 22: Input Validation Rejection**
 * **Validates: Requirements 18.6**
 *
 * Tests that invalid inputs are properly rejected by Zod schemas
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { z } from 'zod';
import {
  createClientSchema,
  clientStatusSchema,
} from '@/lib/validation/schemas/client';
import {
  createProjectSchema,
  projectStatusSchema,
  prioritySchema,
} from '@/lib/validation/schemas/project';
import {
  createTaskSchema,
  taskStatusSchema,
  moveTaskSchema,
} from '@/lib/validation/schemas/task';
import {
  createNoteSchema,
  noteTypeSchema,
  portSchema,
} from '@/lib/validation/schemas/note';
import {
  uuidSchema,
  emailSchema,
  urlSchema,
  hexColorSchema,
  requiredStringSchema,
  positiveNumberSchema,
  positiveIntSchema,
  validateInput,
  createValidationErrorResponse,
} from '@/lib/validation';

const PBT_RUNS = 100;
const TEST_TIMEOUT = 30000;

describe('Input Validation Properties', () => {
  /**
   * **Feature: mmc-app, Property 22: Input Validation Rejection**
   * *For any* invalid UUID string, the uuidSchema should reject it.
   * **Validates: Requirements 18.6**
   */
  it(
    'Property 22: Invalid UUIDs are rejected',
    () => {
      fc.assert(
        fc.property(
          fc.string().filter((s) => {
            // Filter out strings that happen to be valid UUIDs
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            return !uuidRegex.test(s);
          }),
          (invalidUuid) => {
            const result = uuidSchema.safeParse(invalidUuid);
            return !result.success;
          }
        ),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: mmc-app, Property 22: Input Validation Rejection**
   * *For any* invalid email string, the emailSchema should reject it.
   * **Validates: Requirements 18.6**
   */
  it(
    'Property 22: Invalid emails are rejected',
    () => {
      fc.assert(
        fc.property(
          fc.string().filter((s) => {
            // Filter out strings that could be valid emails
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            return !emailRegex.test(s) && s.length <= 255;
          }),
          (invalidEmail) => {
            const result = emailSchema.safeParse(invalidEmail);
            return !result.success;
          }
        ),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: mmc-app, Property 22: Input Validation Rejection**
   * *For any* invalid URL string, the urlSchema should reject it.
   * **Validates: Requirements 18.6**
   */
  it(
    'Property 22: Invalid URLs are rejected',
    () => {
      fc.assert(
        fc.property(
          fc.string().filter((s) => {
            // Filter out strings that could be valid URLs
            try {
              new URL(s);
              return false;
            } catch {
              return s.length <= 2048;
            }
          }),
          (invalidUrl) => {
            const result = urlSchema.safeParse(invalidUrl);
            return !result.success;
          }
        ),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: mmc-app, Property 22: Input Validation Rejection**
   * *For any* invalid hex color string, the hexColorSchema should reject it.
   * **Validates: Requirements 18.6**
   */
  it(
    'Property 22: Invalid hex colors are rejected',
    () => {
      fc.assert(
        fc.property(
          fc.string().filter((s) => {
            // Filter out valid hex colors
            const hexRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
            return !hexRegex.test(s);
          }),
          (invalidHex) => {
            const result = hexColorSchema.safeParse(invalidHex);
            return !result.success;
          }
        ),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: mmc-app, Property 22: Input Validation Rejection**
   * *For any* negative number, positiveNumberSchema should reject it.
   * **Validates: Requirements 18.6**
   */
  it(
    'Property 22: Negative numbers are rejected by positiveNumberSchema',
    () => {
      fc.assert(
        fc.property(
          fc.double({ min: -1e10, max: -0.0001 }),
          (negativeNum) => {
            const result = positiveNumberSchema.safeParse(negativeNum);
            return !result.success;
          }
        ),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: mmc-app, Property 22: Input Validation Rejection**
   * *For any* negative integer, positiveIntSchema should reject it.
   * **Validates: Requirements 18.6**
   */
  it(
    'Property 22: Negative integers are rejected by positiveIntSchema',
    () => {
      fc.assert(
        fc.property(
          fc.integer({ min: -1000000, max: -1 }),
          (negativeInt) => {
            const result = positiveIntSchema.safeParse(negativeInt);
            return !result.success;
          }
        ),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: mmc-app, Property 22: Input Validation Rejection**
   * *For any* empty string, requiredStringSchema should reject it.
   * **Validates: Requirements 18.6**
   */
  it(
    'Property 22: Empty strings are rejected by requiredStringSchema',
    () => {
      const schema = requiredStringSchema(255);
      const result = schema.safeParse('');
      expect(result.success).toBe(false);
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: mmc-app, Property 22: Input Validation Rejection**
   * *For any* string exceeding max length, requiredStringSchema should reject it.
   * **Validates: Requirements 18.6**
   */
  it(
    'Property 22: Strings exceeding max length are rejected',
    () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100 }),
          fc.string({ minLength: 1 }),
          (maxLength, baseString) => {
            const schema = requiredStringSchema(maxLength);
            // Create a string that exceeds the max length
            const tooLongString = baseString.repeat(Math.ceil((maxLength + 1) / Math.max(baseString.length, 1)));
            if (tooLongString.length > maxLength) {
              const result = schema.safeParse(tooLongString);
              return !result.success;
            }
            return true;
          }
        ),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: mmc-app, Property 22: Input Validation Rejection**
   * *For any* invalid port number (outside 0-65535), portSchema should reject it.
   * **Validates: Requirements 18.6**
   */
  it(
    'Property 22: Invalid port numbers are rejected',
    () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.integer({ min: -1000000, max: -1 }),
            fc.integer({ min: 65536, max: 1000000 })
          ),
          (invalidPort) => {
            const result = portSchema.safeParse(invalidPort);
            return !result.success;
          }
        ),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: mmc-app, Property 22: Input Validation Rejection**
   * *For any* invalid client status, clientStatusSchema should reject it.
   * **Validates: Requirements 18.6**
   */
  it(
    'Property 22: Invalid client status values are rejected',
    () => {
      const validStatuses = ['ACTIVE', 'INACTIVE', 'PROSPECT'];
      fc.assert(
        fc.property(
          fc.string().filter((s) => !validStatuses.includes(s)),
          (invalidStatus) => {
            const result = clientStatusSchema.safeParse(invalidStatus);
            return !result.success;
          }
        ),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: mmc-app, Property 22: Input Validation Rejection**
   * *For any* invalid project status, projectStatusSchema should reject it.
   * **Validates: Requirements 18.6**
   */
  it(
    'Property 22: Invalid project status values are rejected',
    () => {
      const validStatuses = ['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'ARCHIVED'];
      fc.assert(
        fc.property(
          fc.string().filter((s) => !validStatuses.includes(s)),
          (invalidStatus) => {
            const result = projectStatusSchema.safeParse(invalidStatus);
            return !result.success;
          }
        ),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: mmc-app, Property 22: Input Validation Rejection**
   * *For any* invalid task status, taskStatusSchema should reject it.
   * **Validates: Requirements 18.6**
   */
  it(
    'Property 22: Invalid task status values are rejected',
    () => {
      const validStatuses = ['BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'CHANGES_REQUESTED', 'DONE'];
      fc.assert(
        fc.property(
          fc.string().filter((s) => !validStatuses.includes(s)),
          (invalidStatus) => {
            const result = taskStatusSchema.safeParse(invalidStatus);
            return !result.success;
          }
        ),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: mmc-app, Property 22: Input Validation Rejection**
   * *For any* invalid priority value, prioritySchema should reject it.
   * **Validates: Requirements 18.6**
   */
  it(
    'Property 22: Invalid priority values are rejected',
    () => {
      const validPriorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
      fc.assert(
        fc.property(
          fc.string().filter((s) => !validPriorities.includes(s)),
          (invalidPriority) => {
            const result = prioritySchema.safeParse(invalidPriority);
            return !result.success;
          }
        ),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: mmc-app, Property 22: Input Validation Rejection**
   * *For any* invalid note type, noteTypeSchema should reject it.
   * **Validates: Requirements 18.6**
   */
  it(
    'Property 22: Invalid note type values are rejected',
    () => {
      const validTypes = ['API', 'RDP', 'SSH', 'DB', 'OTHER'];
      fc.assert(
        fc.property(
          fc.string().filter((s) => !validTypes.includes(s)),
          (invalidType) => {
            const result = noteTypeSchema.safeParse(invalidType);
            return !result.success;
          }
        ),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: mmc-app, Property 22: Input Validation Rejection**
   * *For any* client creation input missing required name field, createClientSchema should reject it.
   * **Validates: Requirements 18.6**
   */
  it(
    'Property 22: Client creation without name is rejected',
    () => {
      fc.assert(
        fc.property(
          fc.record({
            picName: fc.option(fc.string({ maxLength: 255 }), { nil: undefined }),
            email: fc.option(fc.emailAddress(), { nil: undefined }),
            status: fc.constantFrom('ACTIVE', 'INACTIVE', 'PROSPECT'),
          }),
          (partialClient) => {
            // Missing required 'name' field
            const result = createClientSchema.safeParse(partialClient);
            return !result.success;
          }
        ),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: mmc-app, Property 22: Input Validation Rejection**
   * *For any* task creation input missing required projectId, createTaskSchema should reject it.
   * **Validates: Requirements 18.6**
   */
  it(
    'Property 22: Task creation without projectId is rejected',
    () => {
      fc.assert(
        fc.property(
          fc.record({
            title: fc.string({ minLength: 1, maxLength: 255 }),
            description: fc.option(fc.string({ maxLength: 5000 }), { nil: undefined }),
            status: fc.constantFrom('BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'CHANGES_REQUESTED', 'DONE'),
            priority: fc.constantFrom('LOW', 'MEDIUM', 'HIGH', 'URGENT'),
          }),
          (partialTask) => {
            // Missing required 'projectId' field
            const result = createTaskSchema.safeParse(partialTask);
            return !result.success;
          }
        ),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: mmc-app, Property 22: Input Validation Rejection**
   * *For any* note creation input missing required secret field, createNoteSchema should reject it.
   * **Validates: Requirements 18.6**
   */
  it(
    'Property 22: Note creation without secret is rejected',
    () => {
      fc.assert(
        fc.property(
          fc.record({
            systemName: fc.string({ minLength: 1, maxLength: 255 }),
            type: fc.constantFrom('API', 'RDP', 'SSH', 'DB', 'OTHER'),
            host: fc.option(fc.string({ maxLength: 255 }), { nil: undefined }),
            port: fc.option(fc.integer({ min: 0, max: 65535 }), { nil: undefined }),
            username: fc.option(fc.string({ maxLength: 255 }), { nil: undefined }),
          }),
          (partialNote) => {
            // Missing required 'secret' field
            const result = createNoteSchema.safeParse(partialNote);
            return !result.success;
          }
        ),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: mmc-app, Property 22: Input Validation Rejection**
   * *For any* move task input with invalid status, moveTaskSchema should reject it.
   * **Validates: Requirements 18.6**
   */
  it(
    'Property 22: Move task with invalid status is rejected',
    () => {
      const validStatuses = ['BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'CHANGES_REQUESTED', 'DONE'];
      fc.assert(
        fc.property(
          fc.record({
            status: fc.string().filter((s) => !validStatuses.includes(s)),
            order: fc.integer({ min: 0 }),
          }),
          (invalidMoveInput) => {
            const result = moveTaskSchema.safeParse(invalidMoveInput);
            return !result.success;
          }
        ),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: mmc-app, Property 22: Input Validation Rejection**
   * *For any* invalid input, validateInput helper should return success: false with errors.
   * **Validates: Requirements 18.6**
   */
  it(
    'Property 22: validateInput returns structured errors for invalid input',
    () => {
      const testSchema = z.object({
        name: z.string().min(1),
        age: z.number().min(0),
      });

      fc.assert(
        fc.property(
          fc.oneof(
            // Missing required fields
            fc.constant({}),
            // Invalid types
            fc.record({
              name: fc.constant(123),
              age: fc.constant('not a number'),
            }),
            // Invalid values
            fc.record({
              name: fc.constant(''),
              age: fc.integer({ min: -1000, max: -1 }),
            })
          ),
          (invalidInput) => {
            const result = validateInput(testSchema, invalidInput);
            return !result.success && Array.isArray(result.errors) && result.errors.length > 0;
          }
        ),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: mmc-app, Property 22: Input Validation Rejection**
   * *For any* Zod error, createValidationErrorResponse should return structured error format.
   * **Validates: Requirements 18.6**
   */
  it(
    'Property 22: createValidationErrorResponse returns proper error structure',
    () => {
      const testSchema = z.object({
        field1: z.string().min(1),
        field2: z.number(),
      });

      fc.assert(
        fc.property(
          fc.record({
            field1: fc.oneof(fc.constant(''), fc.constant(null), fc.integer()),
            field2: fc.oneof(fc.string(), fc.constant(null), fc.constant(undefined)),
          }),
          (invalidInput) => {
            const parseResult = testSchema.safeParse(invalidInput);
            if (!parseResult.success) {
              const errorResponse = createValidationErrorResponse(parseResult.error);
              return (
                errorResponse.error === 'VALIDATION_ERROR' &&
                errorResponse.message === 'Validation failed' &&
                Array.isArray(errorResponse.details) &&
                errorResponse.details.every(
                  (d) => typeof d.field === 'string' && typeof d.message === 'string'
                )
              );
            }
            return true; // Skip if input happens to be valid
          }
        ),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: mmc-app, Property 22: Input Validation Rejection**
   * *For any* project with end date before start date, createProjectSchema should reject it.
   * **Validates: Requirements 18.6**
   */
  it(
    'Property 22: Project with end date before start date is rejected',
    () => {
      fc.assert(
        fc.property(
          fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }).filter(d => !isNaN(d.getTime())),
          fc.integer({ min: 1, max: 365 }),
          fc.uuid(),
          fc.uuid(),
          (startDate, daysBefore, clientId, managerId) => {
            // Skip if date is invalid
            if (isNaN(startDate.getTime())) return true;
            
            const endDate = new Date(startDate);
            endDate.setDate(endDate.getDate() - daysBefore);

            const projectInput = {
              clientId,
              name: 'Test Project',
              managerId,
              startDate: startDate.toISOString(),
              endDate: endDate.toISOString(),
            };

            const result = createProjectSchema.safeParse(projectInput);
            return !result.success;
          }
        ),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );
});
