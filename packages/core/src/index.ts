export function helloYamaCore() {
  return "Yama core online";
}

// Export model validation
export {
  ModelValidator,
  createModelValidator,
  modelToJsonSchema,
  fieldToJsonSchema,
  type ModelField,
  type ModelDefinition,
  type YamaModels,
  type ValidationResult
} from "./models.js";

// Export type generation
export { generateTypes } from "./typegen.js";

