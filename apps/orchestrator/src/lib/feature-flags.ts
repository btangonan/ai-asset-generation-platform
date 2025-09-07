/**
 * Feature flags for gradual rollout and safe deployment
 * Required by North Star for canary releases
 */

interface FeatureFlags {
  HYBRID_V1_ENABLED: boolean;
  SSE_PROGRESS_ENABLED: boolean;
  REFERENCE_DEDUP_ENABLED: boolean;
  BUDGET_GUARD_ENABLED: boolean;
  LEDGER_VERSIONING_ENABLED: boolean;
}

/**
 * Check if a feature is enabled for a user
 */
export function isFeatureEnabled(
  feature: keyof FeatureFlags,
  userId?: string
): boolean {
  // Check environment variable override
  const envOverride = process.env[`FF_${feature}`];
  if (envOverride !== undefined) {
    return envOverride === 'true';
  }
  
  // Default feature states
  const defaults: FeatureFlags = {
    HYBRID_V1_ENABLED: process.env.HYBRID_V1_ENABLED === 'true',
    SSE_PROGRESS_ENABLED: true,
    REFERENCE_DEDUP_ENABLED: true,
    BUDGET_GUARD_ENABLED: false, // Start disabled, enable gradually
    LEDGER_VERSIONING_ENABLED: true,
  };
  
  // User-specific overrides (for canary rollout)
  if (userId && process.env.CANARY_USERS) {
    const canaryUsers = process.env.CANARY_USERS.split(',');
    if (canaryUsers.includes(userId)) {
      // Canary users get all features
      return true;
    }
  }
  
  return defaults[feature] ?? false;
}

/**
 * Get percentage rollout for a feature
 */
export function getRolloutPercentage(feature: keyof FeatureFlags): number {
  const envVar = process.env[`FF_${feature}_ROLLOUT`];
  return envVar ? parseInt(envVar, 10) : 0;
}

/**
 * Check if user is in rollout percentage
 */
export function isInRollout(
  feature: keyof FeatureFlags,
  userId: string
): boolean {
  const percentage = getRolloutPercentage(feature);
  if (percentage === 0) return false;
  if (percentage >= 100) return true;
  
  // Simple hash-based rollout
  const hash = userId.split('').reduce((acc, char) => 
    acc + char.charCodeAt(0), 0);
  return (hash % 100) < percentage;
}