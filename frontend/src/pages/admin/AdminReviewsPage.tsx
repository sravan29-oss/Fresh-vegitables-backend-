import React, { useState, useEffect } from 'react';
import {
  Star,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  EyeOff,
  AlertTriangle,
  MessageSquare,
  ShieldAlert,
  Clock,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Edit3,
  User,
  ShoppingBag,
} from 'lucide-react';
import api from '../../services/api';
import { SEOHead } from '../../components/common/SEOHead';

interface ReviewItem {
  id: string;
  product_id: string;
  user_id: string;
  order_id: string;
  rating: number;
  title?: string;
  review_text: string;
  status: 'pending' | 'approved' | 'rejected' | 'hidden';
  admin_notes?: string;
  verified_purchase: boolean;
  helpful_votes: number;
  reported_count: number;
  created_at: string;
  updated_at: string;
  product_name?: string;
  product_slug?: string;
  product_images?: string[];
  customer_name?: string;
  customer_email?: string;
  order_number?: string;
}

interface ReviewReport {
  id: string;
  review_id: string;
  user_id: string;
  reason: string;
  status: 'pending' | 'reviewed' | 'dismissed';
  admin_notes?: string;
  created_at: string;
  review_title?: string;
  review_text?: string;
  review_status?: string;
  rating?: number;
  product_name?: string;
  reporter_name?: string;
  reporter_email?: string;
}

export const AdminReviewsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'reviews' | 'reports'>('reviews');
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [reports, setReports] = useState<ReviewReport[]>([]);
  const [summary, setSummary] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    hidden: 0,
    reported: 0,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [ratingFilter, setRatingFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Admin notes modal/inline
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);
  const [notesText, setNotesText] = useState('');

  const fetchReviews = async () => {
    setIsLoading(true);
    try {
      const params: any = {
        page: currentPage,
        limit: 15,
      };
      if (statusFilter !== 'all') params.status = statusFilter;
      if (ratingFilter !== 'all') params.rating = ratingFilter;
      if (searchQuery.trim()) params.search = searchQuery.trim();

      const res = await api.get('/reviews/admin/all', { params });
      if (res.data?.data) {
        setReviews(res.data.data.reviews || []);
        if (res.data.data.summary) {
          setSummary(res.data.data.summary);
        }
        if (res.data.data.pagination) {
          setTotalPages(res.data.data.pagination.total_pages || 1);
        }
      }
    } catch (err) {
      console.error('Failed to load admin reviews', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchReports = async () => {
    setIsLoading(true);
    try {
      const res = await api.get('/reviews/admin/reports');
      if (res.data?.data?.reports) {
        setReports(res.data.data.reports);
      }
    } catch (err) {
      console.error('Failed to load review reports', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'reviews') {
      fetchReviews();
    } else {
      fetchReports();
    }
  }, [activeTab, statusFilter, ratingFilter, currentPage]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchReviews();
  };

  const handleUpdateStatus = async (
    reviewId: string,
    status: 'approved' | 'rejected' | 'hidden',
    notes?: string
  ) => {
    setActionLoadingId(reviewId);
    try {
      await api.put(`/reviews/admin/${reviewId}/status`, {
        status,
        admin_notes: notes,
      });
      // Refresh
      fetchReviews();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update review status');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleSaveNotes = async (reviewId: string) => {
    setActionLoadingId(reviewId);
    try {
      const r = reviews.find((x) => x.id === reviewId);
      if (r) {
        await api.put(`/reviews/admin/${reviewId}/status`, {
          status: r.status,
          admin_notes: notesText,
        });
      }
      setEditingNotesId(null);
      fetchReviews();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to save admin notes');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleUpdateReportStatus = async (reportId: string, status: 'reviewed' | 'dismissed') => {
    setActionLoadingId(reportId);
    try {
      await api.put(`/reviews/admin/reports/${reportId}/status`, { status });
      fetchReports();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update report status');
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <SEOHead title="Customer Reviews Moderation | Admin Panel" noindex={true} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <span className="text-leaf-400 font-bold text-xs uppercase tracking-wider font-mono">
            Phase 16 Moderation
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold font-serif text-slate-100 flex items-center gap-2.5 mt-0.5">
            <Star className="w-7 h-7 text-amber-400 fill-amber-400" />
            Customer Reviews & Ratings
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Review submissions from customers with genuine delivered orders. Only approved reviews appear publicly.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center bg-slate-800 p-1 rounded-xl border border-slate-700">
          <button
            type="button"
            onClick={() => {
              setActiveTab('reviews');
              setCurrentPage(1);
            }}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'reviews'
                ? 'bg-emerald-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All Reviews ({summary.total})
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('reports');
              setCurrentPage(1);
            }}
            className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
              activeTab === 'reports'
                ? 'bg-rose-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            Reported ({summary.reported})
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-slate-800/80 p-3.5 rounded-2xl border border-slate-700/80">
          <div className="text-[11px] font-bold text-slate-400 uppercase">Total Reviews</div>
          <div className="text-xl sm:text-2xl font-bold text-white mt-1 font-mono">{summary.total}</div>
        </div>
        <div className="bg-amber-950/30 p-3.5 rounded-2xl border border-amber-800/40">
          <div className="text-[11px] font-bold text-amber-400 uppercase flex items-center gap-1">
            <Clock className="w-3 h-3" /> Pending
          </div>
          <div className="text-xl sm:text-2xl font-bold text-amber-300 mt-1 font-mono">{summary.pending}</div>
        </div>
        <div className="bg-emerald-950/30 p-3.5 rounded-2xl border border-emerald-800/40">
          <div className="text-[11px] font-bold text-emerald-400 uppercase flex items-center gap-1">
            <CheckCircle className="w-3 h-3" /> Approved
          </div>
          <div className="text-xl sm:text-2xl font-bold text-emerald-300 mt-1 font-mono">{summary.approved}</div>
        </div>
        <div className="bg-rose-950/30 p-3.5 rounded-2xl border border-rose-800/40">
          <div className="text-[11px] font-bold text-rose-400 uppercase flex items-center gap-1">
            <XCircle className="w-3 h-3" /> Rejected
          </div>
          <div className="text-xl sm:text-2xl font-bold text-rose-300 mt-1 font-mono">{summary.rejected}</div>
        </div>
        <div className="bg-slate-800/80 p-3.5 rounded-2xl border border-slate-700/80">
          <div className="text-[11px] font-bold text-slate-400 uppercase flex items-center gap-1">
            <EyeOff className="w-3 h-3" /> Hidden
          </div>
          <div className="text-xl sm:text-2xl font-bold text-slate-300 mt-1 font-mono">{summary.hidden}</div>
        </div>
        <div className="bg-purple-950/30 p-3.5 rounded-2xl border border-purple-800/40">
          <div className="text-[11px] font-bold text-purple-400 uppercase flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> Flagged
          </div>
          <div className="text-xl sm:text-2xl font-bold text-purple-300 mt-1 font-mono">{summary.reported}</div>
        </div>
      </div>

      {activeTab === 'reviews' ? (
        <>
          {/* Filters Bar */}
          <div className="bg-slate-800/90 p-4 rounded-2xl border border-slate-700/80 space-y-3 sm:space-y-0 sm:flex sm:items-center sm:gap-3">
            <form onSubmit={handleSearchSubmit} className="flex-1 relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by customer, email, product, order #, or text..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </form>

            <div className="flex flex-wrap items-center gap-2">
              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-emerald-500 font-medium"
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending Moderation</option>
                <option value="approved">Approved (Public)</option>
                <option value="rejected">Rejected</option>
                <option value="hidden">Hidden</option>
              </select>

              {/* Rating Filter */}
              <select
                value={ratingFilter}
                onChange={(e) => {
                  setRatingFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-emerald-500 font-medium"
              >
                <option value="all">All Ratings</option>
                <option value="5">5 Stars ★★★★★</option>
                <option value="4">4 Stars ★★★★☆</option>
                <option value="3">3 Stars ★★★☆☆</option>
                <option value="2">2 Stars ★★☆☆☆</option>
                <option value="1">1 Star ★☆☆☆☆</option>
              </select>
            </div>
          </div>

          {/* Reviews List */}
          {isLoading ? (
            <div className="p-12 text-center text-slate-400 space-y-2">
              <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs">Loading customer reviews...</p>
            </div>
          ) : reviews.length === 0 ? (
            <div className="bg-slate-800/60 p-12 text-center rounded-2xl border border-slate-700/80 space-y-3">
              <div className="w-12 h-12 rounded-full bg-slate-700 flex items-center justify-center mx-auto text-xl">
                ⭐
              </div>
              <h3 className="text-base font-bold text-slate-200 font-serif">No Customer Reviews Found</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                No reviews match your selected filter criteria. Reviews submitted by customers with verified delivered orders will appear here for moderation.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {reviews.map((r) => {
                const isPending = r.status === 'pending';
                const isApproved = r.status === 'approved';
                const isRejected = r.status === 'rejected';
                const isHidden = r.status === 'hidden';

                return (
                  <div
                    key={r.id}
                    className={`bg-slate-800/90 rounded-2xl border transition-all p-4 sm:p-5 space-y-3 ${
                      isPending
                        ? 'border-amber-600/50 shadow-md shadow-amber-950/20'
                        : isApproved
                        ? 'border-emerald-700/40'
                        : isRejected
                        ? 'border-rose-800/40 opacity-75'
                        : 'border-slate-700/80 opacity-60'
                    }`}
                  >
                    {/* Top Row: Product, Status Pill, Created Date */}
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-700 overflow-hidden flex items-center justify-center shrink-0">
                          {r.product_images?.[0] ? (
                            <img
                              src={r.product_images[0]}
                              alt={r.product_name || 'Product'}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <ShoppingBag className="w-5 h-5 text-slate-400" />
                          )}
                        </div>
                        <div>
                          <div className="font-serif font-bold text-sm text-slate-100">
                            {r.product_name || 'Fresh Vegetable'}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            Order #{r.order_number || r.order_id?.slice(0, 8)}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {r.reported_count > 0 && (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-purple-900/60 text-purple-300 border border-purple-700/60 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> Flagged ({r.reported_count})
                          </span>
                        )}

                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            isApproved
                              ? 'bg-emerald-900/60 text-emerald-300 border border-emerald-700/60'
                              : isPending
                              ? 'bg-amber-900/60 text-amber-300 border border-amber-700/60'
                              : isRejected
                              ? 'bg-rose-900/60 text-rose-300 border border-rose-700/60'
                              : 'bg-slate-700 text-slate-300'
                          }`}
                        >
                          {r.status}
                        </span>

                        <span className="text-[11px] text-slate-500 font-mono">
                          {new Date(r.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    {/* Middle: Star Rating & Review Text */}
                    <div className="space-y-1.5 bg-slate-900/60 p-3.5 rounded-xl border border-slate-700/50">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-0.5">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              className={`w-4 h-4 ${
                                star <= r.rating
                                  ? 'text-amber-400 fill-amber-400'
                                  : 'text-slate-600'
                              }`}
                            />
                          ))}
                        </div>
                        <span className="text-xs font-bold text-amber-400 font-mono">
                          {r.rating}.0
                        </span>
                        {r.title && (
                          <span className="text-xs font-bold text-slate-200">
                            • {r.title}
                          </span>
                        )}
                        {r.verified_purchase && (
                          <span className="text-[10px] bg-emerald-950 text-emerald-400 px-2 py-0.2 rounded border border-emerald-800 font-semibold ml-auto flex items-center gap-1">
                            <CheckCircle className="w-2.5 h-2.5" /> Verified Purchase
                          </span>
                        )}
                      </div>

                      <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-sans whitespace-pre-line">
                        {r.review_text}
                      </p>
                    </div>

                    {/* Author Info & Notes */}
                    <div className="flex flex-wrap items-center justify-between text-xs text-slate-400 pt-1 gap-2">
                      <div className="flex items-center gap-2">
                        <User className="w-3.5 h-3.5 text-slate-500" />
                        <span className="font-medium text-slate-300">{r.customer_name || 'Customer'}</span>
                        <span className="text-slate-500 font-mono text-[11px]">({r.customer_email})</span>
                      </div>

                      {/* Admin Notes Preview / Edit */}
                      <div className="flex items-center gap-2">
                        {r.admin_notes ? (
                          <span className="text-[11px] bg-slate-700/80 px-2 py-0.5 rounded text-slate-300 font-mono">
                            Note: {r.admin_notes}
                          </span>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => {
                            setEditingNotesId(r.id);
                            setNotesText(r.admin_notes || '');
                          }}
                          className="text-[11px] text-leaf-400 hover:text-leaf-300 flex items-center gap-1 font-semibold"
                        >
                          <Edit3 className="w-3 h-3" />
                          {r.admin_notes ? 'Edit Note' : 'Add Note'}
                        </button>
                      </div>
                    </div>

                    {/* Editing Notes Inline */}
                    {editingNotesId === r.id && (
                      <div className="p-3 bg-slate-900 rounded-xl border border-slate-700 space-y-2">
                        <label className="text-[11px] font-bold text-slate-400 uppercase">
                          Internal Admin Note (Private to Store Operators)
                        </label>
                        <input
                          type="text"
                          value={notesText}
                          onChange={(e) => setNotesText(e.target.value)}
                          placeholder="e.g. Verified harvest date with Champapet farm supervisor..."
                          className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500"
                        />
                        <div className="flex items-center gap-2 justify-end">
                          <button
                            type="button"
                            onClick={() => setEditingNotesId(null)}
                            className="px-3 py-1 rounded bg-slate-800 text-xs text-slate-300 hover:bg-slate-700"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveNotes(r.id)}
                            disabled={actionLoadingId === r.id}
                            className="px-3 py-1 rounded bg-emerald-600 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
                          >
                            Save Note
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Action Bar */}
                    <div className="pt-2 border-t border-slate-700/60 flex flex-wrap items-center justify-end gap-2">
                      {isPending && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleUpdateStatus(r.id, 'approved')}
                            disabled={actionLoadingId === r.id}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1 shadow transition-all disabled:opacity-50"
                          >
                            <CheckCircle className="w-3.5 h-3.5" /> Approve Review
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdateStatus(r.id, 'rejected')}
                            disabled={actionLoadingId === r.id}
                            className="px-3 py-1.5 rounded-lg bg-rose-600/80 hover:bg-rose-600 text-white font-bold text-xs flex items-center gap-1 shadow transition-all disabled:opacity-50"
                          >
                            <XCircle className="w-3.5 h-3.5" /> Reject
                          </button>
                        </>
                      )}

                      {isApproved && (
                        <button
                          type="button"
                          onClick={() => handleUpdateStatus(r.id, 'hidden')}
                          disabled={actionLoadingId === r.id}
                          className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold text-xs flex items-center gap-1 transition-all disabled:opacity-50"
                        >
                          <EyeOff className="w-3.5 h-3.5" /> Hide From Store
                        </button>
                      )}

                      {(isRejected || isHidden) && (
                        <button
                          type="button"
                          onClick={() => handleUpdateStatus(r.id, 'approved')}
                          disabled={actionLoadingId === r.id}
                          className="px-3 py-1.5 rounded-lg bg-emerald-700/80 hover:bg-emerald-600 text-white font-bold text-xs flex items-center gap-1 transition-all disabled:opacity-50"
                        >
                          <CheckCircle className="w-3.5 h-3.5" /> Re-Approve
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t border-slate-700/80 text-xs text-slate-400">
              <div>
                Page <span className="font-bold text-slate-200">{currentPage}</span> of{' '}
                <span className="font-bold text-slate-200">{totalPages}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage <= 1}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 text-slate-200 font-medium"
                >
                  <ChevronLeft className="w-4 h-4" /> Previous
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage >= totalPages}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 text-slate-200 font-medium"
                >
                  Next <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        /* Reported Reviews Section */
        <div className="space-y-4">
          {reports.length === 0 ? (
            <div className="bg-slate-800/60 p-12 text-center rounded-2xl border border-slate-700/80 space-y-2">
              <CheckCircle className="w-10 h-10 text-emerald-400 mx-auto" />
              <h3 className="text-base font-bold text-slate-200 font-serif">No Inappropriate Reviews Reported</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Customer community reports will appear here for administrator investigation and dismissal or hiding.
              </p>
            </div>
          ) : (
            reports.map((rep) => (
              <div
                key={rep.id}
                className="bg-slate-800/90 rounded-2xl border border-purple-800/50 p-4 sm:p-5 space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-purple-900/60 text-purple-300 border border-purple-700">
                      Report Status: {rep.status}
                    </span>
                    <h4 className="font-bold text-sm text-slate-100 mt-1">
                      Flagged on {rep.product_name || 'Product'}
                    </h4>
                  </div>
                  <span className="text-[11px] text-slate-500 font-mono">
                    {new Date(rep.created_at).toLocaleDateString()}
                  </span>
                </div>

                <div className="bg-slate-900/70 p-3 rounded-xl border border-slate-700/60 text-xs space-y-1">
                  <div className="text-slate-400 font-bold uppercase text-[10px]">Reason Given by Reporter:</div>
                  <p className="text-rose-300 font-medium">{rep.reason}</p>
                  <div className="text-[11px] text-slate-500">
                    Reported by: {rep.reporter_name} ({rep.reporter_email})
                  </div>
                </div>

                <div className="bg-slate-900/40 p-3 rounded-xl border border-slate-700/40 text-xs space-y-1">
                  <div className="text-slate-400 font-bold uppercase text-[10px]">Review Content:</div>
                  <div className="text-amber-400 font-mono text-[11px]">★ {rep.rating}.0 / 5</div>
                  <p className="text-slate-300 italic">"{rep.review_text}"</p>
                </div>

                <div className="pt-2 border-t border-slate-700 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => handleUpdateReportStatus(rep.id, 'dismissed')}
                    disabled={actionLoadingId === rep.id}
                    className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-bold transition-all disabled:opacity-50"
                  >
                    Dismiss Report
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await handleUpdateStatus(rep.review_id, 'hidden', `Hidden due to report #${rep.id}: ${rep.reason}`);
                      await handleUpdateReportStatus(rep.id, 'reviewed');
                    }}
                    disabled={actionLoadingId === rep.id}
                    className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all disabled:opacity-50"
                  >
                    Hide Review & Mark Reviewed
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default AdminReviewsPage;
