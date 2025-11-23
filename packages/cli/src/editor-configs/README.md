# Editor Configuration for Yama YAML Files

This directory contains editor configuration files to enable autocomplete and validation for Yama YAML configuration files.

## Universal Method (Works with ALL Editors)

**The easiest way** - Add a schema reference comment at the top of any Yama YAML file:

```yaml
# yaml-language-server: $schema=node_modules/@yama/cli/dist/cli/src/yama.schema.json
name: my-app
version: 1.0.0
# ... rest of config
```

This works with **any editor** that supports YAML Language Server (yamlls), including:
- ✅ VS Code (with Red Hat YAML extension)
- ✅ Vim/Neovim (with coc-yaml or nvim-lspconfig)
- ✅ Emacs (with lsp-mode)
- ✅ Sublime Text (with LSP package)
- ✅ Any editor with LSP support

## Supported File Patterns

- `yama.yaml`
- `yama.yml`
- `*.yama.yaml` (e.g., `app.yama.yaml`, `config.yama.yaml`)
- `*.yama.yml`

## Editor-Specific Setup

### VS Code

### Option 1: Workspace Settings (Recommended)

Add this to your workspace `.vscode/settings.json`:

```json
{
  "yaml.schemas": {
    "node_modules/@yama/cli/dist/cli/src/yama.schema.json": [
      "yama.yaml",
      "yama.yml",
      "*.yama.yaml",
      "*.yama.yml"
    ]
  }
}
```

### Option 2: User Settings

Add the same configuration to your VS Code user settings (File > Preferences > Settings, search for "yaml.schemas").

### Option 3: Automatic Setup

Run `yama create` - it automatically configures VS Code settings for you!

### Vim/Neovim

#### With coc.nvim (coc-yaml)

Add to your `coc-settings.json` (in project root or `~/.config/nvim/coc-settings.json`):

```json
{
  "yaml.schemas": {
    "node_modules/@yama/cli/dist/cli/src/yama.schema.json": [
      "yama.yaml",
      "yama.yml",
      "*.yama.yaml",
      "*.yama.yml"
    ]
  }
}
```

#### With nvim-lspconfig

Configure in your `init.lua` or `init.vim`:

```lua
require('lspconfig').yamlls.setup({
  settings = {
    yaml = {
      schemas = {
        ["node_modules/@yama/cli/dist/cli/src/yama.schema.json"] = {
          "yama.yaml",
          "yama.yml",
          "*.yama.yaml",
          "*.yama.yml"
        }
      }
    }
  }
})
```

### Emacs (with lsp-mode)

Add to your `.dir-locals.el` or `lsp-yaml` configuration:

```elisp
(setq lsp-yaml-schemas
      '(("node_modules/@yama/cli/dist/cli/src/yama.schema.json"
         "yama.yaml"
         "yama.yml"
         "*.yama.yaml"
         "*.yama.yml")))
```

### Sublime Text (with LSP package)

Add to your LSP settings:

```json
{
  "clients": {
    "yamlls": {
      "settings": {
        "yaml.schemas": {
          "node_modules/@yama/cli/dist/cli/src/yama.schema.json": [
            "yama.yaml",
            "yama.yml",
            "*.yama.yaml",
            "*.yama.yml"
          ]
        }
      }
    }
  }
}
```

## YAML Language Server Config File

Alternatively, create a `.yamlls-config.json` file in your project root (works with any editor using yamlls):

```json
{
  "yaml": {
    "schemas": {
      "node_modules/@yama/cli/dist/cli/src/yama.schema.json": [
        "yama.yaml",
        "yama.yml",
        "*.yama.yaml",
        "*.yama.yml"
      ]
    }
  }
}
```

## Summary

**Best approach for maximum compatibility:**
1. ✅ **Schema reference comment** (works everywhere) - automatically added by `yama create`
2. ✅ **VS Code settings** - automatically configured by `yama create`
3. ✅ **YAML Language Server config** - automatically created by `yama create`

All three methods are set up automatically when you run `yama create`!

