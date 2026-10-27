import React, { useState, useEffect } from 'react';
import { Search, Boxes, Check, AlertTriangle } from 'lucide-react';
import api from '../../services/api';

export const AdminInventoryPage: React.FC = () => {
  const [inventory, setInventory] = useState<any[]>([]);
  const [stockStatus, setStockStatus] = useState('');
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [editingStocks, setEditingStocks] = useState<Record<string, number>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const loadInventory = async () => {
    try {
      setIsLoading(true);
      const params: Record<string, any> = {};
      if (stockStatus) params.stock_status = stockStatus;
      if (search) params.search = search;

      const res = await api.get('/inventory', { baseURL: '/api/admin', params });
      if (res.data?.data) {
        setInventory(res.data.data);
        const map: Record<string, number> = {};
        res.data.data.forEach((item: any) => {
          map[item.id] = item.stock_quantity;
        });
        setEditingStocks(map);
      }
    } catch (err) {
      console.error('Failed to load inventory', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadInventory();
  }, [stockStatus]);

  const handleSaveStock = async (id: string) => {
    try {
      setSavingId(id);
      await api.patch(`/inventory/${id}`, { stock_quantity: editingStocks[id] }, { baseURL: '/api/admin' });
      await loadInventory();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update stock');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-white tracking-tight">Produce Inventory & Stock</h1>
        <p className="text-xs text-slate-400 mt-1">Live stock quantities, replenishment alerts, and inline updates</p>
      </div>

      {/* Filter and search */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="flex items-center gap-2">
          {['', 'in_stock', 'low_stock', 'out_of_stock'].map((st) => (
            <button
              key={st}
              onClick={() => setStockStatus(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                stockStatus === st
                  ? 'bg-brand-500 text-slate-950 shadow-md'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {st === '' ? 'All Inventory' : st.replace(/_/g, ' ').toUpperCase()}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <input
            type="text"
            placeholder="Search produce..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && loadInventory()}
            className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 text-white rounded-xl text-xs focus:outline-none focus:border-brand-500"
          />
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        </div>
      </div>

      {/* Inventory Table */}
      <div className="bg-slate-950 rounded-3xl border border-slate-800 overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="py-16 text-center text-xs text-slate-400">Loading stock data...</div>
        ) : inventory.length === 0 ? (
          <div className="py-16 text-center text-xs text-slate-400">No produce items found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px] bg-slate-900/40">
                  <th className="py-3.5 px-4">Vegetable</th>
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-4">Unit</th>
                  <th className="py-3.5 px-4">Min. Alert Threshold</th>
                  <th className="py-3.5 px-4">Stock Status</th>
                  <th className="py-3.5 px-4">Available Units</th>
                  <th className="py-3.5 px-4 text-right">Quick Save</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {inventory.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-900/60 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-white text-sm">{item.name}</td>
                    <td className="py-3.5 px-4 text-slate-300">{item.category_name || 'Greens'}</td>
                    <td className="py-3.5 px-4 text-slate-400">{item.unit}</td>
                    <td className="py-3.5 px-4 text-slate-400 font-bold">{item.minimum_stock} units</td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase ${
                          item.stock_status === 'out_of_stock'
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            : item.stock_status === 'low_stock'
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            : 'bg-emerald-500/10 text-emerald-400'
                        }`}
                      >
                        {item.stock_status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <input
                        type="number"
                        min="0"
                        value={editingStocks[item.id] ?? item.stock_quantity}
                        onChange={(e) =>
                          setEditingStocks({
                            ...editingStocks,
                            [item.id]: parseInt(e.target.value) || 0,
                          })
                        }
                        className="w-24 p-1.5 bg-slate-900 border border-slate-700 rounded-xl text-white font-bold text-center focus:outline-none focus:border-brand-500"
                      />
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => handleSaveStock(item.id)}
                        disabled={savingId === item.id}
                        className="bg-brand-500 hover:bg-brand-400 disabled:bg-slate-700 text-slate-950 font-bold text-xs px-3.5 py-1.5 rounded-xl shadow-xs transition-all"
                      >
                        {savingId === item.id ? 'Saving...' : 'Update'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
