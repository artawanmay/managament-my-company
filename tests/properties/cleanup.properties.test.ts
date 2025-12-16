/**
 * Property-based tests for clean code cleanup
 * **Feature: clean-code-cleanup, Property 3: Test Suite Integrity After Cleanup**
 * **Validates: Requirements 1.7, 10.5**
 *
 * Tests that the test suite remains intact and functional after cleanup operations
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import * as fs from 'fs';
import * as path from 'path';
import { createSuccessBody, createErrorBody } from '@/lib/api/response';

const PBT_RUNS = 100;
const TEST_TIMEOUT = 30000;

// Helper to get all test files
function getTestFiles(dir: string): string[] {
  const files: string[] = [];
  
  if (!fs.existsSync(dir)) {
    return files;
  }
  
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getTestFiles(fullPath));
    } else if (entry.name.endsWith('.test.ts') || entry.name.endsWith('.spec.ts')) {
      files.push(fullPath);
    }
  }
  
  return files;
}

// Helper to extract imports from a file
function extractImports(filePath: string): string[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const importRegex = /(?:import|from)\s+['"]([^'"]+)['"]/g;
  const imports: string[] = [];
  let match;
  
  while ((match = importRegex.exec(content)) !== null) {
    if (match[1]) {
      imports.push(match[1]);
    }
  }
  
  return imports;
}

describe('Clean Code Cleanup Properties', () => {
  /**
   * **Feature: clean-code-cleanup, Property 3: Test Suite Integrity After Cleanup**
   * *For any* test file in the test suite, the file should exist and be readable.
   * **Validates: Requirements 1.7, 10.5**
   */
  it(
    'Property 3: Test Suite Integrity - all test files exist and are readable',
    () => {
      const testDirs = ['tests/properties', 'tests/integration', 'tests/e2e'];
      const allTestFiles: string[] = [];
      
      for (const dir of testDirs) {
        allTestFiles.push(...getTestFiles(dir));
      }
      
      // Verify we have test files
      expect(allTestFiles.length).toBeGreaterThan(0);
      
      // Property: For any test file, it should be readable
      fc.assert(
        fc.property(
          fc.constantFrom(...allTestFiles),
          (testFile) => {
            // File should exist
            const exists = fs.existsSync(testFile);
            if (!exists) return false;
            
            // File should be readable
            try {
              const content = fs.readFileSync(testFile, 'utf-8');
              return content.length > 0;
            } catch {
              return false;
            }
          }
        ),
        { numRuns: Math.min(PBT_RUNS, allTestFiles.length) }
      );
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: clean-code-cleanup, Property 3: Test Suite Integrity After Cleanup**
   * *For any* test file, imports should not reference the deleted temp-start folder.
   * **Validates: Requirements 1.7, 10.5**
   */
  it(
    'Property 3: Test Suite Integrity - no test references deleted temp-start folder',
    () => {
      const testDirs = ['tests/properties', 'tests/integration', 'tests/e2e'];
      const allTestFiles: string[] = [];
      
      for (const dir of testDirs) {
        allTestFiles.push(...getTestFiles(dir));
      }
      
      // Property: For any test file, no imports should reference temp-start
      fc.assert(
        fc.property(
          fc.constantFrom(...allTestFiles),
          (testFile) => {
            const imports = extractImports(testFile);
            // No import should reference temp-start
            return imports.every(imp => !imp.includes('temp-start'));
          }
        ),
        { numRuns: Math.min(PBT_RUNS, allTestFiles.length) }
      );
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: clean-code-cleanup, Property 3: Test Suite Integrity After Cleanup**
   * *For any* test file with @/ imports, the referenced module should exist.
   * **Validates: Requirements 1.7, 10.5**
   */
  it(
    'Property 3: Test Suite Integrity - aliased imports resolve to existing modules',
    () => {
      const testDirs = ['tests/properties', 'tests/integration', 'tests/e2e'];
      const allTestFiles: string[] = [];
      
      for (const dir of testDirs) {
        allTestFiles.push(...getTestFiles(dir));
      }
      
      // Property: For any test file with @/ imports, the module should exist
      fc.assert(
        fc.property(
          fc.constantFrom(...allTestFiles),
          (testFile) => {
            const imports = extractImports(testFile);
            const aliasedImports = imports.filter(imp => imp.startsWith('@/'));
            
            return aliasedImports.every(imp => {
              // Convert @/ to src/
              const relativePath = imp.replace('@/', 'src/');
              
              // Check if file exists (with various extensions)
              const extensions = ['', '.ts', '.tsx', '/index.ts', '/index.tsx'];
              return extensions.some(ext => {
                const fullPath = relativePath + ext;
                return fs.existsSync(fullPath);
              });
            });
          }
        ),
        { numRuns: Math.min(PBT_RUNS, allTestFiles.length) }
      );
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: clean-code-cleanup, Property 3: Test Suite Integrity After Cleanup**
   * *For any* property test file, it should contain at least one test case.
   * **Validates: Requirements 1.7, 10.5**
   */
  it(
    'Property 3: Test Suite Integrity - property test files contain test cases',
    () => {
      const propertyTestFiles = getTestFiles('tests/properties');
      
      // Property: For any property test file, it should have at least one it() block
      fc.assert(
        fc.property(
          fc.constantFrom(...propertyTestFiles),
          (testFile) => {
            const content = fs.readFileSync(testFile, 'utf-8');
            // Check for it() or test() blocks
            const hasTests = /\bit\s*\(/.test(content) || /\btest\s*\(/.test(content);
            return hasTests;
          }
        ),
        { numRuns: Math.min(PBT_RUNS, propertyTestFiles.length) }
      );
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: clean-code-cleanup, Property 3: Test Suite Integrity After Cleanup**
   * *For any* deleted folder path, no source file should import from it.
   * **Validates: Requirements 1.7, 10.5**
   */
  it(
    'Property 3: Test Suite Integrity - no source imports from deleted folders',
    () => {
      // List of folders that have been deleted in cleanup
      const deletedFolders = ['temp-start'];
      
      // Get all source files
      function getSourceFiles(dir: string): string[] {
        const files: string[] = [];
        if (!fs.existsSync(dir)) return files;
        
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
            files.push(...getSourceFiles(fullPath));
          } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
            files.push(fullPath);
          }
        }
        return files;
      }
      
      const sourceFiles = getSourceFiles('src');
      
      if (sourceFiles.length === 0) {
        // No source files to check
        return;
      }
      
      // Property: For any source file and deleted folder, no imports should reference it
      fc.assert(
        fc.property(
          fc.constantFrom(...sourceFiles),
          fc.constantFrom(...deletedFolders),
          (sourceFile, deletedFolder) => {
            const imports = extractImports(sourceFile);
            return imports.every(imp => !imp.includes(deletedFolder));
          }
        ),
        { numRuns: Math.min(PBT_RUNS, sourceFiles.length * deletedFolders.length) }
      );
    },
    TEST_TIMEOUT
  );
});

/**
 * API Response Consistency Properties
 * Tests that the API response utilities produce consistent response shapes
 */
describe('API Response Consistency Properties', () => {
  /**
   * **Feature: clean-code-cleanup, Property 1: API Error Response Consistency**
   * *For any* API endpoint that returns an error, the response body should contain
   * an `error` field with a string message.
   * **Validates: Requirements 3.4**
   */
  it(
    'Property 1: API Error Response Consistency - error responses contain error field',
    () => {
      // Generate arbitrary error messages and optional details
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 200 }),
          fc.option(
            fc.dictionary(fc.string({ minLength: 1, maxLength: 20 }), fc.jsonValue()),
            { nil: undefined }
          ),
          (message, details) => {
            const body = createErrorBody(message, details);

            // Body should have error field with string message
            expect(body).toHaveProperty('error');
            expect(typeof body.error).toBe('string');
            expect(body.error).toBe(message);

            // If details provided, they should be in the response
            if (details !== undefined) {
              expect(body).toHaveProperty('details');
              expect(body.details).toEqual(details);
            } else {
              // If no details, the field should not exist
              expect(body.details).toBeUndefined();
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
   * **Feature: clean-code-cleanup, Property 2: API Success Response Consistency**
   * *For any* API endpoint that returns success data, the response body should
   * contain a `data` field.
   * **Validates: Requirements 3.5**
   */
  it(
    'Property 2: API Success Response Consistency - success responses contain data field',
    () => {
      // Generate arbitrary data payloads
      fc.assert(
        fc.property(
          fc.jsonValue(),
          (data) => {
            const body = createSuccessBody(data);

            // Body should have data field
            expect(body).toHaveProperty('data');
            expect(body.data).toEqual(data);

            return true;
          }
        ),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );

  /**
   * **Feature: clean-code-cleanup, Property 1: API Error Response Consistency**
   * *For any* error response body, it should only contain 'error' and optionally 'details' fields.
   * **Validates: Requirements 3.4**
   */
  it(
    'Property 1: API Error Response Consistency - error body has correct shape',
    () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.option(
            fc.dictionary(fc.string({ minLength: 1, maxLength: 20 }), fc.jsonValue()),
            { nil: undefined }
          ),
          (message, details) => {
            const body = createErrorBody(message, details);
            const keys = Object.keys(body);

            // Should only have 'error' and optionally 'details'
            if (details !== undefined) {
              expect(keys).toHaveLength(2);
              expect(keys).toContain('error');
              expect(keys).toContain('details');
            } else {
              expect(keys).toHaveLength(1);
              expect(keys).toContain('error');
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
   * **Feature: clean-code-cleanup, Property 2: API Success Response Consistency**
   * *For any* success response body, it should only contain a 'data' field.
   * **Validates: Requirements 3.5**
   */
  it(
    'Property 2: API Success Response Consistency - success body has correct shape',
    () => {
      fc.assert(
        fc.property(
          fc.jsonValue(),
          (data) => {
            const body = createSuccessBody(data);
            const keys = Object.keys(body);

            // Should only have 'data' field
            expect(keys).toHaveLength(1);
            expect(keys).toContain('data');

            return true;
          }
        ),
        { numRuns: PBT_RUNS }
      );
    },
    TEST_TIMEOUT
  );
});
