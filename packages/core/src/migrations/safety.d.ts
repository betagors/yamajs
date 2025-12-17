import type { MigrationStepUnion } from "./diff.js";
import type { Transition } from "./transitions.js";
/**
 * Safety level classification (numeric for comparison, higher = more dangerous)
 */
export declare enum SafetyLevel {
    /** Safe - can be auto-deployed */
    Safe = 0,
    /** Requires review but likely safe */
    RequiresReview = 1,
    /** Unsafe - may cause issues */
    Unsafe = 2,
    /** Dangerous - will cause data loss */
    Dangerous = 3
}
/**
 * Environment type for safety checks
 */
export type Environment = "development" | "staging" | "production";
/**
 * Safety assessment for a migration step or transition
 */
export interface SafetyAssessment {
    level: SafetyLevel;
    reasons: string[];
    canAutoDeploy: boolean;
    requiresApproval: boolean;
}
/**
 * Impact analysis
 */
export interface ImpactAnalysis {
    tables: string[];
    estimatedRows: number;
    downtime: string;
    requiresBackup: boolean;
    breaking: boolean;
    reversible: boolean;
}
/**
 * Classify a migration step by safety level
 */
export declare function classifyStep(step: MigrationStepUnion): SafetyAssessment;
/**
 * Assess entire transition for safety
 */
export declare function assessTransition(transition: Transition): SafetyAssessment;
/**
 * Extended safety assessment with environment context
 */
export interface EnvironmentSafetyAssessment extends SafetyAssessment {
    environment: Environment;
    blockedInProduction: boolean;
    warnings: string[];
    recommendations: string[];
}
/**
 * Assess safety for a specific environment
 */
export declare function assessSafety(steps: MigrationStepUnion[], environment?: Environment): EnvironmentSafetyAssessment;
/**
 * Analyze impact of a transition
 */
export declare function analyzeImpact(transition: Transition): ImpactAnalysis;
/**
 * Check if transition is safe for auto-deploy
 */
export declare function isSafeForAutoDeploy(transition: Transition): boolean;
/**
 * Check if transition requires approval
 */
export declare function requiresApproval(transition: Transition): boolean;
/**
 * Get safety summary for display
 */
export declare function getSafetySummary(transition: Transition): {
    level: SafetyLevel;
    summary: string;
    details: string[];
};
/**
 * Validate migration can run in environment
 */
export declare function validateForEnvironment(steps: MigrationStepUnion[], environment: Environment, options?: {
    allowDestructive?: boolean;
}): {
    valid: boolean;
    errors: string[];
    warnings: string[];
};
/**
 * Get recommended pre-migration checks
 */
export declare function getPreMigrationChecks(steps: MigrationStepUnion[], environment: Environment): string[];
//# sourceMappingURL=safety.d.ts.map