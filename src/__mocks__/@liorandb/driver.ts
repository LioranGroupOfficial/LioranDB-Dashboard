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
}

export class LioranDBClient {
  public uri: string;
  constructor(uri: string, _options?: any) {
    this.uri = uri;
  }
  async connect(): Promise<this> {
    return this;
  }
  async close(): Promise<void> {}
  db(name?: string): Db {
    return new Db(name || 'lcs');
  }
}

export function parseConnectionString(uri: string): any {
  try {
    const parsed = new URL(uri.replace(/^liorandb(\+https)?:\/\//, 'http://'));
    return {
      protocol: 'liorandb',
      hosts: [parsed.hostname || '127.0.0.1'],
      ports: [parsed.port ? parseInt(parsed.port, 10) : 443],
      database: (parsed.pathname || '').replace(/^\//, '') || 'lcs',
      username: parsed.username ? decodeURIComponent(parsed.username) : undefined,
      password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
    };
  } catch {
    return {
      protocol: 'liorandb',
      hosts: ['127.0.0.1'],
      ports: [443],
      database: 'lcs',
    };
  }
}

export type Filter<T = any> = any;
export type Sort = any;
export type Document = Record<string, any>;
