import React from 'react';
import { requireAdmin } from '@/lib/auth/guards';
import { connectToDatabase, ManagedDatabase } from '@/lib/db';
import { formatPaiseToRupees } from '@/lib/plans';
import AdminInstanceActions from '@/components/admin/AdminInstanceActions';
import { Database, Server, Clock, AlertCircle } from 'lucide-react';
import Link from 'next/link';

export const metadata = { title: 'Instances — Admin Fleet' };

interface AdminInstanceDoc {
  _id: { toString(): string };
  name: string;
  host: string;
  port: number;
  customerId?: { _id: { toString(): string }; email: string; profile?: { fullName?: string } } | null;
  planName?: string;
  planId: string;
  hourlyRatePaise: number;
  backupEnabled: boolean;
  status: string;
  createdAt: Date | string;
}

export default async function AdminInstancesPage() {
  await requireAdmin();
  await connectToDatabase();

  const instances = await ManagedDatabase.find()
    .populate('customerId', 'email profile')
    .sort({ createdAt: -1 })
    .lean();

  const activeCount = instances.filter((i) => i.status === 'ACTIVE' || i.status === 'RUNNING').length;
  const suspendedCount = instances.filter((i) => i.status === 'SUSPENDED').length;
  const terminatedCount = instances.filter((i) => i.status === 'TERMINATED' || i.status === 'DELETED').length;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Managed Fleet</h1>
          <p className="text-sm text-slate-400 mt-1">
            Monitor and manage all customer database instances.
          </p>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Total Fleet</span>
            <Server className="w-4 h-4 text-indigo-400" />
          </div>
          <p className="text-2xl font-bold text-white mt-2">{instances.length}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Active</span>
            <Database className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-emerald-400 mt-2">{activeCount}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Suspended</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-2xl font-bold text-amber-400 mt-2">{suspendedCount}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Terminated</span>
            <AlertCircle className="w-4 h-4 text-slate-500" />
          </div>
          <p className="text-2xl font-bold text-slate-400 mt-2">{terminatedCount}</p>
        </div>
      </div>

      {/* Fleet table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center">
          <h2 className="text-base font-semibold text-white">All Instances</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/60 text-xs uppercase text-slate-400 border-b border-slate-800">
              <tr>
                <th className="px-6 py-3 font-medium">Instance</th>
                <th className="px-6 py-3 font-medium">Customer</th>
                <th className="px-6 py-3 font-medium">Plan</th>
                <th className="px-6 py-3 font-medium">Hourly Rate</th>
                <th className="px-6 py-3 font-medium">Backups</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium">Created</th>
                <th className="px-6 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {(instances as unknown as AdminInstanceDoc[]).map((inst) => {
                const customer = inst.customerId;
                const statusColor =
                  inst.status === 'ACTIVE' || inst.status === 'RUNNING'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    : inst.status === 'SUSPENDED'
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                    : inst.status === 'PROVISIONING'
                    ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                    : 'bg-slate-800 text-slate-400 border-slate-700';

                return (
                  <tr key={inst._id.toString()} className="hover:bg-slate-800/40 transition">
                    <td className="px-6 py-4 font-medium text-white">
                      <div className="flex flex-col">
                        <span>{inst.name}</span>
                        <span className="text-xs text-slate-500 font-mono">{inst.host}:{inst.port}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {customer ? (
                        <Link
                          href={`/admin/customers/${customer._id.toString()}`}
                          className="text-indigo-400 hover:text-indigo-300 transition"
                        >
                          {customer.email}
                        </Link>
                      ) : (
                        <span className="text-slate-500">Unknown</span>
                      )}
                    </td>
                    <td className="px-6 py-4 capitalize">{inst.planName || inst.planId}</td>
                    <td className="px-6 py-4 font-mono">{formatPaiseToRupees(inst.hourlyRatePaise || 100)}/hr</td>
                    <td className="px-6 py-4">
                      {inst.backupEnabled ? (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          Enabled (₹200/mo)
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500">None</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${statusColor}`}>
                        {inst.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-400">
                      {new Date(inst.createdAt).toLocaleDateString('en-IN')}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <AdminInstanceActions
                        instanceId={inst._id.toString()}
                        instanceName={inst.name}
                        status={inst.status}
                      />
                    </td>
                  </tr>
                );
              })}
              {instances.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-slate-500">
                    No managed instances found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
