// Import all built-in providers to trigger registration
import jwtHandler from "./jwt.js";
import apiKeyHandler from "./api-key.js";
import basicHandler from "./basic.js";
import { registerAuthProvider } from "../registry.js";

// Register all built-in providers
registerAuthProvider("jwt", jwtHandler);
registerAuthProvider("api-key", apiKeyHandler);
registerAuthProvider("basic", basicHandler);

// Export handlers for testing
export { jwtHandler, apiKeyHandler, basicHandler };

