import React, { useState, useEffect, useCallback } from 'react';
import { Star, CheckCircle2, ShieldCheck, Flag, Edit3, MessageSquare, AlertCircle, Loader2, X } from 'lucide-react';
import api from '../../services/api';
import { ProductReview, ReviewRatingDistribution, ReviewEligibilityResponse } from '../../types';
import { useAuth } from '../../context/AuthContext';

interface ProductReviewsSectionProps {
  productId: string;
  productName: string;
  onReviewsLoaded?: (reviews: ProductReview[], averageRating: number, reviewCount: number) => void;
}

export const ProductReviewsSection: React.FC<ProductReviewsSectionProps> = ({
  productId,
  productName,
  onReviewsLoaded,
}) => {
  const { user } = useAuth();

  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [averageRating, setAverageRating] = useState<number>(0);
  const [distribution, setDistribution] = useState<ReviewRatingDistribution>({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [filterRating, setFilterRating] = useState<number | null>(null);

  // Customer Eligibility State
  const [eligibility, setEligibility] = useState<ReviewEligibilityResponse | null>(null);
  const [checkingEligibility, setCheckingEligibility] = useState<boolean>(false);

  // Modal States
  const [isWriteModalOpen, setIsWriteModalOpen] = useState<boolean>(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState<boolean>(false);
  const [reportingReviewId, setReportingReviewId] = useState<string | null>(null);

  // Write / Edit Form State
  const [editingReviewId, setEditingReviewId] = useState<string | null>(null);
  const [formRating, setFormRating] = useState<number>(5);
  const [formHoverRating, setFormHoverRating] = useState<number>(0);
  const [formTitle, setFormTitle] = useState<string>('');
  const [formText, setFormText] = useState<string>('');
  const [formOrderId, setFormOrderId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  // Report Form State
  const [reportReason, setReportReason] = useState<string>('inappropriate');
  const [reportDetails, setReportDetails] = useState<string>('');
  const [isReporting, setIsReporting] = useState<boolean>(false);
  const [reportError, setReportError] = useState<string | null>(null);

  // Load Approved Reviews
  const fetchReviews = useCallback(async () => {
    try {
      setIsLoading(true);
      const url = filterRating
        ? `/reviews/product/${productId}?rating=${filterRating}&limit=20`
        : `/reviews/product/${productId}?limit=20`;
      const res = await api.get(url);
      if (res.data?.success && res.data?.data) {
        const data = res.data.data;
        setReviews(data.reviews || []);
        setTotalCount(data.review_count || 0);
        setAverageRating(data.average_rating || 0);
        if (data.distribution) {
          setDistribution(data.distribution);
        }
        if (onReviewsLoaded) {
          onReviewsLoaded(data.reviews || [], data.average_rating || 0, data.review_count || 0);
        }
      }
    } catch (err) {
      console.error('Failed to fetch reviews:', err);
    } finally {
      setIsLoading(false);
    }
  }, [productId, filterRating, onReviewsLoaded]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  // Check Customer Eligibility when user is logged in
  useEffect(() => {
    const checkEligibility = async () => {
      if (!user) {
        setEligibility(null);
        return;
      }
      try {
        setCheckingEligibility(true);
        const res = await api.get(`/reviews/eligible-orders?product_id=${productId}`);
        if (res.data?.success && res.data?.data) {
          setEligibility(res.data.data);
          if (res.data.data.eligible_orders && res.data.data.eligible_orders.length > 0) {
            setFormOrderId(res.data.data.eligible_orders[0].order_id);
          }
        }
      } catch (err) {
        console.error('Failed to check review eligibility:', err);
      } finally {
        setCheckingEligibility(false);
      }
    };

    checkEligibility();
  }, [user, productId]);

  // Open Write Modal
  const handleOpenWriteModal = (existing?: ProductReview) => {
    setFormError(null);
    if (existing) {
      setEditingReviewId(existing.id);
      setFormRating(existing.rating);
      setFormTitle(existing.title || '');
      setFormText(existing.review_text || '');
      setFormOrderId(existing.order_id);
    } else {
      setEditingReviewId(null);
      setFormRating(5);
      setFormTitle('');
      setFormText('');
      if (eligibility?.eligible_orders && eligibility.eligible_orders.length > 0) {
        setFormOrderId(eligibility.eligible_orders[0].order_id);
      }
    }
    setIsWriteModalOpen(true);
  };

  // Submit Review Form
  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formRating || formRating < 1 || formRating > 5) {
      setFormError('Please select a rating between 1 and 5 stars.');
      return;
    }
    if (!formText || formText.trim().length < 5) {
      setFormError('Please enter a review of at least 5 characters.');
      return;
    }

    try {
      setIsSubmitting(true);
      setFormError(null);

      if (editingReviewId) {
        // Edit existing review
        await api.put(`/reviews/${editingReviewId}`, {
          rating: formRating,
          title: formTitle.trim() || undefined,
          review_text: formText.trim(),
        });
        setFeedbackMessage('Your review has been updated and submitted for moderation.');
      } else {
        // Submit new review
        await api.post('/reviews', {
          product_id: productId,
          order_id: formOrderId,
          rating: formRating,
          title: formTitle.trim() || undefined,
          review_text: formText.trim(),
        });
        setFeedbackMessage('Thank you! Your verified purchase review has been submitted for moderation.');
      }

      setIsWriteModalOpen(false);
      // Re-fetch reviews and eligibility
      fetchReviews();
      if (user) {
        const res = await api.get(`/reviews/eligible-orders?product_id=${productId}`);
        if (res.data?.data) setEligibility(res.data.data);
      }
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Failed to submit review. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Report Form
  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportingReviewId) return;

    try {
      setIsReporting(true);
      setReportError(null);
      await api.post(`/reviews/${reportingReviewId}/report`, {
        reason: reportReason,
        details: reportDetails.trim() || undefined,
      });
      setFeedbackMessage('Thank you. The review report has been submitted to our moderation team.');
      setIsReportModalOpen(false);
      setReportingReviewId(null);
      setReportDetails('');
    } catch (err: any) {
      setReportError(err.response?.data?.message || 'Failed to submit report. Please try again.');
    } finally {
      setIsReporting(false);
    }
  };

  const renderStars = (rating: number, size = 'w-4 h-4') => {
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`${size} ${
              star <= Math.round(rating)
                ? 'fill-amber-400 text-amber-500'
                : 'fill-cream-200 text-cream-300'
            }`}
          />
        ))}
      </div>
    );
  };

  return (
    <section className="space-y-6 pt-8 border-t border-line/80 font-sans" id="reviews-section">
      {/* Feedback Banner */}
      {feedbackMessage && (
        <div className="p-4 rounded-xl bg-forest-50 border border-leaf-300 flex items-center justify-between gap-3 text-forest-900 text-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-forest-700 shrink-0" />
            <span>{feedbackMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackMessage(null)}
            className="text-ink-400 hover:text-ink-700 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Title & Eligibility Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-leaf-700 font-bold text-[11px] uppercase tracking-wider">
            Verified Customer Feedback
          </span>
          <h3 className="font-serif text-2xl font-bold text-ink-900 tracking-tight mt-0.5">
            Customer Reviews & Ratings
          </h3>
        </div>

        {/* Action Button: Write a Review */}
        <div>
          {user ? (
            eligibility?.eligible ? (
              <button
                type="button"
                onClick={() => handleOpenWriteModal()}
                className="btn-pill-primary bg-forest-900 hover:bg-forest-850 text-cream-50 font-semibold text-xs px-5 py-2.5 rounded-full shadow-soft flex items-center gap-2 cursor-pointer transition-all active:scale-98"
              >
                <Edit3 className="w-4 h-4 text-leaf-400" />
                <span>Write a Verified Review</span>
              </button>
            ) : (
              <div className="text-xs text-ink-500 bg-cream-100 border border-line px-3 py-1.5 rounded-lg flex items-center gap-1.5 max-w-sm">
                <ShieldCheck className="w-4 h-4 text-ink-400 shrink-0" />
                <span>Only customers with a delivered order of this item can leave a review.</span>
              </div>
            )
          ) : (
            <div className="text-xs text-ink-500 bg-cream-100 border border-line px-3 py-1.5 rounded-lg flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-ink-400 shrink-0" />
              <span>Sign in to review verified delivered purchases.</span>
            </div>
          )}
        </div>
      </div>

      {/* Aggregate Overview Card */}
      <div className="p-6 rounded-2xl bg-cream-50/70 border border-line grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
        {/* Rating Score */}
        <div className="md:col-span-4 flex flex-col items-center justify-center text-center p-4 border-b md:border-b-0 md:border-r border-line/70">
          <span className="font-serif text-5xl font-extrabold text-ink-900 tracking-tight">
            {totalCount > 0 ? averageRating.toFixed(1) : '0.0'}
          </span>
          <div className="mt-2">{renderStars(averageRating, 'w-5 h-5')}</div>
          <span className="mt-2 text-xs font-semibold text-ink-600">
            {totalCount > 0
              ? `Based on ${totalCount} verified ${totalCount === 1 ? 'review' : 'reviews'}`
              : 'No verified reviews yet'}
          </span>
          <div className="mt-2 flex items-center gap-1 text-[11px] text-forest-800 bg-sage-100 border border-leaf-500/20 px-2.5 py-0.5 rounded-full">
            <ShieldCheck className="w-3.5 h-3.5 text-forest-700" />
            <span>100% Genuine Delivered Orders</span>
          </div>
        </div>

        {/* Rating Bars Distribution */}
        <div className="md:col-span-8 space-y-2">
          {[5, 4, 3, 2, 1].map((star) => {
            const count = (distribution as any)[star] || 0;
            const percentage = totalCount > 0 ? Math.round((count / totalCount) * 100) : 0;
            const isSelected = filterRating === star;

            return (
              <button
                key={star}
                type="button"
                onClick={() => setFilterRating(isSelected ? null : star)}
                className={`w-full flex items-center gap-3 text-xs p-1 rounded-lg transition-colors cursor-pointer group text-left ${
                  isSelected ? 'bg-sage-100' : 'hover:bg-cream-100'
                }`}
              >
                <div className="flex items-center gap-1 w-14 shrink-0 font-medium text-ink-700">
                  <span>{star}</span>
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                </div>
                <div className="flex-1 h-2.5 bg-cream-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-400 rounded-full transition-all duration-500"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <div className="w-16 text-right font-mono text-[11px] text-ink-500 shrink-0">
                  {percentage}% ({count})
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Filter Chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        <span className="text-ink-500 font-semibold mr-1">Filter:</span>
        <button
          type="button"
          onClick={() => setFilterRating(null)}
          className={`px-3 py-1.5 rounded-full border text-xs font-semibold transition-all cursor-pointer ${
            filterRating === null
              ? 'bg-forest-900 border-forest-900 text-cream-50 shadow-soft'
              : 'bg-surface border-line text-ink-700 hover:bg-cream-100'
          }`}
        >
          All ({totalCount})
        </button>
        {[5, 4, 3, 2, 1].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => setFilterRating(filterRating === star ? null : star)}
            className={`px-3 py-1.5 rounded-full border text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
              filterRating === star
                ? 'bg-forest-900 border-forest-900 text-cream-50 shadow-soft'
                : 'bg-surface border-line text-ink-700 hover:bg-cream-100'
            }`}
          >
            <span>{star}</span>
            <Star className="w-3 h-3 fill-amber-400 text-amber-500" />
            <span>({(distribution as any)[star] || 0})</span>
          </button>
        ))}
      </div>

      {/* Reviews List */}
      {isLoading ? (
        <div className="py-12 flex flex-col items-center justify-center text-ink-500 gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-forest-700" />
          <span className="text-xs">Loading verified customer reviews...</span>
        </div>
      ) : reviews.length === 0 ? (
        <div className="py-12 text-center p-8 rounded-2xl bg-cream-50/50 border border-line space-y-2">
          <MessageSquare className="w-10 h-10 mx-auto text-ink-300" />
          <h4 className="font-serif font-bold text-ink-800 text-base">
            {filterRating ? `No ${filterRating}-star reviews yet` : 'Be the first to review this vegetable'}
          </h4>
          <p className="text-xs text-ink-500 max-w-md mx-auto">
            {filterRating
              ? 'Try selecting a different rating or viewing all reviews.'
              : 'Have you purchased and enjoyed this produce? Delivered customers can share their honest verified feedback.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map((rev) => {
            const isAuthor = user && rev.user_id === user.id;

            return (
              <div
                key={rev.id}
                className="p-5 rounded-2xl bg-surface border border-line space-y-3 transition-shadow hover:shadow-soft"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-ink-900 text-sm">
                        {rev.customer_name || 'Verified Customer'}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-leaf-800 bg-sage-100 border border-leaf-500/20 px-2 py-0.5 rounded-full">
                        <CheckCircle2 className="w-3 h-3 text-leaf-700" />
                        <span>Verified Purchase</span>
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {renderStars(rev.rating)}
                      <span className="text-xs text-ink-400 font-mono">
                        {new Date(rev.created_at).toLocaleDateString('en-IN', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    </div>
                  </div>

                  {/* Actions: Edit or Report */}
                  <div className="flex items-center gap-1.5">
                    {isAuthor ? (
                      <button
                        type="button"
                        onClick={() => handleOpenWriteModal(rev)}
                        className="text-xs font-semibold text-forest-800 hover:text-forest-950 flex items-center gap-1 bg-sage-100 hover:bg-sage-200 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                        title="Edit your review"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setReportingReviewId(rev.id);
                          setIsReportModalOpen(true);
                        }}
                        className="text-xs text-ink-400 hover:text-tomato-600 flex items-center gap-1 p-1 rounded hover:bg-cream-100 transition-colors cursor-pointer"
                        title="Report inappropriate review"
                      >
                        <Flag className="w-3.5 h-3.5" />
                        <span className="sr-only">Report</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Review Title & Body */}
                {rev.title && (
                  <h5 className="font-bold text-ink-900 text-sm leading-snug">{rev.title}</h5>
                )}
                {rev.review_text && (
                  <p className="text-xs text-ink-700 leading-relaxed whitespace-pre-line">
                    {rev.review_text}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Write / Edit Modal */}
      {isWriteModalOpen && (
        <div className="fixed inset-0 z-50 bg-forest-950/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface rounded-2xl max-w-lg w-full p-6 shadow-xl border border-line space-y-5 animate-slide-up">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h4 className="font-serif text-lg font-bold text-ink-900">
                {editingReviewId ? 'Edit Your Review' : `Review Fresh ${productName}`}
              </h4>
              <button
                type="button"
                onClick={() => setIsWriteModalOpen(false)}
                className="text-ink-400 hover:text-ink-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-lg bg-tomato-50 border border-tomato-200 text-tomato-800 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-tomato-600" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitReview} className="space-y-4 text-xs font-sans">
              {/* Star Rating Picker */}
              <div>
                <label className="block font-semibold text-ink-800 mb-1">
                  Overall Rating <span className="text-tomato-600">*</span>
                </label>
                <div className="flex items-center gap-1.5 py-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setFormRating(star)}
                      onMouseEnter={() => setFormHoverRating(star)}
                      onMouseLeave={() => setFormHoverRating(0)}
                      className="p-1 hover:scale-110 transition-transform cursor-pointer"
                    >
                      <Star
                        className={`w-7 h-7 ${
                          star <= (formHoverRating || formRating)
                            ? 'fill-amber-400 text-amber-500'
                            : 'fill-cream-200 text-cream-300'
                        }`}
                      />
                    </button>
                  ))}
                  <span className="ml-2 font-bold text-ink-800 text-sm">
                    {formHoverRating || formRating} of 5 Stars
                  </span>
                </div>
              </div>

              {/* Order Selection if multiple delivered orders */}
              {eligibility?.eligible_orders && eligibility.eligible_orders.length > 1 && !editingReviewId && (
                <div>
                  <label className="block font-semibold text-ink-800 mb-1">
                    Delivered Order Verified <span className="text-tomato-600">*</span>
                  </label>
                  <select
                    value={formOrderId}
                    onChange={(e) => setFormOrderId(e.target.value)}
                    className="w-full px-3 py-2 border border-line rounded-lg bg-cream-50 focus:outline-leaf-500 text-ink-900"
                    required
                  >
                    {eligibility.eligible_orders.map((ord) => (
                      <option key={ord.order_id} value={ord.order_id}>
                        Order #{ord.order_number} (Delivered{' '}
                        {new Date(ord.delivered_at).toLocaleDateString('en-IN')})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Review Headline */}
              <div>
                <label className="block font-semibold text-ink-800 mb-1">
                  Review Headline (Optional)
                </label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g., Crispy, fresh and delivered swiftly!"
                  maxLength={120}
                  className="w-full px-3 py-2 border border-line rounded-lg bg-cream-50 focus:outline-leaf-500 text-ink-900 text-xs"
                />
              </div>

              {/* Review Text */}
              <div>
                <label className="block font-semibold text-ink-800 mb-1">
                  Detailed Experience <span className="text-tomato-600">*</span>
                </label>
                <textarea
                  value={formText}
                  onChange={(e) => setFormText(e.target.value)}
                  placeholder="Tell us about the freshness, quality, and flavor of this vegetable..."
                  rows={4}
                  maxLength={1000}
                  required
                  className="w-full px-3 py-2 border border-line rounded-lg bg-cream-50 focus:outline-leaf-500 text-ink-900 text-xs leading-relaxed"
                />
                <div className="flex justify-between items-center text-[10px] text-ink-400 mt-1">
                  <span>Minimum 5 characters</span>
                  <span>{formText.length}/1000</span>
                </div>
              </div>

              {/* Moderation note */}
              <div className="p-3 rounded-lg bg-cream-100 text-[11px] text-ink-600 flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-forest-700 shrink-0 mt-0.5" />
                <span>
                  All customer reviews are verified against genuine delivered orders and reviewed by our quality team before appearing publicly.
                </span>
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
                <button
                  type="button"
                  onClick={() => setIsWriteModalOpen(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2 border border-line rounded-full font-semibold text-ink-600 hover:bg-cream-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn-pill-primary bg-forest-900 hover:bg-forest-850 disabled:bg-cream-200 disabled:text-ink-400 text-cream-50 font-semibold px-5 py-2 rounded-full shadow-soft flex items-center gap-1.5 cursor-pointer"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{editingReviewId ? 'Update Review' : 'Submit Review'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Report Review Modal */}
      {isReportModalOpen && (
        <div className="fixed inset-0 z-50 bg-forest-950/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface rounded-2xl max-w-md w-full p-6 shadow-xl border border-line space-y-4 animate-slide-up">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h4 className="font-serif text-base font-bold text-ink-900 flex items-center gap-2">
                <Flag className="w-4 h-4 text-tomato-600" />
                <span>Report Review</span>
              </h4>
              <button
                type="button"
                onClick={() => setIsReportModalOpen(false)}
                className="text-ink-400 hover:text-ink-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {reportError && (
              <div className="p-3 rounded-lg bg-tomato-50 border border-tomato-200 text-tomato-800 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-tomato-600" />
                <span>{reportError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitReport} className="space-y-4 text-xs font-sans">
              <div>
                <label className="block font-semibold text-ink-800 mb-1">
                  Reason for Reporting <span className="text-tomato-600">*</span>
                </label>
                <select
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  className="w-full px-3 py-2 border border-line rounded-lg bg-cream-50 focus:outline-leaf-500 text-ink-900"
                  required
                >
                  <option value="inappropriate">Offensive or Inappropriate Content</option>
                  <option value="spam">Spam, Promotional or Commercial</option>
                  <option value="fake">Fake or Misleading Information</option>
                  <option value="off_topic">Off-topic / Not about this product</option>
                  <option value="other">Other Violation</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-ink-800 mb-1">
                  Additional Details (Optional)
                </label>
                <textarea
                  value={reportDetails}
                  onChange={(e) => setReportDetails(e.target.value)}
                  placeholder="Explain why this review should be moderated..."
                  rows={3}
                  maxLength={500}
                  className="w-full px-3 py-2 border border-line rounded-lg bg-cream-50 focus:outline-leaf-500 text-ink-900 text-xs leading-relaxed"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
                <button
                  type="button"
                  onClick={() => setIsReportModalOpen(false)}
                  disabled={isReporting}
                  className="px-4 py-2 border border-line rounded-full font-semibold text-ink-600 hover:bg-cream-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isReporting}
                  className="btn-pill-primary bg-tomato-600 hover:bg-tomato-700 disabled:bg-cream-200 disabled:text-ink-400 text-cream-50 font-semibold px-4 py-2 rounded-full shadow-soft flex items-center gap-1.5 cursor-pointer"
                >
                  {isReporting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Submit Report</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};
