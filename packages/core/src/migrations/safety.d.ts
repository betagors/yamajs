import type { MigrationStepUnion } from "./diff.js";
import type { Transition } from "./transitions.js";
/**
 * Safety level classification
 */
export declare enum SafetyLevel {
    SAFE = "safe",
    REVIEW = "review",
    DANGEROUS = "dangerous"
}
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
