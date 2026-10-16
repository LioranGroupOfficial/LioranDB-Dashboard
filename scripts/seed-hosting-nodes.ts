/**
 * Seed/reconcile LioranDB Cloud CX01..CX07 hosting-node inventory.
 * Run from LioranDB-Dashboard repository root using `npx tsx scripts/seed-hosting-nodes.ts`.
 *
 * Preview by default. Apply explicitly with --apply.
 * Optional --recreate-cx01 deletes and recreates ONLY an unreferenced CX01 row.
 * This does not create Docker containers, Rust engine databases, customer accounts,
 * root passwords, or actual server-side users.
 */
import 'dotenv/config';
import path from 'node:path';
import fs from 'node:fs';
import { config as loadEnv } from 'dotenv';

// Load repository conventions; supplied process environment always wins.
for (const file of ['.env.local', '.env.production', '.env']) {
  const full = path.resolve(process.cwd(), file);
  if (fs.existsSync(full)) loadEnv({ path: full, override: false, quiet: true });
}

import { connectToDatabase, disconnectFromDatabase, HostingNode, ManagedDatabase, User } from '../src/lib/db';
import { encrypt } from '../src/lib/crypto';
import { LioranDBAdminClient } from '../src/lib/liorandb-admin/client';

const flags = new Set(process.argv.slice(2));
const apply = flags.has('--apply');
const recreateCX01 = flags.has('--recreate-cx01');
const requireHealthy = flags.has('--require-healthy');
const token = (process.env.LIORANDB_CONTROL_PLANE_TOKEN || '').trim();
const hostToken = (id: string) => (process.env[`LIORANDB_${id.toUpperCase()}_CONTROL_PLANE_TOKEN`] || token).trim();
const now = () => new Date();

function idOf(value: unknown): string {
  if (value == null) return '';
  return String(value);
}
function die(msg: string): never { throw new Error(msg); }

// Never use a test/memory database for this operation.
if (process.env.NODE_ENV === 'test' || process.env.LIORANDB_MEMORY_MODE === 'true') {
  die('Refusing to seed test/memory database');
}
if (!(process.env.LIORANDB_URI || process.env.MONGODB_URI)) {
  die('Set LIORANDB_URI (or MONGODB_URI) to the LCS application database');
}
if (recreateCX01 && !apply) {
  console.log('Preview requested: --recreate-cx01 will take effect only with --apply.');
}

function nodeConfig(index: number) {
  const id = `cx${String(index).padStart(2, '0')}`;
  return {
    id, name: `LioranDB Cloud ${id.toUpperCase()}`,
    slug: `liorandb-cloud-${id}`,
    region: 'Asia (Mumbai)',
    dbUrl: `${id}.db.liorandb.com`, port: 443,
    grpcUrl: `${id}.grpc.liorandb.com`, grpcPort: 443,
    protocol: 'https' as const, httpPort: 443,
    controlPlaneEndpoint: `https://${id}.manage.db.liorandb.com`,
    defaultRootUsername: 'admin',
    allocationMode: 'DEDICATED' as const,
    maxCapacity: 1,
    dockerNodeId: id,
    dockerContainerName: `/liorandb-${id}`,
    dockerVolumeName: `${id}-data`,
  };
}

async function checkServer(endpoint: string, controlPlaneToken: string) {
  try {
    const client = new LioranDBAdminClient({ endpoint, controlPlaneToken: controlPlaneToken || undefined, timeoutMs: 5000 });
    const result = await client.getServerStatus();
    return {
      healthStatus: (result.status === 'HEALTHY' ? 'HEALTHY' : 'DEGRADED') as 'HEALTHY' | 'DEGRADED',
      serverIdentity: result.instanceId || undefined,
      serverVersion: result.version || undefined,
      error: undefined as string | undefined,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const authError = /401|403|unauthorized|forbidden|authentication|invalid control-plane credentials/i.test(message);
    return {
      healthStatus: (authError ? 'AUTHENTICATION_FAILED' : 'UNREACHABLE') as 'AUTHENTICATION_FAILED' | 'UNREACHABLE',
      serverIdentity: undefined,
      serverVersion: undefined,
      error: message,
    };
  }
}

async function run() {
  await connectToDatabase();
  console.log(`${apply ? 'APPLY' : 'PREVIEW'} CX01..CX07 inventory`);
  const configs = Array.from({ length: 7 }, (_, i) => nodeConfig(i + 1));
  const allNodes = await HostingNode.find().lean();
  const allDatabases = await ManagedDatabase.find().lean();
  const allUsers = await User.find().select('_id email').lean();
  const usersById = new Map(allUsers.map((u: any) => [idOf(u._id), u.email]));
  const changes: string[] = [];

  // Detect duplicate node identities before any mutation.
  for (const cfg of configs) {
    const matching = allNodes.filter((n: any) => n.slug === cfg.slug || n.dbUrl === cfg.dbUrl || n.controlPlaneEndpoint === cfg.controlPlaneEndpoint);
    if (matching.length > 1) {
      die(`${cfg.id}: duplicate node identities detected, resolve manually before seeding`);
    }
  }
  const snapshots = [];
  for (const cfg of configs) {
    const existing: any = allNodes.find((n: any) => n.slug === cfg.slug || n.dbUrl === cfg.dbUrl || n.controlPlaneEndpoint === cfg.controlPlaneEndpoint);
    const linked: any[] = existing
      ? allDatabases.filter((db: any) => idOf(db.hostingNodeId) === idOf(existing._id))
      : [];
    // Catch legacy assignments by host even if hostingNodeId was lost.
    const hostLinked: any[] = allDatabases.filter((db: any) => db.host === cfg.dbUrl);
    const affected = [...new Map([...linked, ...hostLinked].map((db: any) => [idOf(db._id), db])).values()];
    const live = affected.filter((db: any) => !['DELETED', 'TERMINATED'].includes(db.status));
    const reservation = Boolean(existing?.currentAllocationId || existing?.assignedInstanceId);
    const extra = affected.map((db: any) => ({
      id: idOf(db._id), status: db.status,
      customerId: idOf(db.customerId),
      customerEmail: usersById.get(idOf(db.customerId)) || '(user not found)',
      databaseUsers: (db.databaseUsers || []).map((u: any) => ({ username: u.username, role: u.role, status: u.status })),
    }));
    console.log(`\n${cfg.id.toUpperCase()} | node=${existing ? idOf(existing._id) : '(new)'} | linked=${linked.length} | hostMatches=${hostLinked.length} | live=${live.length}`);
    for (const row of extra) console.log(`  instance ${row.id} ${row.status} | customer ${row.customerId} (${row.customerEmail}) | DB users: ${JSON.stringify(row.databaseUsers)}`);
    if (cfg.id === 'cx01' && recreateCX01 && (affected.length > 0 || reservation)) {
      die('CX01 recreation BLOCKED: linked/host-matched instances or an allocation lease exist. Migrate/drain and independently verify cleanup first. No mutations made.');
    }
    snapshots.push({ cfg, existing, affected, live });
  }

  // Prepare live handshakes. This is inspection only, not reset/cleanup.
  const inspected = [];
  for (const item of snapshots) {
    const cfg = item.cfg;
    const result = await checkServer(cfg.controlPlaneEndpoint, hostToken(cfg.id));
    console.log(`${cfg.id.toUpperCase()} control-plane ${result.healthStatus}${result.error ? ` | ${result.error}` : ''}`);
    inspected.push({ ...item, result });
  }
  if (requireHealthy && inspected.some(x => x.result.healthStatus !== 'HEALTHY')) {
    die('A control plane is unhealthy. --require-healthy requested; no mutations made.');
  }
  if (!apply) {
    console.log('\nPREVIEW ONLY. Add --apply to write. For deletion/recreation also add --recreate-cx01.');
    return;
  }

  // Existing allocations and ownership data remain intact. No customer records are written.
  for (const { cfg, existing, live, result } of inspected) {
    const nodeToken = hostToken(cfg.id);
    const hasToken = nodeToken.length >= 32;
    const freshBase: any = {
      ...cfg, isDefault: false,
      healthStatus: result.healthStatus,
      lastHealthCheckAt: now(),
      serverIdentity: result.serverIdentity,
      serverVersion: result.serverVersion || '2.4.1',
      cleanStatus: 'NOT_VERIFIED',
      volumeCleanVerified: false,
      status: 'QUARANTINED',
      currentAssignedCount: 0,
      quarantineReason: result.error || 'New/recreated node requires authoritative server clean-state verification',
    };
    delete freshBase.id;
    if (hasToken) freshBase.encryptedControlPlaneToken = encrypt(nodeToken);
    if (existing && cfg.id === 'cx01' && recreateCX01) {
      // A fully unreferenced CX01 may be recreated with a new ID.
      const recheck = await ManagedDatabase.find({ hostingNodeId: existing._id });
      if (recheck.length) die('CX01 acquired an assignment during execution, stopping');
      const latest = await HostingNode.findById(existing._id);
      if (!latest || latest.currentAllocationId || latest.assignedInstanceId || latest.currentAssignedCount) {
        die('CX01 allocation changed during execution, stopping');
      }
      const removed = await HostingNode.deleteOne({ _id: existing._id, slug: existing.slug });
      if (removed.deletedCount !== 1) die('Failed to delete CX01 exactly once');
      await HostingNode.create(freshBase);
      changes.push(`${cfg.id} recreated`);
    } else if (existing) {
      // NEVER wipe allocation fields, active customer assignment, or quarantine history.
      const patch: any = {
        name: cfg.name, region: cfg.region,
        dbUrl: cfg.dbUrl, port: cfg.port,
        grpcUrl: cfg.grpcUrl, grpcPort: cfg.grpcPort,
        protocol: cfg.protocol, httpPort: cfg.httpPort,
        controlPlaneEndpoint: cfg.controlPlaneEndpoint,
        defaultRootUsername: existing.defaultRootUsername || 'admin',
        maxCapacity: 1,
        dockerNodeId: cfg.id,
        dockerContainerName: `/liorandb-${cfg.id}`,
        dockerVolumeName: `${cfg.id}-data`,
      };
      if (hasToken) patch.encryptedControlPlaneToken = encrypt(nodeToken);
      if (result.healthStatus !== 'HEALTHY' && existing.status === 'AVAILABLE') {
        patch.status = 'QUARANTINED';
        patch.quarantineReason = result.error || 'Control plane health verification failed';
      }
      if (live.length && existing.status === 'AVAILABLE') {
        patch.status = 'ASSIGNED';
        patch.currentAssignedCount = live.length;
      }
      await HostingNode.updateOne({ _id: existing._id }, { $set: patch });
      changes.push(`${cfg.id} metadata updated (assignments preserved)`);
    } else {
      await HostingNode.create(freshBase);
      changes.push(`${cfg.id} registered QUARANTINED pending clean verification`);
    }
  }
  // Make CX01 the only default only if it's a known-good healthy & clean record.
  const refreshed: any = await HostingNode.findOne({ slug: configs[0].slug }).lean();
  if (refreshed?.status === 'AVAILABLE' && refreshed.healthStatus === 'HEALTHY' && refreshed.cleanStatus === 'CLEAN') {
    await HostingNode.updateMany({ slug: { $ne: configs[0].slug } }, { $set: { isDefault: false } });
    await HostingNode.updateOne({ _id: refreshed._id }, { $set: { isDefault: true } });
  } else {
    await HostingNode.updateOne({ slug: configs[0].slug }, { $set: { isDefault: false } });
    console.log('CX01 not eligible as default until health and clean-state verification pass.');
  }
  console.log('\n' + changes.join('\n'));
  console.log('No customer records, databaseUsers, subscriptions, or Rust server data were modified.');
}

async function main() {
  try {
    await run();
  } catch (e) {
    console.error('FAILED:', e);
    process.exitCode = 1;
  } finally {
    await disconnectFromDatabase();
  }
}

main();
