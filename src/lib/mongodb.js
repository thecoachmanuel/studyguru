import { MongoClient, ObjectId } from 'mongodb';

const uri = process.env.MONGODB_URI || '';
const options = {
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 2000,
};

// ── In-Memory Resilient Store Fallback ──
class MemoryCursor {
  constructor(items) {
    this._items = [...items];
  }

  sort(sortObj) {
    if (sortObj && typeof sortObj === 'object') {
      const [field, direction] = Object.entries(sortObj)[0] || [];
      if (field) {
        this._items.sort((a, b) => {
          const valA = a[field];
          const valB = b[field];
          if (valA < valB) return direction === -1 ? 1 : -1;
          if (valA > valB) return direction === -1 ? -1 : 1;
          return 0;
        });
      }
    }
    return this;
  }

  limit(n) {
    if (typeof n === 'number') this._items = this._items.slice(0, n);
    return this;
  }

  skip(n) {
    if (typeof n === 'number') this._items = this._items.slice(n);
    return this;
  }

  async toArray() {
    return this._items.map((doc) => ({ ...doc }));
  }
}

export { ObjectId };

export function safeObjectId(id) {
  if (!id) return id;
  if (id instanceof ObjectId) return id;
  if (typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id)) {
    try {
      return new ObjectId(id);
    } catch {
      return id;
    }
  }
  return id;
}

class MemoryCollection {
  constructor(name) {
    this.name = name;
    this.docs = [];
  }

  _matches(doc, query = {}) {
    if (!query || Object.keys(query).length === 0) return true;

    if (query.$or && Array.isArray(query.$or)) {
      const anyMatch = query.$or.some((subQuery) => this._matches(doc, subQuery));
      if (!anyMatch) return false;
      const withoutOr = { ...query };
      delete withoutOr.$or;
      return this._matches(doc, withoutOr);
    }

    for (const [key, val] of Object.entries(query)) {
      if (key === '_id' || key === 'id') {
        const docIds = [
          doc._id?.toString?.() ?? String(doc._id || ''),
          doc.id?.toString?.() ?? String(doc.id || ''),
          doc._id,
          doc.id,
        ].filter(Boolean);

        if (val && typeof val === 'object' && Array.isArray(val.$in)) {
          const inStrings = val.$in.map((v) => v?.toString?.() ?? String(v));
          const matchesIn = docIds.some((did) => inStrings.includes(String(did)));
          if (!matchesIn) return false;
        } else {
          const targetStr = val?.toString?.() ?? String(val ?? '');
          const matchesTarget = docIds.some((did) => String(did) === targetStr || did === val);
          if (!matchesTarget) return false;
        }
      } else if (val && typeof val === 'object' && Array.isArray(val.$in)) {
        if (!val.$in.includes(doc[key])) return false;
      } else if (val && typeof val === 'object' && val.$regex) {
        const regex = new RegExp(val.$regex, val.$options || 'i');
        if (!regex.test(String(doc[key] || ''))) return false;
      } else if (doc[key] !== val) {
        return false;
      }
    }
    return true;
  }

  find(query = {}) {
    const matched = this.docs.filter((doc) => this._matches(doc, query));
    return new MemoryCursor(matched);
  }

  async findOne(query = {}) {
    const doc = this.docs.find((d) => this._matches(d, query));
    return doc ? { ...doc } : null;
  }

  async insertOne(doc) {
    const _id = doc._id || new ObjectId();
    const newDoc = { ...doc, _id };
    this.docs.push(newDoc);
    return { insertedId: _id, acknowledged: true };
  }

  async insertMany(docs) {
    const insertedIds = {};
    docs.forEach((doc, idx) => {
      const _id = doc._id || new ObjectId();
      this.docs.push({ ...doc, _id });
      insertedIds[idx] = _id;
    });
    return { insertedCount: docs.length, insertedIds, acknowledged: true };
  }

  async updateOne(query, update) {
    const doc = this.docs.find((d) => this._matches(d, query));
    if (!doc) return { matchedCount: 0, modifiedCount: 0, acknowledged: true };

    if (update.$set) {
      Object.assign(doc, update.$set);
    }
    if (update.$inc) {
      for (const [k, v] of Object.entries(update.$inc)) {
        doc[k] = (doc[k] || 0) + v;
      }
    }
    if (update.$push) {
      for (const [k, v] of Object.entries(update.$push)) {
        if (!Array.isArray(doc[k])) doc[k] = [];
        doc[k].push(v);
      }
    }
    return { matchedCount: 1, modifiedCount: 1, acknowledged: true };
  }

  async updateMany(query, update) {
    const matched = this.docs.filter((d) => this._matches(d, query));
    matched.forEach((doc) => {
      if (update.$set) Object.assign(doc, update.$set);
    });
    return { matchedCount: matched.length, modifiedCount: matched.length, acknowledged: true };
  }

  async deleteOne(query) {
    const idx = this.docs.findIndex((d) => this._matches(d, query));
    if (idx !== -1) {
      this.docs.splice(idx, 1);
      return { deletedCount: 1, acknowledged: true };
    }
    return { deletedCount: 0, acknowledged: true };
  }

  async deleteMany(query) {
    const initialLen = this.docs.length;
    this.docs = this.docs.filter((d) => !this._matches(d, query));
    return { deletedCount: initialLen - this.docs.length, acknowledged: true };
  }

  async countDocuments(query = {}) {
    return this.docs.filter((d) => this._matches(d, query)).length;
  }
}

class MemoryDatabase {
  constructor(name = 'studycord') {
    this.databaseName = name;
    this.collections = new Map();
    this._seedDefaults();
  }

  collection(name) {
    if (!this.collections.has(name)) {
      this.collections.set(name, new MemoryCollection(name));
    }
    return this.collections.get(name);
  }

  _seedDefaults() {
    const demoUserId = '65f01234567890abcdef1234';
    const server1Id = 'server-demo-1';
    const server2Id = 'server-demo-2';

    // Users collection
    this.collection('users').docs.push({
      _id: new ObjectId(demoUserId),
      id: demoUserId,
      name: 'Demo Student',
      email: 'demo@studyguru.me',
      username: 'Demo Student',
      image: null,
      created_at: new Date(),
    });

    // Servers collection
    this.collection('servers').docs.push(
      {
        _id: server1Id,
        id: server1Id,
        name: 'StudyGuru Hub',
        icon_url: null,
        owner_id: demoUserId,
        invite_code: 'GURU2026',
        role: 'owner',
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        _id: server2Id,
        id: server2Id,
        name: 'Computer Science & AI',
        icon_url: null,
        owner_id: demoUserId,
        invite_code: 'CSAI2026',
        role: 'member',
        created_at: new Date(),
        updated_at: new Date(),
      }
    );

    // Memberships collection
    this.collection('server_members').docs.push(
      {
        _id: new ObjectId(),
        server_id: server1Id,
        user_id: demoUserId,
        role: 'owner',
        joined_at: new Date(),
      },
      {
        _id: new ObjectId(),
        server_id: server2Id,
        user_id: demoUserId,
        role: 'member',
        joined_at: new Date(),
      }
    );

    // Channels collection
    this.collection('channels').docs.push(
      { _id: 'ch-general', id: 'ch-general', server_id: server1Id, name: 'general', type: 'text', position: 0, created_at: new Date() },
      { _id: 'ch-resources', id: 'ch-resources', server_id: server1Id, name: 'study-resources', type: 'text', position: 1, created_at: new Date() },
      { _id: 'ch-voice', id: 'ch-voice', server_id: server1Id, name: 'Study Room', type: 'voice', position: 2, created_at: new Date() },
      { _id: 'ch-algos', id: 'ch-algos', server_id: server2Id, name: 'algorithms', type: 'text', position: 0, created_at: new Date() },
      { _id: 'ch-ai', id: 'ch-ai', server_id: server2Id, name: 'ai-discussions', type: 'text', position: 1, created_at: new Date() },
      { _id: 'ch-peer', id: 'ch-peer', server_id: server2Id, name: 'Study Room', type: 'voice', position: 2, created_at: new Date() }
    );
  }
}

if (!global._memoryDb) {
  global._memoryDb = new MemoryDatabase();
}

const mockClient = {
  db: (name) => global._memoryDb,
  close: async () => {},
};

let clientPromise;

if (!uri) {
  clientPromise = Promise.resolve(mockClient);
} else if (process.env.NODE_ENV === 'development') {
  if (!global._mongoClientPromise) {
    const client = new MongoClient(uri, options);
    global._mongoClientPromise = client.connect().catch((err) => {
      console.warn(`[MongoDB] Local connection to ${uri} was not reachable (${err.message}). Using memory store fallback.`);
      return mockClient;
    });
  }
  clientPromise = global._mongoClientPromise;
} else {
  const client = new MongoClient(uri, options);
  clientPromise = client.connect().catch((err) => {
    console.warn(`[MongoDB] Connection error (${err.message}). Using memory store fallback.`);
    return mockClient;
  });
}

/**
 * Returns the MongoDB database instance, or a resilient in-memory fallback.
 * @param {string} [dbName] Optional database name
 */
export async function getDatabase(dbName) {
  try {
    const client = await clientPromise;
    if (client && client !== mockClient && typeof client.db === 'function') {
      return client.db(dbName || process.env.MONGODB_DB || 'studycord');
    }
  } catch (err) {
    console.warn('[MongoDB] Database connection fallback:', err.message);
  }
  return global._memoryDb;
}

export default clientPromise;
