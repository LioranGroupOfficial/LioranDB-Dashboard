export class Collection {
  public name: string;
  constructor(name: string) {
    this.name = name;
  }
  async findOne(_filter?: any, _options?: any): Promise<any> { return null; }
  find(_filter?: any, _options?: any): any {
    return {
      toArray: async () => [],
      sort: function() { return this; },
      skip: function() { return this; },
      limit: function() { return this; },
      project: function() { return this; },
    };
  }
  async insertOne(doc: any): Promise<any> { return { insertedId: doc._id || 'mock_id', acknowledged: true }; }
  async insertMany(docs: any[]): Promise<any> { return { insertedIds: docs.map((_, i) => `mock_id_${i}`), insertedCount: docs.length, acknowledged: true }; }
  async updateOne(_filter: any, _update: any, _options?: any): Promise<any> { return { matchedCount: 1, modifiedCount: 1, upsertedId: null, acknowledged: true }; }
  async updateMany(_filter: any, _update: any, _options?: any): Promise<any> { return { matchedCount: 1, modifiedCount: 1, upsertedId: null, acknowledged: true }; }
  async deleteOne(_filter: any): Promise<any> { return { deletedCount: 1, acknowledged: true }; }
  async deleteMany(_filter: any): Promise<any> { return { deletedCount: 1, acknowledged: true }; }
  async countDocuments(_filter?: any): Promise<number> { return 0; }
  async createIndex(_definition: any, _options?: any): Promise<any> { return { name: 'mock_idx', fields: [], unique: false }; }
  async listIndexes(): Promise<any[]> { return []; }
  async dropIndex(_name: string): Promise<any> { return { name: _name }; }
  aggregate(_pipeline: any[]): any {
    return {
      toArray: async () => [],
    };
  }
}

export class Db {
  public databaseName: string;
  constructor(name = 'lcs') {
    this.databaseName = name;
  }
  collection(name: string): Collection {
    return new Collection(name);
  }
  async createCollection(name: string): Promise<any> {
    return { collection: name };
  }
  async listCollections(): Promise<string[]> {
    return [];
  }
  async dropCollection(name: string): Promise<any> {
    return { collection: name };
  }
}

export class LioranDBClient {
  public uri: string;
  private _connected = true;

  static async connect(uri: string, _options?: any): Promise<LioranDBClient> {
    return new LioranDBClient(uri, _options);
  }

  constructor(uri: string, _options?: any) {
    this.uri = uri;
  }
  async connect(): Promise<this> {
    this._connected = true;
    return this;
  }
  async close(): Promise<void> {
    this._connected = false;
  }
  isConnected(): boolean {
    return this._connected;
  }
  async createDatabase(name: string): Promise<any> {
    return { database: name };
  }
  db(name?: string): Db {
    return new Db(name || 'lcs');
  }
}

export const DRIVER_ERROR_CODES = {
  CONFIG_INVALID_URI: 'LDB_CONFIG_INVALID_URI',
  CONFIG_INVALID_TLS: 'LDB_CONFIG_INVALID_TLS',
  CONFIG_INVALID_OPTION: 'LDB_CONFIG_INVALID_OPTION',
  CONNECTION_REFUSED: 'LDB_CONNECTION_REFUSED',
  CONNECTION_RESET: 'LDB_CONNECTION_RESET',
  REQUEST_TIMEOUT: 'LDB_REQUEST_TIMEOUT',
  SERVER_UNAVAILABLE: 'LDB_SERVER_UNAVAILABLE',
  AUTH_INVALID_CREDENTIALS: 'LDB_AUTH_INVALID_CREDENTIALS',
  AUTH_REQUIRED: 'LDB_AUTH_REQUIRED',
  PERMISSION_DENIED: 'LDB_PERMISSION_DENIED',
  DUPLICATE_KEY: 'LDB_DUPLICATE_KEY',
  CONFLICT: 'LDB_CONFLICT',
  COLLECTION_NOT_FOUND: 'LDB_COLLECTION_NOT_FOUND',
  RATE_LIMITED: 'LDB_RATE_LIMITED',
  VALIDATION_FAILED: 'LDB_VALIDATION_FAILED',
  CLIENT_CLOSED: 'LDB_CLIENT_CLOSED',
} as const;

export class LioranDriverError extends Error {
  public code: string;
  public category: string;
  public retryable?: boolean;
  constructor(message: string, options: any = {}) {
    super(message);
    this.name = 'LioranDriverError';
    this.code = options.code || 'LDB_UNKNOWN';
    this.category = options.category || 'unknown';
    this.retryable = options.retryable;
  }
  toDiagnosticString(): string {
    return `${this.name}: ${this.message} (code: ${this.code})`;
  }
}

export class NotFoundError extends LioranDriverError {
  constructor(message = 'Resource not found', options: any = {}) {
    super(message, { code: DRIVER_ERROR_CODES.COLLECTION_NOT_FOUND, category: 'not-found', ...options });
    this.name = 'NotFoundError';
  }
}

export class ServerOverloadedError extends LioranDriverError {
  constructor(message = 'Server overloaded', options: any = {}) {
    super(message, { code: DRIVER_ERROR_CODES.RATE_LIMITED, category: 'server-overloaded', retryable: true, ...options });
    this.name = 'ServerOverloadedError';
  }
}

export class DuplicateKeyError extends LioranDriverError {
  constructor(message = 'Duplicate key violation', options: any = {}) {
    super(message, { code: DRIVER_ERROR_CODES.DUPLICATE_KEY, category: 'conflict', ...options });
    this.name = 'DuplicateKeyError';
  }
}

export class ConflictError extends LioranDriverError {
  constructor(message = 'Conflict', options: any = {}) {
    super(message, { code: DRIVER_ERROR_CODES.CONFLICT, category: 'conflict', ...options });
    this.name = 'ConflictError';
  }
}

export class ConnectionError extends LioranDriverError {
  constructor(message = 'Connection failed', options: any = {}) {
    super(message, { code: DRIVER_ERROR_CODES.CONNECTION_REFUSED, category: 'network', ...options });
    this.name = 'ConnectionError';
  }
}

export class ConfigurationError extends LioranDriverError {
  constructor(message = 'Configuration error', options: any = {}) {
    super(message, { code: DRIVER_ERROR_CODES.CONFIG_INVALID_OPTION, category: 'configuration', ...options });
    this.name = 'ConfigurationError';
  }
}

export function parseConnectionString(uri: string): any {
  try {
    const parsed = new URL(uri.replace(/^liorandb(\+https)?:\/\//, 'http://'));
    return {
      protocol: 'liorandb',
      scheme: 'liorandb',
      hosts: [parsed.hostname || '127.0.0.1'],
      host: parsed.hostname || '127.0.0.1',
      ports: [parsed.port ? parseInt(parsed.port, 10) : 443],
      port: parsed.port ? parseInt(parsed.port, 10) : 443,
      database: (parsed.pathname || '').replace(/^\//, '') || 'lcs',
      username: parsed.username ? decodeURIComponent(parsed.username) : undefined,
      password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
      isLoopbackHost: parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost',
    };
  } catch {
    return {
      protocol: 'liorandb',
      scheme: 'liorandb',
      hosts: ['127.0.0.1'],
      host: '127.0.0.1',
      ports: [443],
      port: 443,
      database: 'lcs',
      isLoopbackHost: true,
    };
  }
}

export type Filter<T = any> = any;
export type Sort = any;
export type Document = Record<string, any>;
export type CollectionIndexDefinition = any;
