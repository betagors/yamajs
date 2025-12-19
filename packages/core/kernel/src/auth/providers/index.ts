// Import all built-in providers to trigger registration
import jwtHandler from "../../../../../../../../../../../../core/kernel/src/auth/providers/jwt.js";
import apiKeyHandler from "../../../../../../../../../../../../core/kernel/src/auth/providers/api-key.js";
import basicHandler from "../../../../../../../../../../../../core/kernel/src/auth/providers/basic.js";
import { registerAuthProvider } from "../../../../../../../../../../../../core/kernel/src/auth/registry.js";

// Register all built-in providers
registerAuthProvider("jwt", jwtHandler);
registerAuthProvider("api-key", apiKeyHandler);
registerAuthProvider("basic", basicHandler);

// Export handlers for testing
export { jwtHandler, apiKeyHandler, basicHandler };

