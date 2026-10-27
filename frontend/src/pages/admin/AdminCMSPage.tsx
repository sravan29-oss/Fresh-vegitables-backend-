import { useState, useEffect } from 'react';
import {
  Layers,
  Plus,
  Eye,
  EyeOff,
  ArrowUp,
  ArrowDown,
  Trash2,
  Edit2,
  Check,
  X,
  Sparkles,
  LayoutTemplate,
  Save,
  Image as ImageIcon,
  Calendar,
  Clock,
  ExternalLink,
  Phone,
  Mail,
  MapPin,
} from 'lucide-react';
import api from '../../services/api';
import { HomepageSection, HomepageBanner } from '../../types';
import { queryClient } from '../../services/queryClient';
import { useQuery } from '@tanstack/react-query';

export const AdminCMSPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'sections' | 'banners' | 'store_contact'>('sections');
  const [editingSection, setEditingSection] = useState<HomepageSection | null>(null);
  const [editingBanner, setEditingBanner] = useState<HomepageBanner | null>(null);
  const [isSectionModalOpen, setIsSectionModalOpen] = useState(false);
  const [isBannerModalOpen, setIsBannerModalOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // TanStack Query for Store Contact & Support Settings
  const { data: initialSettings, refetch: refetchSettings } = useQuery({
    queryKey: ['admin-store-settings'],
    queryFn: async () => {
      const res = await api.get('/cms/settings');
      return res.data?.data;
    },
  });

  const [contactForm, setContactForm] = useState<{
    support_phone: string;
    support_email: string;
    announcement_text: string;
    store_address: string;
    quality_badge: string;
  }>({
    support_phone: '+91 8106970384',
    support_email: 'care@freshveggies.com',
    announcement_text: 'Same-Day Farm Delivery available for orders before 2:00 PM',
    store_address: 'Sector 14 Central Depot, Agro Valley',
    quality_badge: '⚡ 100% Residue-Free & Organic',
  });

  const [isSavingSettings, setIsSavingSettings] = useState(false);

  useEffect(() => {
    if (initialSettings) {
      setContactForm({
        support_phone: initialSettings.support_phone || '+91 8106970384',
        support_email: initialSettings.support_email || 'care@freshveggies.com',
        announcement_text: initialSettings.announcement_text || 'Same-Day Farm Delivery available for orders before 2:00 PM',
        store_address: initialSettings.store_address || 'Sector 14 Central Depot, Agro Valley',
        quality_badge: initialSettings.quality_badge || '⚡ 100% Residue-Free & Organic',
      });
    }
  }, [initialSettings]);

  const handleSaveContactSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    try {
      await api.put('/cms/settings', contactForm);
      refetchSettings();
      queryClient.invalidateQueries({ queryKey: ['store-settings'] });
      showToast('Store contact details and header/footer settings updated successfully!');
    } catch (err) {
      alert('Failed to update store settings');
    } finally {
      setIsSavingSettings(false);
    }
  };

  // TanStack Query for Sections
  const {
    data: sections = [],
    isLoading: isSectionsLoading,
    refetch: refetchSections,
  } = useQuery<HomepageSection[]>({
    queryKey: ['admin-cms-sections'],
    queryFn: async () => {
      const res = await api.get('/cms/sections');
      return res.data?.data || [];
    },
  });

  // TanStack Query for Banners
  const {
    data: banners = [],
    isLoading: isBannersLoading,
    refetch: refetchBanners,
  } = useQuery<HomepageBanner[]>({
    queryKey: ['admin-cms-banners'],
    queryFn: async () => {
      const res = await api.get('/cms/banners');
      return res.data?.data || [];
    },
  });

  const showToast = (msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const handleToggleStatus = async (id: string) => {
    try {
      const res = await api.patch(`/cms/sections/${id}/toggle`);
      if (res.data?.data) {
        refetchSections();
        queryClient.invalidateQueries({ queryKey: ['homepage-cms'] });
        showToast(`Section ${res.data.data.status === 'active' ? 'published' : 'disabled'}`);
      }
    } catch (err) {
      alert('Failed to toggle status');
    }
  };

  const handleMove = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sections.length) return;

    const newSections = [...sections];
    const [moved] = newSections.splice(index, 1);
    newSections.splice(targetIndex, 0, moved);

    const reordered = newSections.map((s, idx) => ({
      ...s,
      display_order: idx + 1,
    }));

    try {
      await api.post('/cms/sections/reorder', {
        order: reordered.map((s) => ({ id: s.id, display_order: s.display_order })),
      });
      refetchSections();
      queryClient.invalidateQueries({ queryKey: ['homepage-cms'] });
      showToast('Sections order saved');
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteSection = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this homepage section?')) return;
    try {
      await api.delete(`/cms/sections/${id}`);
      refetchSections();
      queryClient.invalidateQueries({ queryKey: ['homepage-cms'] });
      showToast('Section deleted');
    } catch (err) {
      alert('Failed to delete section');
    }
  };

  const handleSaveSectionModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSection) return;

    try {
      if (editingSection.id.startsWith('new-')) {
        await api.post('/cms/sections', editingSection);
        showToast('New section added to homepage');
      } else {
        await api.put(`/cms/sections/${editingSection.id}`, editingSection);
        showToast('Section changes saved');
      }
      refetchSections();
      queryClient.invalidateQueries({ queryKey: ['homepage-cms'] });
      setIsSectionModalOpen(false);
      setEditingSection(null);
    } catch (err) {
      alert('Failed to save section');
    }
  };

  const startCreateSection = () => {
    setEditingSection({
      id: `new-${Date.now()}`,
      type: 'promotional_banner',
      title: 'Fresh Harvest Flash Sale',
      subtitle: 'Flat ₹50 OFF',
      description: 'Hand-picked organic veggies delivered within 30 minutes.',
      button_text: 'Shop Now',
      button_link: '/products',
      display_order: sections.length + 1,
      status: 'active',
      start_date: undefined,
      end_date: undefined,
      configuration: {},
    });
    setIsSectionModalOpen(true);
  };

  // Banner Actions
  const handleSaveBannerModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBanner) return;

    try {
      if (editingBanner.id.startsWith('new-')) {
        await api.post('/cms/banners', editingBanner);
        showToast('New banner slide published');
      } else {
        await api.put(`/cms/banners/${editingBanner.id}`, editingBanner);
        showToast('Banner slide updated');
      }
      refetchBanners();
      queryClient.invalidateQueries({ queryKey: ['homepage-cms'] });
      setIsBannerModalOpen(false);
      setEditingBanner(null);
    } catch (err) {
      alert('Failed to save banner');
    }
  };

  const handleDeleteBanner = async (id: string) => {
    if (!window.confirm('Delete this banner slide?')) return;
    try {
      await api.delete(`/cms/banners/${id}`);
      refetchBanners();
      queryClient.invalidateQueries({ queryKey: ['homepage-cms'] });
      showToast('Banner slide deleted');
    } catch (err) {
      alert('Failed to delete banner');
    }
  };

  const startCreateBanner = () => {
    setEditingBanner({
      id: `new-${Date.now()}`,
      section_id: 'sec-hero-01',
      title: 'Hydrated Leafy Greens & Microgreens',
      subtitle: 'Crunchy Romaine, Baby Spinach, and Rocket Leaves',
      image: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=1200&auto=format&fit=crop',
      link: '/products?category=leafy-greens',
      badge: 'Certified Organic',
      display_order: banners.length + 1,
      status: 'active',
    });
    setIsBannerModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-white tracking-tight">Homepage CMS Builder</h1>
            <span className="text-xs bg-brand-500/20 text-brand-400 border border-brand-500/30 px-2 py-0.5 rounded-full font-bold">
              Phase 13
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Dynamic section ordering, hero banners, and promotional content editor.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <a
            href="/"
            target="_blank"
            rel="noreferrer"
            className="px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white text-xs font-bold flex items-center gap-1.5 transition-all"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>View Live Store</span>
          </a>

          {activeTab === 'sections' ? (
            <button
              onClick={startCreateSection}
              className="bg-brand-500 hover:bg-brand-400 text-slate-950 font-extrabold text-xs px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-brand-500/20"
            >
              <Plus className="w-4 h-4" />
              <span>Add Section</span>
            </button>
          ) : activeTab === 'banners' ? (
            <button
              onClick={startCreateBanner}
              className="bg-brand-500 hover:bg-brand-400 text-slate-950 font-extrabold text-xs px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-brand-500/20"
            >
              <Plus className="w-4 h-4" />
              <span>Add Banner</span>
            </button>
          ) : null}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3 flex-wrap">
        <button
          onClick={() => setActiveTab('sections')}
          className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 ${
            activeTab === 'sections'
              ? 'bg-brand-500 text-slate-950 shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <LayoutTemplate className="w-4 h-4" />
          <span>Homepage Sections ({sections.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('banners')}
          className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 ${
            activeTab === 'banners'
              ? 'bg-brand-500 text-slate-950 shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <ImageIcon className="w-4 h-4" />
          <span>Hero Banners ({banners.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('store_contact')}
          className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 ${
            activeTab === 'store_contact'
              ? 'bg-brand-500 text-slate-950 shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Phone className="w-4 h-4" />
          <span>Support & Store Info</span>
        </button>
      </div>

      {statusMessage && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs px-4 py-2.5 rounded-xl flex items-center gap-2 animate-fade-in">
          <Check className="w-4 h-4" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* ================= TAB 1: SECTIONS ================= */}
      {activeTab === 'sections' && (
        <div className="space-y-3">
          {isSectionsLoading ? (
            <div className="py-12 text-center text-xs text-slate-400">Loading sections...</div>
          ) : sections.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">No homepage sections configured.</div>
          ) : (
            sections.map((section, index) => (
              <div
                key={section.id}
                className={`p-4 rounded-2xl border transition-all flex items-center justify-between gap-4 ${
                  section.status === 'active'
                    ? 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                    : 'bg-slate-950/30 border-slate-900 opacity-60'
                }`}
              >
                {/* Left order & details */}
                <div className="flex items-center gap-4 min-w-0">
                  <span className="w-8 h-8 rounded-lg bg-slate-900 text-slate-400 font-mono text-xs flex items-center justify-center font-bold">
                    #{section.display_order}
                  </span>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-brand-500/10 text-brand-400 border border-brand-500/20">
                        {section.type.replace('_', ' ')}
                      </span>
                      <h4 className="font-extrabold text-sm text-white truncate">{section.title}</h4>
                    </div>
                    <p className="text-xs text-slate-400 truncate mt-0.5">{section.subtitle || section.description || 'No subtitle'}</p>
                    {(section.start_date || section.end_date) && (
                      <div className="flex items-center gap-2 text-[10px] text-amber-400 mt-1">
                        <Calendar className="w-3 h-3" />
                        <span>
                          Schedule: {section.start_date ? new Date(section.start_date).toLocaleDateString() : 'Immediate'} →{' '}
                          {section.end_date ? new Date(section.end_date).toLocaleDateString() : 'Permanent'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right controls */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => handleMove(index, 'up')}
                    disabled={index === 0}
                    className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-30 text-slate-300"
                    title="Move Up"
                  >
                    <ArrowUp className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleMove(index, 'down')}
                    disabled={index === sections.length - 1}
                    className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-30 text-slate-300"
                    title="Move Down"
                  >
                    <ArrowDown className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleToggleStatus(section.id)}
                    className={`p-2 rounded-xl transition-colors ${
                      section.status === 'active'
                        ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                        : 'bg-rose-500/20 text-rose-400 hover:bg-rose-500/30'
                    }`}
                    title={section.status === 'active' ? 'Disable Section' : 'Publish Section'}
                  >
                    {section.status === 'active' ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => {
                      setEditingSection(section);
                      setIsSectionModalOpen(true);
                    }}
                    className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white"
                    title="Edit Section"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteSection(section.id)}
                    className="p-2 rounded-xl bg-slate-900 hover:bg-rose-950/60 text-slate-400 hover:text-rose-400"
                    title="Delete Section"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ================= TAB 2: BANNERS ================= */}
      {activeTab === 'banners' && (
        <div className="space-y-4">
          {isBannersLoading ? (
            <div className="py-12 text-center text-xs text-slate-400">Loading banners...</div>
          ) : banners.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">No banners found.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {banners.map((banner) => (
                <div
                  key={banner.id}
                  className="rounded-2xl border border-slate-800 bg-slate-950 overflow-hidden flex flex-col justify-between"
                >
                  <div className="relative h-44 bg-slate-900 overflow-hidden">
                    <img
                      src={banner.image}
                      alt={banner.title}
                      className="w-full h-full object-cover"
                      onError={(e: any) => {
                        e.target.src = 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=600';
                      }}
                    />
                    <span className="absolute top-3 left-3 bg-brand-500 text-slate-950 font-black text-[10px] px-2.5 py-1 rounded-full uppercase tracking-wider">
                      {banner.badge || 'Banner Slide'}
                    </span>
                  </div>

                  <div className="p-4 space-y-2">
                    <h4 className="font-extrabold text-sm text-white">{banner.title}</h4>
                    <p className="text-xs text-slate-400 line-clamp-2">{banner.subtitle}</p>
                    <div className="text-[11px] text-brand-400 font-mono">Link: {banner.link}</div>
                  </div>

                  <div className="px-4 py-3 bg-slate-900/60 border-t border-slate-800/80 flex items-center justify-between">
                    <span className="text-xs text-slate-400">Order #{banner.display_order}</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setEditingBanner(banner);
                          setIsBannerModalOpen(true);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold flex items-center gap-1"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>
                      <button
                        onClick={() => handleDeleteBanner(banner.id)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-900 text-rose-400"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ================= TAB 3: CONTACT & STORE SETTINGS ================= */}
      {activeTab === 'store_contact' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 max-w-3xl">
          <div>
            <h2 className="text-lg font-black text-white flex items-center gap-2">
              <Phone className="w-5 h-5 text-brand-400" />
              <span>Contact Support & Header / Footer Configuration</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Admin controls for customer support mobile number, email, store pickup address, and top header announcement banner.
            </p>
          </div>

          <form onSubmit={handleSaveContactSettings} className="space-y-5 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-slate-300 font-bold mb-1.5 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-brand-400" />
                  <span>Support Mobile Number</span>
                </label>
                <input
                  type="text"
                  value={contactForm.support_phone}
                  onChange={(e) => setContactForm({ ...contactForm, support_phone: e.target.value })}
                  placeholder="+91 8106970384"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
                />
                <p className="text-[10px] text-slate-500 mt-1">Directly updates Header top micro-bar and Footer support links.</p>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1.5 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-brand-400" />
                  <span>Support Email Address</span>
                </label>
                <input
                  type="email"
                  value={contactForm.support_email}
                  onChange={(e) => setContactForm({ ...contactForm, support_email: e.target.value })}
                  placeholder="care@freshveggies.com"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
                />
                <p className="text-[10px] text-slate-500 mt-1">Displayed in Footer contact links.</p>
              </div>
            </div>

            <div>
              <label className="block text-slate-300 font-bold mb-1.5 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-brand-400" />
                <span>Top Header Announcement Text</span>
              </label>
              <input
                type="text"
                value={contactForm.announcement_text}
                onChange={(e) => setContactForm({ ...contactForm, announcement_text: e.target.value })}
                placeholder="Same-Day Farm Delivery available for orders before 2:00 PM"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
              />
              <p className="text-[10px] text-slate-500 mt-1">Shows in the pulsating green dot announcement banner on top of the customer website.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-slate-300 font-bold mb-1.5 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-brand-400" />
                  <span>Store / Depot Address</span>
                </label>
                <input
                  type="text"
                  value={contactForm.store_address}
                  onChange={(e) => setContactForm({ ...contactForm, store_address: e.target.value })}
                  placeholder="Sector 14 Central Depot, Agro Valley"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1.5 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-brand-400" />
                  <span>Quality Guarantee Badge</span>
                </label>
                <input
                  type="text"
                  value={contactForm.quality_badge}
                  onChange={(e) => setContactForm({ ...contactForm, quality_badge: e.target.value })}
                  placeholder="⚡ 100% Residue-Free & Organic"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
                />
              </div>
            </div>

            <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-800">
              <button
                type="submit"
                disabled={isSavingSettings}
                className="bg-brand-500 hover:bg-brand-400 disabled:opacity-50 text-slate-950 font-black px-6 py-2.5 rounded-xl flex items-center gap-2 shadow-lg shadow-brand-500/20 transition-all cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>{isSavingSettings ? 'Saving...' : 'Save Store & Contact Settings'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ================= EDIT SECTION MODAL ================= */}
      {isSectionModalOpen && editingSection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 text-white w-full max-w-xl rounded-3xl p-6 shadow-2xl relative space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-extrabold text-white text-base">
                {editingSection.id.startsWith('new-') ? 'Add Homepage Section' : 'Edit Section Details'}
              </h3>
              <button
                onClick={() => setIsSectionModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSectionModal} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 font-bold mb-1">Section Type</label>
                <select
                  value={editingSection.type}
                  onChange={(e) => setEditingSection({ ...editingSection, type: e.target.value as any })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-medium"
                >
                  <option value="hero_banner">Hero Banner</option>
                  <option value="categories">Categories Rail</option>
                  <option value="featured_products">Featured Products Rail</option>
                  <option value="fresh_arrivals">Fresh Arrivals Rail</option>
                  <option value="best_sellers">Best Sellers Rail</option>
                  <option value="special_offers">Special Offers Banner</option>
                  <option value="promotional_banner">Promotional Banner</option>
                  <option value="why_choose_us">Why Choose Us Pillars</option>
                  <option value="testimonials">Customer Testimonials</option>
                  <option value="app_promotion">Mobile App Promotion</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Title</label>
                <input
                  type="text"
                  required
                  value={editingSection.title}
                  onChange={(e) => setEditingSection({ ...editingSection, title: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Subtitle / Badge</label>
                <input
                  type="text"
                  value={editingSection.subtitle || ''}
                  onChange={(e) => setEditingSection({ ...editingSection, subtitle: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Description</label>
                <textarea
                  rows={2}
                  value={editingSection.description || ''}
                  onChange={(e) => setEditingSection({ ...editingSection, description: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Image URL (Optional)</label>
                <input
                  type="text"
                  placeholder="https://images.unsplash.com/..."
                  value={editingSection.image || ''}
                  onChange={(e) => setEditingSection({ ...editingSection, image: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">CTA Button Text</label>
                  <input
                    type="text"
                    value={editingSection.button_text || ''}
                    onChange={(e) => setEditingSection({ ...editingSection, button_text: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1">CTA Link</label>
                  <input
                    type="text"
                    value={editingSection.button_link || ''}
                    onChange={(e) => setEditingSection({ ...editingSection, button_link: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                  />
                </div>
              </div>

              {/* Scheduling Window */}
              <div className="grid grid-cols-2 gap-3 pt-1 border-t border-slate-800">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Publish Start Date</label>
                  <input
                    type="datetime-local"
                    value={editingSection.start_date ? editingSection.start_date.slice(0, 16) : ''}
                    onChange={(e) =>
                      setEditingSection({
                        ...editingSection,
                        start_date: e.target.value ? new Date(e.target.value).toISOString() : undefined,
                      })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Publish End Date</label>
                  <input
                    type="datetime-local"
                    value={editingSection.end_date ? editingSection.end_date.slice(0, 16) : ''}
                    onChange={(e) =>
                      setEditingSection({
                        ...editingSection,
                        end_date: e.target.value ? new Date(e.target.value).toISOString() : undefined,
                      })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsSectionModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-brand-500 hover:bg-brand-400 text-slate-950 font-black flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Section</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= EDIT BANNER MODAL ================= */}
      {isBannerModalOpen && editingBanner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 text-white w-full max-w-xl rounded-3xl p-6 shadow-2xl relative space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-extrabold text-white text-base">
                {editingBanner.id.startsWith('new-') ? 'Add Banner Slide' : 'Edit Banner Slide'}
              </h3>
              <button
                onClick={() => setIsBannerModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveBannerModal} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 font-bold mb-1">Banner Title</label>
                <input
                  type="text"
                  required
                  value={editingBanner.title}
                  onChange={(e) => setEditingBanner({ ...editingBanner, title: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Subtitle / Punchline</label>
                <input
                  type="text"
                  value={editingBanner.subtitle || ''}
                  onChange={(e) => setEditingBanner({ ...editingBanner, subtitle: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Badge Tag</label>
                <input
                  type="text"
                  placeholder="Certified Organic / Fresh Today"
                  value={editingBanner.badge || ''}
                  onChange={(e) => setEditingBanner({ ...editingBanner, badge: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Image URL</label>
                <input
                  type="text"
                  required
                  placeholder="https://images.unsplash.com/..."
                  value={editingBanner.image}
                  onChange={(e) => setEditingBanner({ ...editingBanner, image: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Target Link</label>
                <input
                  type="text"
                  placeholder="/products or /products?category=leafy-greens"
                  value={editingBanner.link || ''}
                  onChange={(e) => setEditingBanner({ ...editingBanner, link: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsBannerModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-brand-500 hover:bg-brand-400 text-slate-950 font-black flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Banner</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
