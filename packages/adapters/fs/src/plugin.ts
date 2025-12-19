import { type YamaPlugin } from "@yamajs/kernel";
// Importing the adapter registers it in the core provider registry
import './adapter.js';

/**
 * Filesystem storage plugin
 */
const plugin: YamaPlugin = {
  name: "@yamajs/fs",
  category: "storage",
  pluginApi: "1.0",
  yamaCore: "^0.1.0",

  async init() {
    // The adapter is already registered by the import side-effect.
    // The core provider system will instantiate it when 'storage' provider is initialized.
    return {};
  },
};

export default plugin;
