/**
 * Docker Compose configuration validator
 * Validates docker-compose.yml for data persistence requirements
 * Requirements: 4.1, 4.2, 4.3, 4.4
 */

/**
 * Represents a parsed Docker Compose service
 */
export interface DockerComposeService {
  image?: string;
  build?: {
    context?: string;
    dockerfile?: string;
  };
  volumes?: string[];
  depends_on?: Record<string, { condition: string }> | string[];
  healthcheck?: {
    test: string[];
    interval?: string;
    timeout?: string;
    retries?: number;
    start_period?: string;
  };
  environment?: Record<string, string> | string[];
  restart?: string;
  ports?: string[];
  networks?: string[];
}

/**
 * Represents a parsed Docker Compose configuration
 */
export interface DockerComposeConfig {
  version?: string;
  services: Record<string, DockerComposeService>;
  volumes?: Record<string, { name?: string } | null>;
  networks?: Record<string, { name?: string; driver?: string } | null>;
}

/**
 * Result of docker-compose validation
 */
export interface DockerComposeValidationResult {
  valid: boolean;
  hasPostgresService: boolean;
  hasRedisService: boolean;
  hasAppService: boolean;
  hasNginxService: boolean;
  hasPostgresVolume: boolean;
  hasUploadsVolume: boolean;
  hasPostgresHealthcheck: boolean;
  hasRedisHealthcheck: boolean;
  hasAppHealthcheck: boolean;
  hasCorrectDependencies: boolean;
  errors: string[];
}

/**
 * Required services for the MMC application
 */
export const REQUIRED_SERVICES = ['postgres', 'redis', 'app', 'nginx'] as const;

/**
 * Required named volumes for data persistence
 */
export const REQUIRED_VOLUMES = ['pg_data', 'uploads'] as const;

/**
 * Parse a simple YAML-like docker-compose configuration
 * Note: This is a simplified parser for testing purposes
 * @param content - The docker-compose.yml content
 * @returns Parsed configuration object
 */
export function parseDockerCompose(content: string): DockerComposeConfig {
  const config: DockerComposeConfig = {
    services: {},
    volumes: {},
    networks: {},
  };

  const lines = content.split('\n');
  let currentSection: 'services' | 'volumes' | 'networks' | null = null;
  let currentService: string | null = null;
  let currentSubSection: string | null = null;
  let currentDependency: string | null = null;

  // Helper to get indentation level (number of leading spaces)
  const getIndent = (line: string): number => {
    const match = line.match(/^(\s*)/);
    return match ? match[1].length : 0;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const indent = getIndent(line);
    
    // Skip comments and empty lines
    if (trimmed.startsWith('#') || trimmed === '') continue;

    // Detect top-level sections (no indent)
    if (indent === 0) {
      if (trimmed.startsWith('services:')) {
        currentSection = 'services';
        currentService = null;
        currentSubSection = null;
        continue;
      }
      if (trimmed.startsWith('volumes:')) {
        currentSection = 'volumes';
        currentService = null;
        currentSubSection = null;
        continue;
      }
      if (trimmed.startsWith('networks:')) {
        currentSection = 'networks';
        currentService = null;
        currentSubSection = null;
        continue;
      }
      if (trimmed.startsWith('version:')) {
        const match = trimmed.match(/^version:\s*['"]?([^'"]+)['"]?/);
        if (match) config.version = match[1];
        continue;
      }
    }

    // Parse services section
    if (currentSection === 'services') {
      // Service name (2 spaces indent)
      if (indent === 2 && trimmed.endsWith(':') && !trimmed.includes(' ')) {
        currentService = trimmed.slice(0, -1);
        config.services[currentService] = {};
        currentSubSection = null;
        currentDependency = null;
        continue;
      }

      if (currentService) {
        const service = config.services[currentService]!;

        // Parse service properties (4 spaces indent)
        if (indent === 4) {
          // Reset sub-section tracking when we hit a new property
          if (trimmed.endsWith(':') && !trimmed.includes(' ')) {
            const propName = trimmed.slice(0, -1);
            if (propName === 'volumes') {
              currentSubSection = 'volumes';
              service.volumes = [];
            } else if (propName === 'depends_on') {
              currentSubSection = 'depends_on';
              service.depends_on = {};
            } else if (propName === 'healthcheck') {
              currentSubSection = 'healthcheck';
              service.healthcheck = { test: [] };
            } else if (propName === 'environment') {
              currentSubSection = 'environment';
              service.environment = {};
            } else if (propName === 'ports') {
              currentSubSection = 'ports';
              service.ports = [];
            } else if (propName === 'networks') {
              currentSubSection = 'networks';
              service.networks = [];
            } else if (propName === 'build') {
              currentSubSection = 'build';
              service.build = {};
            } else {
              currentSubSection = null;
            }
            continue;
          }

          // Parse inline properties
          const colonIndex = trimmed.indexOf(':');
          if (colonIndex > 0) {
            const key = trimmed.slice(0, colonIndex).trim();
            const value = trimmed.slice(colonIndex + 1).trim();
            
            if (key === 'image' && value) {
              service.image = value;
              currentSubSection = null;
            } else if (key === 'restart' && value) {
              service.restart = value;
              currentSubSection = null;
            } else if (key === 'container_name' && value) {
              currentSubSection = null;
            } else if (key === 'command' && value) {
              currentSubSection = null;
            }
          }
        }

        // Parse sub-section items (6 spaces indent)
        if (indent === 6) {
          if (currentSubSection === 'volumes' && trimmed.startsWith('-')) {
            const volumeValue = trimmed.slice(1).trim();
            if (service.volumes) {
              service.volumes.push(volumeValue);
            }
          }
          if (currentSubSection === 'ports' && trimmed.startsWith('-')) {
            const portValue = trimmed.slice(1).trim().replace(/^["']|["']$/g, '');
            if (service.ports) {
              service.ports.push(portValue);
            }
          }
          if (currentSubSection === 'networks' && trimmed.startsWith('-')) {
            const networkValue = trimmed.slice(1).trim();
            if (service.networks) {
              service.networks.push(networkValue);
            }
          }
          if (currentSubSection === 'depends_on') {
            // Handle dependency name
            if (trimmed.endsWith(':') && !trimmed.startsWith('-')) {
              currentDependency = trimmed.slice(0, -1);
              if (typeof service.depends_on === 'object' && !Array.isArray(service.depends_on)) {
                (service.depends_on as Record<string, { condition: string }>)[currentDependency] = { condition: '' };
              }
            }
          }
          if (currentSubSection === 'healthcheck') {
            // Parse healthcheck test array
            if (trimmed.startsWith('test:')) {
              const testValue = trimmed.slice(5).trim();
              if (testValue.startsWith('[') && testValue.endsWith(']')) {
                const testArray = testValue.slice(1, -1).split(',').map(s => s.trim().replace(/^["']|["']$/g, ''));
                if (service.healthcheck) {
                  service.healthcheck.test = testArray;
                }
              }
            } else if (trimmed.startsWith('interval:')) {
              if (service.healthcheck) {
                service.healthcheck.interval = trimmed.slice(9).trim();
              }
            } else if (trimmed.startsWith('timeout:')) {
              if (service.healthcheck) {
                service.healthcheck.timeout = trimmed.slice(8).trim();
              }
            } else if (trimmed.startsWith('retries:')) {
              if (service.healthcheck) {
                service.healthcheck.retries = parseInt(trimmed.slice(8).trim(), 10);
              }
            } else if (trimmed.startsWith('start_period:')) {
              if (service.healthcheck) {
                service.healthcheck.start_period = trimmed.slice(13).trim();
              }
            }
          }
          if (currentSubSection === 'environment') {
            const envColonIndex = trimmed.indexOf(':');
            if (envColonIndex > 0) {
              const envKey = trimmed.slice(0, envColonIndex).trim();
              const envValue = trimmed.slice(envColonIndex + 1).trim();
              if (typeof service.environment === 'object' && !Array.isArray(service.environment)) {
                (service.environment as Record<string, string>)[envKey] = envValue;
              }
            }
          }
          if (currentSubSection === 'build') {
            if (trimmed.startsWith('context:')) {
              if (service.build) {
                service.build.context = trimmed.slice(8).trim();
              }
            } else if (trimmed.startsWith('dockerfile:')) {
              if (service.build) {
                service.build.dockerfile = trimmed.slice(11).trim();
              }
            }
          }
        }

        // Parse nested items (8 spaces indent)
        if (indent === 8) {
          if (currentSubSection === 'depends_on' && currentDependency) {
            if (trimmed.startsWith('condition:')) {
              const conditionValue = trimmed.slice(10).trim();
              if (typeof service.depends_on === 'object' && !Array.isArray(service.depends_on)) {
                (service.depends_on as Record<string, { condition: string }>)[currentDependency] = { condition: conditionValue };
              }
            }
          }
        }
      }
    }

    // Parse volumes section
    if (currentSection === 'volumes') {
      if (indent === 2 && trimmed.endsWith(':') && !trimmed.includes(' ')) {
        const volumeName = trimmed.slice(0, -1);
        config.volumes![volumeName] = {};
        continue;
      }
      if (indent === 4 && trimmed.startsWith('name:')) {
        const volumeNameValue = trimmed.slice(5).trim();
        const lastVolume = Object.keys(config.volumes!).pop();
        if (lastVolume) {
          config.volumes![lastVolume] = { name: volumeNameValue };
        }
      }
    }

    // Parse networks section
    if (currentSection === 'networks') {
      if (indent === 2 && trimmed.endsWith(':') && !trimmed.includes(' ')) {
        const networkName = trimmed.slice(0, -1);
        config.networks![networkName] = {};
        continue;
      }
    }
  }

  return config;
}

/**
 * Check if a service has a volume mounted for a specific path pattern
 * @param service - The service configuration
 * @param volumeName - The volume name to check for
 * @returns True if the volume is mounted
 */
export function hasVolumeMount(service: DockerComposeService, volumeName: string): boolean {
  if (!service.volumes) return false;
  return service.volumes.some(v => v.startsWith(`${volumeName}:`));
}

/**
 * Check if a service depends on another service with health condition
 * @param service - The service configuration
 * @param dependencyName - The dependency service name
 * @returns True if the dependency exists with service_healthy condition
 */
export function hasDependencyWithHealthCheck(
  service: DockerComposeService,
  dependencyName: string
): boolean {
  if (!service.depends_on) return false;
  
  if (Array.isArray(service.depends_on)) {
    return service.depends_on.includes(dependencyName);
  }
  
  const dep = service.depends_on[dependencyName];
  return dep?.condition === 'service_healthy';
}

/**
 * Check if a service has a healthcheck configured
 * @param service - The service configuration
 * @returns True if healthcheck is configured
 */
export function hasHealthcheck(service: DockerComposeService): boolean {
  return !!service.healthcheck && service.healthcheck.test.length > 0;
}

/**
 * Validate docker-compose configuration for MMC deployment requirements
 * @param content - The docker-compose.yml content
 * @returns Validation result
 */
export function validateDockerCompose(content: string): DockerComposeValidationResult {
  const errors: string[] = [];
  const config = parseDockerCompose(content);

  // Check for required services
  const hasPostgresService = 'postgres' in config.services;
  const hasRedisService = 'redis' in config.services;
  const hasAppService = 'app' in config.services;
  const hasNginxService = 'nginx' in config.services;

  if (!hasPostgresService) errors.push('Missing postgres service');
  if (!hasRedisService) errors.push('Missing redis service');
  if (!hasAppService) errors.push('Missing app service');
  if (!hasNginxService) errors.push('Missing nginx service');

  // Check for required volumes
  const hasPostgresVolume = 'pg_data' in (config.volumes || {});
  const hasUploadsVolume = 'uploads' in (config.volumes || {});

  if (!hasPostgresVolume) errors.push('Missing pg_data volume for PostgreSQL persistence');
  if (!hasUploadsVolume) errors.push('Missing uploads volume for file persistence');

  // Check volume mounts on services
  if (hasPostgresService && !hasVolumeMount(config.services.postgres!, 'pg_data')) {
    errors.push('PostgreSQL service does not mount pg_data volume');
  }
  if (hasAppService && !hasVolumeMount(config.services.app!, 'uploads')) {
    errors.push('App service does not mount uploads volume');
  }

  // Check healthchecks
  const hasPostgresHealthcheck = hasPostgresService && hasHealthcheck(config.services.postgres!);
  const hasRedisHealthcheck = hasRedisService && hasHealthcheck(config.services.redis!);
  const hasAppHealthcheck = hasAppService && hasHealthcheck(config.services.app!);

  if (!hasPostgresHealthcheck) errors.push('PostgreSQL service missing healthcheck');
  if (!hasRedisHealthcheck) errors.push('Redis service missing healthcheck');
  if (!hasAppHealthcheck) errors.push('App service missing healthcheck');

  // Check dependencies
  let hasCorrectDependencies = true;
  if (hasAppService) {
    const appService = config.services.app!;
    if (!hasDependencyWithHealthCheck(appService, 'postgres')) {
      errors.push('App service should depend on postgres with service_healthy condition');
      hasCorrectDependencies = false;
    }
    if (!hasDependencyWithHealthCheck(appService, 'redis')) {
      errors.push('App service should depend on redis with service_healthy condition');
      hasCorrectDependencies = false;
    }
  }
  if (hasNginxService) {
    const nginxService = config.services.nginx!;
    if (!hasDependencyWithHealthCheck(nginxService, 'app')) {
      errors.push('Nginx service should depend on app with service_healthy condition');
      hasCorrectDependencies = false;
    }
  }

  const valid = errors.length === 0;

  return {
    valid,
    hasPostgresService,
    hasRedisService,
    hasAppService,
    hasNginxService,
    hasPostgresVolume,
    hasUploadsVolume,
    hasPostgresHealthcheck,
    hasRedisHealthcheck,
    hasAppHealthcheck,
    hasCorrectDependencies,
    errors,
  };
}

/**
 * Check if a volume configuration ensures data persistence
 * Named volumes persist data across container restarts
 * @param volumeConfig - The volume configuration
 * @returns True if the volume is configured for persistence
 */
export function isNamedVolume(volumeConfig: { name?: string } | null): boolean {
  // Named volumes (with or without explicit name) persist data
  // Bind mounts (starting with ./ or /) do not count as named volumes
  return volumeConfig !== null;
}

/**
 * Validate that all required volumes are named volumes (not bind mounts)
 * @param config - The parsed docker-compose configuration
 * @returns True if all required volumes are named volumes
 */
export function hasNamedVolumesForPersistence(config: DockerComposeConfig): boolean {
  if (!config.volumes) return false;
  
  for (const volumeName of REQUIRED_VOLUMES) {
    if (!(volumeName in config.volumes)) return false;
    if (!isNamedVolume(config.volumes[volumeName])) return false;
  }
  
  return true;
}
