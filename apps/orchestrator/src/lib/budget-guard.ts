import { ErrorCode } from '@ai-platform/shared';

/**
 * User budget tracking
 * In production, this would be stored in a database
 */
const userBudgets = new Map<string, {
  dailyLimit: number;
  spent: number;
  resetAt: Date;
}>();

/**
 * Default daily budget per user
 */
const DEFAULT_DAILY_BUDGET = 10.00; // $10 per day

/**
 * Get or initialize user budget
 */
function getUserBudget(userId: string) {
  const now = new Date();
  const existing = userBudgets.get(userId);
  
  // Check if we need to reset (new day)
  if (existing && existing.resetAt > now) {
    return existing;
  }
  
  // Initialize or reset budget
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  
  const budget = {
    dailyLimit: DEFAULT_DAILY_BUDGET,
    spent: 0,
    resetAt: tomorrow,
  };
  
  userBudgets.set(userId, budget);
  return budget;
}

/**
 * Check if user has sufficient budget
 */
export function checkBudget(
  userId: string,
  estimatedCost: number
): {
  allowed: boolean;
  remaining: number;
  dailyLimit: number;
  spent: number;
  estimatedCost: number;
  code?: ErrorCode;
  message?: string;
} {
  const budget = getUserBudget(userId);
  const remaining = budget.dailyLimit - budget.spent;
  const allowed = estimatedCost <= remaining;
  
  if (!allowed) {
    return {
      allowed: false,
      remaining,
      dailyLimit: budget.dailyLimit,
      spent: budget.spent,
      estimatedCost,
      code: ErrorCode.BUDGET_EXCEEDED,
      message: `Estimated cost $${estimatedCost.toFixed(2)} exceeds remaining daily budget $${remaining.toFixed(2)}`,
    };
  }
  
  return {
    allowed: true,
    remaining,
    dailyLimit: budget.dailyLimit,
    spent: budget.spent,
    estimatedCost,
  };
}

/**
 * Record spent amount
 */
export function recordSpend(userId: string, amount: number): void {
  const budget = getUserBudget(userId);
  budget.spent += amount;
  userBudgets.set(userId, budget);
  
  console.log(`User ${userId} spent $${amount.toFixed(2)}, total: $${budget.spent.toFixed(2)}/$${budget.dailyLimit.toFixed(2)}`);
}

/**
 * Get remaining budget for user
 */
export function getRemainingBudget(userId: string): number {
  const budget = getUserBudget(userId);
  return Math.max(0, budget.dailyLimit - budget.spent);
}

/**
 * Set custom daily limit for user
 */
export function setUserDailyLimit(userId: string, limit: number): void {
  const budget = getUserBudget(userId);
  budget.dailyLimit = limit;
  userBudgets.set(userId, budget);
}