export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .trim();
}

export function generateOrderNumber(): string {
  const prefix = 'FV';
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}${timestamp}${random}`;
}

export function calculateDiscount(mrp: number, sellingPrice: number): number {
  if (mrp <= 0 || sellingPrice >= mrp) return 0;
  return Math.round(((mrp - sellingPrice) / mrp) * 100);
}

export function getStockStatus(stockQuantity: number, minimumStock: number): string {
  if (stockQuantity <= 0) return 'out_of_stock';
  if (stockQuantity <= minimumStock) return 'low_stock';
  return 'in_stock';
}

export function parsePaginationParams(query: any): { page: number; limit: number; offset: number } {
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 20));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}
