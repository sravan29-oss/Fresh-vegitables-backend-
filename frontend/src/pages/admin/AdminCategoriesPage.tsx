import React, { useState, useEffect, useRef } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  X,
  Layers,
  Upload,
  Image as ImageIcon,
  Sparkles,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import api from '../../services/api';
import { Category } from '../../types';
import { getProductImageUrl } from '../../utils/imageUrl';

export const AdminCategoriesPage: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Image Upload State
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [imageUrl, setImageUrl] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    status: 'active' as 'active' | 'inactive',
    display_order: 0,
  });

  const loadCategories = async () => {
    try {
      setIsLoading(true);
      const res = await api.get('/categories/admin/all').catch(() => api.get('/categories'));
      if (res.data?.data) setCategories(res.data.data);
    } catch (err) {
      console.error('Failed to load categories', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  // Client-side image compression utility
  const compressImageFile = async (file: File): Promise<File> => {
    if (file.size <= 500 * 1024) return file;

    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const MAX_DIM = 1200;
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
      const preview = URL.createObjectURL(file);
      setImagePreview(preview);
      setImageUrl('');

      try {
        const optimized = await compressImageFile(file);
        setImageFile(optimized);
      } catch {
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

  const openCreateModal = () => {
    setEditingCategory(null);
    clearImage();
    setFormData({
      name: '',
      description: '',
      status: 'active',
      display_order: categories.length + 1,
    });
    setIsModalOpen(true);
  };

  const openEditModal = (cat: Category) => {
    setEditingCategory(cat);
    setImageFile(null);
    setImagePreview(cat.image || '');
    setImageUrl(cat.image || '');
    if (fileInputRef.current) fileInputRef.current.value = '';
    setFormData({
      name: cat.name,
      description: cat.description || '',
      status: cat.status,
      display_order: cat.display_order,
    });
    setIsModalOpen(true);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSaving(true);

      let finalImageValue = imageUrl.trim() || null;

      if (imageFile) {
        // Convert to high-definition WebP data URL for permanent Supabase persistence
        const reader = new FileReader();
        const base64Data = await new Promise<string>((resolve) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => resolve('');
          reader.readAsDataURL(imageFile);
        });

        if (base64Data) {
          finalImageValue = base64Data;
        }
      }

      const payload: any = {
        name: formData.name.trim(),
        description: formData.description?.trim() || null,
        status: formData.status,
        display_order: Number(formData.display_order || 0),
        image: finalImageValue,
      };

      if (editingCategory) {
        await api.put(`/categories/${editingCategory.id}`, payload);
      } else {
        await api.post('/categories', payload);
      }

      setIsModalOpen(false);
      clearImage();
      loadCategories();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to save category');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm('Are you sure you want to deactivate this category?')) return;
    try {
      await api.delete(`/categories/${id}`);
      loadCategories();
    } catch (err) {
      alert('Failed to delete category');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Produce Categories</h1>
          <p className="text-xs text-slate-400 mt-1">
            Organize vegetables into customer-friendly marketplace aisles with high-definition imagery
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="bg-brand-500 hover:bg-brand-400 text-slate-950 font-black text-xs px-5 py-3 rounded-xl shadow-md flex items-center gap-2 self-start transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Category</span>
        </button>
      </div>

      <div className="bg-slate-950 rounded-3xl border border-slate-800 overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="py-16 text-center text-xs text-slate-400">Loading categories...</div>
        ) : categories.length === 0 ? (
          <div className="py-16 text-center text-xs text-slate-400">No categories found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px] bg-slate-900/40">
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-4">Slug</th>
                  <th className="py-3.5 px-4">Products Linked</th>
                  <th className="py-3.5 px-4">Display Order</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {categories.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-900/60 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        {/* Category Image Thumbnail */}
                        <div className="w-11 h-11 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center overflow-hidden shrink-0">
                          {c.image ? (
                            <img
                              src={getProductImageUrl(c.image, c.name)}
                              alt={c.name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                          ) : (
                            <Layers className="w-5 h-5 text-brand-400" />
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-white text-sm">{c.name}</p>
                          {c.description && (
                            <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1 max-w-xs">{c.description}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-400 font-mono text-[11px]">{c.slug}</td>
                    <td className="py-3.5 px-4">
                      <span className="bg-brand-500/10 text-brand-400 font-bold px-2.5 py-0.5 rounded-full text-[11px]">
                        {c.product_count || 0} produce
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-300 font-bold">{c.display_order}</td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                          c.status === 'active'
                            ? 'bg-emerald-400/10 text-emerald-400'
                            : 'bg-slate-700 text-slate-400'
                        }`}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openEditModal(c)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
                          title="Edit Category"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteCategory(c.id)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                          title="Deactivate Category"
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

      {/* Create / Edit Category Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-lg w-full text-white shadow-2xl space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-brand-500/20 text-brand-400 flex items-center justify-center">
                  <Layers className="w-4 h-4" />
                </div>
                <h3 className="font-extrabold text-base">
                  {editingCategory ? 'Edit Produce Category' : 'Create Produce Category'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCategory} className="space-y-4 text-xs">
              {/* Category Name */}
              <div>
                <label className="font-bold text-slate-300 block mb-1">
                  Category Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Leafy Greens & Herbs"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-brand-500"
                />
              </div>

              {/* Category Image Upload & Preview */}
              <div>
                <label className="font-bold text-slate-300 block mb-1.5">
                  Category Image <span className="text-slate-500 font-normal">(Upload File or Paste Image URL)</span>
                </label>

                <div className="flex items-center gap-3">
                  {/* Image Preview Box */}
                  <div className="w-20 h-20 rounded-2xl bg-slate-950 border-2 border-dashed border-slate-800 flex items-center justify-center overflow-hidden shrink-0 relative group">
                    {imagePreview ? (
                      <>
                        <img
                          src={
                            imagePreview.startsWith('blob:') || imagePreview.startsWith('data:')
                              ? imagePreview
                              : getProductImageUrl(imagePreview, formData.name)
                          }
                          alt="Preview"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.opacity = '0.3';
                          }}
                        />
                        <button
                          type="button"
                          onClick={clearImage}
                          className="absolute inset-0 bg-slate-950/80 text-rose-400 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-1 transition-opacity text-[10px] font-bold"
                          title="Remove image"
                        >
                          <X className="w-3.5 h-3.5" /> Remove
                        </button>
                      </>
                    ) : (
                      <div className="text-center p-2 text-slate-600">
                        <ImageIcon className="w-6 h-6 mx-auto mb-1 stroke-1" />
                        <span className="text-[9px] block">No image</span>
                      </div>
                    )}
                  </div>

                  {/* Actions Column */}
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="file"
                        ref={fileInputRef}
                        accept="image/png,image/jpeg,image/webp,image/jpg"
                        onChange={handleFileChange}
                        className="hidden"
                        id="category-image-upload"
                      />
                      <label
                        htmlFor="category-image-upload"
                        className="px-3.5 py-2 rounded-xl bg-brand-500 hover:bg-brand-400 text-slate-950 font-black text-xs flex items-center gap-1.5 cursor-pointer transition-all shadow-sm"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>Upload File</span>
                      </label>

                      {imagePreview && (
                        <button
                          type="button"
                          onClick={clearImage}
                          className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs"
                        >
                          Clear
                        </button>
                      )}
                    </div>

                    {/* Or URL input */}
                    <input
                      type="text"
                      placeholder="Or enter direct image URL (e.g. https://.../image.jpg)"
                      value={imageUrl}
                      onChange={(e) => {
                        setImageUrl(e.target.value);
                        setImagePreview(e.target.value);
                        setImageFile(null);
                      }}
                      className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-300 text-[11px] font-mono focus:outline-none focus:border-brand-500"
                    />
                    <p className="text-[10px] text-slate-400">
                      Use direct image files (.jpg, .png, .webp) or upload an image above.
                    </p>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="font-bold text-slate-300 block mb-1">Description</label>
                <textarea
                  rows={2}
                  placeholder="Brief description for customer catalog"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-brand-500"
                />
              </div>

              {/* Display Order & Status */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-300 block mb-1">Display Order</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.display_order}
                    onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })}
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-brand-500"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-300 block mb-1">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-brand-500 cursor-pointer"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSaving}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-6 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-400 text-slate-950 font-black shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>{editingCategory ? 'Save Changes' : 'Create Category'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminCategoriesPage;
