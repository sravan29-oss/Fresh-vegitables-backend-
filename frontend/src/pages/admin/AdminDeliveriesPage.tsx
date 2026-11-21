import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Truck,
  Users,
  CheckCircle2,
  Clock,
  MapPin,
  Plus,
  RefreshCw,
  Phone,
  ShieldCheck,
  Send,
  UserCheck,
  AlertTriangle,
  XCircle,
  Package,
  KeyRound,
  Filter,
  Search,
  Navigation,
  Building2,
  Check,
  Info,
} from 'lucide-react';
import api from '../../services/api';
import { DeliveryPartner, DeliveryDashboardKPIs, DeliveryDashboardItem } from '../../types';

export const AdminDeliveriesPage: React.FC = () => {
  // Navigation tabs: 'deliveries' | 'fleet'
  const [activeTab, setActiveTab] = useState<'deliveries' | 'fleet'>('deliveries');

  // Filters
  const [selectedHub, setSelectedHub] = useState<string>('all'); // 'all' | 'hub-champapet' | 'hub-kphb'
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Data
  const [kpis, setKpis] = useState<DeliveryDashboardKPIs>({
    total_deliveries: 0,
    pending_assignment: 0,
    ready_for_dispatch: 0,
    assigned_deliveries: 0,
    out_for_delivery: 0,
    delivered: 0,
    failed: 0,
    cancelled: 0,
  });
  const [deliveries, setDeliveries] = useState<DeliveryDashboardItem[]>([]);
  const [partners, setPartners] = useState<DeliveryPartner[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // New Partner Modal
  const [isNewPartnerModalOpen, setIsNewPartnerModalOpen] = useState(false);
  const [newPartner, setNewPartner] = useState({
    name: '',
    phone: '',
    email: '',
    vehicle_type: 'Electric Cargo Bike',
    vehicle_number: '',
    assigned_hub_id: 'hub-champapet',
    pin_code: '',
  });
  const [submittingPartner, setSubmittingPartner] = useState(false);

  // Assign Driver Modal
  const [selectedDeliveryForAssign, setSelectedDeliveryForAssign] = useState<DeliveryDashboardItem | null>(null);
  const [selectedDriverId, setSelectedDriverId] = useState<string>('');
  const [assignNotes, setAssignNotes] = useState<string>('');
  const [assigning, setAssigning] = useState(false);
  const [generatedDevOtp, setGeneratedDevOtp] = useState<string | null>(null);

  // OTP Verification Modal
  const [selectedDeliveryForOtp, setSelectedDeliveryForOtp] = useState<DeliveryDashboardItem | null>(null);
  const [otpInput, setOtpInput] = useState<string>('');
  const [verifyingOtp, setVerifyingOtp] = useState(false);

  // Failure Modal
  const [selectedDeliveryForFail, setSelectedDeliveryForFail] = useState<DeliveryDashboardItem | null>(null);
  const [failureReason, setFailureReason] = useState<string>('customer_unavailable');
  const [failureNotes, setFailureNotes] = useState<string>('');
  const [recordingFailure, setRecordingFailure] = useState(false);

  const fetchDeliveryData = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      else setRefreshing(true);

      const params: any = {};
      if (selectedHub && selectedHub !== 'all') params.hub_id = selectedHub;
      if (selectedStatus && selectedStatus !== 'all') params.status = selectedStatus;

      const [dashRes, partRes] = await Promise.all([
        api.get('/delivery/dashboard', { params }),
        api.get('/delivery/partners', { params: { hub_id: selectedHub } }),
      ]);

      if (dashRes.data?.data) {
        const { kpis: fetchedKpis, deliveries: fetchedDeliveries } = dashRes.data.data;
        if (fetchedKpis) setKpis(fetchedKpis);
        if (Array.isArray(fetchedDeliveries)) setDeliveries(fetchedDeliveries);
      }

      if (partRes.data?.data && Array.isArray(partRes.data.data)) {
        setPartners(partRes.data.data);
      }
    } catch (err) {
      console.warn('Failed to fetch delivery dashboard data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedHub, selectedStatus]);

  useEffect(() => {
    fetchDeliveryData();
  }, [fetchDeliveryData]);

  // Handle Driver Registration
  const handleRegisterPartner = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmittingPartner(true);
      await api.post('/delivery/partners', newPartner);
      alert('Delivery partner registered successfully');
      setIsNewPartnerModalOpen(false);
      setNewPartner({
        name: '',
        phone: '',
        email: '',
        vehicle_type: 'Electric Cargo Bike',
        vehicle_number: '',
        assigned_hub_id: 'hub-champapet',
        pin_code: '',
      });
      fetchDeliveryData(true);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to register delivery partner');
    } finally {
      setSubmittingPartner(false);
    }
  };

  // Handle Driver Toggle Active/Suspended
  const handleTogglePartnerStatus = async (partner: DeliveryPartner) => {
    const nextStatus = partner.status === 'AVAILABLE' ? 'OFFLINE' : 'AVAILABLE';
    try {
      await api.put(`/delivery/partners/${partner.id}`, { status: nextStatus });
      fetchDeliveryData(true);
    } catch (err: any) {
      alert('Failed to update status');
    }
  };

  // Handle Assignment
  const handleAssignDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDeliveryForAssign || !selectedDriverId) return;

    try {
      setAssigning(true);
      const res = await api.post(`/delivery/assign/${selectedDeliveryForAssign.order_id}`, {
        delivery_partner_id: selectedDriverId,
        notes: assignNotes,
      });

      if (res.data?.data?.dev_otp) {
        setGeneratedDevOtp(res.data.data.dev_otp);
      } else {
        alert(`Driver assigned to order #${selectedDeliveryForAssign.order_number}`);
        setSelectedDeliveryForAssign(null);
        setSelectedDriverId('');
        setAssignNotes('');
      }
      fetchDeliveryData(true);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to assign driver');
    } finally {
      setAssigning(false);
    }
  };

  // Handle Status Transition
  const handleTransitionStatus = async (assignmentId: string, nextStatus: string, notes?: string) => {
    try {
      await api.put(`/delivery/assignments/${assignmentId}/status`, { status: nextStatus, notes });
      fetchDeliveryData(true);
    } catch (err: any) {
      alert(err.response?.data?.message || `Failed to transition to ${nextStatus}`);
    }
  };

  // Handle OTP Verification
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDeliveryForOtp?.assignment_id || !otpInput) return;

    try {
      setVerifyingOtp(true);
      await api.post(`/delivery/assignments/${selectedDeliveryForOtp.assignment_id}/verify-otp`, {
        otp: otpInput.trim(),
      });
      alert(`Order #${selectedDeliveryForOtp.order_number} marked as DELIVERED successfully!`);
      setSelectedDeliveryForOtp(null);
      setOtpInput('');
      fetchDeliveryData(true);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to verify OTP');
    } finally {
      setVerifyingOtp(false);
    }
  };

  // Handle Failure Reporting
  const handleReportFailure = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDeliveryForFail?.assignment_id) return;

    try {
      setRecordingFailure(true);
      await api.post(`/delivery/assignments/${selectedDeliveryForFail.assignment_id}/fail`, {
        reason: failureReason,
        notes: failureNotes,
      });
      alert(`Delivery failure recorded for #${selectedDeliveryForFail.order_number}.`);
      setSelectedDeliveryForFail(null);
      setFailureReason('customer_unavailable');
      setFailureNotes('');
      fetchDeliveryData(true);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to record failure');
    } finally {
      setRecordingFailure(false);
    }
  };

  // Filtered Deliveries based on search
  const displayedDeliveries = deliveries.filter((d) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      d.order_number?.toLowerCase().includes(q) ||
      d.customer_name?.toLowerCase().includes(q) ||
      d.customer_phone?.toLowerCase().includes(q) ||
      d.delivery_address?.toLowerCase().includes(q) ||
      d.assigned_partner_name?.toLowerCase().includes(q)
    );
  });

  // Filtered partners for assignment based on order's hub
  const eligibleDriversForSelectedOrder = selectedDeliveryForAssign
    ? partners.filter(
        (p) =>
          p.assigned_hub_id === selectedDeliveryForAssign.assigned_hub_id &&
          p.is_active !== false &&
          p.status !== 'SUSPENDED'
      )
    : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-950 p-6 rounded-2xl border border-slate-800">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-forest-900/40 border border-forest-700/50 flex items-center justify-center text-forest-400">
              <Truck className="w-5 h-5 text-brand-400" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white tracking-tight">Delivery Fleet &amp; Dispatch</h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Two-Hub Fulfillment Operations (Champapet Hub &amp; KPHB Hub)
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/delivery"
            target="_blank"
            className="bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 text-xs font-bold px-3.5 py-2.5 rounded-xl border border-emerald-500/30 flex items-center gap-1.5 transition-all shadow-md"
          >
            <Navigation className="w-4 h-4 text-emerald-400" /> Driver Portal 📱
          </Link>
          <button
            onClick={() => setIsNewPartnerModalOpen(true)}
            className="bg-brand-500 hover:bg-brand-400 text-slate-950 text-xs font-black px-4 py-2.5 rounded-xl flex items-center gap-1.5 shadow-lg shadow-brand-500/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Add Delivery Partner
          </button>
          <button
            onClick={() => fetchDeliveryData()}
            disabled={refreshing}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold px-3.5 py-2.5 rounded-xl border border-slate-700 transition-all cursor-pointer flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* 8 KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Total Deliveries</span>
          <p className="text-2xl font-black text-white">{kpis.total_deliveries}</p>
          <span className="text-[10px] text-slate-400">All registered</span>
        </div>

        <div className="bg-slate-950 p-4 rounded-xl border border-amber-900/30 bg-amber-950/10 space-y-1">
          <span className="text-[10px] uppercase font-bold tracking-wider text-amber-400">Pending Assign</span>
          <p className="text-2xl font-black text-amber-400">{kpis.pending_assignment}</p>
          <span className="text-[10px] text-amber-500/80">Needs fleet driver</span>
        </div>

        <div className="bg-slate-950 p-4 rounded-xl border border-purple-900/30 bg-purple-950/10 space-y-1">
          <span className="text-[10px] uppercase font-bold tracking-wider text-purple-400">Ready Dispatch</span>
          <p className="text-2xl font-black text-purple-400">{kpis.ready_for_dispatch}</p>
          <span className="text-[10px] text-purple-400/80">Packed at hub</span>
        </div>

        <div className="bg-slate-950 p-4 rounded-xl border border-indigo-900/30 bg-indigo-950/10 space-y-1">
          <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-400">Assigned</span>
          <p className="text-2xl font-black text-indigo-400">{kpis.assigned_deliveries}</p>
          <span className="text-[10px] text-indigo-400/80">Driver confirmed</span>
        </div>

        <div className="bg-slate-950 p-4 rounded-xl border border-sky-900/30 bg-sky-950/10 space-y-1">
          <span className="text-[10px] uppercase font-bold tracking-wider text-sky-400">Out for Delivery</span>
          <p className="text-2xl font-black text-sky-400">{kpis.out_for_delivery}</p>
          <span className="text-[10px] text-sky-400/80">En route live GPS</span>
        </div>

        <div className="bg-slate-950 p-4 rounded-xl border border-emerald-900/30 bg-emerald-950/10 space-y-1">
          <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-400">Delivered</span>
          <p className="text-2xl font-black text-emerald-400">{kpis.delivered}</p>
          <span className="text-[10px] text-emerald-400/80">OTP verified</span>
        </div>

        <div className="bg-slate-950 p-4 rounded-xl border border-rose-900/30 bg-rose-950/10 space-y-1">
          <span className="text-[10px] uppercase font-bold tracking-wider text-rose-400">Failed</span>
          <p className="text-2xl font-black text-rose-400">{kpis.failed}</p>
          <span className="text-[10px] text-rose-400/80">Exceptions</span>
        </div>

        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Cancelled</span>
          <p className="text-2xl font-black text-slate-400">{kpis.cancelled}</p>
          <span className="text-[10px] text-slate-500">Store cancelled</span>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="flex items-center justify-between border-b border-slate-800">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('deliveries')}
            className={`pb-3 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
              activeTab === 'deliveries'
                ? 'border-brand-500 text-brand-400'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Truck className="w-4 h-4" /> Live Deliveries &amp; Dispatch Queue ({deliveries.length})
          </button>
          <button
            onClick={() => setActiveTab('fleet')}
            className={`pb-3 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
              activeTab === 'fleet'
                ? 'border-brand-500 text-brand-400'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" /> Delivery Fleet Partners ({partners.length})
          </button>
        </div>

        {/* Two-Hub Filter Switcher */}
        <div className="flex items-center gap-2 pb-2">
          <Building2 className="w-3.5 h-3.5 text-slate-500" />
          <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setSelectedHub('all')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                selectedHub === 'all' ? 'bg-brand-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              All Hubs
            </button>
            <button
              onClick={() => setSelectedHub('hub-champapet')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                selectedHub === 'hub-champapet' ? 'bg-brand-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              Champapet Hub
            </button>
            <button
              onClick={() => setSelectedHub('hub-kphb')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                selectedHub === 'hub-kphb' ? 'bg-brand-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              KPHB Hub
            </button>
          </div>
        </div>
      </div>

      {activeTab === 'deliveries' ? (
        <div className="space-y-4">
          {/* Status Filters & Search Bar */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-950 p-4 rounded-xl border border-slate-800">
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { id: 'all', label: 'All' },
                { id: 'pending_assignment', label: 'Pending' },
                { id: 'ready_for_dispatch', label: 'Ready' },
                { id: 'assigned', label: 'Assigned' },
                { id: 'out_for_delivery', label: 'Out for Delivery' },
                { id: 'delivered', label: 'Delivered' },
                { id: 'failed', label: 'Failed' },
                { id: 'cancelled', label: 'Cancelled' },
              ].map((pill) => (
                <button
                  key={pill.id}
                  onClick={() => setSelectedStatus(pill.id)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                    selectedStatus === pill.id
                      ? 'bg-slate-800 text-brand-400 border border-brand-500/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`}
                >
                  {pill.label}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-500" />
              <input
                type="text"
                placeholder="Search order #, customer, address..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>

          {/* Deliveries Table */}
          <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-400 bg-slate-900/50">
                    <th className="py-3.5 px-4">Order</th>
                    <th className="py-3.5 px-4">Customer &amp; Address</th>
                    <th className="py-3.5 px-4">Assigned Hub</th>
                    <th className="py-3.5 px-4">Delivery Status</th>
                    <th className="py-3.5 px-4">Assigned Driver</th>
                    <th className="py-3.5 px-4">Payment</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-xs">
                  {displayedDeliveries.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-500">
                        <Truck className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        No deliveries match the selected filters or search query.
                      </td>
                    </tr>
                  ) : (
                    displayedDeliveries.map((delivery) => {
                      const isPending = delivery.delivery_status === 'PENDING_ASSIGNMENT';
                      const isAssigned = delivery.delivery_status === 'ASSIGNED';
                      const isOut = delivery.delivery_status === 'OUT_FOR_DELIVERY';
                      const isDelivered = delivery.delivery_status === 'DELIVERED';
                      const isFailed = delivery.delivery_status === 'FAILED';

                      return (
                        <tr key={delivery.order_id} className="hover:bg-slate-900/40 transition-colors">
                          <td className="py-4 px-4 font-mono font-bold text-white">
                            <Link to={`/admin/orders/${delivery.order_id}`} className="hover:text-brand-400">
                              #{delivery.order_number}
                            </Link>
                            <span className="block text-[10px] font-normal text-slate-500 mt-0.5">
                              {delivery.created_at ? new Date(delivery.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : ''}
                            </span>
                          </td>

                          <td className="py-4 px-4 max-w-xs">
                            <p className="font-bold text-white text-xs">{delivery.customer_name}</p>
                            <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                              <Phone className="w-3 h-3 text-slate-500" /> {delivery.customer_phone || 'N/A'}
                            </p>
                            <p className="text-[11px] text-slate-400 truncate mt-0.5" title={delivery.delivery_address}>
                              {delivery.delivery_address}
                            </p>
                          </td>

                          <td className="py-4 px-4 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                delivery.assigned_hub_id === 'hub-kphb'
                                  ? 'bg-purple-950/60 text-purple-300 border border-purple-800/40'
                                  : 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/40'
                              }`}
                            >
                              <Building2 className="w-3 h-3" />
                              {delivery.assigned_hub_name || 'Champapet Hub'}
                            </span>
                          </td>

                          <td className="py-4 px-4 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                isDelivered
                                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                  : isOut
                                  ? 'bg-sky-950 text-sky-400 border border-sky-800 animate-pulse'
                                  : isFailed
                                  ? 'bg-rose-950 text-rose-400 border border-rose-800'
                                  : isAssigned
                                  ? 'bg-indigo-950 text-indigo-400 border border-indigo-800'
                                  : 'bg-amber-950 text-amber-400 border border-amber-800'
                              }`}
                            >
                              {delivery.delivery_status}
                            </span>
                          </td>

                          <td className="py-4 px-4 whitespace-nowrap">
                            {delivery.assigned_partner_name ? (
                              <div>
                                <p className="font-bold text-white text-xs">{delivery.assigned_partner_name}</p>
                                <p className="text-[10px] text-slate-400">{delivery.assigned_partner_phone}</p>
                              </div>
                            ) : (
                              <span className="text-slate-500 italic text-xs">Unassigned</span>
                            )}
                          </td>

                          <td className="py-4 px-4 whitespace-nowrap">
                            <p className="font-bold text-white">₹{delivery.total_amount}</p>
                            <span className="text-[10px] font-mono text-slate-400 uppercase">
                              {delivery.payment_method} • {delivery.payment_status}
                            </span>
                          </td>

                          <td className="py-4 px-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-2">
                              {isPending && (
                                <button
                                  onClick={() => {
                                    setSelectedDeliveryForAssign(delivery);
                                    setSelectedDriverId('');
                                    setGeneratedDevOtp(null);
                                  }}
                                  className="bg-brand-500 hover:bg-brand-400 text-slate-950 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-sm"
                                >
                                  Assign Driver
                                </button>
                              )}

                              {isAssigned && delivery.assignment_id && (
                                <>
                                  <button
                                    onClick={() => handleTransitionStatus(delivery.assignment_id!, 'PICKED_UP')}
                                    className="bg-purple-950 hover:bg-purple-900 text-purple-300 border border-purple-800 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer"
                                  >
                                    Mark Picked Up
                                  </button>
                                  <button
                                    onClick={() => handleTransitionStatus(delivery.assignment_id!, 'OUT_FOR_DELIVERY')}
                                    className="bg-sky-950 hover:bg-sky-900 text-sky-300 border border-sky-800 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer"
                                  >
                                    Dispatch Out
                                  </button>
                                </>
                              )}

                              {isOut && delivery.assignment_id && (
                                <>
                                  <button
                                    onClick={() => {
                                      setSelectedDeliveryForOtp(delivery);
                                      setOtpInput('');
                                    }}
                                    className="bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-800 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                                  >
                                    <KeyRound className="w-3.5 h-3.5" /> Verify OTP &amp; Deliver
                                  </button>
                                  <button
                                    onClick={() => {
                                      setSelectedDeliveryForFail(delivery);
                                      setFailureReason('customer_unavailable');
                                      setFailureNotes('');
                                    }}
                                    className="bg-rose-950 hover:bg-rose-900 text-rose-300 border border-rose-800 px-2 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer"
                                  >
                                    Fail
                                  </button>
                                </>
                              )}

                              <Link
                                to={`/orders/${delivery.order_id}/track`}
                                target="_blank"
                                className="bg-slate-900 hover:bg-slate-800 text-slate-300 px-2 py-1.5 rounded-lg text-xs font-bold border border-slate-800 transition-all"
                                title="Customer Live Tracking View"
                              >
                                Track
                              </Link>
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
        </div>
      ) : (
        /* Delivery Fleet Registry Tab */
        <div className="space-y-4">
          <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-brand-400" /> Two-Hub Delivery Fleet Partners
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Fulfillment hub assigned drivers with vehicle and live workload status
                </p>
              </div>
              <button
                onClick={() => setIsNewPartnerModalOpen(true)}
                className="bg-brand-500 hover:bg-brand-400 text-slate-950 text-xs font-black px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-lg shadow-brand-500/20 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Add Delivery Partner
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {partners.map((partner) => (
                <div
                  key={partner.id}
                  className="bg-slate-900 p-5 rounded-xl border border-slate-800 space-y-3 hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-emerald-400 text-slate-950 font-black text-sm flex items-center justify-center">
                        {partner.name.charAt(0)}
                      </div>
                      <div>
                        <h4 className="font-bold text-white text-xs">{partner.name}</h4>
                        <p className="text-[11px] text-slate-400">{partner.phone}</p>
                      </div>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        partner.status === 'AVAILABLE'
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                          : partner.status === 'ON_DELIVERY'
                          ? 'bg-sky-950 text-sky-400 border border-sky-800 animate-pulse'
                          : 'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}
                    >
                      {partner.status}
                    </span>
                  </div>

                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/80 space-y-1.5 text-xs">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-slate-500">Assigned Hub:</span>
                      <span className="font-bold text-slate-200">{partner.assigned_hub_name || partner.assigned_hub_id}</span>
                    </div>
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-slate-500">Vehicle:</span>
                      <span className="font-bold text-slate-200">{partner.vehicle_type} ({partner.vehicle_number})</span>
                    </div>
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-slate-500">Completed / Failed:</span>
                      <span className="font-bold text-slate-200">
                        {partner.total_deliveries || 0} delivered / {partner.failed_deliveries || 0} failed
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-slate-500">Active Workload:</span>
                      <span className="font-bold text-brand-400">{partner.active_tasks_count || 0} active orders</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-800/60">
                    <button
                      onClick={() => handleTogglePartnerStatus(partner)}
                      className={`text-[11px] font-bold px-3 py-1.5 rounded-lg border transition-all cursor-pointer ${
                        partner.status === 'AVAILABLE'
                          ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                          : 'bg-emerald-950 text-emerald-300 border-emerald-800 hover:bg-emerald-900'
                      }`}
                    >
                      {partner.status === 'AVAILABLE' ? 'Set Offline' : 'Set Available'}
                    </button>
                    <span className="text-[10px] text-slate-500 font-mono">PIN: {partner.pin_code || '1234'}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: ADD DELIVERY PARTNER */}
      {isNewPartnerModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <Plus className="w-4 h-4 text-brand-400" /> Register Delivery Partner
              </h3>
              <button
                onClick={() => setIsNewPartnerModalOpen(false)}
                className="text-slate-500 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRegisterPartner} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Kumar"
                  value={newPartner.name}
                  onChange={(e) => setNewPartner({ ...newPartner, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Mobile Number *
                </label>
                <input
                  type="tel"
                  required
                  placeholder="e.g. +91 9848011221"
                  value={newPartner.phone}
                  onChange={(e) => setNewPartner({ ...newPartner, phone: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Assigned Fulfillment Hub *
                </label>
                <select
                  value={newPartner.assigned_hub_id}
                  onChange={(e) => setNewPartner({ ...newPartner, assigned_hub_id: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
                >
                  <option value="hub-champapet">Champapet Hub (Raji Reddy Nagar)</option>
                  <option value="hub-kphb">KPHB Hub (Phase 3)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Vehicle Type
                  </label>
                  <select
                    value={newPartner.vehicle_type}
                    onChange={(e) => setNewPartner({ ...newPartner, vehicle_type: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
                  >
                    <option value="Electric Cargo Bike">Electric Cargo Bike</option>
                    <option value="Electric Scooter">Electric Scooter</option>
                    <option value="Standard Bike">Standard Bike</option>
                    <option value="Eco Van">Eco Van</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Vehicle Reg Number *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. TS-08-EV-1024"
                    value={newPartner.vehicle_number}
                    onChange={(e) => setNewPartner({ ...newPartner, vehicle_number: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Portal Login PIN (4-6 digits, non-trivial)
                </label>
                <input
                  type="text"
                  maxLength={6}
                  placeholder="e.g. 7482"
                  value={newPartner.pin_code}
                  onChange={(e) => setNewPartner({ ...newPartner, pin_code: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-brand-500 font-mono"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Security policy: Trivial PINs ('1234', '0000', sequential numbers) are rejected. Leave empty to auto-generate a secure random PIN.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsNewPartnerModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingPartner}
                  className="bg-brand-500 hover:bg-brand-400 text-slate-950 px-5 py-2 rounded-xl text-xs font-black shadow-lg shadow-brand-500/20 transition-all cursor-pointer"
                >
                  {submittingPartner ? 'Registering...' : 'Register Partner'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: ASSIGN DRIVER (HUB STRICT) */}
      {selectedDeliveryForAssign && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-white text-base">Assign Delivery Partner</h3>
                <p className="text-xs text-slate-400">Order #{selectedDeliveryForAssign.order_number}</p>
              </div>
              <button
                onClick={() => setSelectedDeliveryForAssign(null)}
                className="text-slate-500 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-400">Assigned Hub:</span>
                <span className="font-bold text-brand-400">{selectedDeliveryForAssign.assigned_hub_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Customer:</span>
                <span className="text-slate-200">{selectedDeliveryForAssign.customer_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Destination:</span>
                <span className="text-slate-200 truncate max-w-[200px]">{selectedDeliveryForAssign.delivery_address}</span>
              </div>
            </div>

            {generatedDevOtp ? (
              <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                <h4 className="font-bold text-white text-sm">Driver Assigned Successfully!</h4>
                <p className="text-xs text-slate-400">
                  Customer Delivery Verification OTP (Development Mode View):
                </p>
                <div className="py-2 px-4 bg-emerald-900/40 rounded-lg inline-block border border-emerald-500/40 font-mono text-2xl font-black text-emerald-300 tracking-widest">
                  {generatedDevOtp}
                </div>
                <p className="text-[10px] text-slate-400">
                  Give this OTP to the driver upon delivery to verify and complete the order.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDeliveryForAssign(null);
                    setGeneratedDevOtp(null);
                  }}
                  className="mt-3 bg-brand-500 hover:bg-brand-400 text-slate-950 text-xs font-black px-4 py-2 rounded-xl cursor-pointer"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleAssignDriver} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Select Driver (Strictly {selectedDeliveryForAssign.assigned_hub_name}) *
                  </label>
                  {eligibleDriversForSelectedOrder.length === 0 ? (
                    <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-900 text-amber-300 text-xs">
                      No active drivers registered for {selectedDeliveryForAssign.assigned_hub_name}. Please add a driver to this hub first.
                    </div>
                  ) : (
                    <select
                      required
                      value={selectedDriverId}
                      onChange={(e) => setSelectedDriverId(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
                    >
                      <option value="">-- Choose eligible fleet partner --</option>
                      {eligibleDriversForSelectedOrder.map((driver) => (
                        <option key={driver.id} value={driver.id}>
                          {driver.name} ({driver.vehicle_type} - {driver.status})
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Dispatch Instructions / Notes
                  </label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Handle leafy greens gently, temperature controlled box #4"
                    value={assignNotes}
                    onChange={(e) => setAssignNotes(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-brand-500"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setSelectedDeliveryForAssign(null)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={assigning || !selectedDriverId}
                    className="bg-brand-500 hover:bg-brand-400 disabled:opacity-40 text-slate-950 px-5 py-2 rounded-xl text-xs font-black shadow-lg shadow-brand-500/20 transition-all cursor-pointer"
                  >
                    {assigning ? 'Assigning...' : 'Confirm Assignment'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* MODAL 3: VERIFY OTP & DELIVER */}
      {selectedDeliveryForOtp && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-white text-base flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-emerald-400" /> Verify Customer OTP
                </h3>
                <p className="text-xs text-slate-400">Order #{selectedDeliveryForOtp.order_number}</p>
              </div>
              <button
                onClick={() => setSelectedDeliveryForOtp(null)}
                className="text-slate-500 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Enter 6-digit Customer Delivery OTP *
                </label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  placeholder="• • • • • •"
                  value={otpInput}
                  onChange={(e) => setOtpInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-center text-xl font-mono tracking-widest text-emerald-400 placeholder-slate-700 focus:outline-none focus:border-emerald-500"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Customer must provide this OTP at doorstep to confirm safe receipt of organic produce.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setSelectedDeliveryForOtp(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={verifyingOtp || otpInput.trim().length !== 6}
                  className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 px-5 py-2 rounded-xl text-xs font-black shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
                >
                  {verifyingOtp ? 'Verifying...' : 'Complete Delivery'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: REPORT DELIVERY FAILURE */}
      {selectedDeliveryForFail && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-white text-base text-rose-400 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400" /> Report Delivery Exception
                </h3>
                <p className="text-xs text-slate-400">Order #{selectedDeliveryForFail.order_number}</p>
              </div>
              <button
                onClick={() => setSelectedDeliveryForFail(null)}
                className="text-slate-500 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleReportFailure} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Reason for Non-Delivery *
                </label>
                <select
                  value={failureReason}
                  onChange={(e) => setFailureReason(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
                >
                  <option value="customer_unavailable">Customer Unavailable at Address</option>
                  <option value="customer_phone_unreachable">Customer Phone Unreachable / Switched Off</option>
                  <option value="incorrect_address">Incorrect or Incomplete Address</option>
                  <option value="customer_rescheduled">Customer Requested Rescheduling</option>
                  <option value="delivery_refused">Delivery Refused by Customer</option>
                  <option value="weather_issue">Severe Weather / Waterlogging</option>
                  <option value="other">Other Operational Issue</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Detailed Notes (Mandatory, min 5 chars) *
                </label>
                <textarea
                  required
                  minLength={5}
                  rows={3}
                  placeholder="Explain the incident, calls made, or instructions from customer..."
                  value={failureNotes}
                  onChange={(e) => setFailureNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setSelectedDeliveryForFail(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={recordingFailure || failureNotes.trim().length < 5}
                  className="bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white px-5 py-2 rounded-xl text-xs font-black shadow-lg shadow-rose-600/20 transition-all cursor-pointer"
                >
                  {recordingFailure ? 'Recording...' : 'Confirm Delivery Failure'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDeliveriesPage;
