/**
 * Dependency Injection Container
 * Provides centralized service registration and resolution
 * Supports singleton, transient, and factory patterns
 */

type ServiceFactory<T = any> = (...args: any[]) => T | Promise<T>
type ServiceInstance<T = any> = T

interface ServiceRegistration<T = any> {
  factory: ServiceFactory<T>
  lifecycle: 'singleton' | 'transient' | 'scoped'
  instance?: ServiceInstance<T>
  dependencies: string[]
}

export class Container {
  private services = new Map<string, ServiceRegistration>()
  private resolving = new Set<string>()

  /**
   * Register a singleton service
   * Instance is created once and reused
   */
  singleton<T>(
    name: string,
    factory: ServiceFactory<T>,
    dependencies: string[] = []
  ): this {
    this.services.set(name, {
      factory,
      lifecycle: 'singleton',
      dependencies
    })
    return this
  }

  /**
   * Register a transient service
   * New instance created on each resolution
   */
  transient<T>(
    name: string,
    factory: ServiceFactory<T>,
    dependencies: string[] = []
  ): this {
    this.services.set(name, {
      factory,
      lifecycle: 'transient',
      dependencies
    })
    return this
  }

  /**
   * Register a scoped service
   * Instance created per resolution scope (useful for request-scoped services)
   */
  scoped<T>(
    name: string,
    factory: ServiceFactory<T>,
    dependencies: string[] = []
  ): this {
    this.services.set(name, {
      factory,
      lifecycle: 'scoped',
      dependencies
    })
    return this
  }

  /**
   * Register a pre-created instance
   */
  instance<T>(name: string, instance: T): this {
    this.services.set(name, {
      factory: () => instance,
      lifecycle: 'singleton',
      instance,
      dependencies: []
    })
    return this
  }

  /**
   * Resolve a service and its dependencies
   */
  async resolve<T>(name: string, scope?: Map<string, any>): Promise<T> {
    if (this.resolving.has(name)) {
      throw new Error(`Circular dependency detected: ${name}`)
    }

    const registration = this.services.get(name)
    if (!registration) {
      throw new Error(`Service not found: ${name}`)
    }

    // Check scoped instances first
    if (scope?.has(name)) {
      return scope.get(name)
    }

    // Return existing singleton instance
    if (registration.lifecycle === 'singleton' && registration.instance) {
      return registration.instance as T
    }

    this.resolving.add(name)

    try {
      // Resolve dependencies
      const dependencies = await Promise.all(
        registration.dependencies.map(dep => this.resolve(dep, scope))
      )

      // Create instance
      const instance = await registration.factory(...dependencies)

      // Cache singleton instances
      if (registration.lifecycle === 'singleton') {
        registration.instance = instance
      }

      // Cache scoped instances
      if (registration.lifecycle === 'scoped' && scope) {
        scope.set(name, instance)
      }

      return instance as T
    } finally {
      this.resolving.delete(name)
    }
  }

  /**
   * Create a new resolution scope
   * Useful for request-scoped services
   */
  createScope(): Map<string, any> {
    return new Map()
  }

  /**
   * Check if a service is registered
   */
  has(name: string): boolean {
    return this.services.has(name)
  }

  /**
   * Get all registered service names
   */
  getServiceNames(): string[] {
    return Array.from(this.services.keys())
  }

  /**
   * Clear all services (useful for testing)
   */
  clear(): void {
    this.services.clear()
    this.resolving.clear()
  }
}

// Global container instance
export const container = new Container()

// Service registration decorators (optional, for class-based services)
export function Injectable(name: string, dependencies: string[] = []) {
  return function <T extends new (...args: any[]) => any>(constructor: T) {
    container.singleton(name, (...deps) => new constructor(...deps), dependencies)
    return constructor
  }
}

export function Transient(name: string, dependencies: string[] = []) {
  return function <T extends new (...args: any[]) => any>(constructor: T) {
    container.transient(name, (...deps) => new constructor(...deps), dependencies)
    return constructor
  }
}

// Utility function for type-safe service resolution
export async function inject<T>(name: string, scope?: Map<string, any>): Promise<T> {
  return container.resolve<T>(name, scope)
}
