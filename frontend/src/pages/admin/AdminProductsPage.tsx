import React, { useState, useEffect, useRef } from 'react';
import { Plus, Search, Edit2, Trash2, Check, X, AlertTriangle, Upload, Image as ImageIcon, Sparkles, Loader2 } from 'lucide-react';
import api from '../../services/api';
import { Product, Category } from '../../types';
import { notifyLiveUpdate } from '../../services/liveSync';
import { getProductImageUrl, getFallbackImageUrl } from '../../utils/imageUrl';

const VEGETABLE_IMAGE_PRESETS = [
  { name: 'Tomato', url: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=500&auto=format&fit=crop', icon: '🍅' },
  { name: 'Potato', url: 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=500&auto=format&fit=crop', icon: '🥔' },
  { name: 'Onion', url: 'https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?w=500&auto=format&fit=crop', icon: '🧅' },
  { name: 'Carrot', url: 'https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?w=500&auto=format&fit=crop', icon: '🥕' },
  { name: 'Spinach', url: 'https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=500&auto=format&fit=crop', icon: '🥬' },
  { name: 'Capsicum', url: 'https://images.unsplash.com/photo-1563565375-f3fdfdbefa83?w=500&auto=format&fit=crop', icon: '🫑' },
  { name: 'Cucumber', url: 'https://images.unsplash.com/photo-1604977042946-1eecc30f269e?w=500&auto=format&fit=crop', icon: '🥒' },
  { name: 'Cauliflower', url: 'https://images.unsplash.com/photo-1568584711075-3d021a7c3ca3?w=500&auto=format&fit=crop', icon: '🥦' },
  { name: 'Cabbage', url: 'https://images.unsplash.com/photo-1594282486552-05b4d80fbb9f?w=500&auto=format&fit=crop', icon: '🥗' },
  { name: 'Garlic', url: 'https://images.unsplash.com/photo-1540148426945-6cf22a6b2383?w=500&auto=format&fit=crop', icon: '🧄' },
];

export const AdminProductsPage: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Image Upload & Selection State
  const [imageUrl, setImageUrl] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    name: '',
    category_id: '',
    description: '',
    unit: '1kg',
    mrp: 50,
    selling_price: 40,
    stock_quantity: 50,
    minimum_stock: 5,
    status: 'active' as 'active' | 'inactive',
    featured: false,
    best_seller: false,
  });

  const loadProducts = async () => {
    try {
      setIsLoading(true);
      const [prodRes, catRes] = await Promise.all([
        api.get('/products/admin/all').catch(() => api.get('/products', { params: { limit: 100 } })),
        api.get('/categories/admin/all').catch(() => api.get('/categories')),
      ]);
      if (prodRes.data?.data) setProducts(prodRes.data.data);
      if (catRes.data?.data) setCategories(catRes.data.data);
    } catch (err) {
      console.error('Failed to load products/categories', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const compressImageFile = async (file: File): Promise<File> => {
    // If file is already small (e.g. under 500KB), return as is
    if (file.size <= 500 * 1024) return file;

    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const MAX_DIM = 1600;
          let width = img.width;
          let height = img.height;

          if (width > height && width > MAX_DIM) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          } else if (height > MAX_DIM) {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(file);
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                resolve(file);
                return;
              }
              const cleanName = file.name.replace(/\.[^.]+$/, '') + '.webp';
              const compressedFile = new File([blob], cleanName, {
                type: 'image/webp',
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            },
            'image/webp',
            0.88
          );
        };
        img.onerror = () => resolve(file);
        img.src = event.target?.result as string;
      };
      reader.onerror = () => resolve(file);
      reader.readAsDataURL(file);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Immediate local preview
      const previewUrl = URL.createObjectURL(file);
      setImagePreview(previewUrl);

      // Compress and optimize for fast upload
      try {
        const optimized = await compressImageFile(file);
        setImageFile(optimized);
      } catch (err) {
        console.warn('Image optimization skipped, using original:', err);
        setImageFile(file);
      }
    }
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview('');
    setImageUrl('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const selectPreset = (preset: { name: string; url: string }) => {
    setImageUrl(preset.url);
    setImagePreview(preset.url);
    setImageFile(null);
    if (!formData.name) {
      setFormData((prev) => ({ ...prev, name: preset.name }));
    }
  };

  const openCreateModal = () => {
    setEditingProduct(null);
    setImageFile(null);
    setImagePreview('');
    setImageUrl('');
    if (fileInputRef.current) fileInputRef.current.value = '';
    setFormData({
      name: '',
      category_id: categories[0]?.id || '',
      description: '',
      unit: '1kg',
      mrp: 60,
      selling_price: 50,
      stock_quantity: 40,
      minimum_stock: 5,
      status: 'active',
      featured: false,
      best_seller: false,
    });
    setIsModalOpen(true);
  };

  const openEditModal = (p: Product) => {
    setEditingProduct(p);
    setImageFile(null);
    const existingImg = p.images?.[0] || '';
    setImageUrl(existingImg);
    setImagePreview(existingImg);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setFormData({
      name: p.name,
      category_id: p.category_id || '',
      description: p.description || '',
      unit: p.unit,
      mrp: p.mrp,
      selling_price: p.selling_price,
      stock_quantity: p.stock_quantity,
      minimum_stock: p.minimum_stock,
      status: p.status,
      featured: p.featured,
      best_seller: p.best_seller,
    });
    setIsModalOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      if (imageFile) {
        const data = new FormData();
        Object.entries(formData).forEach(([k, v]) => {
          if (k === 'category_id' && (!v || v === '')) return;
          data.append(k, String(v));
        });
        data.append('images', imageFile);
        if (imageUrl) {
          data.append('image_url', imageUrl);
        }

        if (editingProduct) {
          await api.put(`/products/${editingProduct.id}`, data);
        } else {
          await api.post('/products', data);
        }
      } else {
        const payload: any = { ...formData };
        if (!payload.category_id) {
          delete payload.category_id;
        }
        if (imageUrl) {
          payload.image_url = imageUrl;
          payload.images = [imageUrl];
        }
        if (editingProduct) {
          await api.put(`/products/${editingProduct.id}`, payload);
        } else {
          await api.post('/products', payload);
        }
      }
      setIsModalOpen(false);
      loadProducts();
      notifyLiveUpdate('products');
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to save product');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm('Are you sure you want to permanently delete this product from the database?')) return;
    try {
      setProducts((prev) => prev.filter((p) => p.id !== id));
      await api.delete(`/products/${id}`);
      loadProducts();
      notifyLiveUpdate('products');
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete product');
      loadProducts();
    }
  };

  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Vegetable Produce Catalog</h1>
          <p className="text-xs text-slate-400 mt-1">Manage listings, prices, units, and stock quantities</p>
        </div>
        <button
          onClick={openCreateModal}
          className="bg-brand-500 hover:bg-brand-400 text-slate-950 font-black text-xs px-5 py-3 rounded-xl shadow-md flex items-center gap-2 self-start transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Vegetable</span>
        </button>
      </div>

      {/* Filter / Search Bar */}
      <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex items-center gap-3">
        <Search className="w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search by vegetable name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none flex-1"
        />
      </div>

      {/* Products Table */}
      <div className="bg-slate-950 rounded-3xl border border-slate-800 overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="py-16 text-center text-xs text-slate-400">Loading catalog...</div>
        ) : products.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <div className="text-4xl">🥬</div>
            <p className="text-sm font-bold text-white">No products added yet</p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Your vegetable catalog is completely clean. Click &quot;Add Vegetable&quot; above to add your first real product.
            </p>
            <button
              onClick={openCreateModal}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-400 text-slate-950 font-extrabold text-xs shadow-md transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add First Vegetable</span>
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-xs text-slate-400">No vegetables match your search.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px] bg-slate-900/40">
                  <th className="py-3.5 px-4">Produce</th>
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-4">Unit</th>
                  <th className="py-3.5 px-4">MRP / Price</th>
                  <th className="py-3.5 px-4">Stock</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-900/60 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-lg overflow-hidden flex-shrink-0">
                          {p.images && p.images[0] ? (
                            <img
                              src={getProductImageUrl(p.images[0], p.name)}
                              alt={p.name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.currentTarget.src = getFallbackImageUrl(p.name);
                              }}
                            />
                          ) : (
                            '🥦'
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-white text-sm">{p.name}</p>
                          <div className="flex gap-1.5 mt-0.5">
                            {p.featured && (
                              <span className="text-[9px] bg-brand-500/20 text-brand-400 px-1.5 py-0.2 rounded font-bold">
                                FEATURED
                              </span>
                            )}
                            {p.best_seller && (
                              <span className="text-[9px] bg-amber-500/20 text-amber-400 px-1.5 py-0.2 rounded font-bold">
                                BEST SELLER
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-300">{p.category_name || 'Greens'}</td>
                    <td className="py-3.5 px-4 text-slate-400">{p.unit}</td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-baseline gap-1.5">
                        <span className="font-black text-brand-400">₹{p.selling_price}</span>
                        <span className="text-slate-500 line-through text-[11px]">₹{p.mrp}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                          p.stock_quantity <= p.minimum_stock
                            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            : 'bg-emerald-500/10 text-emerald-400'
                        }`}
                      >
                        {p.stock_quantity} units
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                          p.status === 'active'
                            ? 'bg-emerald-400/10 text-emerald-400'
                            : 'bg-slate-700 text-slate-400'
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEditModal(p)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                          title="Edit Product"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteProduct(p.id)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors"
                          title="Deactivate"
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
        )}
      </div>

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-xl w-full text-white shadow-2xl space-y-4 my-8">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800">
              <h3 className="font-extrabold text-base">
                {editingProduct ? 'Edit Vegetable Produce' : 'Add New Fresh Vegetable'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-slate-300 block mb-1">Vegetable Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Baby Spinach (Palak)"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white"
                />
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1">
                  Product Description <span className="text-slate-500 font-normal">(Optional — only shown if entered by Admin)</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="Enter custom description (taste, organic origin, cooking ideas...). Leave empty if none."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
                />
              </div>

              {/* Vegetable Image Section */}
              <div className="p-3.5 bg-slate-800/80 border border-slate-700/80 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-200 flex items-center gap-1.5 text-xs">
                    <ImageIcon className="w-4 h-4 text-brand-400" />
                    <span>Vegetable Image</span>
                  </label>
                  {imagePreview && (
                    <button
                      type="button"
                      onClick={clearImage}
                      className="text-[10px] text-rose-400 hover:text-rose-300 font-bold"
                    >
                      Remove Image
                    </button>
                  )}
                </div>

                {/* Upload or Preview Row */}
                <div className="flex items-center gap-3">
                  {imagePreview ? (
                    <div className="relative w-16 h-16 rounded-xl overflow-hidden border-2 border-brand-500 shadow-md shrink-0 bg-slate-900 group">
                      <img
                        src={getProductImageUrl(imagePreview, formData.name)}
                        alt="Preview"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.src = getFallbackImageUrl(formData.name);
                        }}
                      />
                    </div>
                  ) : (
                    <div className="w-16 h-16 rounded-xl border border-dashed border-slate-600 bg-slate-900/60 flex flex-col items-center justify-center shrink-0 text-slate-500 text-[10px]">
                      <Upload className="w-5 h-5 mb-1 text-slate-400" />
                      <span>No Image</span>
                    </div>
                  )}

                  <div className="flex-1 space-y-2">
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept="image/png,image/jpeg,image/webp,image/jpg"
                      onChange={handleFileChange}
                      className="hidden"
                      id="product-image-upload"
                    />
                    <div className="flex items-center gap-2">
                      <label
                        htmlFor="product-image-upload"
                        className="px-3 py-1.5 bg-brand-600 hover:bg-brand-500 text-white rounded-lg font-bold text-xs cursor-pointer flex items-center gap-1.5 shadow transition-colors"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>Upload File</span>
                      </label>
                      <span className="text-[10px] text-slate-400">PNG, JPG, WebP (auto-optimized, up to 25MB)</span>
                    </div>

                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Image URL or uploaded path (e.g. https://... or /uploads/...)"
                        value={imageUrl}
                        onChange={(e) => {
                          const val = e.target.value;
                          setImageUrl(val);
                          setImagePreview(val);
                          setImageFile(null);
                        }}
                        className="w-full p-2 text-[11px] bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Quick Presets Picker */}
                <div className="pt-1 border-t border-slate-700/50">
                  <p className="text-[10px] font-semibold text-slate-400 mb-1.5 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-400" />
                    <span>Quick Vegetable Photos (click to select):</span>
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {VEGETABLE_IMAGE_PRESETS.map((preset) => (
                      <button
                        key={preset.name}
                        type="button"
                        onClick={() => selectPreset(preset)}
                        className={`px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all ${
                          imagePreview === preset.url
                            ? 'bg-brand-500 text-slate-950 ring-1 ring-white'
                            : 'bg-slate-700/80 hover:bg-slate-600 text-slate-200'
                        }`}
                      >
                        <span>{preset.icon}</span>
                        <span>{preset.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-300 block mb-1">Category</label>
                  <select
                    value={formData.category_id}
                    onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                    className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white"
                  >
                    <option value="">Select Category</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-300 block mb-1">Unit / Pack</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 500g, 1kg, 1 bunch"
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-300 block mb-1">MRP (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.mrp}
                    onChange={(e) => setFormData({ ...formData, mrp: parseFloat(e.target.value) || 0 })}
                    className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-300 block mb-1">Selling Price (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.selling_price}
                    onChange={(e) => setFormData({ ...formData, selling_price: parseFloat(e.target.value) || 0 })}
                    className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-300 block mb-1">Stock Quantity</label>
                  <input
                    type="number"
                    required
                    value={formData.stock_quantity}
                    onChange={(e) => setFormData({ ...formData, stock_quantity: parseInt(e.target.value) || 0 })}
                    className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-300 block mb-1">Min. Stock Alert Threshold</label>
                  <input
                    type="number"
                    required
                    value={formData.minimum_stock}
                    onChange={(e) => setFormData({ ...formData, minimum_stock: parseInt(e.target.value) || 0 })}
                    className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1">Description / Nutrition</label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Organic, pesticide-free harvest notes..."
                  className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white"
                />
              </div>

              <div className="flex gap-6 pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.featured}
                    onChange={(e) => setFormData({ ...formData, featured: e.target.checked })}
                    className="rounded bg-slate-800"
                  />
                  <span>Featured on Homepage</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.best_seller}
                    onChange={(e) => setFormData({ ...formData, best_seller: e.target.checked })}
                    className="rounded bg-slate-800"
                  />
                  <span>Mark as Best Seller</span>
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-6 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-400 text-slate-950 font-black shadow-md flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{editingProduct ? (isSaving ? 'Saving...' : 'Save Changes') : (isSaving ? 'Creating...' : 'Create Product')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
