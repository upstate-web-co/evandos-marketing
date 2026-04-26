// Single source of truth for shared constants across React admin components.
// Rule 20 / Rule 24: Extract at 3 — if a constant appears in 2+ files, it lives here.

export const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-[#F7F4EF]/10 text-[#F7F4EF]/50',
  scheduled: 'bg-blue-900/30 text-blue-300',
  posting: 'bg-yellow-900/30 text-yellow-300',
  posted: 'bg-green-900/30 text-green-300',
  failed: 'bg-red-900/30 text-red-300',
  cancelled: 'bg-[#F7F4EF]/5 text-[#F7F4EF]/30',
  archived: 'bg-[#F7F4EF]/5 text-[#F7F4EF]/30',
  approved: 'bg-green-900/30 text-green-300',
}

export const PLATFORM_LABELS: Record<string, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  linkedin: 'LinkedIn',
  gbp: 'Google Business Profile',
}

export const PLATFORM_BADGE_STYLES: Record<string, string> = {
  facebook: 'bg-blue-600 text-white',
  instagram: 'bg-pink-600 text-white',
  linkedin: 'bg-sky-700 text-white',
  gbp: 'bg-amber-600 text-white',
}

export const PLATFORM_CHAR_LIMITS: Record<string, number> = {
  facebook: 63206,
  instagram: 2200,
  linkedin: 3000,
  gbp: 1500,
}

export const PLATFORMS = ['facebook', 'instagram', 'linkedin', 'gbp'] as const
export type Platform = typeof PLATFORMS[number]

// Error codes used across API responses
export const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  DB_NOT_CONFIGURED: 'DB_NOT_CONFIGURED',
  AI_SERVICE_ERROR: 'AI_SERVICE_ERROR',
  UPLOAD_FAILED: 'UPLOAD_FAILED',
  DAILY_LIMIT_REACHED: 'DAILY_LIMIT_REACHED',
  RATE_LIMITED: 'RATE_LIMITED',
} as const
