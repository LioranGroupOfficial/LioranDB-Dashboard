'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Server,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  X,
  Edit2,
  Trash2,
  RotateCw,
  Database,
  ExternalLink,
  Shield,
  Layers,
  Network,
  Cpu,
  Globe,
  Radio,
  Check,
  Activity,
} from 'lucide-react';

export interface AdminHostingNodeItem {
  _id: string;
  name: string;
  slug: string;
  region: string;
  dbUrl: string;
  port: number;
  protocol: 'http' | 'https';
  httpPort: number;
  grpcUrl: string;
  grpcPort: number;
  controlPlaneEndpoint?: string;
  healthStatus?: 'HEALTHY' | 'DEGRADED' | 'UNREACHABLE' | 'AUTHENTICATION_FAILED' | 'UNKNOWN';
  serverIdentity?: string;
  serverVersion?: string;
  allocationMode?: string;
  defaultRootUsername: string;
  defaultRootPassword?: string;
  status: 'AVAILABLE' | 'ACTIVE' | 'RESERVED' | 'PROVISIONING' | 'ASSIGNED' | 'DRAINING' | 'RESETTING' | 'FAILED' | 'QUARANTINED' | 'MAINTENANCE' | 'DISABLED';
  maxCapacity?: number;
  currentAssignedCount: number;
  assignedInstanceName?: string;
  assignedInstanceStatus?: string;
  assignedDatabaseId?: string;
  lastHealthCheckAt?: string;
  quarantineReason?: string;
  cleanupFailureReason?: string;
  lastResetAt?: string;
  lastCredentialRotationAt?: string;
  notes?: string;
  isDefault: boolean;
  createdAt: string;
}

interface Props {
  initialNodes: AdminHostingNodeItem[];
}

export default function AdminHostingClient({ initialNodes }: Props) {
  const router = useRouter();
  const [nodes, setNodes] = useState<AdminHostingNodeItem[]>(initialNodes);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [loading, setLoading] = useState(false);

  // Modals
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editingNode, setEditingNode] = useState<AdminHostingNodeItem | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Testing & Diagnostics
  const [testingNodeId, setTestingNodeId] = useState<string | null>(null);
  const [purgingNodeId, setPurgingNodeId] = useState<string | null>(null);
  const [togglingNodeId, setTogglingNodeId] = useState<string | null>(null);
  const [testingForm, setTestingForm] = useState(false);
  const [formTestResult, setFormTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [diagnosticModal, setDiagnosticModal] = useState<{
    open: boolean;
    nodeName: string;
    loading: boolean;
    data?: any;
    error?: string;
  } | null>(null);

  // Form State
  const [formName, setFormName] = useState('');
  const [formSlug, setFormSlug] = useState('');
  const [formRegion, setFormRegion] = useState('Asia (Mumbai)');
  const [formDbUrl, setFormDbUrl] = useState('');
  const [formPort, setFormPort] = useState(27018);
  const [formProtocol, setFormProtocol] = useState<'http' | 'https'>('http');
  const [formHttpPort, setFormHttpPort] = useState(27018);
  const [formControlPlaneEndpoint, setFormControlPlaneEndpoint] = useState('');
  const [formControlPlaneToken, setFormControlPlaneToken] = useState('');
  const [formGrpcUrl, setFormGrpcUrl] = useState('');
  const [formGrpcPort, setFormGrpcPort] = useState(27019);
  const [formRootUser, setFormRootUser] = useState('admin');
  const [formStatus, setFormStatus] = useState<AdminHostingNodeItem['status']>('AVAILABLE');
  const [formNotes, setFormNotes] = useState('');
  const [formIsDefault, setFormIsDefault] = useState(false);

  // Refresh
  async function refreshNodes() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/hosting');
      const data = await res.json();
      if (data.success && data.nodes) {
        setNodes(data.nodes);
      }
      router.refresh();
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  // Live Node Diagnostic Test
  async function handleTestNode(node: AdminHostingNodeItem) {
    setTestingNodeId(node._id);
    setDiagnosticModal({
      open: true,
      nodeName: node.name,
      loading: true,
    });
    try {
      const res = await fetch(`/api/admin/hosting/${node._id}/test`, { method: 'POST' });
      const data = await res.json();
      if (data.healthy || (data.success && data.healthStatus === 'HEALTHY')) {
        setDiagnosticModal({
          open: true,
          nodeName: node.name,
          loading: false,
          data,
        });
        setFeedbackMsg({
          type: 'success',
          text: `Node "${node.name}" is healthy and connected (${data.latencyMs ?? 0}ms).`,
        });
      } else {
        setDiagnosticModal({
          open: true,
          nodeName: node.name,
          loading: false,
          error: data.error || 'Connection check failed',
          data,
        });
        setFeedbackMsg({
          type: 'error',
          text: `Node "${node.name}" test failed: ${data.error || 'Unknown error'}`,
        });
      }
      await refreshNodes();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Network error testing node';
      setDiagnosticModal({
        open: true,
        nodeName: node.name,
        loading: false,
        error: msg,
      });
      setFeedbackMsg({ type: 'error', text: msg });
    } finally {
      setTestingNodeId(null);
    }
  }

  // Administrator-Authorized Purge & Reset
  async function handlePurgeNode(node: AdminHostingNodeItem) {
    if (
      !confirm(
        `Are you sure you want to reset and purge hosting node "${node.name}"?\n\nThis is a destructive action that will perform an authoritative server reset, wipe all customer data, and regenerate root credentials.`
      )
    ) {
      return;
    }

    setPurgingNodeId(node._id);
    setLoading(true);
    setFeedbackMsg(null);
    try {
      const res = await fetch(`/api/admin/hosting/${node._id}/purge`, { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        setFeedbackMsg({
          type: 'success',
          text: `Node "${node.name}" successfully reset and returned to AVAILABLE.`,
        });
      } else {
        setFeedbackMsg({
          type: 'error',
          text: `Reset on "${node.name}" failed: ${data.error || 'Rust server reset failed.'}`,
        });
      }
      await refreshNodes();
    } catch (err: unknown) {
      setFeedbackMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Network error executing reset',
      });
    } finally {
      setPurgingNodeId(null);
      setLoading(false);
    }
  }

  // Toggle Node Enabled / Disabled
  async function handleToggleDisableNode(node: AdminHostingNodeItem) {
    const isCurrentlyDisabled = node.status === 'DISABLED';
    if (!isCurrentlyDisabled && node.currentAssignedCount > 0) {
      alert(`Cannot disable hosting node "${node.name}" because it currently has an active customer database assigned.`);
      return;
    }

    const actionText = isCurrentlyDisabled ? 'enable' : 'disable';
    if (!confirm(`Are you sure you want to ${actionText} hosting node "${node.name}"?`)) {
      return;
    }

    setTogglingNodeId(node._id);
    setLoading(true);
    setFeedbackMsg(null);
    try {
      const newStatus = isCurrentlyDisabled ? 'AVAILABLE' : 'DISABLED';
      const res = await fetch(`/api/admin/hosting/${node._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed to ${actionText} node`);

      setFeedbackMsg({
        type: 'success',
        text: `Hosting node "${node.name}" has been ${isCurrentlyDisabled ? 'enabled' : 'disabled'}.`,
      });
      await refreshNodes();
    } catch (err: unknown) {
      setFeedbackMsg({
        type: 'error',
        text: err instanceof Error ? err.message : `Failed to ${actionText} node`,
      });
    } finally {
      setTogglingNodeId(null);
      setLoading(false);
    }
  }

  // Live Endpoint Test in Form
  async function handleTestFormEndpoint() {
    setTestingForm(true);
    setFormTestResult(null);
    try {
      const res = await fetch('/api/admin/hosting/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: formControlPlaneEndpoint.trim() || undefined,
          host: formDbUrl.trim(),
          port: Number(formPort),
          protocol: formProtocol,
          token: formControlPlaneToken.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (data.healthy || data.success) {
        setFormTestResult({
          success: true,
          message: `Connected successfully! Instance: ${data.serverIdentity || 'node-1'} (v${data.serverVersion || '2.4.1'}) in ${data.latencyMs}ms`,
        });
      } else {
        setFormTestResult({
          success: false,
          message: data.error || 'Connection failed to control plane',
        });
      }
    } catch (err: unknown) {
      setFormTestResult({
        success: false,
        message: err instanceof Error ? err.message : 'Network error testing endpoint',
      });
    } finally {
      setTestingForm(false);
    }
  }

  // Endpoint input auto-parsers
  function handleDbUrlChange(val: string) {
    let clean = val.trim();
    // If user enters host:port (like 127.0.0.1:27018 or localhost:27018), auto-split
    clean = clean.replace(/^(https?:\/\/|grpc:\/\/|liorandb:\/\/|mongodb:\/\/)/i, '').split('/')[0].split('?')[0];
    if (clean.includes(':')) {
      const [h, p] = clean.split(':');
      setFormDbUrl(h);
      const parsed = parseInt(p, 10);
      if (!isNaN(parsed) && parsed > 0 && parsed <= 65535) {
        setFormPort(parsed);
      }
      return;
    }
    setFormDbUrl(val);
  }

  function handleGrpcUrlChange(val: string) {
    let clean = val.trim();
    // If user enters host:port (like 127.0.0.1:27019 or localhost:50051), auto-split
    clean = clean.replace(/^(https?:\/\/|grpc:\/\/|liorandb:\/\/|mongodb:\/\/)/i, '').split('/')[0].split('?')[0];
    if (clean.includes(':')) {
      const [h, p] = clean.split(':');
      setFormGrpcUrl(h);
      const parsed = parseInt(p, 10);
      if (!isNaN(parsed) && parsed > 0 && parsed <= 65535) {
        setFormGrpcPort(parsed);
      }
      return;
    }
    setFormGrpcUrl(val);
  }

  function applyLocalhostPreset() {
    setFormName('Localhost Node (127.0.0.1)');
    setFormSlug('localhost-node-01');
    setFormRegion('Localhost / Development');
    setFormDbUrl('127.0.0.1');
    setFormPort(27018);
    setFormProtocol('http');
    setFormHttpPort(27018);
    setFormControlPlaneEndpoint('http://127.0.0.1:27018');
    setFormControlPlaneToken('');
    setFormGrpcUrl('127.0.0.1');
    setFormGrpcPort(27019);
    setFormRootUser('admin');
    setFormStatus('AVAILABLE');
    setFormNotes('Localhost dedicated development database cluster on 127.0.0.1');
    if (nodes.length === 0) setFormIsDefault(true);
  }

  // Open Add Modal
  function openAddModal() {
    setFormName('');
    setFormSlug('');
    setFormRegion('Asia (Mumbai)');
    setFormDbUrl('');
    setFormPort(27018);
    setFormProtocol('http');
    setFormHttpPort(27018);
    setFormControlPlaneEndpoint('');
    setFormControlPlaneToken('');
    setFormGrpcUrl('');
    setFormGrpcPort(27019);
    setFormRootUser('admin');
    setFormStatus('AVAILABLE');
    setFormNotes('');
    setFormIsDefault(nodes.length === 0);
    setAddModalOpen(true);
  }

  // Open Edit Modal
  function openEditModal(node: AdminHostingNodeItem) {
    setEditingNode(node);
    setFormName(node.name);
    setFormSlug(node.slug);
    setFormRegion(node.region);
    setFormDbUrl(node.dbUrl);
    setFormPort(node.port);
    setFormProtocol(node.protocol);
    setFormHttpPort(node.httpPort);
    setFormControlPlaneEndpoint(node.controlPlaneEndpoint || '');
    setFormControlPlaneToken('');
    setFormGrpcUrl(node.grpcUrl);
    setFormGrpcPort(node.grpcPort);
    setFormRootUser(node.defaultRootUsername);
    setFormStatus(node.status);
    setFormNotes(node.notes || '');
    setFormIsDefault(node.isDefault);
  }

  // Save Node (Create or Update)
  async function handleSaveNode(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setFeedbackMsg(null);

    const payload = {
      name: formName.trim(),
      slug: formSlug.trim() || undefined,
      region: formRegion.trim(),
      dbUrl: formDbUrl.trim(),
      port: Number(formPort),
      protocol: formProtocol,
      httpPort: Number(formHttpPort),
      controlPlaneEndpoint: formControlPlaneEndpoint.trim() || undefined,
      controlPlaneToken: formControlPlaneToken.trim() || undefined,
      grpcUrl: formGrpcUrl.trim(),
      grpcPort: Number(formGrpcPort),
      defaultRootUsername: formRootUser.trim() || 'admin',
      status: formStatus,
      maxCapacity: 1,
      notes: formNotes.trim(),
      isDefault: formIsDefault,
    };

    try {
      if (editingNode) {
        // Update
        const res = await fetch(`/api/admin/hosting/${editingNode._id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to update node');
        setFeedbackMsg({ type: 'success', text: `Hosting node "${formName}" updated successfully.` });
        setEditingNode(null);
      } else {
        // Create
        const res = await fetch('/api/admin/hosting', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to create node');
        setFeedbackMsg({ type: 'success', text: `Hosting node "${formName}" created successfully.` });
        setAddModalOpen(false);
      }

      await refreshNodes();
    } catch (err: unknown) {
      setFeedbackMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Operation failed',
      });
    } finally {
      setLoading(false);
    }
  }

  // Delete Node
  async function handleDeleteNode(id: string, name: string) {
    if (!confirm(`Are you sure you want to delete hosting node "${name}"?`)) return;

    setLoading(true);
    setFeedbackMsg(null);
    try {
      const res = await fetch(`/api/admin/hosting/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete node');

      setFeedbackMsg({ type: 'success', text: `Hosting node "${name}" deleted.` });
      await refreshNodes();
    } catch (err: unknown) {
      setFeedbackMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Delete failed',
      });
    } finally {
      setLoading(false);
    }
  }

  // Filtered nodes
  const filteredNodes = useMemo(() => {
    const q = search.trim().toLowerCase();
    return nodes.filter((node) => {
      const matchesSearch =
        !q ||
        node.name.toLowerCase().includes(q) ||
        node.dbUrl.toLowerCase().includes(q) ||
        node.grpcUrl.toLowerCase().includes(q) ||
        node.region.toLowerCase().includes(q);

      const matchesStatus = statusFilter === 'ALL' || node.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [nodes, search, statusFilter]);

  // Stats
  const stats = useMemo(() => {
    const totalNodes = nodes.length;
    const healthyNodes = nodes.filter((n) => n.healthStatus === 'HEALTHY' && n.status !== 'QUARANTINED').length;
    const availableNodes = nodes.filter(
      (n) =>
        (n.status === 'AVAILABLE' || n.status === 'ACTIVE') &&
        n.currentAssignedCount === 0 &&
        !n.quarantineReason
    ).length;
    const totalAssigned = nodes.filter((n) => n.currentAssignedCount > 0 || n.status === 'ASSIGNED').length;

    return { totalNodes, healthyNodes, availableNodes, totalAssigned };
  }, [nodes]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-strong)] tracking-tight">Database Hosting Nodes</h1>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Dedicated 1-server-per-user Rust infrastructure: manage authoritative control planes, gRPC listeners, credentials, and real-time health.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={loading}
            onClick={refreshNodes}
            className="btn-secondary py-2 px-3 text-xs inline-flex items-center gap-1.5"
          >
            <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            type="button"
            onClick={openAddModal}
            className="btn-primary py-2 px-4 min-h-[38px] text-xs inline-flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Add Hosting Node</span>
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedbackMsg && (
        <div className="p-3.5 rounded-[7px] bg-[var(--surface-soft)] border border-[var(--border-strong)] text-xs text-[var(--text-strong)] flex items-center justify-between animate-in fade-in duration-150">
          <div className="flex items-center gap-2">
            {feedbackMsg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-[var(--text-strong)] shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-[var(--text-strong)] shrink-0" />
            )}
            <span className="font-medium">{feedbackMsg.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackMsg(null)}
            className="text-[var(--text-muted)] hover:text-[var(--text-strong)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="flex items-center justify-between text-[var(--text-muted)]">
            <span className="text-xs font-mono uppercase tracking-wider">Total Hosting Nodes</span>
            <Server className="w-4 h-4 opacity-70" />
          </div>
          <p className="text-2xl font-bold text-[var(--text-strong)] font-mono mt-2">{stats.totalNodes}</p>
          <p className="text-[11px] text-[var(--text-muted)] mt-1 font-mono">
            Registered Rust database nodes
          </p>
        </div>

        <div className="card p-4">
          <div className="flex items-center justify-between text-[var(--text-muted)]">
            <span className="text-xs font-mono uppercase tracking-wider">Healthy Control Plane</span>
            <CheckCircle2 className="w-4 h-4 opacity-70 text-[var(--text-strong)]" />
          </div>
          <p className="text-2xl font-bold text-[var(--text-strong)] font-mono mt-2">{stats.healthyNodes}</p>
          <p className="text-[11px] text-[var(--text-muted)] mt-1 font-mono">
            Verified /v1/admin/status responders
          </p>
        </div>

        <div className="card p-4">
          <div className="flex items-center justify-between text-[var(--text-muted)]">
            <span className="text-xs font-mono uppercase tracking-wider">Available (Unassigned)</span>
            <Layers className="w-4 h-4 opacity-70" />
          </div>
          <p className="text-2xl font-bold text-[var(--text-strong)] font-mono mt-2">{stats.availableNodes}</p>
          <p className="text-[11px] text-[var(--text-muted)] mt-1 font-mono">
            Ready for instant dedicated provisioning
          </p>
        </div>

        <div className="card p-4">
          <div className="flex items-center justify-between text-[var(--text-muted)]">
            <span className="text-xs font-mono uppercase tracking-wider">Assigned Dedicated</span>
            <Database className="w-4 h-4 opacity-70" />
          </div>
          <p className="text-2xl font-bold text-[var(--text-strong)] font-mono mt-2">{stats.totalAssigned}</p>
          <p className="text-[11px] text-[var(--text-muted)] mt-1 font-mono">
            Exclusive 1:1 customer allocation
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="card p-4 flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search nodes by name, DB URL, gRPC URL, control plane, or region..."
            className="input-field pl-9 w-full"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="flex items-center gap-1.5 px-3 py-2 bg-[var(--surface-soft)] border border-[var(--border)] rounded-[7px] text-xs text-[var(--text-secondary)]">
            <span className="font-mono text-[11px]">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter hosting nodes by status"
              className="bg-transparent text-[var(--text-strong)] focus:outline-hidden cursor-pointer font-medium"
            >
              <option value="ALL" className="bg-[var(--surface)] text-[var(--text-primary)]">All</option>
              <option value="AVAILABLE" className="bg-[var(--surface)] text-[var(--text-primary)]">Available</option>
              <option value="ASSIGNED" className="bg-[var(--surface)] text-[var(--text-primary)]">Assigned</option>
              <option value="ACTIVE" className="bg-[var(--surface)] text-[var(--text-primary)]">Active</option>
              <option value="RESERVED" className="bg-[var(--surface)] text-[var(--text-primary)]">Reserved</option>
              <option value="PROVISIONING" className="bg-[var(--surface)] text-[var(--text-primary)]">Provisioning</option>
              <option value="DRAINING" className="bg-[var(--surface)] text-[var(--text-primary)]">Draining</option>
              <option value="RESETTING" className="bg-[var(--surface)] text-[var(--text-primary)]">Resetting</option>
              <option value="FAILED" className="bg-[var(--surface)] text-[var(--text-primary)]">Failed</option>
              <option value="MAINTENANCE" className="bg-[var(--surface)] text-[var(--text-primary)]">Maintenance</option>
              <option value="DISABLED" className="bg-[var(--surface)] text-[var(--text-primary)]">Disabled</option>
            </select>
          </div>
        </div>
      </div>

      {/* Hosting Nodes Table */}
      <div className="card p-0 overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[var(--surface-2)] text-[var(--text-muted)] uppercase font-mono border-b border-[var(--border)]">
              <tr>
                <th className="px-4 py-3 font-medium">Node</th>
                <th className="px-4 py-3 font-medium">Endpoint</th>
                <th className="px-4 py-3 font-medium">Health</th>
                <th className="px-4 py-3 font-medium">Allocation</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)] font-mono">
              {filteredNodes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-[var(--text-muted)] text-xs font-sans">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Server className="w-6 h-6 opacity-40" />
                      <span>No hosting nodes found. Click &quot;Add Hosting Node&quot; to configure database infrastructure.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredNodes.map((node) => {
                  const isAssigned = node.currentAssignedCount > 0;
                  const cpEndpoint = node.controlPlaneEndpoint || `${node.protocol || 'http'}://${node.dbUrl}:${node.httpPort || 27018}`;

                  return (
                    <tr key={node._id} className="hover:bg-[var(--surface-soft)] transition-colors">
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-xs font-sans text-[var(--text-strong)]">{node.name}</span>
                          {node.isDefault && (
                            <span className="px-1.5 py-0.5 rounded-[4px] text-[9px] font-mono bg-[var(--surface-2)] text-[var(--text-strong)] border border-[var(--border-strong)] font-bold">
                              DEFAULT
                            </span>
                          )}
                          {(node.dbUrl === '127.0.0.1' || node.dbUrl === 'localhost' || node.dbUrl.startsWith('127.') || node.dbUrl === '0.0.0.0') && (
                            <span className="px-1.5 py-0.5 rounded-[4px] text-[9px] font-mono bg-[var(--surface-soft)] text-[var(--text-strong)] border border-[var(--border)] font-semibold">
                              LOCAL
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-[var(--text-muted)] mt-0.5 font-sans">
                          {node.region} • <span className="font-mono">{node.slug}</span>
                          {node.serverIdentity && (
                            <span className="block text-[10px] text-[var(--text-muted)] opacity-80 font-mono">
                              ID: {node.serverIdentity} (v{node.serverVersion || '2.4.1'})
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-3.5 text-xs">
                        <div className="text-[var(--text-strong)] font-mono">
                          DB: {node.dbUrl}:{node.port}
                        </div>
                        <div className="text-[11px] text-[var(--text-muted)] font-mono">
                          gRPC: {node.grpcUrl}:{node.grpcPort}
                        </div>
                        <div className="text-[10px] text-[var(--text-muted)] font-mono truncate max-w-[180px]" title={cpEndpoint}>
                          CP: {cpEndpoint}
                        </div>
                      </td>

                      <td className="px-4 py-3.5 text-xs">
                        <div>
                          <span
                            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[4px] text-[9px] font-mono font-semibold uppercase tracking-wider ${
                              node.healthStatus === 'HEALTHY'
                                ? 'bg-[var(--surface-2)] text-[var(--text-strong)] border border-[var(--border-strong)]'
                                : 'bg-[var(--surface-soft)] text-[var(--text-muted)] border border-[var(--border)]'
                            }`}
                          >
                            {node.healthStatus || 'UNKNOWN'}
                          </span>
                        </div>
                        {node.lastHealthCheckAt && (
                          <div className="text-[10px] text-[var(--text-muted)] mt-1 font-mono">
                            Checked: {new Date(node.lastHealthCheckAt).toLocaleTimeString()}
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3.5">
                        {node.status === 'QUARANTINED' ? (
                          <div className="space-y-1">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] text-[10px] font-mono bg-red-500/10 text-red-500 dark:text-red-400 border border-red-500/20 font-bold">
                              <AlertCircle className="w-3 h-3 text-red-500" />
                              QUARANTINED (0/1)
                            </span>
                            <div className="text-[10px] text-red-500 dark:text-red-400 font-sans truncate max-w-[140px]" title={node.quarantineReason || `${node.name} unavailable: reset required.`}>
                              Reset Required
                            </div>
                          </div>
                        ) : node.status === 'RESETTING' ? (
                          <div className="space-y-1">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] text-[10px] font-mono bg-[var(--surface-soft)] text-[var(--text-strong)] border border-[var(--border)] font-semibold">
                              <RotateCw className="w-3 h-3 animate-spin text-[var(--text-muted)]" />
                              RESETTING (0/1)
                            </span>
                            <div className="text-[10px] text-[var(--text-muted)] font-mono">
                              Authoritative Reset
                            </div>
                          </div>
                        ) : node.status === 'DISABLED' ? (
                          <div className="space-y-1">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] text-[10px] font-mono bg-[var(--surface-soft)] text-[var(--text-muted)] border border-[var(--border)] font-semibold">
                              DISABLED (0/1)
                            </span>
                            <div className="text-[10px] text-[var(--text-muted)] font-mono">
                              Administratively Off
                            </div>
                          </div>
                        ) : node.status === 'PROVISIONING' ? (
                          <div className="space-y-1">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] text-[10px] font-mono bg-[var(--surface-soft)] text-[var(--text-strong)] border border-[var(--border)] font-semibold">
                              <RotateCw className="w-3 h-3 animate-spin text-[var(--text-muted)]" />
                              RESERVED (1/1)
                            </span>
                            <div className="text-[11px] text-[var(--text-muted)] truncate max-w-[140px]" title={node.assignedInstanceName || 'Provisioning'}>
                              {node.assignedInstanceName || 'Provisioning'}
                            </div>
                          </div>
                        ) : isAssigned ? (
                          <div className="space-y-1">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] text-[10px] font-mono bg-[var(--surface-2)] text-[var(--text-strong)] border border-[var(--border-strong)] font-bold">
                              <Database className="w-3 h-3" />
                              ASSIGNED (1/1)
                            </span>
                            <div className="text-[11px] text-[var(--text-muted)] truncate max-w-[140px]" title={node.assignedInstanceName || 'Dedicated instance'}>
                              {node.assignedInstanceName || 'Dedicated Instance'}
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] text-[10px] font-mono bg-[var(--surface-soft)] text-[var(--text-strong)] border border-[var(--border)] font-medium">
                              <CheckCircle2 className="w-3 h-3 text-[var(--text-strong)]" />
                              AVAILABLE (0/1)
                            </span>
                            <div className="text-[10px] text-[var(--text-muted)] font-mono">
                              Unassigned • Ready
                            </div>
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="space-y-1">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-[4px] text-[11px] font-mono uppercase tracking-wider ${
                              node.status === 'AVAILABLE' || node.status === 'ACTIVE'
                                ? 'bg-[var(--surface-2)] text-[var(--text-strong)] border border-[var(--border-strong)] font-semibold'
                                : node.status === 'ASSIGNED'
                                ? 'bg-[var(--surface-soft)] text-[var(--text-strong)] border border-[var(--border)]'
                                : node.status === 'PROVISIONING' || node.status === 'RESETTING'
                                ? 'bg-[var(--surface-soft)] text-[var(--text-strong)] border border-[var(--border)] font-semibold'
                                : node.status === 'QUARANTINED'
                                ? 'bg-red-500/10 text-red-500 dark:text-red-400 border border-red-500/20 font-bold'
                                : 'text-[var(--text-muted)] border border-[var(--border)]'
                            }`}
                          >
                            {node.status}
                          </span>
                          {node.status === 'QUARANTINED' && (
                            <div
                              className="text-[10px] text-red-500 dark:text-red-400 max-w-[200px] font-sans break-words mt-1"
                              title={node.quarantineReason || `${node.name} unavailable: reset required.`}
                            >
                              {node.quarantineReason?.includes('unavailable') || node.quarantineReason?.includes('reset required')
                                ? node.quarantineReason
                                : `${node.name} unavailable: reset required.`}
                            </div>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          <button
                            type="button"
                            onClick={() => handleTestNode(node)}
                            disabled={testingNodeId === node._id}
                            title="Test connection to Rust control plane"
                            className="btn-secondary px-2 py-1 text-[11px] inline-flex items-center gap-1 text-[var(--text-strong)]"
                          >
                            <Activity className={`w-3 h-3 ${testingNodeId === node._id ? 'animate-spin text-[var(--text-muted)]' : 'text-[var(--text-strong)]'}`} />
                            <span>{testingNodeId === node._id ? 'Testing...' : 'Test'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditModal(node)}
                            title="Edit node parameters"
                            className="btn-secondary px-2 py-1 text-[11px] inline-flex items-center gap-1"
                          >
                            <Edit2 className="w-3 h-3" />
                            <span>Edit</span>
                          </button>
                          {node.currentAssignedCount === 0 && (
                            <button
                              type="button"
                              onClick={() => handlePurgeNode(node)}
                              disabled={purgingNodeId === node._id}
                              title="Destructive factory reset: wipes tenant data and regenerates root credentials"
                              className="btn-secondary px-2 py-1 text-[11px] inline-flex items-center gap-1 text-[var(--text-strong)]"
                            >
                              <Shield className={`w-3 h-3 ${purgingNodeId === node._id ? 'animate-spin text-[var(--text-muted)]' : ''}`} />
                              <span>{purgingNodeId === node._id ? 'Resetting...' : 'Reset/Purge'}</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleToggleDisableNode(node)}
                            disabled={togglingNodeId === node._id || (node.status !== 'DISABLED' && node.currentAssignedCount > 0)}
                            title={
                              node.status === 'DISABLED'
                                ? 'Enable hosting node for deployments'
                                : node.currentAssignedCount > 0
                                ? 'Cannot disable node with active instances'
                                : 'Disable hosting node'
                            }
                            className="btn-secondary px-2 py-1 text-[11px] inline-flex items-center gap-1 disabled:opacity-40"
                          >
                            <span>{node.status === 'DISABLED' ? 'Enable' : 'Disable'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteNode(node._id, node.name)}
                            disabled={node.currentAssignedCount > 0}
                            title={node.currentAssignedCount > 0 ? 'Cannot delete node with active instances' : 'Delete node'}
                            className="btn-secondary px-2 py-1 text-[11px] text-[var(--text-muted)] hover:text-[var(--text-strong)] disabled:opacity-40"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE / EDIT HOSTING NODE MODAL */}
      {(addModalOpen || editingNode) && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="card max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <div className="flex items-center gap-2">
                <Server className="w-5 h-5 text-[var(--text-strong)]" />
                <h3 className="text-base font-bold text-[var(--text-strong)]">
                  {editingNode ? `Edit Hosting Node: ${editingNode.name}` : 'Add New Database Hosting Node'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setAddModalOpen(false);
                  setEditingNode(null);
                }}
                className="text-[var(--text-muted)] hover:text-[var(--text-strong)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {!editingNode && (
              <div className="p-3 bg-[var(--surface-soft)] border border-[var(--border)] rounded-[7px] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="text-xs">
                  <span className="font-bold text-[var(--text-strong)] flex items-center gap-1.5">
                    <span>⚡ Quick Localhost DB Preset</span>
                  </span>
                  <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                    Instantly fill in local development database cluster endpoints (127.0.0.1:27018).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={applyLocalhostPreset}
                  className="btn-secondary py-1.5 px-3 text-xs shrink-0 self-start sm:self-auto font-medium"
                >
                  Use Localhost Preset
                </button>
              </div>
            )}

            <form onSubmit={handleSaveNode} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Node Name */}
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-[var(--text-muted)] mb-1">
                    Node Cluster Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => {
                      setFormName(e.target.value);
                      if (!editingNode && !formSlug) {
                        setFormSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'));
                      }
                    }}
                    placeholder="e.g. Localhost Node or Mumbai Primary 01"
                    className="input-field w-full text-xs"
                  />
                </div>

                {/* Slug */}
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-[var(--text-muted)] mb-1">
                    Slug / Identifier
                  </label>
                  <input
                    type="text"
                    value={formSlug}
                    onChange={(e) => setFormSlug(e.target.value)}
                    placeholder="e.g. localhost-node-01 or mumbai-node-01"
                    className="input-field w-full text-xs font-mono"
                  />
                </div>

                {/* Region */}
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-[var(--text-muted)] mb-1">
                    Region
                  </label>
                  <input
                    type="text"
                    list="region-presets"
                    value={formRegion}
                    onChange={(e) => setFormRegion(e.target.value)}
                    placeholder="e.g. Localhost / Development or Asia (Mumbai)"
                    className="input-field w-full text-xs"
                  />
                  <datalist id="region-presets">
                    <option value="Localhost / Development" />
                    <option value="Asia (Mumbai)" />
                    <option value="On-Premise / Self-Hosted" />
                    <option value="US East (N. Virginia)" />
                    <option value="EU Central (Frankfurt)" />
                    <option value="Singapore" />
                  </datalist>
                </div>

                {/* Status */}
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-[var(--text-muted)] mb-1">
                    Node Status
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as unknown as typeof formStatus)}
                    className="input-field w-full text-xs font-medium cursor-pointer"
                  >
                    <option value="AVAILABLE">AVAILABLE (Accepting Deployments)</option>
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="DRAINING">DRAINING (No New Instances)</option>
                    <option value="MAINTENANCE">MAINTENANCE (Offline for Updates)</option>
                    <option value="DISABLED">DISABLED (Archived)</option>
                  </select>
                </div>
              </div>

              {/* Endpoints & Networking */}
              <div className="p-3.5 rounded-[7px] bg-[var(--surface-soft)] border border-[var(--border)] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[var(--text-strong)] block">
                    Control Plane &amp; Networking Endpoints
                  </span>
                  <span className="text-[10px] text-[var(--text-muted)] font-mono">
                    Rust HTTP / gRPC / Control Plane
                  </span>
                </div>

                {/* Private Control Plane Endpoint */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-mono uppercase text-[var(--text-muted)] mb-1">
                      Private Control Plane Endpoint
                    </label>
                    <input
                      type="text"
                      value={formControlPlaneEndpoint}
                      onChange={(e) => setFormControlPlaneEndpoint(e.target.value)}
                      placeholder="http://127.0.0.1:27018 or https://cp.internal"
                      className="input-field w-full text-xs font-mono"
                    />
                    <span className="text-[10px] text-[var(--text-muted)] mt-0.5 block">
                      Leave empty to auto-derive from protocol, host, and HTTP port.
                    </span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-mono uppercase text-[var(--text-muted)] mb-1">
                      Node Control Plane Token (Optional)
                    </label>
                    <input
                      type="password"
                      value={formControlPlaneToken}
                      onChange={(e) => setFormControlPlaneToken(e.target.value)}
                      placeholder="Leave empty to use env LIORANDB_CONTROL_PLANE_TOKEN"
                      className="input-field w-full text-xs font-mono"
                    />
                    <span className="text-[10px] text-[var(--text-muted)] mt-0.5 block">
                      Encrypted with AES-256-GCM before storage.
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Database Host */}
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-mono uppercase text-[var(--text-muted)] mb-1">
                      Database Host / DB URL *
                    </label>
                    <input
                      type="text"
                      required
                      value={formDbUrl}
                      onChange={(e) => handleDbUrlChange(e.target.value)}
                      placeholder="127.0.0.1 or db-mumbai-01.liorandb.net"
                      className="input-field w-full text-xs font-mono"
                    />
                  </div>

                  {/* Database Port */}
                  <div>
                    <label className="block text-[11px] font-mono uppercase text-[var(--text-muted)] mb-1">
                      DB Native Port
                    </label>
                    <input
                      type="number"
                      required
                      value={formPort}
                      onChange={(e) => setFormPort(Number(e.target.value))}
                      placeholder="27018"
                      className="input-field w-full text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* gRPC URL */}
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-mono uppercase text-[var(--text-muted)] mb-1">
                      gRPC URL *
                    </label>
                    <input
                      type="text"
                      required
                      value={formGrpcUrl}
                      onChange={(e) => handleGrpcUrlChange(e.target.value)}
                      placeholder="127.0.0.1 or grpc.mumbai-01.liorandb.net"
                      className="input-field w-full text-xs font-mono"
                    />
                  </div>

                  {/* gRPC Port */}
                  <div>
                    <label className="block text-[11px] font-mono uppercase text-[var(--text-muted)] mb-1">
                      gRPC Port
                    </label>
                    <input
                      type="number"
                      required
                      value={formGrpcPort}
                      onChange={(e) => setFormGrpcPort(Number(e.target.value))}
                      placeholder="27019"
                      className="input-field w-full text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Protocol */}
                  <div>
                    <label className="block text-[11px] font-mono uppercase text-[var(--text-muted)] mb-1">
                      HTTP Protocol
                    </label>
                    <select
                      value={formProtocol}
                      onChange={(e) => setFormProtocol(e.target.value as 'http' | 'https')}
                      className="input-field w-full text-xs font-mono cursor-pointer"
                    >
                      <option value="http">HTTP (Standard)</option>
                      <option value="https">HTTPS (Secure / TLS)</option>
                    </select>
                  </div>

                  {/* HTTP Port */}
                  <div>
                    <label className="block text-[11px] font-mono uppercase text-[var(--text-muted)] mb-1">
                      HTTP / Control Plane Port
                    </label>
                    <input
                      type="number"
                      required
                      value={formHttpPort}
                      onChange={(e) => setFormHttpPort(Number(e.target.value))}
                      placeholder="27018"
                      className="input-field w-full text-xs font-mono"
                    />
                  </div>
                </div>

                {/* Live Test Endpoint Action */}
                <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-t border-[var(--border)]">
                  <button
                    type="button"
                    disabled={testingForm || !formDbUrl}
                    onClick={handleTestFormEndpoint}
                    className="btn-secondary py-1.5 px-3 text-xs inline-flex items-center gap-1.5 self-start sm:self-auto disabled:opacity-40"
                  >
                    <Activity className={`w-3.5 h-3.5 ${testingForm ? 'animate-spin text-[var(--text-muted)]' : 'text-[var(--text-strong)]'}`} />
                    <span>{testingForm ? 'Testing Connection...' : 'Test Endpoint Connection'}</span>
                  </button>

                  {formTestResult && (
                    <div
                      className={`text-[11px] font-mono px-2.5 py-1 rounded-[4px] border ${
                        formTestResult.success
                          ? 'bg-[var(--surface-2)] text-[var(--text-strong)] border-[var(--border-strong)] font-semibold'
                          : 'bg-[var(--surface-soft)] text-[var(--text-secondary)] border-[var(--border)]'
                      }`}
                    >
                      {formTestResult.message}
                    </div>
                  )}
                </div>
              </div>

              {/* Credentials & Options */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-[var(--text-muted)] mb-1">
                    Default Root Username
                  </label>
                  <input
                    type="text"
                    required
                    value={formRootUser}
                    onChange={(e) => setFormRootUser(e.target.value)}
                    placeholder="admin"
                    className="input-field w-full text-xs font-mono"
                  />
                </div>

                <div className="flex items-center gap-2 pt-6">
                  <input
                    type="checkbox"
                    id="isDefaultNode"
                    checked={formIsDefault}
                    onChange={(e) => setFormIsDefault(e.target.checked)}
                    className="cursor-pointer accent-black dark:accent-white"
                  />
                  <label htmlFor="isDefaultNode" className="text-xs text-[var(--text-strong)] cursor-pointer font-medium">
                    Set as Default Hosting Node for New Databases
                  </label>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-[var(--text-muted)] mb-1">
                  Internal Operational Notes
                </label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="e.g. Bare metal Rust node provisioned in Equinix Mumbai datacenter DC-2..."
                  className="input-field w-full text-xs font-sans"
                />
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => {
                    setAddModalOpen(false);
                    setEditingNode(null);
                    setFormTestResult(null);
                  }}
                  className="btn-secondary text-xs py-2 px-4"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary text-xs py-2 px-5 inline-flex items-center gap-1.5 disabled:opacity-50"
                >
                  {loading ? <RotateCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>{editingNode ? 'Save Changes' : 'Create Hosting Node'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DIAGNOSTIC TEST MODAL */}
      {diagnosticModal && diagnosticModal.open && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="card max-w-lg w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-[var(--text-strong)]" />
                <h3 className="text-sm font-bold text-[var(--text-strong)]">
                  Live Diagnostic: {diagnosticModal.nodeName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDiagnosticModal(null)}
                className="text-[var(--text-muted)] hover:text-[var(--text-strong)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {diagnosticModal.loading ? (
              <div className="py-8 flex flex-col items-center justify-center gap-3">
                <RotateCw className="w-6 h-6 animate-spin text-[var(--text-strong)]" />
                <p className="text-xs text-[var(--text-muted)] font-mono">
                  Probing Rust control plane `/v1/admin/status`...
                </p>
              </div>
            ) : diagnosticModal.error ? (
              <div className="space-y-3">
                <div className="p-3 bg-[var(--surface-soft)] border border-[var(--border-strong)] rounded-[7px] text-xs text-[var(--text-strong)]">
                  <div className="flex items-center gap-2 font-bold mb-1">
                    <AlertCircle className="w-4 h-4 shrink-0 text-[var(--text-strong)]" />
                    <span>Connection Failed</span>
                  </div>
                  <p className="font-mono text-[11px] text-[var(--text-muted)]">{diagnosticModal.error}</p>
                </div>
                {diagnosticModal.data?.endpoint && (
                  <p className="text-[11px] text-[var(--text-muted)] font-mono">
                    Target Endpoint: {diagnosticModal.data.endpoint}
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="p-3 bg-[var(--surface-2)] border border-[var(--border-strong)] rounded-[7px] text-xs text-[var(--text-strong)]">
                  <div className="flex items-center gap-2 font-bold">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-[var(--text-strong)]" />
                    <span>LioranDB Rust Server Healthy &amp; Online</span>
                  </div>
                  <p className="text-[11px] mt-1 text-[var(--text-muted)] font-mono">
                    Response received in {diagnosticModal.data?.latencyMs}ms. Control plane verified healthy (Status: {diagnosticModal.data?.status || 'AVAILABLE'}, Health: {diagnosticModal.data?.healthStatus || 'HEALTHY'}).
                  </p>
                </div>

                <div className="bg-[var(--surface-soft)] border border-[var(--border)] rounded-[7px] p-3 space-y-2 text-xs font-mono">
                  <div className="flex justify-between">
                    <span className="text-[var(--text-muted)]">Server Identity:</span>
                    <span className="font-bold text-[var(--text-strong)]">{diagnosticModal.data?.serverIdentity || 'node-1'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--text-muted)]">Engine Version:</span>
                    <span className="font-bold text-[var(--text-strong)]">v{diagnosticModal.data?.serverVersion || '2.4.1'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--text-muted)]">Health Status:</span>
                    <span className="text-[var(--text-strong)] font-bold">{diagnosticModal.data?.healthStatus || 'HEALTHY'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--text-muted)]">Allocation Status:</span>
                    <span className="font-bold text-[var(--text-strong)]">{diagnosticModal.data?.status || 'AVAILABLE'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--text-muted)]">Endpoint:</span>
                    <span className="text-[var(--text-secondary)]">{diagnosticModal.data?.endpoint}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--text-muted)]">Databases Count:</span>
                    <span className="text-[var(--text-strong)]">{diagnosticModal.data?.databaseCount ?? 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--text-muted)]">Uptime:</span>
                    <span className="text-[var(--text-strong)]">{diagnosticModal.data?.uptimeSeconds ?? 0}s</span>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => setDiagnosticModal(null)}
                className="btn-secondary text-xs py-1.5 px-4"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
