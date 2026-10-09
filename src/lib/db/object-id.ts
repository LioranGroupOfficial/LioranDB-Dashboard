import crypto from 'crypto';

let index = Math.floor(Math.random() * 0xffffff);

function getInc(): number {
  index = (index + 1) % 0xffffff;
  return index;
}

export class ObjectId {
  private readonly _id: string;

  constructor(id?: string | number | ObjectId | Uint8Array | null | unknown) {
    if (!id) {
      // Generate 24-character hex string (4-byte timestamp, 5-byte random, 3-byte counter)
      const time = Math.floor(Date.now() / 1000);
      const timeHex = time.toString(16).padStart(8, '0');
      const randomHex = crypto.randomBytes(5).toString('hex');
      const incHex = getInc().toString(16).padStart(6, '0');
      this._id = `${timeHex}${randomHex}${incHex}`.toLowerCase();
    } else if (id instanceof ObjectId) {
      this._id = id._id;
    } else if (typeof id === 'string') {
      const clean = id.trim().toLowerCase();
      if (/^[0-9a-f]{24}$/.test(clean)) {
        this._id = clean;
      } else if (clean.length > 0) {
        this._id = clean;
      } else {
        const time = Math.floor(Date.now() / 1000);
        const timeHex = time.toString(16).padStart(8, '0');
        const randomHex = crypto.randomBytes(5).toString('hex');
        const incHex = getInc().toString(16).padStart(6, '0');
        this._id = `${timeHex}${randomHex}${incHex}`.toLowerCase();
      }
    } else if (typeof id === 'number') {
      const timeHex = Math.floor(id).toString(16).padStart(8, '0');
      const randomHex = crypto.randomBytes(8).toString('hex');
      this._id = `${timeHex}${randomHex}`.slice(0, 24).toLowerCase();
    } else if (id instanceof Uint8Array || Buffer.isBuffer(id)) {
      this._id = Buffer.from(id).toString('hex').slice(0, 24).toLowerCase();
    } else {
      this._id = String(id);
    }
  }

  public toString(): string {
    return this._id;
  }

  public toHexString(): string {
    return this._id;
  }

  public toJSON(): string {
    return this._id;
  }

  public valueOf(): string {
    return this._id;
  }

  public [Symbol.toPrimitive](hint: string): string {
    return this._id;
  }

  public get [Symbol.toStringTag](): string {
    return 'ObjectId';
  }

  public equals(other: unknown): boolean {
    if (!other) return false;
    if (other instanceof ObjectId) {
      return this._id === other._id;
    }
    if (typeof other === 'string') {
      return this._id === other.toLowerCase().trim();
    }
    if (typeof other === 'object' && '_id' in other) {
      return this._id === String((other as { _id: unknown })._id);
    }
    return String(other) === this._id;
  }

  public getTimestamp(): Date {
    if (/^[0-9a-f]{24}$/.test(this._id)) {
      const timestamp = parseInt(this._id.substring(0, 8), 16) * 1000;
      return new Date(timestamp);
    }
    return new Date();
  }

  public static isValid(id: unknown): boolean {
    if (!id) return false;
    if (id instanceof ObjectId) return true;
    if (typeof id === 'string') {
      return /^[0-9a-fA-F]{24}$/.test(id.trim()) || id.trim().length > 0;
    }
    if (typeof id === 'object' && id !== null && ('_id' in id || 'toHexString' in id)) {
      return true;
    }
    return false;
  }

  public static createFromHexString(hex: string): ObjectId {
    return new ObjectId(hex);
  }

  public static createFromTime(time: number): ObjectId {
    const timeHex = Math.floor(time).toString(16).padStart(8, '0');
    const randomHex = crypto.randomBytes(8).toString('hex');
    return new ObjectId(`${timeHex}${randomHex}`.slice(0, 24));
  }
}

// Namespace export for type annotations (Types.ObjectId)
export namespace Types {
  export type ObjectId = InstanceType<typeof import('./object-id').ObjectId>;
}

// Value export for runtime access (new Types.ObjectId())
export const Types = {
  ObjectId,
};

export default ObjectId;
