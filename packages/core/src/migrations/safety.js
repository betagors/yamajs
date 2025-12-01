/**
 * Safety level classification
 */
export var SafetyLevel;
(function (SafetyLevel) {
    SafetyLevel["SAFE"] = "safe";
    SafetyLevel["REVIEW"] = "review";
    SafetyLevel["DANGEROUS"] = "dangerous";
})(SafetyLevel || (SafetyLevel = {}));
/**
 * Classify a migration step by safety level
 */
export function classifyStep(step) {
    const reasons = [];
    let level = SafetyLevel.SAFE;
    switch (step.type) {
        case "add_table":
            // Adding tables is safe
            reasons.push("Adding new table is non-breaking");
            break;
        case "add_column":
            // Adding nullable columns is safe
            if (step.column.nullable) {
                reasons.push("Adding nullable column is non-breaking");
            }
            else {
                level = SafetyLevel.REVIEW;
                reasons.push("Adding non-nullable column requires default value or data migration");
            }
            break;
        case "add_index":
            // Adding indexes is safe (can be done online)
            reasons.push("Adding index is non-breaking");
            break;
        case "add_foreign_key":
            // Adding foreign keys requires review (data validation needed)
            level = SafetyLevel.REVIEW;
            reasons.push("Adding foreign key requires data validation");
            break;
        case "modify_column":
            // Modifying columns requires review
            level = SafetyLevel.REVIEW;
            reasons.push("Modifying column type/size may require data transformation");
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
            level = SafetyLevel.DANGEROUS;
            reasons.push("Dropping column will delete data (use shadow column instead)");
            break;
        case "drop_table":
            // Dropping tables is dangerous
            level = SafetyLevel.DANGEROUS;
            reasons.push("Dropping table will delete all data");
            break;
    }
    return {
        level,
        reasons,
        canAutoDeploy: level === SafetyLevel.SAFE,
        requiresApproval: level !== SafetyLevel.SAFE,
    };
}
/**
 * Assess entire transition for safety
 */
export function assessTransition(transition) {
    const stepAssessments = transition.steps.map(classifyStep);
    // Overall level is the highest (most dangerous) level
    let overallLevel = SafetyLevel.SAFE;
    const reasons = [];
    for (const assessment of stepAssessments) {
        if (assessment.level === SafetyLevel.DANGEROUS) {
            overallLevel = SafetyLevel.DANGEROUS;
        }
        else if (assessment.level === SafetyLevel.REVIEW && overallLevel === SafetyLevel.SAFE) {
            overallLevel = SafetyLevel.REVIEW;
        }
        reasons.push(...assessment.reasons);
    }
    return {
        level: overallLevel,
        reasons: [...new Set(reasons)], // Remove duplicates
        canAutoDeploy: overallLevel === SafetyLevel.SAFE,
        requiresApproval: overallLevel !== SafetyLevel.SAFE,
    };
}
/**
 * Analyze impact of a transition
 */
export function analyzeImpact(transition) {
    const tables = new Set();
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
    }
    else if (transition.steps.length > 5) {
        downtime = "< 30 seconds";
    }
    else if (transition.steps.length > 0) {
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
export function isSafeForAutoDeploy(transition) {
    const assessment = assessTransition(transition);
    return assessment.canAutoDeploy;
}
/**
 * Check if transition requires approval
 */
export function requiresApproval(transition) {
    const assessment = assessTransition(transition);
    return assessment.requiresApproval;
}
/**
 * Get safety summary for display
 */
export function getSafetySummary(transition) {
    const assessment = assessTransition(transition);
    const impact = analyzeImpact(transition);
    let summary = "";
    switch (assessment.level) {
        case SafetyLevel.SAFE:
            summary = "✅ Safe to auto-deploy - All changes are non-breaking";
            break;
        case SafetyLevel.REVIEW:
            summary = "⚠️ Requires review - Some changes may need attention";
            break;
        case SafetyLevel.DANGEROUS:
            summary = "🚨 Dangerous - Manual approval required";
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
//# sourceMappingURL=safety.js.map