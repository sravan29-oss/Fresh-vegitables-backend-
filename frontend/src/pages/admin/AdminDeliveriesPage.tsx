import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Truck,
  Users,
  CheckCircle,
  Clock,
  MapPin,
  Plus,
  RefreshCw,
  Phone,
  ShieldCheck,
  Send,
  UserCheck,
  Trash2,
} from 'lucide-react';
import api from '../../services/api';
import { DeliveryPartner, Order } from '../../types';

export const AdminDeliveriesPage: React.FC = () => {
  const [partners, setPartners] = useState<DeliveryPartner[]>([]);
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  // New Partner Modal
  const [isNewPartnerModalOpen, setIsNewPartnerModalOpen] = useState(false);
  const [newPartner, setNewPartner] = useState({
    name: '',
    phone: '',
    vehicle_type: 'Electric Bike',
    vehicle_number: '',
  });

  // Assign Driver Modal
  const [selectedOrderForAssign, setSelectedOrderForAssign] = useState<Order | null>(null);
  const [selectedDriverId, setSelectedDriverId] = useState<string>('');
  const [assigning, setAssigning] = useState(false);

  const fetchDeliveryData = async () => {
    try {
      setLoading(true);
      const [partnersRes, dashboardRes] = await Promise.all([
        api.get('/delivery/partners'),
        api.get('/delivery/dashboard'),
      ]);

      if (partnersRes.data?.data && Array.isArray(partnersRes.data.data)) {
        setPartners(partnersRes.data.data);
      } else {
        setPartners([]);
      }

      if (dashboardRes.data?.data?.activeOrders && Array.isArray(dashboardRes.data.data.activeOrders)) {
        setActiveOrders(dashboardRes.data.data.activeOrders);
      } else {
        setActiveOrders([]);
      }
    } catch (err) {
      console.warn('Failed to fetch delivery data:', err);
      setPartners([]);
      setActiveOrders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeliveryData();
  }, []);

  const handleRegisterPartner = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/delivery/partners', newPartner);
      alert('Delivery partner registered successfully');
      setIsNewPartnerModalOpen(false);
      setNewPartner({ name: '', phone: '', vehicle_type: 'Electric Bike', vehicle_number: '' });
      fetchDeliveryData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to register delivery partner');
    }
  };

  const handleTogglePartnerStatus = async (partner: DeliveryPartner) => {
    const nextStatus = partner.status === 'AVAILABLE' ? 'OFFLINE' : 'AVAILABLE';
    try {
      await api.put(`/delivery/partners/${partner.id}`, { status: nextStatus });
      fetchDeliveryData();
    } catch (err: any) {
      alert('Failed to update status');
    }
  };

  const handleDeletePartner = async (partnerId: string, partnerName: string) => {
    if (!window.confirm(`Are you sure you want to remove delivery partner "${partnerName}"?`)) return;
    try {
      await api.delete(`/delivery/partners/${partnerId}`);
      fetchDeliveryData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to remove delivery partner');
    }
  };

  const handleAssignDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrderForAssign || !selectedDriverId) return;

    try {
      setAssigning(true);
      await api.post(`/delivery/assign/${selectedOrderForAssign.id}`, {
        delivery_partner_id: selectedDriverId,
      });
      alert(`Driver assigned to order #${selectedOrderForAssign.order_number}`);
      setSelectedOrderForAssign(null);
      fetchDeliveryData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to assign driver');
    } finally {
      setAssigning(false);
    }
  };

  const handleMarkDelivered = async (orderId: string) => {
    try {
      await api.put(`/delivery/assignments/${orderId}/status`, { status: 'DELIVERED' });
      alert('Order marked as DELIVERED. Driver returned to AVAILABLE.');
      fetchDeliveryData();
    } catch (err) {
      alert('Failed to update status');
    }
  };

  const availableDrivers = partners.filter((p) => p.status === 'AVAILABLE');
  const onDeliveryDrivers = partners.filter((p) => p.status === 'ON_DELIVERY');
  const unassignedOrders = activeOrders.filter((o) => o.order_status !== 'out_for_delivery' && o.order_status !== 'delivered');
  const activeDeliveries = activeOrders.filter((o) => o.order_status === 'out_for_delivery');
  const avgFleetRating = partners.length > 0
    ? (partners.reduce((sum, p) => sum + (Number(p.rating) || 5), 0) / partners.length).toFixed(1)
    : '0.0';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Delivery Fleet &amp; Dispatch Operations</h1>
          <p className="text-xs text-slate-400 mt-1">
            Manage field drivers, vehicle assignments, and real-time order delivery fulfillment
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/admin/delivery-charges"
            className="bg-slate-800 hover:bg-slate-700 text-brand-400 text-xs font-black px-4 py-2.5 rounded-xl border border-brand-500/30 flex items-center gap-1.5 transition-all shadow-md"
          >
            <MapPin className="w-4 h-4" /> Manage Delivery Charges
          </Link>
          <button
            onClick={() => setIsNewPartnerModalOpen(true)}
            className="bg-brand-500 hover:bg-brand-400 text-slate-950 text-xs font-black px-4 py-2.5 rounded-xl flex items-center gap-1.5 shadow-lg shadow-brand-500/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Add Delivery Partner
          </button>
          <button
            onClick={fetchDeliveryData}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold px-3.5 py-2.5 rounded-xl border border-slate-700 transition-all cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-1">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Available Drivers</span>
          <p className="text-2xl font-black text-emerald-400">{availableDrivers.length}</p>
          <span className="text-[11px] text-slate-400">Ready for dispatch</span>
        </div>

        <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-1">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">On Active Route</span>
          <p className="text-2xl font-black text-brand-400">{onDeliveryDrivers.length}</p>
          <span className="text-[11px] text-slate-400">Live GPS tracking</span>
        </div>

        <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-1">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Unassigned Orders</span>
          <p className="text-2xl font-black text-amber-400">{unassignedOrders.length}</p>
          <span className="text-[11px] text-slate-400">Needs driver assign</span>
        </div>

        <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-1">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Out for Delivery</span>
          <p className="text-2xl font-black text-sky-400">{activeDeliveries.length}</p>
          <span className="text-[11px] text-slate-400">En route to kitchen</span>
        </div>

        <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-1">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Fleet Rating</span>
          <p className="text-2xl font-black text-white">{partners.length > 0 ? `${avgFleetRating} ⭐` : '0.0 ⭐'}</p>
          <span className="text-[11px] text-slate-400">
            {partners.length > 0 ? 'Cold chain guaranteed' : 'No drivers registered'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Driver Fleet Registry (7 cols) */}
        <div className="lg:col-span-7 bg-slate-950 p-6 rounded-2xl border border-slate-800 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="font-bold text-white text-sm flex items-center gap-2">
              <Users className="w-4 h-4 text-brand-400" /> Delivery Fleet Partners
            </h3>
            <span className="text-xs text-slate-400 font-semibold">{partners.length} Drivers Registered</span>
          </div>

          {partners.length === 0 ? (
            <div className="text-center py-12 px-4 rounded-xl border border-dashed border-slate-800 bg-slate-900/30 space-y-3">
              <Users className="w-10 h-10 text-slate-600 mx-auto" />
              <div>
                <h4 className="text-white font-bold text-sm">No Delivery Fleet Partners</h4>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  All mock drivers have been removed. Click &ldquo;+ Add Delivery Partner&rdquo; to register real delivery partners with their phone and vehicle details.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsNewPartnerModalOpen(true)}
                className="bg-brand-500 hover:bg-brand-400 text-slate-950 text-xs font-black px-4 py-2 rounded-xl inline-flex items-center gap-1.5 shadow-lg shadow-brand-500/20 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Add Delivery Partner
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {partners.map((partner) => (
                <div
                  key={partner.id}
                  className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-4 hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-emerald-400 text-white font-black text-sm flex items-center justify-center">
                      {partner.name.charAt(0)}
                    </div>
                    <div>
                      <h4 className="font-bold text-white text-xs">{partner.name}</h4>
                      <p className="text-[11px] text-slate-400">{partner.phone} • {partner.vehicle_type}</p>
                      <p className="text-[10px] font-mono text-brand-400 font-bold">{partner.vehicle_number}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        partner.status === 'AVAILABLE'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : partner.status === 'ON_DELIVERY'
                          ? 'bg-brand-500/10 text-brand-400 border border-brand-500/20'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {partner.status}
                    </span>

                    <button
                      onClick={() => handleTogglePartnerStatus(partner)}
                      className="text-[10px] font-bold text-slate-400 hover:text-white px-2.5 py-1 rounded-lg border border-slate-800 hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      Toggle
                    </button>

                    <button
                      onClick={() => handleDeletePartner(partner.id, partner.name)}
                      className="text-[10px] font-bold text-rose-400 hover:text-white px-2 py-1 rounded-lg border border-rose-500/20 hover:bg-rose-500/20 transition-colors flex items-center gap-1 cursor-pointer"
                      title="Remove Partner"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Dispatch & Active Deliveries Pipeline (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Unassigned Orders Queue */}
          <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 space-y-4">
            <h3 className="font-bold text-white text-sm flex items-center gap-2 border-b border-slate-800 pb-3">
              <Truck className="w-4 h-4 text-amber-400" /> Pending Dispatch Queue
            </h3>

            {unassignedOrders.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">No unassigned orders currently awaiting driver.</p>
            ) : (
              <div className="space-y-3">
                {unassignedOrders.map((ord) => (
                  <div
                    key={ord.id}
                    className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between text-xs"
                  >
                    <div>
                      <p className="font-mono font-bold text-white">#{ord.order_number}</p>
                      <p className="text-[11px] text-slate-400">{ord.delivery_address?.area || ord.address_snapshot?.area || 'KPHB Colony, Hyderabad'}</p>
                      <span className="text-[10px] uppercase font-bold text-amber-400">{ord.order_status}</span>
                    </div>

                    <button
                      onClick={() => {
                        setSelectedOrderForAssign(ord);
                        if (availableDrivers[0]) setSelectedDriverId(availableDrivers[0].id);
                      }}
                      className="bg-brand-500 hover:bg-brand-400 text-slate-950 font-black text-xs px-3 py-1.5 rounded-lg transition-all shadow-md shadow-brand-500/15"
                    >
                      Assign Driver
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Active Deliveries en route */}
          <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 space-y-4">
            <h3 className="font-bold text-white text-sm flex items-center gap-2 border-b border-slate-800 pb-3">
              <Send className="w-4 h-4 text-sky-400" /> Deliveries On Route (Live)
            </h3>

            {activeDeliveries.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">No orders currently out for delivery.</p>
            ) : (
              <div className="space-y-3">
                {activeDeliveries.map((ord) => (
                  <div
                    key={ord.id}
                    className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between text-xs"
                  >
                    <div>
                      <p className="font-mono font-bold text-white">#{ord.order_number}</p>
                      <p className="text-[11px] text-slate-400">Total ₹{ord.total} • {ord.payment_method.toUpperCase()}</p>
                      <span className="text-[10px] font-bold text-sky-400 flex items-center gap-1 mt-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse"></span> Moving to Destination
                      </span>
                    </div>

                    <button
                      onClick={() => handleMarkDelivered(ord.id)}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-3 py-1.5 rounded-lg transition-all"
                    >
                      Mark Delivered
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Assign Driver Modal */}
      {selectedOrderForAssign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-950 rounded-3xl max-w-md w-full p-6 border border-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-brand-400" /> Assign Driver to Order #{selectedOrderForAssign.order_number}
              </h3>
              <button onClick={() => setSelectedOrderForAssign(null)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <form onSubmit={handleAssignDriver} className="space-y-4 text-xs">
              <div className="bg-slate-900 p-3 rounded-xl space-y-1">
                <p className="text-slate-400">Delivery Address: <strong className="text-white">{selectedOrderForAssign.delivery_address?.area || 'Satellite'}</strong></p>
                <p className="text-slate-400">Customer: <strong className="text-white">{selectedOrderForAssign.customer_name || 'Customer'}</strong></p>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1.5">Select Delivery Partner</label>
                <select
                  required
                  value={selectedDriverId}
                  onChange={(e) => setSelectedDriverId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-white font-bold"
                >
                  <option value="">-- Choose Available Partner --</option>
                  {partners.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.vehicle_type} - {p.vehicle_number}) [{p.status}]
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setSelectedOrderForAssign(null)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:bg-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={assigning || !selectedDriverId}
                  className="bg-brand-500 hover:bg-brand-400 disabled:bg-slate-800 text-slate-950 font-black px-5 py-2 rounded-xl shadow-lg shadow-brand-500/20"
                >
                  {assigning ? 'Assigning...' : 'Confirm Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Partner Modal */}
      {isNewPartnerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-950 rounded-3xl max-w-md w-full p-6 border border-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <Plus className="w-4 h-4 text-brand-400" /> Register Delivery Partner
              </h3>
              <button onClick={() => setIsNewPartnerModalOpen(false)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <form onSubmit={handleRegisterPartner} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-bold mb-1">Partner Full Name</label>
                <input
                  type="text"
                  required
                  value={newPartner.name}
                  onChange={(e) => setNewPartner({ ...newPartner, name: e.target.value })}
                  placeholder="e.g. Ramesh Patel"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Phone Number</label>
                <input
                  type="tel"
                  required
                  value={newPartner.phone}
                  onChange={(e) => setNewPartner({ ...newPartner, phone: e.target.value })}
                  placeholder="e.g. 9898765432"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">Vehicle Type</label>
                  <select
                    value={newPartner.vehicle_type}
                    onChange={(e) => setNewPartner({ ...newPartner, vehicle_type: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white"
                  >
                    <option value="Electric Bike">Electric Bike</option>
                    <option value="Scooter">Petrol Scooter</option>
                    <option value="Motorcycle">Motorcycle</option>
                    <option value="EV Mini Van">EV Mini Van</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">Vehicle Plate No.</label>
                  <input
                    type="text"
                    required
                    value={newPartner.vehicle_number}
                    onChange={(e) => setNewPartner({ ...newPartner, vehicle_number: e.target.value })}
                    placeholder="TS-09-EV-1234"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white uppercase font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsNewPartnerModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:bg-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-brand-500 hover:bg-brand-400 text-slate-950 font-black px-5 py-2 rounded-xl"
                >
                  Save Partner
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
