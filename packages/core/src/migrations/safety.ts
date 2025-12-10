import type { MigrationStepUnion } from "./diff.js";
import type { Transition } from "./transitions.js";

/**
 * Safety level classification (numeric for comparison, higher = more dangerous)
 */
export enum SafetyLevel {
  /** Safe - can be auto-deployed */
  Safe = 0,
  /** Requires review but likely safe */
  RequiresReview = 1,
  /** Unsafe - may cause issues */
  Unsafe = 2,
  /** Dangerous - will cause data loss */
  Dangerous = 3,
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
export function classifyStep(step: MigrationStepUnion): SafetyAssessment {
  const reasons: string[] = [];
  let level: SafetyLevel = SafetyLevel.Safe;
  
  switch (step.type) {
    case "add_table":
      // Adding tables is safe
      reasons.push("Adding new table is non-breaking");
      break;
      
    case "add_column":
      // Adding nullable columns is safe
      if (step.column.nullable) {
        reasons.push("Adding nullable column is non-breaking");
      } else {
        level = SafetyLevel.RequiresReview;
        reasons.push("Adding non-nullable column requires default value or data migration");
      }
      break;
      
    case "add_index":
      // Adding indexes is safe (can be done online)
      reasons.push("Adding index is non-breaking");
      break;
      
    case "add_foreign_key":
      // Adding foreign keys requires review (data validation needed)
      level = SafetyLevel.RequiresReview;
      reasons.push("Adding foreign key requires data validation");
      break;
      
    case "modify_column":
      // Modifying columns requires review
      level = SafetyLevel.RequiresReview;
      reasons.push("Modifying column type/size may require data transformation");
      break;
      
    case "rename_column":
      // Renaming requires review - code may reference old name
      level = SafetyLevel.RequiresReview;
      reasons.push("Renaming column may break code referencing old name");
      break;
      
    case "drop_index":
      // Dropping indexes is relatively safe
      reasons.push("Dropping index is non-breaking (may affect performance)");
      break;
      
    case "drop_foreign_key":
      // Dropping foreign keys is relatively safe
      reasons.push("Dropping foreign key is non-breaking");
      break;
      
    case "drop_column":
      // Dropping columns is dangerous
      level = SafetyLevel.Dangerous;
      reasons.push("Dropping column will delete data (use shadow column instead)");
      break;
      
    case "drop_table":
      // Dropping tables is dangerous
      level = SafetyLevel.Dangerous;
      reasons.push("Dropping table will delete all data");
      break;
  }
  
  return {
    level,
    reasons,
    canAutoDeploy: level === SafetyLevel.Safe,
    requiresApproval: level !== SafetyLevel.Safe,
  };
}

/**
 * Assess entire transition for safety
 */
export function assessTransition(transition: Transition): SafetyAssessment {
  const stepAssessments = transition.steps.map(classifyStep);
  
  // Overall level is the highest (most dangerous) level
  let overallLevel = SafetyLevel.Safe;
  const reasons: string[] = [];
  
  for (const assessment of stepAssessments) {
    if (assessment.level > overallLevel) {
      overallLevel = assessment.level;
    }
    reasons.push(...assessment.reasons);
  }
  
  return {
    level: overallLevel,
    reasons: [...new Set(reasons)], // Remove duplicates
    canAutoDeploy: overallLevel === SafetyLevel.Safe,
    requiresApproval: overallLevel !== SafetyLevel.Safe,
  };
}

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
export function assessSafety(
  steps: MigrationStepUnion[],
  environment: Environment = "development"
): EnvironmentSafetyAssessment {
  const stepAssessments = steps.map(classifyStep);
  
  let overallLevel = SafetyLevel.Safe;
  const reasons: string[] = [];
  const warnings: string[] = [];
  const recommendations: string[] = [];
  
  for (const assessment of stepAssessments) {
    if (assessment.level > overallLevel) {
      overallLevel = assessment.level;
    }
    reasons.push(...assessment.reasons);
  }
  
  // Environment-specific checks
  let blockedInProduction = false;
  
  if (environment === "production") {
    // Block dangerous operations in production by default
    if (overallLevel >= SafetyLevel.Dangerous) {
      blockedInProduction = true;
      warnings.push("Destructive operations are blocked in production by default");
      recommendations.push("Use --allow-destructive flag to override (not recommended)");
      recommendations.push("Consider using shadow columns for zero-downtime migrations");
    }
    
    // Add production-specific warnings
    if (overallLevel >= SafetyLevel.RequiresReview) {
      warnings.push("This migration should be tested in staging before production");
      recommendations.push("Create a backup before running this migration");
    }
    
    // Check for large schema changes
    if (steps.length > 10) {
      warnings.push("Large migration with many steps - consider splitting");
      recommendations.push("Run during low-traffic period");
    }
  }
  
  // Add general recommendations based on step types
  const hasDrops = steps.some(s => s.type === "drop_table" || s.type === "drop_column");
  if (hasDrops) {
    recommendations.push("Verify data backup before proceeding");
    recommendations.push("Consider keeping dropped data in a separate table first");
  }
  
  const hasTypeChanges = steps.some(s => s.type === "modify_column");
  if (hasTypeChanges) {
    recommendations.push("Test data conversion with a sample of production data");
  }
  
  return {
    level: overallLevel,
    reasons: [...new Set(reasons)],
    canAutoDeploy: overallLevel === SafetyLevel.Safe && environment !== "production",
    requiresApproval: overallLevel !== SafetyLevel.Safe || environment === "production",
    environment,
    blockedInProduction,
    warnings,
    recommendations,
  };
}

/**
 * Analyze impact of a transition
 */
export function analyzeImpact(transition: Transition): ImpactAnalysis {
  const tables = new Set<string>();
  let estimatedRows = 0;
  let requiresBackup = false;
  let breaking = false;
  let reversible = true;
  
  for (const step of transition.steps) {
    tables.add(step.table);
    
    switch (step.type) {
      case "drop_table":
      case "drop_column":
        requiresBackup = true;
        breaking = true;
        break;
        
      case "modify_column":
        requiresBackup = true;
        breaking = true;
        break;
        
      case "add_column":
        if (!step.column.nullable) {
          breaking = true;
        }
        break;
    }
  }
  
  // Estimate downtime
  let downtime = "0 seconds";
  if (transition.steps.length > 10) {
    downtime = "< 1 minute";
  } else if (transition.steps.length > 5) {
    downtime = "< 30 seconds";
  } else if (transition.steps.length > 0) {
    downtime = "< 10 seconds";
  }
  
  return {
    tables: Array.from(tables),
    estimatedRows,
    downtime,
    requiresBackup,
    breaking,
    reversible,
  };
}

/**
 * Check if transition is safe for auto-deploy
 */
export function isSafeForAutoDeploy(transition: Transition): boolean {
  const assessment = assessTransition(transition);
  return assessment.canAutoDeploy;
}

/**
 * Check if transition requires approval
 */
export function requiresApproval(transition: Transition): boolean {
  const assessment = assessTransition(transition);
  return assessment.requiresApproval;
}

/**
 * Get safety summary for display
 */
export function getSafetySummary(transition: Transition): {
  level: SafetyLevel;
  summary: string;
  details: string[];
} {
  const assessment = assessTransition(transition);
  const impact = analyzeImpact(transition);
  
  let summary = "";
  switch (assessment.level) {
    case SafetyLevel.Safe:
      summary = "Safe to auto-deploy - All changes are non-breaking";
      break;
    case SafetyLevel.RequiresReview:
      summary = "Requires review - Some changes may need attention";
      break;
    case SafetyLevel.Unsafe:
      summary = "Unsafe - Manual review strongly recommended";
      break;
    case SafetyLevel.Dangerous:
      summary = "Dangerous - Manual approval required, data loss possible";
      break;
  }
  
  const details = [
    ...assessment.reasons,
    `Affected tables: ${impact.tables.join(", ")}`,
    `Estimated downtime: ${impact.downtime}`,
    impact.requiresBackup ? "Backup recommended" : "No backup required",
    impact.breaking ? "Breaking changes detected" : "No breaking changes",
  ];
  
  return {
    level: assessment.level,
    summary,
    details,
  };
}

/**
 * Validate migration can run in environment
 */
export function validateForEnvironment(
  steps: MigrationStepUnion[],
  environment: Environment,
  options: { allowDestructive?: boolean } = {}
): { valid: boolean; errors: string[]; warnings: string[] } {
  const assessment = assessSafety(steps, environment);
  const errors: string[] = [];
  const warnings: string[] = [...assessment.warnings];
  
  // Block dangerous operations in production unless explicitly allowed
  if (
    environment === "production" &&
    assessment.level >= SafetyLevel.Dangerous &&
    !options.allowDestructive
  ) {
    errors.push("Destructive operations are not allowed in production");
    errors.push("Use --allow-destructive to override (not recommended)");
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Get recommended pre-migration checks
 */
export function getPreMigrationChecks(
  steps: MigrationStepUnion[],
  environment: Environment
): string[] {
  const checks: string[] = [];
  
  // Always check database connection
  checks.push("Verify database connection");
  
  // Environment-specific checks
  if (environment === "production" || environment === "staging") {
    checks.push("Create database backup");
    checks.push("Verify backup is accessible and restorable");
    checks.push("Notify relevant team members");
  }
  
  // Check based on step types
  const hasDrops = steps.some(s => s.type === "drop_table" || s.type === "drop_column");
  if (hasDrops) {
    checks.push("Confirm data in dropped columns/tables is not needed");
    checks.push("Verify no application code references dropped schema");
  }
  
  const hasTypeChanges = steps.some(s => s.type === "modify_column");
  if (hasTypeChanges) {
    checks.push("Verify data can be converted to new column types");
    checks.push("Test migration on staging with production-like data");
  }
  
  if (environment === "production") {
    checks.push("Schedule migration during low-traffic period");
    checks.push("Have rollback plan ready");
    checks.push("Monitor application after migration");
  }
  
  return checks;
}
















