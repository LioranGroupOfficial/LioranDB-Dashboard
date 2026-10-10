import {
  LioranDBClient,
  Collection as LioranCollection,
  Db as LioranDb,
  CollectionIndexDefinition,
  ConfigurationError,
  ConnectionError,
  NotFoundError,
  DRIVER_ERROR_CODES,
} from '@liorandb/driver';
import { ObjectId, Types } from './object-id';

export { ObjectId, Types };

export interface SchemaOptions {
  timestamps?: boolean | { createdAt?: boolean | string; updatedAt?: boolean | string };
  _id?: boolean;
  collection?: string;
  toJSON?: Record<string, unknown>;
  toObject?: Record<string, unknown>;
  [key: string]: unknown;
}

export type SchemaDefinition = Record<string, any>;

export interface DeclaredIndexField {
  field: string;
  direction: 'Asc' | 'Desc';
}

export interface DeclaredIndex {
  fields: DeclaredIndexField[];
  options: {
    name?: string;
    unique?: boolean;
    sparse?: boolean;
    partialFilter?: Record<string, any>;
    [key: string]: any;
  };
}

export class Schema<T = any> {
  public readonly definition: SchemaDefinition;
  public readonly options: SchemaOptions;
  public readonly declaredIndexes: DeclaredIndex[] = [];

  public static readonly Types = {
    ObjectId,
    String: String,
    Number: Number,
    Boolean: Boolean,
    Date: Date,
    Mixed: Object,
    Buffer: Buffer,
    Array: Array,
  };

  public readonly statics: Record<string, Function> = {};
  public readonly methods: Record<string, Function> = {};
  public readonly virtuals: Record<string, any> = {};

  constructor(definition?: SchemaDefinition, options?: SchemaOptions) {
    this.definition = definition || {};
    this.options = options || {};

    // Automatically inspect field-level index and unique declarations
    this._inspectFieldIndexes();
  }

  private _inspectFieldIndexes(): void {
    for (const [field, fieldDef] of Object.entries(this.definition)) {
      if (!fieldDef || typeof fieldDef !== 'object') continue;

      const isUnique = Boolean(fieldDef.unique);
      const isIndexed = Boolean(fieldDef.index);

      if (isUnique || isIndexed) {
        const indexName = `${field}_1`;
        this.declaredIndexes.push({
          fields: [{ field, direction: 'Asc' }],
          options: {
            name: indexName,
            unique: isUnique,
            sparse: Boolean(fieldDef.sparse),
          },
        });
      }
    }
  }

  public index(fields: Record<string, number | string>, options?: any): this {
    const declaredFields: DeclaredIndexField[] = [];
    const nameParts: string[] = [];

    for (const [field, direction] of Object.entries(fields)) {
      const isDesc = direction === -1 || direction === 'desc' || direction === 'Desc';
      const dir: 'Asc' | 'Desc' = isDesc ? 'Desc' : 'Asc';
      declaredFields.push({ field, direction: dir });
      nameParts.push(`${field}_${direction}`);
    }

    const defaultName = nameParts.join('_');
    const existingIndexIdx = this.declaredIndexes.findIndex((idx) => (idx.options.name || '') === (options?.name || defaultName));
    const priorUnique = existingIndexIdx >= 0 ? Boolean(this.declaredIndexes[existingIndexIdx].options.unique) : false;

    const opts = {
      name: options?.name || defaultName,
      unique: options?.unique !== undefined ? Boolean(options.unique) : priorUnique,
      sparse: Boolean(options?.sparse),
      partialFilter: options?.partialFilter,
      ...options,
    };

    if (existingIndexIdx >= 0) {
      this.declaredIndexes[existingIndexIdx] = { fields: declaredFields, options: opts };
    } else {
      this.declaredIndexes.push({ fields: declaredFields, options: opts });
    }
    return this;
  }

  public get indexes(): Array<{ fields: Record<string, number | string>; options?: any }> {
    return this.declaredIndexes.map((idx) => {
      const fieldsObj: Record<string, number> = {};
      for (const f of idx.fields) {
        fieldsObj[f.field] = f.direction === 'Desc' ? -1 : 1;
      }
      return { fields: fieldsObj, options: idx.options };
    });
  }

  public pre(event: string, fn: Function): this {
    return this;
  }

  public post(event: string, fn: Function): this {
    return this;
  }

  public virtual(name: string): { get(fn: Function): any; set(fn: Function): any } {
    return {
      get: (fn: Function) => {
        this.virtuals[name] = { ...this.virtuals[name], get: fn };
        return this;
      },
      set: (fn: Function) => {
        this.virtuals[name] = { ...this.virtuals[name], set: fn };
        return this;
      },
    };
  }

  public static(name: string, fn: Function): this {
    this.statics[name] = fn;
    return this;
  }

  public method(name: string, fn: Function): this {
    this.methods[name] = fn;
    return this;
  }
}

export interface Document {
  _id: any;
  _isNew?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  [key: string]: any;
  save(options?: any): Promise<this>;
  toObject(options?: any): any;
  toJSON(): any;
}

export interface UpdateResult {
  matchedCount: number;
  modifiedCount: number;
  upsertedId: any;
  acknowledged?: boolean;
}

export interface DeleteResult {
  deletedCount: number;
  acknowledged?: boolean;
}

export interface QueryOptions {
  upsert?: boolean;
  new?: boolean;
  returnDocument?: 'before' | 'after';
  sort?: any;
  session?: any;
  projection?: any;
  lean?: boolean;
  [key: string]: any;
}

/**
 * Isolated in-memory storage for explicit test mode only.
 * Isolated by database and collection: Map<dbName:collectionName, Map<id, doc>>
 */
const memoryStore = new Map<string, Map<string, any>>();

export function isMemoryModeEnabled(): boolean {
  // Strictly disallowed in production
  if (process.env.NODE_ENV === 'production') return false;
  // Opt-in for unit tests
  return (
    process.env.NODE_ENV === 'test' &&
    (process.env.LIORANDB_MEMORY_STORE === 'true' ||
      process.env.LIORANDB_MOCK_DRIVER === 'true' ||
      !process.env.MONGODB_URI)
  );
}

export function getMemoryCollection(dbName: string, name: string): Map<string, any> {
  const key = `${dbName || 'lcs'}:${name}`;
  if (!memoryStore.has(key)) {
    memoryStore.set(key, new Map());
  }
  return memoryStore.get(key)!;
}

export function clearMemoryStore(): void {
  memoryStore.clear();
}

/**
 * Normalizes filter values, converting ObjectId instances to strings for database transmission.
 */
export function normalizeFilter(filter: any): any {
  if (!filter || typeof filter !== 'object') return filter;
  if (filter instanceof ObjectId) return filter.toString();
  if (filter instanceof Date) return filter.toISOString();
  if (filter instanceof RegExp) return { $regex: filter.source, $options: filter.flags };
  if (Array.isArray(filter)) return filter.map(normalizeFilter);

  const out: Record<string, any> = {};
  for (const [key, val] of Object.entries(filter)) {
    if (val === undefined) continue;
    if (key === '_id') {
      if (val instanceof ObjectId) {
        out._id = val.toString();
      } else if (typeof val === 'string') {
        out._id = val;
      } else if (val && typeof val === 'object') {
        out._id = normalizeFilter(val);
      } else {
        out._id = val;
      }
    } else if (val instanceof ObjectId) {
      out[key] = val.toString();
    } else if (val instanceof Date) {
      out[key] = val.toISOString();
    } else if (val && typeof val === 'object') {
      out[key] = normalizeFilter(val);
    } else {
      out[key] = val;
    }
  }
  return out;
}

/**
 * Serializes document or payload into JSON-compatible plain objects for the LioranDB Rust driver.
 * Converts ObjectIds to strings and Dates to ISO-8601 strings.
 */
export function serializeForLioran(value: any): any {
  if (value === null || value === undefined) return value;
  if (typeof value === 'function') return undefined;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (value instanceof ObjectId) {
    return value.toString();
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (value instanceof RegExp) {
    return { $regex: value.source, $options: value.flags };
  }
  if (Array.isArray(value)) {
    return value.map(serializeForLioran).filter((v) => v !== undefined);
  }
  if (typeof value === 'object') {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) {
      if (v === undefined || typeof v === 'function') continue;
      const serialized = serializeForLioran(v);
      if (serialized !== undefined) {
        out[k] = serialized;
      }
    }
    return out;
  }
  return undefined;
}

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

/**
 * Normalizes document fields before storing or returning.
 * Restores ObjectId instances for _id and Date objects for ISO date strings.
 */
export function normalizeDocument(doc: any): any {
  if (!doc || typeof doc !== 'object') return doc;
  if (doc instanceof ObjectId || doc instanceof Date) return doc;
  if (Array.isArray(doc)) return doc.map(normalizeDocument);

  const out: Record<string, any> = {};
  for (const [key, val] of Object.entries(doc)) {
    if (key === '_id') {
      out._id = val instanceof ObjectId ? val : new ObjectId(val as any);
    } else if (typeof val === 'string' && ISO_DATE_REGEX.test(val)) {
      const parsed = new Date(val);
      out[key] = isNaN(parsed.getTime()) ? val : parsed;
    } else if (val && typeof val === 'object' && !(val instanceof ObjectId) && !(val instanceof Date)) {
      out[key] = normalizeDocument(val);
    } else {
      out[key] = val;
    }
  }
  return out;
}

export interface ParsedProjection {
  driverProjection?: string[];
  includedFields?: string[];
  excludedFields?: string[];
}

/**
 * Normalizes projections for LioranDB HTTP compatibility.
 * Since LioranDB HTTP transport only supports inclusion fields, exclusion projections (e.g. -passwordHash)
 * are excluded from the HTTP request and applied post-query by the adapter.
 */
export function parseProjection(projection: any): ParsedProjection {
  if (!projection) return {};

  const inclusions: string[] = [];
  const exclusions: string[] = [];

  if (typeof projection === 'string') {
    const parts = projection.split(/\s+/).filter(Boolean);
    for (const part of parts) {
      if (part.startsWith('-')) {
        exclusions.push(part.slice(1));
      } else if (part.startsWith('+')) {
        inclusions.push(part.slice(1));
      } else {
        inclusions.push(part);
      }
    }
  } else if (Array.isArray(projection)) {
    for (const item of projection) {
      if (typeof item === 'string') {
        if (item.startsWith('-')) {
          exclusions.push(item.slice(1));
        } else if (item.startsWith('+')) {
          inclusions.push(item.slice(1));
        } else {
          inclusions.push(item);
        }
      }
    }
  } else if (typeof projection === 'object') {
    for (const [key, val] of Object.entries(projection)) {
      if (val === 0 || val === false || val === -1) {
        exclusions.push(key);
      } else if (val === 1 || val === true) {
        inclusions.push(key);
      }
    }
  }

  // If there are exclusions, the driver HTTP transport cannot handle them.
  // We omit driverProjection (so driver fetches all fields) and apply exclusions client-side.
  if (exclusions.length > 0) {
    return {
      driverProjection: undefined,
      excludedFields: exclusions,
      includedFields: inclusions.length > 0 ? inclusions : undefined,
    };
  }

  if (inclusions.length > 0) {
    return {
      driverProjection: inclusions,
      includedFields: inclusions,
    };
  }

  return {};
}

export function applyProjectionToDoc(doc: any, parsed: ParsedProjection): any {
  if (!doc || typeof doc !== 'object') return doc;
  if (parsed.excludedFields && parsed.excludedFields.length > 0) {
    for (const field of parsed.excludedFields) {
      delete doc[field];
    }
  }
  if (parsed.includedFields && parsed.includedFields.length > 0) {
    for (const key of Object.keys(doc)) {
      if (key !== '_id' && !parsed.includedFields.includes(key)) {
        delete doc[key];
      }
    }
  }
  return doc;
}

/**
 * In-memory document matching engine supporting MongoDB operators (used for tests only).
 */
export function matchesFilter(doc: any, filter: any): boolean {
  if (!filter || Object.keys(filter).length === 0) return true;

  for (const [key, expected] of Object.entries(filter)) {
    if (key === '$or' && Array.isArray(expected)) {
      const matchAny = expected.some((subFilter) => matchesFilter(doc, subFilter));
      if (!matchAny) return false;
      continue;
    }
    if (key === '$and' && Array.isArray(expected)) {
      const matchAll = expected.every((subFilter) => matchesFilter(doc, subFilter));
      if (!matchAll) return false;
      continue;
    }

    const actual = getNestedValue(doc, key);

    if (
      expected &&
      typeof expected === 'object' &&
      !(expected instanceof Date) &&
      !(expected instanceof ObjectId) &&
      !(expected instanceof RegExp)
    ) {
      for (const [op, opVal] of Object.entries(expected)) {
        if (op === '$eq') {
          if (!areValuesEqual(actual, opVal)) return false;
        } else if (op === '$ne') {
          if (areValuesEqual(actual, opVal)) return false;
        } else if (op === '$in' && Array.isArray(opVal)) {
          const matchIn = opVal.some((item) => areValuesEqual(actual, item));
          if (!matchIn) return false;
        } else if (op === '$nin' && Array.isArray(opVal)) {
          const matchNin = opVal.some((item) => areValuesEqual(actual, item));
          if (matchNin) return false;
        } else if (op === '$gt') {
          if (compareValues(actual, opVal) <= 0) return false;
        } else if (op === '$gte') {
          if (compareValues(actual, opVal) < 0) return false;
        } else if (op === '$lt') {
          if (compareValues(actual, opVal) >= 0) return false;
        } else if (op === '$lte') {
          if (compareValues(actual, opVal) > 0) return false;
        } else if (op === '$exists') {
          const exists = actual !== undefined;
          if (exists !== Boolean(opVal)) return false;
        } else if (op === '$regex') {
          const flags = (expected as any).$options || '';
          const regex = new RegExp(String(opVal), flags);
          if (!regex.test(String(actual ?? ''))) return false;
        }
      }
    } else if (expected instanceof RegExp) {
      if (!expected.test(String(actual ?? ''))) return false;
    } else {
      if (!areValuesEqual(actual, expected)) return false;
    }
  }

  return true;
}

function getNestedValue(obj: any, path: string): any {
  if (!obj) return undefined;
  if (!path.includes('.')) return obj[path];
  const parts = path.split('.');
  let current = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    current = current[part];
  }
  return current;
}

function setNestedValue(obj: any, path: string, value: any): void {
  if (!obj) return;
  if (!path.includes('.')) {
    obj[path] = value;
    return;
  }
  const parts = path.split('.');
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!current[part] || typeof current[part] !== 'object') {
      current[part] = {};
    }
    current = current[part];
  }
  current[parts[parts.length - 1]] = value;
}

function deleteNestedValue(obj: any, path: string): void {
  if (!obj) return;
  if (!path.includes('.')) {
    delete obj[path];
    return;
  }
  const parts = path.split('.');
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!current[part] || typeof current[part] !== 'object') return;
    current = current[part];
  }
  delete current[parts[parts.length - 1]];
}

function areValuesEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (a instanceof ObjectId || b instanceof ObjectId) {
    return String(a) === String(b);
  }
  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime();
  }
  if (typeof a === 'string' && b instanceof Date) {
    return new Date(a).getTime() === b.getTime();
  }
  if (a instanceof Date && typeof b === 'string') {
    return a.getTime() === new Date(b).getTime();
  }
  return false;
}

function compareValues(a: any, b: any): number {
  if (a instanceof Date || b instanceof Date) {
    const timeA = a instanceof Date ? a.getTime() : new Date(a).getTime();
    const timeB = b instanceof Date ? b.getTime() : new Date(b).getTime();
    return timeA - timeB;
  }
  if (typeof a === 'number' && typeof b === 'number') {
    return a - b;
  }
  if (typeof a === 'string' && typeof b === 'string') {
    return a.localeCompare(b);
  }
  return 0;
}

/**
 * Applies MongoDB update operators to a document in-place.
 */
export function applyUpdate(doc: any, update: any): void {
  if (!update || typeof update !== 'object') return;

  let hasOperators = false;
  for (const key of Object.keys(update)) {
    if (key.startsWith('$')) {
      hasOperators = true;
      break;
    }
  }

  if (!hasOperators) {
    for (const [key, val] of Object.entries(update)) {
      if (key !== '_id') {
        setNestedValue(doc, key, val);
      }
    }
    return;
  }

  if (update.$set) {
    for (const [key, val] of Object.entries(update.$set)) {
      if (key !== '_id') {
        setNestedValue(doc, key, val);
      }
    }
  }

  if (update.$inc) {
    for (const [key, val] of Object.entries(update.$inc)) {
      const current = Number(getNestedValue(doc, key) || 0);
      setNestedValue(doc, key, current + Number(val));
    }
  }

  if (update.$push) {
    for (const [key, val] of Object.entries(update.$push)) {
      const current = getNestedValue(doc, key);
      const arr = Array.isArray(current) ? current : [];
      if (val && typeof val === 'object' && '$each' in val && Array.isArray((val as any).$each)) {
        arr.push(...(val as any).$each);
      } else {
        arr.push(val);
      }
      setNestedValue(doc, key, arr);
    }
  }

  if (update.$pull) {
    for (const [key, val] of Object.entries(update.$pull)) {
      const current = getNestedValue(doc, key);
      if (Array.isArray(current)) {
        const filtered = current.filter((item) => {
          if (val && typeof val === 'object') {
            return !matchesFilter(item, val);
          }
          return !areValuesEqual(item, val);
        });
        setNestedValue(doc, key, filtered);
      }
    }
  }

  if (update.$unset) {
    for (const key of Object.keys(update.$unset)) {
      if (key !== '_id') {
        deleteNestedValue(doc, key);
      }
    }
  }
}

/**
 * Query Builder supporting chaining methods: .sort(), .skip(), .limit(), .select(), .populate(), .lean(), .session(), .exec()
 */
export class Query<T = any, TLean = any> implements PromiseLike<T> {
  private model: Model<any>;
  private filter: any;
  private projection?: any;
  private sortOptions?: any;
  private skipCount?: number;
  private limitCount?: number;
  private populateOptions: Array<{ path: string; select?: string }> = [];
  private isLean = false;
  private single = false;
  private countQuery = false;

  constructor(model: Model<any>, filter: any, projection?: any, single = false, count = false) {
    this.model = model;
    this.filter = filter || {};
    this.projection = projection;
    this.single = single;
    this.countQuery = count;
  }

  public sort(sort: any): this {
    this.sortOptions = sort;
    return this;
  }

  public skip(skip: number): this {
    this.skipCount = skip;
    return this;
  }

  public limit(limit: number): this {
    this.limitCount = limit;
    return this;
  }

  public select<TResult = T>(fields: any): Query<TResult, TLean> {
    this.projection = fields;
    return this as unknown as Query<TResult, TLean>;
  }

  public populate<TResult = T>(path: string, select?: string): Query<TResult, TLean> {
    this.populateOptions.push({ path, select });
    return this as unknown as Query<TResult, TLean>;
  }

  public lean<TResult = TLean>(_lean = true): Query<TResult, TResult> {
    this.isLean = _lean;
    return this as unknown as Query<TResult, TResult>;
  }

  public session(_session: any): this {
    return this;
  }

  public async exec(): Promise<T> {
    const rawResult = await this.model._executeQuery({
      filter: this.filter,
      projection: this.projection,
      sort: this.sortOptions,
      skip: this.skipCount,
      limit: this.limitCount,
      single: this.single,
      count: this.countQuery,
      isLean: this.isLean,
      populate: this.populateOptions,
    });
    return rawResult as T;
  }

  public then<TResult1 = T, TResult2 = never>(
    onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.exec().then(onfulfilled, onrejected);
  }

  public catch<TResult = never>(
    onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | null
  ): Promise<T | TResult> {
    return this.exec().catch(onrejected);
  }

  public finally(onfinally?: (() => void) | null): Promise<T> {
    return this.exec().finally(onfinally);
  }
}

export type HydratedDocument<T> = T & Document;

// Global tracking of initialized collections and indexes: `${dbName}:${collectionName}`
const initializedCollections = new Set<string>();
const initializingPromises = new Map<string, Promise<void>>();

function isAlreadyExistsError(err: any): boolean {
  if (!err) return false;
  const msg = String(err.message || '').toLowerCase();
  return (
    err.code === DRIVER_ERROR_CODES.CONFLICT ||
    err.code === 'LDB_CONFLICT' ||
    err.name === 'ConflictError' ||
    err.status === 409 ||
    msg.includes('already exists') ||
    msg.includes('conflict')
  );
}

export function isCollectionNotFoundError(err: any): boolean {
  if (!err) return false;
  const msg = String(err.message || '').toLowerCase();
  const code = String(err.code || '');
  const serverCode = String(err.serverCode || '');
  const status = Number(err.status || err.httpStatus || 0);

  return (
    code === 'LDB_COLLECTION_NOT_FOUND' ||
    code === (DRIVER_ERROR_CODES as any).COLLECTION_NOT_FOUND ||
    serverCode === 'CollectionNotFound' ||
    err instanceof NotFoundError ||
    err?.name === 'NotFoundError' ||
    (status === 404 && (
      code === 'LDB_COLLECTION_NOT_FOUND' ||
      serverCode === 'CollectionNotFound' ||
      msg.includes('collection') ||
      msg.includes('not found') ||
      msg.includes('could not find the requested liorandb resource')
    )) ||
    msg.includes('collectionnotfound') ||
    msg.includes('collection not found') ||
    msg.includes('could not find the requested liorandb resource')
  );
}

export function isUnsupportedOperatorError(err: any): boolean {
  if (!err) return false;
  const serverCode = String(err.serverCode || '').toLowerCase();
  const code = String(err.code || '');
  const msg = String(err.message || '').toLowerCase();
  return (
    serverCode === 'unsupportedoperator' ||
    serverCode === 'unsupported_operator' ||
    msg.includes('unsupportedoperator') ||
    msg.includes('unsupported operator') ||
    (code === 'LDB_VALIDATION_FAILED' && (msg.includes('operator') || serverCode.includes('operator')))
  );
}

export function isTransientError(err: any): boolean {
  if (!err) return false;
  const status = Number(err.status || err.httpStatus || 0);
  const code = String(err.code || '');
  const serverCode = String(err.serverCode || '');
  const category = String(err.category || '');
  const msg = String(err.message || '').toLowerCase();

  return (
    status === 429 ||
    status === 503 ||
    status === 504 ||
    Boolean(err.retryable) ||
    code === 'LDB_RATE_LIMITED' ||
    code === 'LDB_SERVER_UNAVAILABLE' ||
    code === 'LDB_REQUEST_TIMEOUT' ||
    serverCode === 'RATE_LIMIT_EXCEEDED' ||
    serverCode === 'RESOURCE_EXHAUSTED' ||
    category === 'server-overloaded' ||
    category === 'server-unavailable' ||
    msg.includes('rate limit') ||
    msg.includes('overloaded') ||
    msg.includes('temporarily overloaded') ||
    msg.includes('too many requests')
  );
}

/**
 * Retries an asynchronous database operation when encountering transient
 * server overload or rate limit errors (HTTP 429 / 503) using exponential backoff with jitter.
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  baseDelayMs = 150
): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await operation();
    } catch (err: any) {
      attempt++;
      if (attempt > maxRetries || !isTransientError(err)) {
        throw err;
      }
      const jitter = Math.floor(Math.random() * 100);
      const delayMs = baseDelayMs * Math.pow(2, attempt - 1) + jitter;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

export class Model<T = any> {
  public readonly modelName: string;
  public readonly collectionName: string;
  public readonly databaseName: string;
  public readonly schema: Schema<T>;

  constructor(name: string, schema: Schema<T>, collectionName?: string) {
    this.modelName = name;
    this.schema = schema;
    this.collectionName =
      collectionName || schema.options.collection || `${name.toLowerCase()}s`;
    this.databaseName = 'lcs';

    // Bind custom statics
    for (const [staticName, fn] of Object.entries(schema.statics)) {
      (this as any)[staticName] = fn.bind(this);
    }
  }

  /**
   * Instantiates a new hydrated document.
   */
  public hydrate(data: any, isNew = false): HydratedDocument<T> {
    const docData = normalizeDocument(this._applyDefaults(data));
    const model = this;

    const doc: any = {
      ...docData,
      ...(docData._id ? { _id: docData._id instanceof ObjectId ? docData._id : new ObjectId(docData._id) } : {}),
      _isNew: isNew,
      save: async function (this: any): Promise<any> {
        return model._saveDocument(this);
      },
      toObject: function (this: any): any {
        const clone: Record<string, any> = {};
        for (const [key, val] of Object.entries(this)) {
          if (typeof val === 'function' || key === '_isNew') continue;
          clone[key] = val;
        }
        return clone;
      },
      toJSON: function (this: any): any {
        return this.toObject();
      },
      toString: function (this: any): string {
        return `[Document ${model.modelName} ${this._id}]`;
      },
    };

    // Attach custom methods
    for (const [methodName, fn] of Object.entries(this.schema.methods)) {
      doc[methodName] = fn.bind(doc);
    }

    return doc as HydratedDocument<T>;
  }

  private _applyDefaults(data: any): any {
    const out = { ...data };
    if (!out._id && this.schema.options._id !== false) {
      out._id = new ObjectId();
    }

    // Apply schema defaults
    for (const [field, def] of Object.entries(this.schema.definition)) {
      if (out[field] === undefined) {
        if (def && typeof def === 'object' && 'default' in def) {
          out[field] = typeof def.default === 'function' ? def.default() : def.default;
        }
      }
    }

    if (this.schema.options.timestamps) {
      const now = new Date();
      if (!out.createdAt) out.createdAt = now;
      if (!out.updatedAt) out.updatedAt = now;
    }

    return out;
  }

  /**
   * Idempotently ensures the remote collection exists and synchronizes all declared schema indexes.
   * Only called on write paths or explicit initialization; never on unrelated read-only queries.
   */
  public async ensureCollectionReady(db: LioranDb): Promise<LioranCollection> {
    const cacheKey = `${db.databaseName}:${this.collectionName}`;
    if (initializedCollections.has(cacheKey)) {
      return db.collection(this.collectionName);
    }

    if (initializingPromises.has(cacheKey)) {
      await initializingPromises.get(cacheKey);
      return db.collection(this.collectionName);
    }

    const initPromise = (async () => {
      // 1. Idempotently create collection if it does not already exist
      try {
        const existingCollections = await withRetry(() => db.listCollections());
        if (!existingCollections.includes(this.collectionName)) {
          await withRetry(() => db.createCollection(this.collectionName));
        }
      } catch (err: any) {
        if (!isAlreadyExistsError(err)) {
          console.warn(`[DB] Notice ensuring collection '${this.collectionName}':`, err?.message || err);
        }
      }

      const collection = db.collection(this.collectionName);

      // 2. Synchronize declared schema indexes (including field-level unique and compound indexes)
      await this.syncIndexes(collection);

      initializedCollections.add(cacheKey);
    })();

    initializingPromises.set(cacheKey, initPromise);
    try {
      await initPromise;
    } finally {
      initializingPromises.delete(cacheKey);
    }

    return db.collection(this.collectionName);
  }

  /**
   * Synchronizes declared schema indexes with the server-side indexes on LioranDB.
   * Detects incompatible index definitions and fails explicitly rather than silently replacing them.
   */
  public async syncIndexes(collection: LioranCollection): Promise<void> {
    let existingIndexes: readonly CollectionIndexDefinition[] = [];
    try {
      existingIndexes = await withRetry(() => collection.listIndexes());
    } catch {
      existingIndexes = [];
    }

    for (const declared of this.schema.declaredIndexes) {
      const matching = existingIndexes.find((existing) => {
        if (declared.options.name && existing.name === declared.options.name) return true;
        if (existing.fields.length !== declared.fields.length) return false;
        return existing.fields.every((ef, idx) => {
          const df = declared.fields[idx];
          return ef.field === df.field && ef.direction.toLowerCase() === df.direction.toLowerCase();
        });
      });

      if (matching) {
        // Detect incompatible existing index definitions
        const existingUnique = Boolean(matching.unique);
        const declaredUnique = Boolean(declared.options.unique);
        if (existingUnique !== declaredUnique) {
          throw new ConfigurationError(
            `Index definition conflict on '${this.collectionName}.${matching.name}': server index has unique=${existingUnique}, but schema declares unique=${declaredUnique}. Incompatible index cannot be applied automatically.`
          );
        }
        continue;
      }

      try {
        if (
          declared.fields.length === 1 &&
          declared.fields[0].direction === 'Asc' &&
          !declared.options.sparse &&
          !declared.options.partialFilter
        ) {
          await withRetry(() =>
            collection.createIndex(declared.fields[0].field, {
              name: declared.options.name,
              unique: declared.options.unique,
            })
          );
        } else {
          await withRetry(() =>
            collection.createIndex({
              fields: declared.fields.map((f) => ({
                field: f.field,
                direction: f.direction,
              })),
              name: declared.options.name,
              unique: declared.options.unique,
              sparse: declared.options.sparse,
              partialFilter: declared.options.partialFilter,
            })
          );
        }
      } catch (err: any) {
        if (!isAlreadyExistsError(err)) {
          console.warn(
            `[DB] Warning synchronizing index '${declared.options.name || declared.fields[0]?.field}' on '${this.collectionName}':`,
            err?.message || err
          );
        }
      }
    }
  }

  /**
   * Public helper to trigger index and collection readiness on demand.
   */
  public async initIndexes(): Promise<void> {
    if (isMemoryModeEnabled()) return;
    const { getDb } = await import('./connection');
    const db = await getDb();
    await this.ensureCollectionReady(db);
  }

  public find(filter?: any, projection?: any): Query<Array<HydratedDocument<T>>, Array<T>> {
    return new Query<Array<HydratedDocument<T>>, Array<T>>(this, filter, projection, false, false);
  }

  public findOne(filter?: any, projection?: any): Query<HydratedDocument<T> | null, T | null> {
    return new Query<HydratedDocument<T> | null, T | null>(this, filter, projection, true, false);
  }

  public findById(id: any, projection?: any): Query<HydratedDocument<T> | null, T | null> {
    const normalizedId = id instanceof ObjectId ? id.toString() : String(id);
    return new Query<HydratedDocument<T> | null, T | null>(this, { _id: normalizedId }, projection, true, false);
  }

  public countDocuments(filter?: any): Query<number, number> {
    return new Query<number, number>(this, filter, undefined, false, true);
  }

  public async exists(filter?: any): Promise<{ _id: any } | null> {
    const doc = await this.findOne(filter).select('_id').lean();
    return doc ? { _id: (doc as any)._id } : null;
  }

  public async create(docs: any | any[], _options?: any): Promise<any> {
    if (Array.isArray(docs)) {
      const hydrated = docs.map((d) => this.hydrate(d, true));
      for (const doc of hydrated) {
        await this._saveDocument(doc);
      }
      return hydrated;
    }
    const hydrated = this.hydrate(docs, true);
    await this._saveDocument(hydrated);
    return hydrated;
  }

  public async insertMany(docs: any[]): Promise<Array<HydratedDocument<T>>> {
    const hydrated = docs.map((d) => this.hydrate(d, true));
    for (const doc of hydrated) {
      await this._saveDocument(doc);
    }
    return hydrated;
  }

  public async updateOne(filter: any, update: any, options?: QueryOptions): Promise<UpdateResult> {
    const normFilter = normalizeFilter(filter);

    if (isMemoryModeEnabled()) {
      const store = getMemoryCollection(this.databaseName, this.collectionName);
      let matched = 0;
      let modified = 0;
      let upsertedId: any = null;

      for (const [id, doc] of store.entries()) {
        if (matchesFilter(doc, normFilter)) {
          matched++;
          applyUpdate(doc, update);
          if (this.schema.options.timestamps) doc.updatedAt = new Date();
          store.set(id, doc);
          modified++;
          break;
        }
      }

      if (matched === 0 && options?.upsert) {
        const newDoc = this.hydrate({ ...normFilter }, false);
        applyUpdate(newDoc, update);
        store.set(String(newDoc._id), newDoc);
        upsertedId = newDoc._id;
        modified = 1;
      }

      return { matchedCount: matched, modifiedCount: modified, upsertedId, acknowledged: true };
    }

    // Production LioranDB execution: persist before returning success, propagate errors
    const { getDb } = await import('./connection');
    const db = await getDb();
    const collection = await this.ensureCollectionReady(db);

    const serializedFilter = serializeForLioran(normFilter);
    const serializedUpdate = serializeForLioran(update);

    const res = await withRetry(() =>
      collection.updateOne(serializedFilter, serializedUpdate, { upsert: options?.upsert })
    );
    return {
      matchedCount: res.matchedCount,
      modifiedCount: res.modifiedCount,
      upsertedId: res.upsertedId,
      acknowledged: true,
    };
  }

  public async updateMany(filter: any, update: any, options?: QueryOptions): Promise<UpdateResult> {
    const normFilter = normalizeFilter(filter);

    if (isMemoryModeEnabled()) {
      const store = getMemoryCollection(this.databaseName, this.collectionName);
      let matched = 0;
      let modified = 0;

      for (const [id, doc] of store.entries()) {
        if (matchesFilter(doc, normFilter)) {
          matched++;
          applyUpdate(doc, update);
          if (this.schema.options.timestamps) doc.updatedAt = new Date();
          store.set(id, doc);
          modified++;
        }
      }

      return { matchedCount: matched, modifiedCount: modified, upsertedId: null, acknowledged: true };
    }

    const { getDb } = await import('./connection');
    const db = await getDb();
    const collection = await this.ensureCollectionReady(db);

    const serializedFilter = serializeForLioran(normFilter);
    const serializedUpdate = serializeForLioran(update);

    const res = await withRetry(() =>
      collection.updateMany(serializedFilter, serializedUpdate, { upsert: options?.upsert })
    );
    return {
      matchedCount: res.matchedCount,
      modifiedCount: res.modifiedCount,
      upsertedId: res.upsertedId,
      acknowledged: true,
    };
  }

  public async deleteOne(filter: any): Promise<DeleteResult> {
    const normFilter = normalizeFilter(filter);

    if (isMemoryModeEnabled()) {
      const store = getMemoryCollection(this.databaseName, this.collectionName);
      let deleted = 0;
      for (const [id, doc] of store.entries()) {
        if (matchesFilter(doc, normFilter)) {
          store.delete(id);
          deleted = 1;
          break;
        }
      }
      return { deletedCount: deleted, acknowledged: true };
    }

    const { getDb } = await import('./connection');
    const db = await getDb();
    const collection = db.collection(this.collectionName);
    const serializedFilter = serializeForLioran(normFilter);

    try {
      const res = await withRetry(() => collection.deleteOne(serializedFilter));
      return { deletedCount: res.deletedCount, acknowledged: true };
    } catch (err: any) {
      if (isCollectionNotFoundError(err)) {
        await this.ensureCollectionReady(db).catch(() => {});
        return { deletedCount: 0, acknowledged: true };
      }
      throw err;
    }
  }

  public async deleteMany(filter: any): Promise<DeleteResult> {
    const normFilter = normalizeFilter(filter);

    if (isMemoryModeEnabled()) {
      const store = getMemoryCollection(this.databaseName, this.collectionName);
      let deleted = 0;
      for (const [id, doc] of Array.from(store.entries())) {
        if (matchesFilter(doc, normFilter)) {
          store.delete(id);
          deleted++;
        }
      }
      return { deletedCount: deleted, acknowledged: true };
    }

    const { getDb } = await import('./connection');
    const db = await getDb();
    const collection = db.collection(this.collectionName);
    const serializedFilter = serializeForLioran(normFilter);

    try {
      const res = await withRetry(() => collection.deleteMany(serializedFilter));
      return { deletedCount: res.deletedCount, acknowledged: true };
    } catch (err: any) {
      if (isCollectionNotFoundError(err)) {
        await this.ensureCollectionReady(db).catch(() => {});
        return { deletedCount: 0, acknowledged: true };
      }
      throw err;
    }
  }

  public async findOneAndUpdate(filter: any, update: any, options?: QueryOptions): Promise<HydratedDocument<T> | null> {
    const returnAfter = options?.new || options?.returnDocument === 'after';
    const normFilter = normalizeFilter(filter);

    let doc = await this.findOne(normFilter).exec();
    if (!doc && options?.upsert) {
      const newDoc = this.hydrate({ ...normFilter }, true);
      applyUpdate(newDoc, update);
      await this._saveDocument(newDoc);
      return newDoc;
    }

    if (!doc) return null;

    const beforeState = this.hydrate(JSON.parse(JSON.stringify(doc)), false);
    applyUpdate(doc, update);
    if (this.schema.options.timestamps) {
      doc.updatedAt = new Date();
    }
    await this._saveDocument(doc);

    return returnAfter ? doc : beforeState;
  }

  public async findByIdAndUpdate(id: any, update: any, options?: QueryOptions): Promise<HydratedDocument<T> | null> {
    const normalizedId = id instanceof ObjectId ? id.toString() : String(id);
    return this.findOneAndUpdate({ _id: normalizedId }, update, options);
  }

  public async findOneAndDelete(filter: any): Promise<HydratedDocument<T> | null> {
    const doc = await this.findOne(filter).exec();
    if (doc) {
      await this.deleteOne({ _id: doc._id });
    }
    return doc;
  }

  public async findByIdAndDelete(id: any): Promise<HydratedDocument<T> | null> {
    const normalizedId = id instanceof ObjectId ? id.toString() : String(id);
    return this.findOneAndDelete({ _id: normalizedId });
  }

  public async aggregate<TResult = any>(pipeline: any[]): Promise<TResult[]> {
    if (isMemoryModeEnabled()) {
      let docs = Array.from(getMemoryCollection(this.databaseName, this.collectionName).values()).map(normalizeDocument);

      for (const stage of pipeline) {
        if (stage.$match) {
          docs = docs.filter((d) => matchesFilter(d, stage.$match));
        } else if (stage.$group) {
          const groupSpec = stage.$group;
          const groups = new Map<string, any>();

          for (const doc of docs) {
            let groupId: any;
            if (typeof groupSpec._id === 'string' && groupSpec._id.startsWith('$')) {
              groupId = getNestedValue(doc, groupSpec._id.substring(1));
            } else if (groupSpec._id && typeof groupSpec._id === 'object') {
              const composite: Record<string, any> = {};
              for (const [k, v] of Object.entries(groupSpec._id)) {
                if (typeof v === 'string' && v.startsWith('$')) {
                  composite[k] = getNestedValue(doc, v.substring(1));
                } else {
                  composite[k] = v;
                }
              }
              groupId = composite;
            } else {
              groupId = groupSpec._id;
            }

            const groupKey = JSON.stringify(groupId);
            if (!groups.has(groupKey)) {
              groups.set(groupKey, { _id: groupId, count: 0, items: [] });
            }
            const groupObj = groups.get(groupKey);
            groupObj.count++;
            groupObj.items.push(doc);

            for (const [accField, accExpr] of Object.entries(groupSpec)) {
              if (accField === '_id') continue;
              if (accExpr && typeof accExpr === 'object' && '$sum' in (accExpr as any)) {
                const sumVal = (accExpr as any).$sum;
                const increment =
                  typeof sumVal === 'number'
                    ? sumVal
                    : typeof sumVal === 'string' && sumVal.startsWith('$')
                    ? Number(getNestedValue(doc, sumVal.substring(1)) || 0)
                    : 1;
                groupObj[accField] = (groupObj[accField] || 0) + increment;
              }
            }
          }
          docs = Array.from(groups.values());
        } else if (stage.$sort) {
          docs.sort((a, b) => {
            for (const [sortField, dir] of Object.entries(stage.$sort)) {
              const factor = dir === -1 || dir === 'desc' ? -1 : 1;
              const comp = compareValues(getNestedValue(a, sortField), getNestedValue(b, sortField));
              if (comp !== 0) return comp * factor;
            }
            return 0;
          });
        } else if (stage.$skip) {
          docs = docs.slice(stage.$skip);
        } else if (stage.$limit) {
          docs = docs.slice(0, stage.$limit);
        }
      }

      return docs as TResult[];
    }

    const { getDb } = await import('./connection');
    const db = await getDb();
    const collection = db.collection(this.collectionName);
    const serializedPipeline = serializeForLioran(pipeline);

    try {
      const cursor = collection.aggregate<TResult>(serializedPipeline);
      const results = await withRetry(() => cursor.toArray());
      return Array.from(results);
    } catch (err: any) {
      if (isCollectionNotFoundError(err)) {
        await this.ensureCollectionReady(db).catch(() => {});
        return [];
      }
      throw err;
    }
  }

  /**
   * Persists a document to the remote LioranDB database.
   * Awaits remote persistence, enforces immutable _id semantics, and propagates errors.
   */
  public async _saveDocument(doc: any): Promise<HydratedDocument<T>> {
    const isNew = doc._isNew !== false;
    const raw: Record<string, any> = {};
    const source = typeof doc.toObject === 'function' ? doc.toObject() : doc;
    for (const [key, val] of Object.entries(source)) {
      if (typeof val === 'function' || key === '_isNew') continue;
      raw[key] = val;
    }

    const now = new Date();
    if (this.schema.options.timestamps) {
      if (isNew && !raw.createdAt) raw.createdAt = now;
      raw.updatedAt = now;
      doc.updatedAt = now;
      if (isNew && !doc.createdAt) doc.createdAt = now;
    }

    const idStr = raw._id instanceof ObjectId ? raw._id.toString() : String(raw._id);
    raw._id = idStr;

    if (isMemoryModeEnabled()) {
      const store = getMemoryCollection(this.databaseName, this.collectionName);
      store.set(idStr, JSON.parse(JSON.stringify(raw)));
      doc._isNew = false;
      return this.hydrate(raw, false);
    }

    // Production write: Persist to remote LioranDB before reporting success
    const { getDb } = await import('./connection');
    const db = await getDb();
    const collection = await this.ensureCollectionReady(db);

    const serialized = serializeForLioran(raw);

    if (isNew) {
      // Direct insert for new documents respects uniqueness constraints
      await withRetry(() => collection.insertOne(serialized));
      doc._isNew = false;
    } else {
      // Exclude _id from $set payload to prevent immutable _id modification violations
      const fieldsToUpdate = { ...serialized };
      delete fieldsToUpdate._id;
      const res = await withRetry(() => collection.updateOne({ _id: idStr }, { $set: fieldsToUpdate }));
      if (res.matchedCount === 0) {
        // Document does not exist remotely, insert it
        await withRetry(() => collection.insertOne(serialized));
      }
      doc._isNew = false;
    }

    return this.hydrate(raw, false);
  }

  public async _executeQuery(params: {
    filter: any;
    projection?: any;
    sort?: any;
    skip?: number;
    limit?: number;
    single: boolean;
    count: boolean;
    isLean: boolean;
    populate: Array<{ path: string; select?: string }>;
  }): Promise<any> {
    const normFilter = normalizeFilter(params.filter);
    const parsedProj = parseProjection(params.projection);

    if (isMemoryModeEnabled()) {
      const store = getMemoryCollection(this.databaseName, this.collectionName);
      let docs = Array.from(store.values()).filter((d) => matchesFilter(d, normFilter));

      if (params.sort) {
        docs.sort((a, b) => {
          for (const [sortField, dir] of Object.entries(params.sort)) {
            const factor = dir === -1 || dir === 'desc' ? -1 : 1;
            const comp = compareValues(getNestedValue(a, sortField), getNestedValue(b, sortField));
            if (comp !== 0) return comp * factor;
          }
          return 0;
        });
      }

      if (params.skip) {
        docs = docs.slice(params.skip);
      }

      if (params.limit) {
        docs = docs.slice(0, params.limit);
      }

      if (parsedProj.excludedFields || parsedProj.includedFields) {
        for (const d of docs) {
          applyProjectionToDoc(d, parsedProj);
        }
      }

      if (params.count) {
        return docs.length;
      }

      if (params.single) {
        docs = docs.slice(0, 1);
      }

      if (params.single) {
        if (docs.length === 0) return null;
        const normalized = normalizeDocument(docs[0]);
        return params.isLean ? normalized : this.hydrate(normalized, false);
      }

      const normalizedList = docs.map(normalizeDocument);
      return params.isLean ? normalizedList : normalizedList.map((d) => this.hydrate(d, false));
    }

    // Remote LioranDB query execution
    const { getDb } = await import('./connection');
    const db = await getDb();
    const collection = db.collection(this.collectionName);

    const serializedFilter = serializeForLioran(normFilter);

    if (params.count) {
      try {
        return await withRetry(() => collection.countDocuments(serializedFilter));
      } catch (err: any) {
        if (isCollectionNotFoundError(err)) {
          await this.ensureCollectionReady(db).catch(() => {});
          return 0;
        }
        if (isUnsupportedOperatorError(err)) {
          let allDocs: any[] = [];
          try {
            const cursor = collection.find({});
            allDocs = (await withRetry(() => cursor.toArray())) as any[];
          } catch {
            allDocs = [];
          }
          return allDocs.filter((d) => matchesFilter(d, normFilter)).length;
        }
        throw err;
      }
    }

    let docs: any[] = [];

    try {
      if (params.single) {
        const found = await withRetry(() =>
          collection.findOne(serializedFilter, {
            sort: params.sort,
            projection: parsedProj.driverProjection,
          })
        );
        if (found) {
          docs = [found];
        }
      } else {
        const cursor = collection.find(serializedFilter, {
          sort: params.sort,
          skip: params.skip,
          limit: params.limit,
          projection: parsedProj.driverProjection,
        });
        docs = (await withRetry(() => cursor.toArray())) as any[];
      }
    } catch (err: any) {
      if (isCollectionNotFoundError(err)) {
        await this.ensureCollectionReady(db).catch(() => {});
        docs = [];
      } else if (isUnsupportedOperatorError(err)) {
        let allRemote: any[] = [];
        try {
          const cursor = collection.find({}, { sort: params.sort });
          allRemote = (await withRetry(() => cursor.toArray())) as any[];
        } catch {
          try {
            const cursor = collection.find({});
            allRemote = (await withRetry(() => cursor.toArray())) as any[];
          } catch {
            allRemote = [];
          }
        }
        docs = allRemote.filter((d) => matchesFilter(d, normFilter));
        if (params.skip) {
          docs = docs.slice(params.skip);
        }
        if (params.limit) {
          docs = docs.slice(0, params.limit);
        }
        if (params.single && docs.length > 0) {
          docs = [docs[0]];
        }
      } else {
        throw err;
      }
    }

    if (parsedProj.excludedFields || parsedProj.includedFields) {
      for (const d of docs) {
        applyProjectionToDoc(d, parsedProj);
      }
    }

    // Populate references if requested
    if (params.populate && params.populate.length > 0) {
      for (const pop of params.populate) {
        const refField = pop.path;
        const schemaDef = this.schema.definition[refField];
        const refModelName =
          schemaDef?.ref || (schemaDef && typeof schemaDef === 'object' && schemaDef.type && schemaDef.type.ref);

        if (refModelName && modelsRegistry[refModelName]) {
          const targetModel = modelsRegistry[refModelName];
          for (const doc of docs) {
            const refVal = doc[refField];
            if (refVal) {
              const targetId = refVal instanceof ObjectId ? refVal.toString() : String(refVal);
              const refDoc = await targetModel.findById(targetId).lean().exec();
              if (refDoc) {
                if (pop.select) {
                  const allowedFields = pop.select.split(' ').filter(Boolean);
                  const projected: Record<string, any> = { _id: refDoc._id };
                  for (const f of allowedFields) {
                    projected[f] = refDoc[f];
                  }
                  doc[refField] = projected;
                } else {
                  doc[refField] = refDoc;
                }
              }
            }
          }
        }
      }
    }

    if (params.single) {
      if (docs.length === 0) return null;
      const normalized = normalizeDocument(docs[0]);
      return params.isLean ? normalized : this.hydrate(normalized, false);
    }

    const normalizedList = docs.map(normalizeDocument);
    return params.isLean ? normalizedList : normalizedList.map((d) => this.hydrate(d, false));
  }

  private async _getLioranCollection(): Promise<LioranCollection> {
    const { getDb } = await import('./connection');
    const db = await getDb();
    return db.collection(this.collectionName);
  }
}

// Global registry of models
export const modelsRegistry: Record<string, Model<any>> = {};

export function model<T = any>(name: string, schema?: Schema<T>, collection?: string): Model<T> {
  if (!schema) {
    if (modelsRegistry[name]) {
      return modelsRegistry[name];
    }
    throw new Error(`Model '${name}' has not been registered.`);
  }

  const inst = new Model<T>(name, schema, collection);
  modelsRegistry[name] = inst;
  return inst;
}

export const models = modelsRegistry;

const dbAdapter = {
  Schema,
  model,
  models,
  Types,
  ObjectId,
};

export default dbAdapter;
