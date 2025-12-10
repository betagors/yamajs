import { startYamaNodeRuntime } from "@betagors/yama-node";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Path to YAML config file
const yamlConfigPath = join(__dirname, "yama.yaml");

startYamaNodeRuntime(4000, yamlConfigPath);

