'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Database,
  ArrowLeft,
  ExternalLink,
  Server,
  Users,
  Key,
  Sliders,
  History,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  RotateCw,
  Play,
  Pause,
  Trash2,
  Lock,
  Eye,
  EyeOff,
  Copy,
  Check,
  Plus,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { formatPaiseToRupees } from '@/lib/plans';

export interface DatabaseDetailData {
  _id: string;
  name: string;
  slug?: string;
  host: string;
  port: number;
  databaseName: string;
  status: string;
  planId: string;
  planName?: string;
  hourlyRatePaise: number;
  backupEnabled: boolean;
  backupMonthlyPaise: number;
  billingStartedAt?: string | null;
  billingStoppedAt?: string | null;
  provisionedAt?: string | null;
  rootUsername: string;
  rootRotatedAt?: string | null;
  lastCredentialRotationAt?: string | null;
  customer?: {
    _id: string;
    email: string;
    fullName?: string;
  } | null;
  databaseUsers: Array<{
    username: string;
    role: string;
    status: 'ACTIVE' | 'DISABLED';
    createdAt: string;
    updatedAt: string;
  }>;
  serverStatus: {
    status: string;
    version: string;
    uptimeSeconds: number;
    storageBytes: number;
    documentCount?: number;
    databaseCount?: number;
    collectionCount?: number;
    activeConnections?: number;
    opsPerSec?: number;
    lastBackupAt?: string;
    engine?: string;
    state?: string;
  };
  estimate: {
    periodStart: string;
    periodEnd: string;
    billableSeconds: number;
    billableHours: number;
    computeChargesPaise: number;
    backupChargesPaise: number;
    totalPaise: number;
  };
  auditLogs: Array<{
    _id: string;
    action: string;
    actor: { email: string; name: string };
    actorRole: string;
    metadata: Record<string, unknown>;
    ip?: string;
    createdAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

interface Props {
  initialData: DatabaseDetailData;
}

export default function AdminDatabaseDetailClient({ initialData }: Props) {
  const [data, setData] = useState<DatabaseDetailData>(initialData);
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'credentials' | 'operations' | 'audit'>('overview');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // One-time credential modal state (write-only secrets)
  const [secretModal, setSecretModal] = useState<{
    title: string;
    subtitle?: string;
    username: string;
    password: string; // Held ONLY in local state for one-time display
    connectionDetails?: string;
  } | null>(null);
  const [showPasswordSecret, setShowPasswordSecret] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // User Management Modals
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newUserRole, setNewUserRole] = useState('readWrite');
  const [confirmResetUser, setConfirmResetUser] = useState<string | null>(null);

  // Operations Modals
  const [confirmRotateRoot, setConfirmRotateRoot] = useState(false);
  const [showResetInstanceModal, setShowResetInstanceModal] = useState(false);
  const [resetConfirmationText, setResetConfirmationText] = useState('');
  const [showTerminateModal, setShowTerminateModal] = useState(false);
  const [terminateConfirmationText, setTerminateConfirmationText] = useState('');

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  function formatDateTime(isoString: string | Date | null | undefined): string {
    if (!isoString) return '—';
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  function formatDateOnly(isoString: string | Date | null | undefined): string {
    if (!isoString) return '—';
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  async function copyToClipboard(text: string, fieldKey: string) {
    await navigator.clipboard.writeText(text);
    setCopiedField(fieldKey);
    setTimeout(() => setCopiedField(null), 2000);
  }

  async function refreshData() {
    try {
      const res = await fetch(`/api/admin/databases/${data._id}`);
      const json = await res.json();
      if (json.success && json.database) {
        setData(json.database);
      }
    } catch {
      // ignore
    }
  }

  // ==========================================
  // Database User Operations
  // ==========================================

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    if (!newUsername) return;
    setActionLoading(true);
    setActionMessage(null);

    try {
      const res = await fetch(`/api/admin/databases/${data._id}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: newUsername, role: newUserRole }),
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || 'Failed to create database user');

      setShowCreateUserModal(false);
      setNewUsername('');

      // Show generated password ONCE
      setShowPasswordSecret(false);
      setSecretModal({
        title: 'USER CREATED',
        subtitle: `Database user '${resData.user.username}' created with role '${resData.user.role}'.`,
        username: resData.user.username,
        password: resData.user.generatedPassword,
        connectionDetails: `liorandb://${resData.user.username}:${resData.user.generatedPassword}@${data.host}:${data.port}/${data.databaseName}`,
      });

      await refreshData();
    } catch (err: unknown) {
      setActionMessage({ type: 'error', text: err instanceof Error ? err.message : 'Error creating user' });
    } finally {
      setActionLoading(false);
    }
  }

  async function handleResetUserPassword(username: string) {
    setActionLoading(true);
    setActionMessage(null);

    try {
      const res = await fetch(
        `/api/admin/databases/${data._id}/users/${encodeURIComponent(username)}/reset-password`,
        { method: 'POST' }
      );
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || 'Failed to reset password');

      setConfirmResetUser(null);

      // Show generated password ONCE
      setShowPasswordSecret(false);
      setSecretModal({
        title: 'PASSWORD CHANGED',
        subtitle: `New password generated for '${username}'. Previous credentials are immediately invalidated.`,
        username: resData.username,
        password: resData.newGeneratedPassword,
        connectionDetails: `liorandb://${resData.username}:${resData.newGeneratedPassword}@${data.host}:${data.port}/${data.databaseName}`,
      });

      await refreshData();
    } catch (err: unknown) {
      setActionMessage({ type: 'error', text: err instanceof Error ? err.message : 'Error resetting password' });
    } finally {
      setActionLoading(false);
    }
  }

  async function handleToggleUserStatus(username: string, currentStatus: string) {
    const nextStatus = currentStatus === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';
    setActionLoading(true);
    try {
      const res = await fetch(
        `/api/admin/databases/${data._id}/users/${encodeURIComponent(username)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: nextStatus }),
        }
      );
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || 'Failed to update user status');
      await refreshData();
      setActionMessage({ type: 'success', text: resData.message });
    } catch (err: unknown) {
      setActionMessage({ type: 'error', text: err instanceof Error ? err.message : 'Error updating user status' });
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDeleteUser(username: string) {
    if (!confirm(`Are you sure you want to delete user '${username}' from this database?`)) return;
    setActionLoading(true);
    try {
      const res = await fetch(
        `/api/admin/databases/${data._id}/users/${encodeURIComponent(username)}`,
        { method: 'DELETE' }
      );
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || 'Failed to delete user');
      await refreshData();
      setActionMessage({ type: 'success', text: resData.message });
    } catch (err: unknown) {
      setActionMessage({ type: 'error', text: err instanceof Error ? err.message : 'Error deleting user' });
    } finally {
      setActionLoading(false);
    }
  }

  // ==========================================
  // Credentials & Root Password Rotation
  // ==========================================

  async function handleRotateRoot() {
    setActionLoading(true);
    setActionMessage(null);

    try {
      const res = await fetch(`/api/admin/databases/${data._id}/rotate-root`, { method: 'POST' });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || 'Failed to rotate root password');

      setConfirmRotateRoot(false);

      // Show generated root password ONCE
      setShowPasswordSecret(false);
      setSecretModal({
        title: 'ROOT PASSWORD ROTATED',
        subtitle: `Root/bootstrap database credential for '${resData.rootUsername}' has been rotated.`,
        username: resData.rootUsername,
        password: resData.newGeneratedPassword,
        connectionDetails: `liorandb://${resData.rootUsername}:${resData.newGeneratedPassword}@${data.host}:${data.port}/${data.databaseName}`,
      });

      await refreshData();
    } catch (err: unknown) {
      setActionMessage({ type: 'error', text: err instanceof Error ? err.message : 'Error rotating root password' });
    } finally {
      setActionLoading(false);
    }
  }

  // ==========================================
  // Infrastructure Operations
  // ==========================================

  async function handleSuspend() {
    if (!confirm(`Suspend database '${data.name}'? Customer traffic and billing will be paused.`)) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/databases/${data._id}/suspend`, { method: 'POST' });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || 'Failed to suspend database');
      await refreshData();
      setActionMessage({ type: 'success', text: resData.message });
    } catch (err: unknown) {
      setActionMessage({ type: 'error', text: err instanceof Error ? err.message : 'Error suspending database' });
    } finally {
      setActionLoading(false);
    }
  }

  async function handleResume() {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/databases/${data._id}/resume`, { method: 'POST' });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || 'Failed to resume database');
      await refreshData();
      setActionMessage({ type: 'success', text: resData.message });
    } catch (err: unknown) {
      setActionMessage({ type: 'error', text: err instanceof Error ? err.message : 'Error resuming database' });
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRestart() {
    if (!confirm(`Restart daemon process for '${data.name}'? Active client connections will briefly reconnect.`)) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/databases/${data._id}/restart`, { method: 'POST' });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || 'Failed to restart instance');
      await refreshData();
      setActionMessage({ type: 'success', text: resData.message });
    } catch (err: unknown) {
      setActionMessage({ type: 'error', text: err instanceof Error ? err.message : 'Error restarting instance' });
    } finally {
      setActionLoading(false);
    }
  }

  async function handleBackup() {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/databases/${data._id}/backup`, { method: 'POST' });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || 'Failed to trigger backup');
      await refreshData();
      setActionMessage({ type: 'success', text: resData.backup?.message || 'Snapshot completed' });
    } catch (err: unknown) {
      setActionMessage({ type: 'error', text: err instanceof Error ? err.message : 'Error triggering backup' });
    } finally {
      setActionLoading(false);
    }
  }

  async function handleResetInstance(e: React.FormEvent) {
    e.preventDefault();
    if (resetConfirmationText !== data.name) return;
    setActionLoading(true);
    setActionMessage(null);

    try {
      const res = await fetch(`/api/admin/databases/${data._id}/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmation: resetConfirmationText }),
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || 'Failed to reset instance');

      setShowResetInstanceModal(false);
      setResetConfirmationText('');

      // Show generated root password ONCE
      setShowPasswordSecret(false);
      setSecretModal({
        title: 'INSTANCE RESET SUCCESSFULLY',
        subtitle: `Instance '${data.name}' was safely wiped and re-initialized with a clean database state and new root credential.`,
        username: resData.rootUsername,
        password: resData.newGeneratedRootPassword,
        connectionDetails: `liorandb://${resData.rootUsername}:${resData.newGeneratedRootPassword}@${data.host}:${data.port}/${data.databaseName}`,
      });

      await refreshData();
    } catch (err: unknown) {
      setActionMessage({ type: 'error', text: err instanceof Error ? err.message : 'Error resetting instance' });
    } finally {
      setActionLoading(false);
    }
  }

  async function handleTerminateInstance(e: React.FormEvent) {
    e.preventDefault();
    if (terminateConfirmationText !== data.name) return;
    setActionLoading(true);
    setActionMessage(null);

    try {
      const res = await fetch(`/api/admin/databases/${data._id}/terminate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmation: terminateConfirmationText }),
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || 'Failed to terminate instance');

      setShowTerminateModal(false);
      setTerminateConfirmationText('');
      await refreshData();
      setActionMessage({ type: 'success', text: resData.message });
    } catch (err: unknown) {
      setActionMessage({ type: 'error', text: err instanceof Error ? err.message : 'Error terminating instance' });
    } finally {
      setActionLoading(false);
    }
  }

  const connectionUri = `liorandb://${data.rootUsername || 'admin'}:••••••••@${data.host}:${data.port}/${data.databaseName}`;

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      {/* Top Breadcrumb & Status */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Link
            href="/admin/databases"
            className="inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-strong)] transition-colors mb-2 font-semibold"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Managed Databases</span>
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-[var(--text-strong)] tracking-tight flex items-center gap-2">
              <Database className="w-6 h-6 text-[var(--text-strong)]" />
              <span>{data.name}</span>
            </h1>
            <span
              className={`badge ${
                data.status === 'ACTIVE' || data.status === 'RUNNING'
                  ? 'badge-active'
                  : data.status === 'SUSPENDED'
                  ? 'badge-suspended'
                  : 'badge-info'
              }`}
            >
              {data.status}
            </span>
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-1 font-mono">
            Instance ID: <span className="text-[var(--text-secondary)] font-semibold">{data._id}</span>
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={refreshData}
            title="Refresh database data"
            className="btn-secondary p-2 min-h-[36px]"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <a
            href="https://studio.liorandb.com"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary py-2 px-3.5 min-h-[36px] text-xs inline-flex items-center gap-1.5"
          >
            <span>Open Studio</span>
            <ExternalLink className="w-3.5 h-3.5 text-[var(--text-muted)]" />
          </a>
        </div>
      </div>

      {/* Global Action Message Banner */}
      {actionMessage && (
        <div
          className={`p-3.5 rounded-[7px] border-2 text-xs flex items-center justify-between ${
            actionMessage.type === 'success'
              ? 'bg-[var(--surface-soft)] border-[var(--hairline-strong)] text-[var(--text-strong)]'
              : 'bg-[var(--surface-soft)] border-red-500 text-red-600 dark:text-red-400'
          }`}
        >
          <div className="flex items-center gap-2">
            {actionMessage.type === 'success' ? (
              <Check className="w-4 h-4 text-[var(--text-strong)] shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
            )}
            <span className="font-semibold">{actionMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionMessage(null)}
            className="text-[var(--text-muted)] hover:text-[var(--text-strong)] font-bold text-base"
          >
            &times;
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex border-b border-[var(--border)] gap-2 overflow-x-auto font-mono">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`pb-3 px-3 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
            activeTab === 'overview'
              ? 'border-[var(--primary)] text-[var(--text-strong)]'
              : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
          }`}
        >
          <Server className="w-4 h-4" />
          <span>Overview</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('users')}
          className={`pb-3 px-3 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
            activeTab === 'users'
              ? 'border-[var(--primary)] text-[var(--text-strong)]'
              : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Database Users ({data.databaseUsers.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('credentials')}
          className={`pb-3 px-3 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
            activeTab === 'credentials'
              ? 'border-[var(--primary)] text-[var(--text-strong)]'
              : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
          }`}
        >
          <Key className="w-4 h-4" />
          <span>Credentials</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('operations')}
          className={`pb-3 px-3 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
            activeTab === 'operations'
              ? 'border-[var(--primary)] text-[var(--text-strong)]'
              : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>Operations</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('audit')}
          className={`pb-3 px-3 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
            activeTab === 'audit'
              ? 'border-[var(--primary)] text-[var(--text-strong)]'
              : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Audit History</span>
        </button>
      </div>

      {/* ========================================================= */}
      {/* TAB 1: OVERVIEW */}
      {/* ========================================================= */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="card p-4">
              <span className="text-xs font-mono uppercase tracking-wider text-[var(--text-muted)]">Server Health</span>
              <div className="mt-2">
                <span className="text-lg font-bold text-[var(--text-strong)] font-mono">
                  {data.serverStatus.status}
                </span>
              </div>
              <span className="text-[11px] text-[var(--text-muted)] mt-1 block font-mono">
                {data.serverStatus.version}
              </span>
            </div>

            <div className="card p-4">
              <span className="text-xs font-mono uppercase tracking-wider text-[var(--text-muted)]">Estimated Current Bill</span>
              <p className="text-lg font-bold text-[var(--text-strong)] font-mono mt-2">
                {formatPaiseToRupees(data.estimate.totalPaise)}
              </p>
              <span className="text-[11px] text-[var(--text-muted)] mt-1 block font-mono">
                {data.estimate.billableHours.toFixed(1)} hrs usage
              </span>
            </div>

            <div className="card p-4">
              <span className="text-xs font-mono uppercase tracking-wider text-[var(--text-muted)]">Storage / Docs</span>
              <p className="text-lg font-bold text-[var(--text-strong)] font-mono mt-2">
                {(data.serverStatus.storageBytes / (1024 * 1024)).toFixed(1)} MB
              </p>
              <span className="text-[11px] text-[var(--text-muted)] mt-1 block font-mono">
                {(data.serverStatus.documentCount ?? data.serverStatus.collectionCount ?? 0).toLocaleString()} documents
              </span>
            </div>

            <div className="card p-4">
              <span className="text-xs font-mono uppercase tracking-wider text-[var(--text-muted)]">Backups</span>
              <div className="flex items-center gap-1.5 mt-2">
                {data.backupEnabled ? (
                  <span className="badge badge-active">Enabled</span>
                ) : (
                  <span className="badge badge-default">Disabled</span>
                )}
              </div>
              <span className="text-[11px] text-[var(--text-muted)] mt-1 block font-mono">
                {data.backupEnabled ? '₹200/mo addon' : 'No backups'}
              </span>
            </div>
          </div>

          {/* Infrastructure Specifications & Customer Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Instance & Host Spec */}
            <div className="card p-5 space-y-4">
              <h3 className="text-sm font-bold text-[var(--text-strong)] border-b border-[var(--border)] pb-3 flex items-center gap-2">
                <Server className="w-4 h-4 text-[var(--text-strong)]" />
                <span>Infrastructure Specifications</span>
              </h3>

              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between items-center py-1 border-b border-[var(--border)]">
                  <span className="text-[var(--text-muted)]">Plan</span>
                  <span className="font-mono text-[var(--text-strong)] px-2 py-0.5 rounded-[4px] bg-[var(--surface-soft)] border border-[var(--border)] font-semibold">
                    {data.planName || (data.planId === 'dedicated' ? 'Dedicated' : 'Shared')} (
                    {formatPaiseToRupees(data.hourlyRatePaise)}/hr)
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-[var(--border)]">
                  <span className="text-[var(--text-muted)]">Server Endpoint</span>
                  <span className="font-mono text-[var(--text-primary)] font-medium">{data.host}:{data.port}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-[var(--border)]">
                  <span className="text-[var(--text-muted)]">Database Name</span>
                  <span className="font-mono text-[var(--text-primary)] font-medium">{data.databaseName}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-[var(--border)]">
                  <span className="text-[var(--text-muted)]">Engine Core</span>
                  <span className="text-[var(--text-primary)] font-mono font-medium">{data.serverStatus.engine}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-[var(--border)]">
                  <span className="text-[var(--text-muted)]">Created At</span>
                  <span suppressHydrationWarning className="text-[var(--text-secondary)] font-mono">{formatDateTime(data.createdAt)}</span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-[var(--text-muted)]">Billing Started</span>
                  <span suppressHydrationWarning className="text-[var(--text-secondary)] font-mono">
                    {data.billingStartedAt ? formatDateTime(data.billingStartedAt) : 'Not started'}
                  </span>
                </div>
              </div>
            </div>

            {/* Customer & Billing Card */}
            <div className="card p-5 space-y-4">
              <h3 className="text-sm font-bold text-[var(--text-strong)] border-b border-[var(--border)] pb-3 flex items-center gap-2">
                <Users className="w-4 h-4 text-[var(--text-strong)]" />
                <span>Customer &amp; Account</span>
              </h3>

              {data.customer ? (
                <div className="space-y-2.5 text-xs">
                  <div className="flex justify-between items-center py-1 border-b border-[var(--border)]">
                    <span className="text-[var(--text-muted)]">Customer Name</span>
                    <span className="text-[var(--text-strong)] font-bold">
                      {data.customer.fullName || '—'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-[var(--border)]">
                    <span className="text-[var(--text-muted)]">Customer Email</span>
                    <span className="text-[var(--text-primary)] font-mono font-medium">{data.customer.email}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-[var(--border)]">
                    <span className="text-[var(--text-muted)]">Customer ID</span>
                    <span className="font-mono text-[var(--text-muted)] text-[11px]">
                      {data.customer._id}
                    </span>
                  </div>
                  <div className="pt-2">
                    <Link
                      href={`/admin/customers/${data.customer._id}`}
                      className="btn-secondary py-1.5 px-3 min-h-[34px] text-xs inline-flex items-center gap-1.5"
                    >
                      <span>View Customer Profile &amp; Fleet</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-[var(--text-muted)] py-4">No associated customer found.</p>
              )}
            </div>
          </div>

          {/* Connection String Box */}
          <div className="card p-5 space-y-3">
            <h3 className="text-sm font-bold text-[var(--text-strong)] flex items-center gap-2">
              <Lock className="w-4 h-4 text-[var(--text-strong)]" />
              <span>Standard Connection URI</span>
            </h3>
            <p className="text-xs text-[var(--text-muted)]">
              Pass this connection URI to application clients or connect via LioranDB Studio.
            </p>
            <div className="flex items-center gap-2 bg-[var(--surface-soft)] border border-[var(--border)] rounded-[7px] p-3 font-mono text-xs text-[var(--text-primary)] overflow-x-auto">
              <span className="flex-1 select-all">{connectionUri}</span>
              <button
                type="button"
                onClick={() => copyToClipboard(connectionUri, 'overview_uri')}
                className="p-1.5 rounded hover:bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text-strong)] transition-colors shrink-0 cursor-pointer"
                title="Copy connection string"
              >
                {copiedField === 'overview_uri' ? (
                  <Check className="w-4 h-4 text-[var(--text-strong)]" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: DATABASE USERS */}
      {/* ========================================================= */}
      {activeTab === 'users' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-base font-bold text-[var(--text-strong)]">Database Users</h2>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                Manage instance-level database authentication roles and credentials. Passwords are write-only.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowCreateUserModal(true)}
              className="btn-primary py-1.5 px-3 min-h-[36px] text-xs inline-flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Database User</span>
            </button>
          </div>

          <div className="card p-0 overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[var(--surface-2)] text-[var(--muted)] uppercase font-mono border-b border-[var(--border)]">
                  <tr>
                    <th className="px-4 py-3 font-medium">Username</th>
                    <th className="px-4 py-3 font-medium">Role</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Created</th>
                    <th className="px-4 py-3 font-medium">Updated</th>
                    <th className="px-4 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)] font-mono">
                  {data.databaseUsers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-10 text-center text-[var(--muted)] text-xs font-sans">
                        No additional database users configured. Use &apos;Create Database User&apos; to add one.
                      </td>
                    </tr>
                  ) : (
                    data.databaseUsers.map((u) => (
                      <tr key={u.username} className="hover:bg-[var(--surface-soft)] transition-colors">
                        <td className="px-4 py-3.5 font-mono text-xs font-bold text-[var(--text-strong)]">
                          {u.username}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="px-2 py-0.5 rounded-[4px] bg-[var(--surface-soft)] border border-[var(--border)] font-mono text-[11px] text-[var(--text-secondary)] font-semibold">
                            {u.role}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={`badge ${u.status === 'ACTIVE' ? 'badge-active' : 'badge-suspended'}`}>
                            {u.status}
                          </span>
                        </td>
                        <td suppressHydrationWarning className="px-4 py-3.5 text-xs text-[var(--text-muted)]">
                          {formatDateOnly(u.createdAt)}
                        </td>
                        <td suppressHydrationWarning className="px-4 py-3.5 text-xs text-[var(--text-muted)]">
                          {u.updatedAt ? formatDateOnly(u.updatedAt) : '—'}
                        </td>
                        <td className="px-4 py-3.5 text-right space-x-2">
                          <button
                            type="button"
                            onClick={() => setConfirmResetUser(u.username)}
                            className="btn-secondary py-1 px-2 min-h-[28px] text-[11px]"
                          >
                            Reset Password
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleUserStatus(u.username, u.status)}
                            className="btn-secondary py-1 px-2 min-h-[28px] text-[11px]"
                          >
                            {u.status === 'ACTIVE' ? 'Disable' : 'Enable'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteUser(u.username)}
                            className="btn-secondary py-1 px-2 min-h-[28px] text-[11px]"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 3: CREDENTIALS */}
      {/* ========================================================= */}
      {activeTab === 'credentials' && (
        <div className="space-y-6">
          <div className="card space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[var(--border)] pb-4">
              <div>
                <h3 className="text-sm font-bold text-[var(--text-strong)] flex items-center gap-2">
                  <Key className="w-4 h-4 text-[var(--text-strong)]" />
                  <span>Primary / Root Database Credential</span>
                </h3>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  Superuser bootstrap account for administrative engine-level access.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setConfirmRotateRoot(true)}
                className="btn-secondary text-xs py-1.5 px-3 shrink-0 inline-flex items-center gap-1.5"
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span>ROTATE ROOT PASSWORD</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div className="bg-[var(--surface-soft)] p-3.5 rounded-lg border border-[var(--border)]">
                <span className="text-[var(--text-muted)] block text-[11px]">Root Username</span>
                <span className="font-mono text-sm text-[var(--text-strong)] font-semibold mt-1 block">
                  {data.rootUsername || 'admin'}
                </span>
              </div>
              <div className="bg-[var(--surface-soft)] p-3.5 rounded-lg border border-[var(--border)]">
                <span className="text-[var(--text-muted)] block text-[11px]">Credential Status</span>
                <span className="font-mono text-xs text-[var(--text-strong)] font-semibold mt-1 block tracking-wider">
                  ACTIVE / ROTATABLE
                </span>
              </div>
              <div className="bg-[var(--surface-soft)] p-3.5 rounded-lg border border-[var(--border)]">
                <span className="text-[var(--text-muted)] block text-[11px]">Last Rotated</span>
                <span suppressHydrationWarning className="text-xs text-[var(--text-primary)] mt-1 block">
                  {data.rootRotatedAt ? formatDateTime(data.rootRotatedAt) : 'Initial Provisioning'}
                </span>
              </div>
            </div>

            <div className="bg-[var(--surface-soft)] border border-[var(--border)] rounded-lg p-3.5 text-xs text-[var(--text-secondary)] flex items-start gap-2.5">
              <Lock className="w-4 h-4 text-[var(--text-muted)] shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-[var(--text-strong)]">Strict Write-Only Credential Policy</p>
                <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">
                  LioranDB never stores plaintext passwords. Passwords are shown exactly once upon creation or rotation.
                  If a credential is misplaced, rotate or reset it immediately.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 4: OPERATIONS */}
      {/* ========================================================= */}
      {activeTab === 'operations' && (
        <div className="space-y-6">
          {/* Normal Operations */}
          <div className="card space-y-4">
            <h3 className="text-sm font-semibold text-[var(--text-strong)] border-b border-[var(--border)] pb-3 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-[var(--text-muted)]" />
              <span>Routine Infrastructure Operations</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Suspend / Resume */}
              <div className="bg-[var(--surface-soft)] border border-[var(--border)] rounded-[7px] p-4 flex flex-col justify-between">
                <div>
                  <h4 className="text-xs font-bold text-[var(--text-strong)]">
                    {data.status === 'SUSPENDED' ? 'Resume Database Instance' : 'Suspend Database Instance'}
                  </h4>
                  <p className="text-[11px] text-[var(--text-muted)] mt-1">
                    {data.status === 'SUSPENDED'
                      ? 'Restore customer traffic and resume billing accrual.'
                      : 'Temporarily pause customer access and pause billing accrual while preserving all data.'}
                  </p>
                </div>
                <div className="pt-3">
                  {data.status === 'SUSPENDED' ? (
                    <button
                      type="button"
                      onClick={handleResume}
                      disabled={actionLoading}
                      className="btn-primary text-xs py-1.5 px-3 inline-flex items-center gap-1.5"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>Resume Instance</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSuspend}
                      disabled={actionLoading}
                      className="btn-secondary text-xs py-1.5 px-3 inline-flex items-center gap-1.5"
                    >
                      <Pause className="w-3.5 h-3.5" />
                      <span>Suspend Instance</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Restart Daemon */}
              <div className="bg-[var(--surface-soft)] border border-[var(--border)] rounded-[7px] p-4 flex flex-col justify-between">
                <div>
                  <h4 className="text-xs font-bold text-[var(--text-strong)]">Restart Instance Daemon</h4>
                  <p className="text-[11px] text-[var(--text-muted)] mt-1">
                    Gracefully restart the LioranDB engine process on the host server.
                  </p>
                </div>
                <div className="pt-3">
                  <button
                    type="button"
                    onClick={handleRestart}
                    disabled={actionLoading}
                    className="btn-secondary text-xs py-1.5 px-3 inline-flex items-center gap-1.5"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                    <span>Restart Process</span>
                  </button>
                </div>
              </div>

              {/* Trigger Snapshot Backup */}
              <div className="bg-[var(--surface-soft)] border border-[var(--border)] rounded-[7px] p-4 flex flex-col justify-between">
                <div>
                  <h4 className="text-xs font-bold text-[var(--text-strong)]">Trigger On-Demand Backup</h4>
                  <p className="text-[11px] text-[var(--text-muted)] mt-1">
                    Capture an immediate point-in-time snapshot of the database storage.
                  </p>
                </div>
                <div className="pt-3">
                  <button
                    type="button"
                    onClick={handleBackup}
                    disabled={actionLoading}
                    className="btn-primary text-xs py-1.5 px-3 inline-flex items-center gap-1.5"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Trigger Snapshot</span>
                  </button>
                </div>
              </div>

              {/* Rotate Root Password shortcut */}
              <div className="bg-[var(--surface-soft)] border border-[var(--border)] rounded-[7px] p-4 flex flex-col justify-between">
                <div>
                  <h4 className="text-xs font-bold text-[var(--text-strong)]">Rotate Root Password</h4>
                  <p className="text-[11px] text-[var(--text-muted)] mt-1">
                    Invalidate existing superuser credentials and generate a new random password.
                  </p>
                </div>
                <div className="pt-3">
                  <button
                    type="button"
                    onClick={() => setConfirmRotateRoot(true)}
                    disabled={actionLoading}
                    className="btn-secondary text-xs py-1.5 px-3 inline-flex items-center gap-1.5"
                  >
                    <Key className="w-3.5 h-3.5" />
                    <span>Rotate Credentials</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Danger Zone */}
          <div className="card space-y-4">
            <h3 className="text-sm font-bold text-[var(--text-strong)] border-b border-[var(--border)] pb-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-[var(--text-strong)]" />
              <span>Danger Zone</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Reset Instance */}
              <div className="bg-[var(--surface-soft)] border border-[var(--border)] rounded-[7px] p-4 flex flex-col justify-between">
                <div>
                  <h4 className="text-xs font-bold text-[var(--text-strong)]">Reset Database Instance</h4>
                  <p className="text-[11px] text-[var(--text-muted)] mt-1">
                    Super Admin action. Safely wipes all customer collections, documents, indexes, and database users.
                    Re-initializes fresh root credentials and returns the server to an active clean state.
                  </p>
                </div>
                <div className="pt-3">
                  <button
                    type="button"
                    onClick={() => setShowResetInstanceModal(true)}
                    disabled={actionLoading}
                    className="btn-secondary text-xs py-1.5 px-3 inline-flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Reset Instance...</span>
                  </button>
                </div>
              </div>

              {/* Terminate Instance */}
              <div className="bg-[var(--surface-soft)] border border-[var(--border)] rounded-[7px] p-4 flex flex-col justify-between">
                <div>
                  <h4 className="text-xs font-bold text-[var(--text-strong)]">Terminate Instance</h4>
                  <p className="text-[11px] text-[var(--text-muted)] mt-1">
                    Permanently terminate service, stop customer access, close billing intervals, and wipe database
                    contents while preserving financial records and audit logs.
                  </p>
                </div>
                <div className="pt-3">
                  <button
                    type="button"
                    onClick={() => setShowTerminateModal(true)}
                    disabled={actionLoading}
                    className="btn-primary text-xs py-1.5 px-3 inline-flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Terminate Instance...</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 5: AUDIT HISTORY */}
      {/* ========================================================= */}
      {activeTab === 'audit' && (
        <div className="space-y-4">
          <div className="card !p-0 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[var(--border)] flex justify-between items-center bg-[var(--surface-soft)]">
              <h3 className="text-sm font-semibold text-[var(--text-strong)] flex items-center gap-2">
                <History className="w-4 h-4 text-[var(--text-muted)]" />
                <span>Instance Activity &amp; Privileged Audit Log</span>
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-[var(--text-primary)]">
                <thead className="bg-[var(--surface-soft)] text-xs uppercase text-[var(--text-muted)] border-b border-[var(--border)] font-mono">
                  <tr>
                    <th className="px-5 py-3 font-medium">Timestamp</th>
                    <th className="px-5 py-3 font-medium">Action</th>
                    <th className="px-5 py-3 font-medium">Actor</th>
                    <th className="px-5 py-3 font-medium">Metadata / Target</th>
                    <th className="px-5 py-3 font-medium">IP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {data.auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-10 text-center text-[var(--text-muted)] text-xs">
                        No audit events recorded for this database instance.
                      </td>
                    </tr>
                  ) : (
                    data.auditLogs.map((log) => (
                      <tr key={log._id} className="hover:bg-[var(--surface-card)] transition-colors text-xs">
                        <td suppressHydrationWarning className="px-5 py-3 font-mono text-[var(--text-muted)] whitespace-nowrap">
                          {formatDateTime(log.createdAt)}
                        </td>
                        <td className="px-5 py-3">
                          <span className="font-mono px-2 py-0.5 rounded bg-[var(--surface-soft)] border border-[var(--border)] text-[11px] text-[var(--text-strong)]">
                            {log.action}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <span className="text-[var(--text-strong)] font-medium">{log.actor.email}</span>
                          <span className="text-[var(--text-muted)] text-[11px] block">{log.actorRole}</span>
                        </td>
                        <td className="px-5 py-3">
                          <span className="text-[var(--text-secondary)] text-[11px] font-mono truncate max-w-xs block">
                            {JSON.stringify(log.metadata || {})}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-[var(--text-muted)] font-mono text-[11px]">
                          {log.ip || 'internal'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* WRITE-ONLY ONE-TIME SECRET MODAL */}
      {/* ========================================================= */}
      {secretModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in duration-150">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="badge badge-active text-[10px] font-mono uppercase tracking-wider">
                  Write-Only Secret
                </span>
                <h3 className="text-lg font-bold text-[var(--text-strong)] mt-1">{secretModal.title}</h3>
                {secretModal.subtitle && (
                  <p className="text-xs text-[var(--text-muted)] mt-1">{secretModal.subtitle}</p>
                )}
              </div>
            </div>

            <div className="space-y-3 bg-[var(--surface-soft)] border border-[var(--border)] rounded-xl p-4">
              <div>
                <label className="text-[11px] font-medium text-[var(--text-muted)] block mb-1">Username</label>
                <div className="flex items-center justify-between bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-xs font-mono text-[var(--text-strong)]">
                  <span>{secretModal.username}</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(secretModal.username, 'modal_user')}
                    className="text-[var(--text-muted)] hover:text-[var(--text-strong)] cursor-pointer"
                  >
                    {copiedField === 'modal_user' ? (
                      <Check className="w-3.5 h-3.5 text-[var(--text-strong)]" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-medium text-[var(--text-muted)]">Password</label>
                  <button
                    type="button"
                    onClick={() => setShowPasswordSecret(!showPasswordSecret)}
                    className="inline-flex items-center gap-1 text-[11px] text-[var(--text-primary)] hover:underline cursor-pointer"
                  >
                    {showPasswordSecret ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    <span>{showPasswordSecret ? 'Hide' : 'Show'}</span>
                  </button>
                </div>
                <div className="flex items-center justify-between bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-xs font-mono text-[var(--text-strong)] font-bold tracking-wide">
                  <span>{showPasswordSecret ? secretModal.password : '••••••••••••••••••••••••'}</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(secretModal.password, 'modal_pwd')}
                    className="text-[var(--text-muted)] hover:text-[var(--text-strong)] cursor-pointer"
                  >
                    {copiedField === 'modal_pwd' ? (
                      <Check className="w-3.5 h-3.5 text-[var(--text-strong)]" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>

              {secretModal.connectionDetails && (
                <div>
                  <label className="text-[11px] font-medium text-[var(--text-muted)] block mb-1">
                    Connection URI
                  </label>
                  <div className="flex items-center justify-between bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-[11px] font-mono text-[var(--text-secondary)] overflow-x-auto">
                    <span className="truncate mr-2">{secretModal.connectionDetails}</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(secretModal.connectionDetails!, 'modal_conn')}
                      className="text-[var(--text-muted)] hover:text-[var(--text-strong)] shrink-0 cursor-pointer"
                    >
                      {copiedField === 'modal_conn' ? (
                        <Check className="w-3.5 h-3.5 text-[var(--text-strong)]" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-[11px] text-amber-600 dark:text-amber-400 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <span>
                <strong>Warning:</strong> This password is shown only once. Save it securely in your password manager.
                If it is lost, reset the password.
              </span>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setSecretModal(null)}
                className="btn-primary w-full py-2.5 px-4 text-xs font-semibold"
              >
                I have saved these credentials securely
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: CREATE DATABASE USER */}
      {/* ========================================================= */}
      {showCreateUserModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateUser}
            className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl"
          >
            <div>
              <h3 className="text-base font-bold text-[var(--text-strong)]">Create Database User</h3>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                A strong random password will be generated server-side and returned once.
              </p>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="label">Username</label>
                <input
                  type="text"
                  required
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="e.g. app_service_user"
                  pattern="^[a-zA-Z0-9_.-]{3,32}$"
                  className="input-field font-mono"
                />
              </div>

              <div>
                <label className="label">Role / Permissions</label>
                <select
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value)}
                  className="input-field cursor-pointer"
                >
                  <option value="readWrite">readWrite (Standard app access)</option>
                  <option value="read">read (Read-only query access)</option>
                  <option value="dbAdmin">dbAdmin (Database administrative)</option>
                  <option value="admin">admin (Full cluster administrator)</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => setShowCreateUserModal(false)}
                className="btn-secondary text-xs py-2 px-3.5"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={actionLoading || !newUsername}
                className="btn-primary text-xs py-2 px-4 disabled:opacity-50"
              >
                {actionLoading ? 'Creating User...' : 'Generate User & Password'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: RESET USER PASSWORD CONFIRMATION */}
      {/* ========================================================= */}
      {confirmResetUser && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-[var(--text-strong)]">Reset Database User Password</h3>
            <p className="text-xs text-[var(--text-secondary)]">
              Reset password for <strong className="font-mono text-[var(--text-strong)]">&quot;{confirmResetUser}&quot;</strong>?
            </p>
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-xs text-amber-600 dark:text-amber-400">
              The current password will immediately stop working. A new strong password will be generated and shown
              once.
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => setConfirmResetUser(null)}
                className="btn-secondary text-xs py-2 px-3.5"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => handleResetUserPassword(confirmResetUser)}
                className="btn-primary text-xs py-2 px-4"
              >
                {actionLoading ? 'Resetting...' : 'Reset Password'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: ROTATE ROOT PASSWORD CONFIRMATION */}
      {/* ========================================================= */}
      {confirmRotateRoot && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-[var(--text-strong)]">Rotate Root Password</h3>
            <p className="text-xs text-[var(--text-secondary)]">
              Rotate the primary root credential for <strong className="font-mono text-[var(--text-strong)]">&quot;{data.rootUsername || 'admin'}&quot;</strong>?
            </p>
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-xs text-amber-600 dark:text-amber-400">
              The previous root password will be immediately invalidated. The new password will be generated and shown
              once.
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => setConfirmRotateRoot(false)}
                className="btn-secondary text-xs py-2 px-3.5"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleRotateRoot}
                className="btn-primary text-xs py-2 px-4 font-semibold"
              >
                {actionLoading ? 'Rotating...' : 'Rotate Root Password'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: RESET INSTANCE (STRONG CONFIRMATION) */}
      {/* ========================================================= */}
      {showResetInstanceModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleResetInstance}
            className="bg-[var(--surface)] border border-rose-500/30 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl"
          >
            <div>
              <span className="badge badge-default text-[10px] font-mono font-bold uppercase tracking-wider">
                Super Admin Operation
              </span>
              <h3 className="text-lg font-bold text-[var(--text-strong)] mt-1">Reset Database Instance</h3>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                This will wipe all customer collections, documents, indexes, and custom database users. The instance
                will return to a ready state with new root credentials.
              </p>
            </div>

            <div className="bg-[var(--surface-soft)] border border-[var(--border)] rounded-xl p-3.5 text-xs text-[var(--text-secondary)] space-y-1">
              <p className="font-semibold text-[var(--text-strong)]">Destructive Action Confirmation</p>
              <p className="text-[11px]">
                To proceed, type the instance name <strong className="font-mono text-[var(--text-strong)]">{data.name}</strong> below:
              </p>
            </div>

            <div>
              <input
                type="text"
                required
                value={resetConfirmationText}
                onChange={(e) => setResetConfirmationText(e.target.value)}
                placeholder={data.name}
                className="input-field font-mono text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => {
                  setShowResetInstanceModal(false);
                  setResetConfirmationText('');
                }}
                className="btn-secondary text-xs py-2 px-3.5"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={actionLoading || resetConfirmationText !== data.name}
                className="btn-primary text-xs py-2 px-4 font-bold disabled:opacity-40"
              >
                {actionLoading ? 'Resetting Engine...' : 'RESET INSTANCE'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: TERMINATE INSTANCE */}
      {/* ========================================================= */}
      {showTerminateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleTerminateInstance}
            className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl"
          >
            <div>
              <span className="badge badge-default text-[10px] font-mono font-bold uppercase tracking-wider">
                Permanent Termination
              </span>
              <h3 className="text-lg font-bold text-[var(--text-strong)] mt-1">Terminate Managed Database</h3>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                Customer service and billing will be ended immediately. Engine contents will be wiped.
              </p>
            </div>

            <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3.5 text-xs text-rose-600 dark:text-rose-400 space-y-1">
              <p className="font-semibold">Type instance name to confirm termination</p>
              <p className="text-[11px]">
                Type <strong className="font-mono text-[var(--text-strong)]">{data.name}</strong> to confirm:
              </p>
            </div>

            <div>
              <input
                type="text"
                required
                value={terminateConfirmationText}
                onChange={(e) => setTerminateConfirmationText(e.target.value)}
                placeholder={data.name}
                className="input-field font-mono text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => {
                  setShowTerminateModal(false);
                  setTerminateConfirmationText('');
                }}
                className="btn-secondary text-xs py-2 px-3.5"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={actionLoading || terminateConfirmationText !== data.name}
                className="btn-primary text-xs py-2 px-4 font-bold disabled:opacity-40"
              >
                {actionLoading ? 'Terminating...' : 'TERMINATE INSTANCE'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
