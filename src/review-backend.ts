import { REVIEW_PROJECT_ID, requireReviewBrowserKey } from './review-backend-config.mjs'

// Only the registered synthetic backend is reachable from this review build.
export const projectId = REVIEW_PROJECT_ID
export const publicAnonKey = requireReviewBrowserKey(import.meta.env.VITE_SUPABASE_ANON_KEY)
