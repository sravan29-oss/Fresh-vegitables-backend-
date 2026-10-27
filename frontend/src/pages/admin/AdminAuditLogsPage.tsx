import React, { useEffect, useState } from 'react';
import {
  ShieldAlert,
  Search,
  Clock,
  UserCheck,
  Terminal,
  Activity,
  Server,
  Cpu,
} from 'lucide-react';
import api from '../../services/api';
import { AuditLog } from '../../types';

export const AdminAuditLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [health, setHealth] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState('');

  const fetchLogs = async () => {
    try {
      setIsLoading(true);
      const [logsRes, healthRes] = await Promise.all([
        api.get('/audit-logs').catch(() => null),
        api.get('/audit-logs/health').catch(() => null),
      ]);

      if (logsRes?.data?.data?.logs) {
        setLogs(logsRes.data.data.logs);
      }
      if (healthRes?.data?.data) {
        setHealth(healthRes.data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filteredLogs = logs.filter((l) =>
    actionFilter ? l.action.toLowerCase().includes(actionFilter.toLowerCase()) : true
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-white tracking-tight">
              Enterprise Audit Logs &amp; Observability
            </h1>
            <span className="text-xs bg-brand-500/20 text-brand-400 border border-brand-500/30 px-2 py-0.5 rounded-full font-bold">
              Phase 20
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Immutable administrative accountability ledger: track price changes, stock adjustments, refunds, and CMS edits.
          </p>
        </div>
      </div>

      {/* System Health telemetry */}
      {health && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400">System Status</span>
              <p className="font-extrabold text-sm text-emerald-400">{health.status}</p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-500/20 text-brand-400 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400">Process Uptime</span>
              <p className="font-extrabold text-sm text-white">{health.uptime_seconds}s active</p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400">Memory RSS</span>
              <p className="font-extrabold text-sm text-white">{health.memory?.rss_mb} MB</p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400">Fast Cache</span>
              <p className="font-extrabold text-sm text-white">{health.cache?.totalKeys || 0} active keys</p>
            </div>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="flex items-center gap-3 max-w-md">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Filter by action (e.g. PRICE, CMS, STOCK, ZONE)..."
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
          />
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
        </div>
      </div>

      {/* Audit Logs Table */}
      <div className="bg-slate-950/70 border border-slate-800 rounded-3xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-extrabold text-sm text-white">Administrative Actions Ledger</h3>
          <span className="text-xs text-slate-400">{filteredLogs.length} events logged</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="py-2.5 px-3">Timestamp</th>
                <th className="py-2.5 px-3">Admin</th>
                <th className="py-2.5 px-3">Action</th>
                <th className="py-2.5 px-3">Target Entity</th>
                <th className="py-2.5 px-3">Changes / Details</th>
                <th className="py-2.5 px-3">IP Address</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-900/50">
                  <td className="py-3 px-3 text-slate-400 text-[11px] whitespace-nowrap">
                    {new Date(log.created_at).toLocaleString()}
                  </td>
                  <td className="py-3 px-3 font-semibold text-white">
                    {log.admin_email}
                  </td>
                  <td className="py-3 px-3">
                    <span className="bg-brand-500/20 text-brand-300 border border-brand-500/30 px-2 py-0.5 rounded text-[10px] font-mono font-bold">
                      {log.action}
                    </span>
                  </td>
                  <td className="py-3 px-3 font-mono text-[11px] text-slate-400">
                    {log.entity_type} {log.entity_id ? `(#${log.entity_id})` : ''}
                  </td>
                  <td className="py-3 px-3 max-w-xs truncate font-mono text-[10px] text-slate-400">
                    {log.new_values ? JSON.stringify(log.new_values) : 'Action executed'}
                  </td>
                  <td className="py-3 px-3 font-mono text-[11px] text-slate-500">
                    {log.ip_address}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
