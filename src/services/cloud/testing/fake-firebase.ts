// In-memory stand-in for ./firebase, used by the cloud unit tests through
// `vi.mock("./firebase", () => import("./testing/fake-firebase"))`. It keeps documents keyed by their
// full path and logs every write with its raw data (sentinels included), so tests can assert the
// exact paths, fields and query shapes the repositories use. Never import it from app code.
import { vi } from "vitest";

type Data = Record<string, unknown>;
type Sentinel =
  | { __fake: "serverTimestamp" }
  | { __fake: "deleteField" }
  | { __fake: "arrayUnion"; values: unknown[] }
  | { __fake: "arrayRemove"; values: unknown[] };

export const SERVER_TIMESTAMP = "<serverTimestamp>";

export class FakeDocRef {
  readonly type = "document";
  constructor(readonly path: string) {}
  get id() {
    return this.path.split("/").pop() as string;
  }
}
export class FakeCollectionRef {
  readonly type = "collection";
  constructor(readonly path: string) {}
}
type Constraint =
  | { kind: "where"; field: string; op: string; value: unknown }
  | { kind: "orderBy"; field: string; dir: "asc" | "desc" }
  | { kind: "limit"; n: number };
export class FakeQuery {
  readonly type = "query";
  constructor(
    readonly collection: FakeCollectionRef,
    readonly constraints: Constraint[],
  ) {}
}

export interface WriteRecord {
  op: "set" | "update" | "delete";
  path: string;
  data?: Data;
  options?: { merge?: boolean };
}

export interface FakeUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  isAnonymous: boolean;
  providerData: Array<{ providerId: string }>;
}

const store = new Map<string, Data>();
const writes: WriteRecord[] = [];
const authListeners: Array<(user: FakeUser | null) => void> = [];
let autoId = 0;
let snapshotError: Error | null = null;

const isSentinel = (v: unknown): v is Sentinel => !!v && typeof v === "object" && "__fake" in v;
const isPlainObject = (v: unknown): v is Data =>
  !!v && typeof v === "object" && !Array.isArray(v) && !isSentinel(v);
const clone = <T>(v: T): T => structuredClone(v);

function applyValue(current: unknown, value: unknown): unknown {
  if (!isSentinel(value)) return isPlainObject(value) ? resolveObject(value) : clone(value);
  switch (value.__fake) {
    case "serverTimestamp":
      return SERVER_TIMESTAMP;
    case "arrayUnion": {
      const arr = Array.isArray(current) ? [...current] : [];
      for (const v of value.values)
        if (!arr.some((a) => JSON.stringify(a) === JSON.stringify(v))) arr.push(clone(v));
      return arr;
    }
    case "arrayRemove": {
      const arr = Array.isArray(current) ? current : [];
      return arr.filter((a) => !value.values.some((v) => JSON.stringify(a) === JSON.stringify(v)));
    }
    default:
      return undefined;
  }
}

function resolveObject(data: Data): Data {
  const out: Data = {};
  for (const [k, v] of Object.entries(data)) {
    if (isSentinel(v) && v.__fake === "deleteField") continue;
    out[k] = applyValue(undefined, v);
  }
  return out;
}

function mergeInto(target: Data, data: Data): void {
  for (const [k, v] of Object.entries(data)) {
    if (isSentinel(v) && v.__fake === "deleteField") delete target[k];
    else if (isPlainObject(v)) {
      const child = isPlainObject(target[k]) ? (target[k] as Data) : {};
      mergeInto(child, v);
      target[k] = child;
    } else target[k] = applyValue(target[k], v);
  }
}

function setPath(target: Data, path: string, value: unknown): void {
  const parts = path.split(".");
  let node = target;
  for (const part of parts.slice(0, -1)) {
    if (!isPlainObject(node[part])) node[part] = {};
    node = node[part] as Data;
  }
  const last = parts[parts.length - 1];
  if (isSentinel(value) && value.__fake === "deleteField") delete node[last];
  else node[last] = applyValue(node[last], value);
}

function snapshotOf(ref: FakeDocRef) {
  const data = store.get(ref.path);
  return {
    id: ref.id,
    ref,
    metadata: { hasPendingWrites: false, fromCache: false },
    exists: () => data !== undefined,
    data: () => (data === undefined ? undefined : clone(data)),
  };
}

function runQuery(target: FakeCollectionRef | FakeQuery) {
  const col = target instanceof FakeQuery ? target.collection : target;
  const constraints = target instanceof FakeQuery ? target.constraints : [];
  const depth = col.path.split("/").length + 1;
  let refs = [...store.keys()]
    .filter((p) => p.startsWith(col.path + "/") && p.split("/").length === depth)
    .map((p) => new FakeDocRef(p));
  for (const c of constraints) {
    if (c.kind === "where") {
      refs = refs.filter((r) => {
        const v = (store.get(r.path) as Data)[c.field];
        if (c.op === "==") return v === c.value;
        if (c.op === "in") return (c.value as unknown[]).includes(v);
        if (c.op === "array-contains") return Array.isArray(v) && v.includes(c.value);
        throw new Error(`fake-firebase: unsupported operator ${c.op}`);
      });
    } else if (c.kind === "orderBy") {
      const sign = c.dir === "desc" ? -1 : 1;
      refs.sort((a, b) => {
        const va = (store.get(a.path) as Data)[c.field] as number;
        const vb = (store.get(b.path) as Data)[c.field] as number;
        return va < vb ? -sign : va > vb ? sign : 0;
      });
    } else refs = refs.slice(0, c.n);
  }
  const docs = refs.map(snapshotOf);
  return {
    docs,
    size: docs.length,
    empty: docs.length === 0,
    forEach: (cb: (d: (typeof docs)[number]) => void) => docs.forEach(cb),
  };
}

// ---- Test controls ----
export const fake = {
  store,
  writes,
  reset() {
    store.clear();
    writes.length = 0;
    autoId = 0;
    snapshotError = null;
  },
  // Makes every later onSnapshot call fail with this error instead of delivering data.
  failSnapshots(err: Error | null) {
    snapshotError = err;
  },
  seed(path: string, data: Data) {
    store.set(path, clone(data));
  },
  get(path: string): Data | undefined {
    return store.get(path);
  },
  signIn(user: Partial<FakeUser> & { uid: string }) {
    const full: FakeUser = {
      email: null,
      displayName: null,
      isAnonymous: false,
      providerData: [{ providerId: "password" }],
      ...user,
    };
    auth.currentUser = full;
    authListeners.forEach((cb) => cb(full));
    return full;
  },
  signOut() {
    auth.currentUser = null;
    authListeners.forEach((cb) => cb(null));
  },
};

// ---- Same exports as ./firebase ----
export const firebaseConfig = { projectId: "fake" };
export const auth: { currentUser: FakeUser | null } = { currentUser: null };
export const db = { type: "firestore" };
export const googleProvider = { providerId: "google.com" };
export const yahooProvider = { providerId: "yahoo.com" };

export function onAuthStateChanged(_auth: unknown, cb: (user: FakeUser | null) => void) {
  authListeners.push(cb);
  return () => authListeners.splice(authListeners.indexOf(cb), 1);
}
export const createUserWithEmailAndPassword = vi.fn();
export const signInWithEmailAndPassword = vi.fn();
export const signInWithPopup = vi.fn();
export const sendPasswordResetEmail = vi.fn();
export const signOut = vi.fn(async () => fake.signOut());
export const updateProfile = vi.fn(async (user: FakeUser, profile: { displayName?: string }) => {
  if (profile.displayName !== undefined) user.displayName = profile.displayName;
});

export function collection(_parent: unknown, ...segments: string[]) {
  return new FakeCollectionRef(segments.join("/"));
}
export function doc(parent: unknown, ...segments: string[]) {
  if (parent instanceof FakeCollectionRef)
    return new FakeDocRef(
      `${parent.path}/${segments.length ? segments.join("/") : `auto-${++autoId}`}`,
    );
  return new FakeDocRef(segments.join("/"));
}
export const where = (field: string, op: string, value: unknown): Constraint => ({
  kind: "where",
  field,
  op,
  value,
});
export const orderBy = (field: string, dir: "asc" | "desc" = "asc"): Constraint => ({
  kind: "orderBy",
  field,
  dir,
});
export const limit = (n: number): Constraint => ({ kind: "limit", n });
export const query = (col: FakeCollectionRef, ...constraints: Constraint[]) =>
  new FakeQuery(col, constraints);

export const serverTimestamp = (): Sentinel => ({ __fake: "serverTimestamp" });
export const deleteField = (): Sentinel => ({ __fake: "deleteField" });
export const arrayUnion = (...values: unknown[]): Sentinel => ({ __fake: "arrayUnion", values });
export const arrayRemove = (...values: unknown[]): Sentinel => ({ __fake: "arrayRemove", values });

export async function getDoc(ref: FakeDocRef) {
  return snapshotOf(ref);
}
export async function getDocs(target: FakeCollectionRef | FakeQuery) {
  return runQuery(target);
}
export async function getCountFromServer(target: FakeCollectionRef | FakeQuery) {
  const count = runQuery(target).size;
  return { data: () => ({ count }) };
}
export async function setDoc(ref: FakeDocRef, data: Data, options?: { merge?: boolean }) {
  writes.push({ op: "set", path: ref.path, data, ...(options ? { options } : {}) });
  if (options?.merge) {
    const current = store.get(ref.path) || {};
    mergeInto(current, data);
    store.set(ref.path, current);
  } else store.set(ref.path, resolveObject(data));
}
export async function updateDoc(ref: FakeDocRef, data: Data) {
  writes.push({ op: "update", path: ref.path, data });
  const current = store.get(ref.path);
  if (!current)
    throw Object.assign(new Error(`No document to update: ${ref.path}`), { code: "not-found" });
  for (const [field, value] of Object.entries(data)) setPath(current, field, value);
}
export async function deleteDoc(ref: FakeDocRef) {
  writes.push({ op: "delete", path: ref.path });
  store.delete(ref.path);
}
// Delivers the current state (or the injected failure) once, synchronously.
export function onSnapshot(
  target: FakeDocRef | FakeCollectionRef | FakeQuery,
  next: (snap: unknown) => void,
  error?: (err: Error) => void,
) {
  if (snapshotError) error?.(snapshotError);
  else next(target instanceof FakeDocRef ? snapshotOf(target) : runQuery(target));
  return vi.fn();
}
