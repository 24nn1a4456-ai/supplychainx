/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Building2,
  Plus,
  Search,
  Filter,
  Download,
  Upload,
  Edit2,
  Trash2,
  AlertCircle,
  CheckCircle,
  ExternalLink,
  ShieldCheck,
  X,
} from 'lucide-react';
import { DatabaseState, Supplier } from '../../types.ts';

interface SuppliersViewProps {
  state: DatabaseState;
  onRefresh: () => void;
}

export const SuppliersView: React.FC<SuppliersViewProps> = ({ state, onRefresh }) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [tierFilter, setTierFilter] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    contactName: '',
    email: '',
    phone: '',
    country: '',
    city: '',
    lat: 0,
    lng: 0,
    productsSupplied: 'MCU-9021',
    dailyCapacity: 2000,
    leadTimeDays: 3,
    reliabilityScore: 95,
    costPerUnit: 45.0,
    operationalStatus: 'active' as Supplier['operationalStatus'],
    contractTier: 'Primary' as Supplier['contractTier'],
  });

  const filteredSuppliers = state.suppliers.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.code.toLowerCase().includes(search.toLowerCase()) ||
      s.country.toLowerCase().includes(search.toLowerCase()) ||
      s.productsSupplied.some((p) => p.toLowerCase().includes(search.toLowerCase()));

    const matchesStatus = statusFilter === 'all' || s.operationalStatus === statusFilter;
    const matchesTier = tierFilter === 'all' || s.contractTier === tierFilter;

    return matchesSearch && matchesStatus && matchesTier;
  });

  const handleOpenAdd = () => {
    setEditingSupplier(null);
    setFormData({
      code: `SUP-${Math.floor(Math.random() * 900 + 100)}`,
      name: '',
      contactName: '',
      email: '',
      phone: '',
      country: 'United States',
      city: '',
      lat: 37.77,
      lng: -122.41,
      productsSupplied: 'MCU-9021, PMIC-440',
      dailyCapacity: 2500,
      leadTimeDays: 3,
      reliabilityScore: 95,
      costPerUnit: 48.0,
      operationalStatus: 'active',
      contractTier: 'Primary',
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (sup: Supplier) => {
    setEditingSupplier(sup);
    setFormData({
      code: sup.code,
      name: sup.name,
      contactName: sup.contactName,
      email: sup.email,
      phone: sup.phone,
      country: sup.country,
      city: sup.city,
      lat: sup.coordinates.lat,
      lng: sup.coordinates.lng,
      productsSupplied: sup.productsSupplied.join(', '),
      dailyCapacity: sup.dailyCapacity,
      leadTimeDays: sup.leadTimeDays,
      reliabilityScore: sup.reliabilityScore,
      costPerUnit: sup.costPerUnit,
      operationalStatus: sup.operationalStatus,
      contractTier: sup.contractTier,
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      code: formData.code,
      name: formData.name,
      contactName: formData.contactName,
      email: formData.email,
      phone: formData.phone,
      country: formData.country,
      city: formData.city,
      coordinates: { lat: Number(formData.lat), lng: Number(formData.lng) },
      productsSupplied: formData.productsSupplied.split(',').map((s) => s.trim()),
      dailyCapacity: Number(formData.dailyCapacity),
      leadTimeDays: Number(formData.leadTimeDays),
      reliabilityScore: Number(formData.reliabilityScore),
      costPerUnit: Number(formData.costPerUnit),
      operationalStatus: formData.operationalStatus,
      contractTier: formData.contractTier,
    };

    if (editingSupplier) {
      await fetch(`/api/suppliers/${editingSupplier.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } else {
      await fetch('/api/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    }

    setIsModalOpen(false);
    onRefresh();
  };

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Are you sure you want to remove supplier "${name}"?`)) {
      await fetch(`/api/suppliers/${id}`, { method: 'DELETE' });
      onRefresh();
    }
  };

  const handleToggleStatus = async (sup: Supplier) => {
    const nextStatus = sup.operationalStatus === 'active' ? 'disrupted' : 'active';
    await fetch(`/api/suppliers/${sup.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operationalStatus: nextStatus,
        outageReason: nextStatus === 'disrupted' ? 'Manual Operator Disruption Flag' : undefined,
      }),
    });
    onRefresh();
  };

  const handleExportCSV = () => {
    // Route export through secure backend endpoint to protect against formula injection (CWE-1236)
    const link = document.createElement('a');
    link.href = '/api/suppliers/export-csv';
    link.download = 'supply_chain_x_suppliers_secure.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportCSVSubmit = async () => {
    if (!importText.trim()) {
      setImportStatus('Please provide CSV rows or file content.');
      return;
    }
    setIsImporting(true);
    setImportStatus(null);
    try {
      // Parse CSV text into row objects
      const lines = importText.trim().split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (lines.length < 2) {
        setImportStatus('CSV must contain a header row and at least one data row.');
        setIsImporting(false);
        return;
      }
      const headerLine = lines[0];
      const headers = headerLine.split(',').map((h) => h.trim().replace(/^["']|["']$/g, ''));
      const rows: Record<string, any>[] = [];
      for (let i = 1; i < lines.length; i++) {
        // Simple comma split respecting quotes
        const rawVals = lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || lines[i].split(',');
        const vals = rawVals.map((v) => v.trim().replace(/^["']|["']$/g, ''));
        const rowObj: Record<string, any> = {};
        headers.forEach((h, idx) => {
          rowObj[h] = vals[idx] !== undefined ? vals[idx] : '';
        });
        rows.push(rowObj);
      }

      const res = await fetch('/api/suppliers/import-csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rows,
          managerRole: 'Supply Chain Analyst',
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setImportStatus(`Successfully imported ${data.importedCount} supplier(s)!`);
        setTimeout(() => {
          setIsImportModalOpen(false);
          setImportText('');
          setImportStatus(null);
          onRefresh();
        }, 1200);
      } else {
        const errorMsg = data.detail || (data.errors ? data.errors.join(', ') : 'Import failed');
        setImportStatus(`Import Error: ${errorMsg}`);
      }
    } catch (err) {
      setImportStatus(`Import failed: ${err instanceof Error ? err.message : 'Network error'}`);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Header & Search Controls */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-600" />
            Global Supplier Directory & Capacity Registry
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage multi-tier supplier profiles, unit costs, historical lead times, and emergency contingency tiers.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold border border-slate-300 flex items-center gap-1.5 cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import CSV</span>
          </button>
          <button
            onClick={handleExportCSV}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold border border-slate-300 flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={handleOpenAdd}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Supplier</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <div className="relative w-full max-w-sm">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by supplier, code, country, or SKU..."
              className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-800 focus:outline-hidden focus:border-blue-500 focus:bg-white"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-slate-500">
            <Filter className="w-3.5 h-3.5" />
            <span>Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-md px-2 py-1 text-slate-800 font-medium"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="disrupted">Disrupted</option>
              <option value="warning">Warning</option>
              <option value="offline">Offline</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 text-slate-500">
            <span>Tier:</span>
            <select
              value={tierFilter}
              onChange={(e) => setTierFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-md px-2 py-1 text-slate-800 font-medium"
            >
              <option value="all">All Tiers</option>
              <option value="Primary">Primary</option>
              <option value="Secondary">Secondary (Contingency)</option>
              <option value="Spot">Spot Market</option>
            </select>
          </div>
        </div>
      </div>

      {/* Suppliers Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-slate-500 uppercase font-mono text-[10px] tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-4">Code</th>
                <th className="py-2.5 px-4">Supplier Name</th>
                <th className="py-2.5 px-4">Location</th>
                <th className="py-2.5 px-4">Products / SKUs</th>
                <th className="py-2.5 px-4">Daily Capacity</th>
                <th className="py-2.5 px-4">Lead Time</th>
                <th className="py-2.5 px-4">Unit Cost</th>
                <th className="py-2.5 px-4">Reliability</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSuppliers.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-4 font-mono font-bold text-slate-900">{s.code}</td>
                  <td className="py-3 px-4">
                    <div className="font-semibold text-slate-900">{s.name}</div>
                    <div className="text-[11px] text-slate-400">{s.contactName} ({s.email})</div>
                  </td>
                  <td className="py-3 px-4">
                    <div>{s.city}</div>
                    <div className="text-[11px] text-slate-400">{s.country}</div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex flex-wrap gap-1">
                      {s.productsSupplied.map((p) => (
                        <span key={p} className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 font-mono text-[10px]">
                          {p}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="py-3 px-4 font-mono font-medium">{s.dailyCapacity.toLocaleString()} u/d</td>
                  <td className="py-3 px-4 font-mono font-medium">{s.leadTimeDays} Days</td>
                  <td className="py-3 px-4 font-mono font-semibold text-slate-900">${s.costPerUnit.toFixed(2)}</td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            s.reliabilityScore >= 95
                              ? 'bg-emerald-500'
                              : s.reliabilityScore >= 90
                              ? 'bg-blue-500'
                              : 'bg-amber-500'
                          }`}
                          style={{ width: `${s.reliabilityScore}%` }}
                        />
                      </div>
                      <span className="font-mono font-bold text-[11px]">{s.reliabilityScore}%</span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      onClick={() => handleToggleStatus(s)}
                      title="Click to toggle operational status"
                      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold cursor-pointer transition-colors ${
                        s.operationalStatus === 'active'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                          : s.operationalStatus === 'disrupted'
                          ? 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 animate-pulse'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          s.operationalStatus === 'active' ? 'bg-emerald-500' : 'bg-rose-500'
                        }`}
                      />
                      <span className="capitalize">{s.operationalStatus}</span>
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => handleOpenEdit(s)}
                        className="p-1 text-slate-500 hover:text-blue-600 rounded hover:bg-slate-100 cursor-pointer"
                        title="Edit supplier"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(s.id, s.name)}
                        className="p-1 text-slate-500 hover:text-rose-600 rounded hover:bg-slate-100 cursor-pointer"
                        title="Delete supplier"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Supplier Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg p-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 className="font-bold text-sm text-slate-900">
                {editingSupplier ? `Edit Supplier: ${editingSupplier.name}` : 'Register New Global Supplier'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 mb-1 font-medium">Supplier Code</label>
                  <input
                    type="text"
                    required
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 mb-1 font-medium">Supplier Name</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 mb-1 font-medium">Country</label>
                  <input
                    type="text"
                    required
                    value={formData.country}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 mb-1 font-medium">City</label>
                  <input
                    type="text"
                    required
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-600 mb-1 font-medium">Daily Capacity</label>
                  <input
                    type="number"
                    required
                    value={formData.dailyCapacity}
                    onChange={(e) => setFormData({ ...formData, dailyCapacity: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 mb-1 font-medium">Lead Time (Days)</label>
                  <input
                    type="number"
                    required
                    value={formData.leadTimeDays}
                    onChange={(e) => setFormData({ ...formData, leadTimeDays: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 mb-1 font-medium">Unit Cost ($)</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={formData.costPerUnit}
                    onChange={(e) => setFormData({ ...formData, costPerUnit: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-600 mb-1 font-medium">Supplied SKUs (Comma-separated)</label>
                <input
                  type="text"
                  required
                  value={formData.productsSupplied}
                  onChange={(e) => setFormData({ ...formData, productsSupplied: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-xs font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-slate-600 mb-1 font-medium">Operational Status</label>
                  <select
                    value={formData.operationalStatus}
                    onChange={(e) => setFormData({ ...formData, operationalStatus: e.target.value as any })}
                    className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-xs"
                  >
                    <option value="active">Active</option>
                    <option value="disrupted">Disrupted</option>
                    <option value="warning">Warning</option>
                    <option value="offline">Offline</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-600 mb-1 font-medium">Contract Tier</label>
                  <select
                    value={formData.contractTier}
                    onChange={(e) => setFormData({ ...formData, contractTier: e.target.value as any })}
                    className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-xs"
                  >
                    <option value="Primary">Primary</option>
                    <option value="Secondary">Secondary (Contingency)</option>
                    <option value="Spot">Spot Market</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 rounded text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded shadow-xs cursor-pointer"
                >
                  Save Supplier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CSV Import Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <Upload className="w-4 h-4 text-blue-600" />
                Import Suppliers CSV (Formula-Injection Protected)
              </h3>
              <button
                onClick={() => setIsImportModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3 text-xs">
              <p className="text-slate-600">
                Paste CSV content below or enter comma-separated values. All text values are strictly sanitized against spreadsheet formula injection (CWE-1236 triggers like <code className="bg-slate-100 px-1 py-0.5 rounded text-rose-600">=</code>, <code className="bg-slate-100 px-1 py-0.5 rounded text-rose-600">+</code>, <code className="bg-slate-100 px-1 py-0.5 rounded text-rose-600">-</code>, <code className="bg-slate-100 px-1 py-0.5 rounded text-rose-600">@</code>).
              </p>

              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">
                  CSV Data (Header + Data rows)
                </label>
                <textarea
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  placeholder={`code,name,dailyCapacity,leadTimeDays,reliabilityScore,costPerUnit,contractTier\nSUP-991,Tokyo Optical Fab,1200,4,96,42.5,Secondary\nSUP-992,Munich Logic AG,800,6,94,55.0,Secondary`}
                  className="w-full h-36 p-2 bg-slate-50 border border-slate-200 rounded font-mono text-[11px] focus:outline-hidden focus:border-blue-500"
                />
              </div>

              {importStatus && (
                <div
                  className={`p-2.5 rounded text-xs font-medium ${
                    importStatus.includes('Error') || importStatus.includes('failed') || importStatus.includes('must') || importStatus.includes('Please')
                      ? 'bg-rose-50 text-rose-700 border border-rose-200'
                      : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  }`}
                >
                  {importStatus}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(false)}
                  className="px-3 py-1.5 rounded text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleImportCSVSubmit}
                  disabled={isImporting}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isImporting ? 'Importing...' : 'Validate & Import'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
