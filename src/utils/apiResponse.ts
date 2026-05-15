// ============================================================
// LYO - API Response Helpers
// ============================================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  meta?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, string[]>;
  };
}

export function success<T>(data: T, message?: string, meta?: ApiResponse['meta']): ApiResponse<T> {
  return { success: true, data, message, meta };
}

export function error(code: string, message: string, details?: Record<string, string[]>): ApiError {
  return { success: false, error: { code, message, details } };
}

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: Record<string, string[]>
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function paginate<T>(items: T[], page: number, limit: number, total: number) {
  return {
    items,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}
