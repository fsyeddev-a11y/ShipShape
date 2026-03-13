/**
 * Shared cookie configuration for cross-origin deployments.
 *
 * When web and API are on different domains (e.g., Render), cookies must use
 * sameSite: 'none' + secure: true so the browser sends them cross-origin.
 * Same-origin deployments (e.g., behind CloudFront) use 'strict'.
 */

const isProduction = process.env.NODE_ENV === 'production';
const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';

// Cross-origin if production and CORS origin is set to a different domain
const isCrossOrigin = isProduction && !corsOrigin.includes('localhost');

export const cookieSameSite: 'strict' | 'none' = isCrossOrigin ? 'none' : 'strict';
export const cookieSecure: boolean = isProduction;
