# YAMA MCP (Model Context Protocol) Usage Guide

YAMA provides an MCP server that exposes YAMA CLI commands as tools and project data as resources for AI assistants like Cursor, Claude Desktop, and other MCP-compatible clients.

## What is MCP?

Model Context Protocol (MCP) is a standard protocol that allows AI assistants to interact with external tools and resources. The YAMA MCP server makes your YAMA project accessible to AI assistants, enabling them to:

- Validate your `yama.yaml` configuration
- Generate code and types
- Read your project configuration, schemas, and endpoints
- Check migration status
- Create new YAMA projects

## Starting the MCP Server

### Option 1: Using the CLI Command

```bash
yama mcp
```

This starts the MCP server using stdio transport, which is suitable for MCP clients.

### Option 2: Direct Execution

If you have the YAMA CLI installed globally, you can also run:

```bash
yama-cli mcp
```

Or if running from the package directly:

```bash
node packages/cli/dist/cli/src/mcp-server.js
```

## Available Tools

The YAMA MCP server provides the following tools that AI assistants can use:

### 1. `yama_validate`
Validates your `yama.yaml` configuration file.

**Parameters:**
- `config` (optional): Path to yama.yaml configuration file
- `strict` (optional): Enable strict validation

**Example:**
```json
{
  "name": "yama_validate",
  "arguments": {
    "config": "yama.yaml",
    "strict": true
  }
}
```

### 2. `yama_generate`
Generates TypeScript types and SDK from your YAMA configuration.

**Parameters:**
- `config` (optional): Path to yama.yaml configuration file
- `watch` (optional): Enable watch mode

### 3. `yama_migration_generate`
Generates database migrations from entity definitions.

**Parameters:**
- `config` (optional): Path to yama.yaml configuration file
- `name` (optional): Migration name

### 4. `yama_migration_status`
Checks the status of database migrations.

**Parameters:**
- `config` (optional): Path to yama.yaml configuration file

### 5. `yama_config`
Reads and displays the `yama.yaml` configuration file.

**Parameters:**
- `config` (optional): Path to yama.yaml configuration file

### 6. `yama_endpoints`
Lists all endpoints defined in your YAMA configuration.

**Parameters:**
- `config` (optional): Path to yama.yaml configuration file

### 7. `yama_schemas`
Lists all schemas defined in your YAMA configuration.

**Parameters:**
- `config` (optional): Path to yama.yaml configuration file

### 8. `yama_create`
Creates a new YAMA project.

**Parameters:**
- `name`: Project name
- `template` (optional): Template to use

## Available Resources

The MCP server also provides resources that can be read by AI assistants:

### 1. `yama://config`
Reads the `yama.yaml` configuration file as JSON.

### 2. `yama://endpoints`
Lists all endpoints defined in `yama.yaml`.

### 3. `yama://schemas`
Lists all schemas defined in `yama.yaml`.

### 4. `yama://migration-status`
Gets the current database migration status.

## Configuring MCP Clients

### Cursor IDE

To use YAMA MCP with Cursor, add the following to your Cursor MCP settings (usually in `~/.cursor/mcp.json` or similar):

**For a standalone project:**
```json
{
  "mcpServers": {
    "yama": {
      "command": "yama",
      "args": ["mcp"],
      "env": {}
    }
  }
}
```

**For a monorepo (set the working directory):**
```json
{
  "mcpServers": {
    "yama": {
      "command": "yama",
      "args": ["mcp"],
      "env": {
        "YAMA_MCP_WORKDIR": "/path/to/your/yama/project"
      }
    }
  }
}
```

**Example for Windows monorepo:**
```json
{
  "mcpServers": {
    "yama": {
      "command": "yama",
      "args": ["mcp"],
      "env": {
        "YAMA_MCP_WORKDIR": "C:\\Users\\USER\\Code\\yama\\examples\\todo-api"
      }
    }
  }
}
```

**Alternative: Use YAMA_CONFIG_PATH to point directly to yama.yaml:**
```json
{
  "mcpServers": {
    "yama": {
      "command": "yama",
      "args": ["mcp"],
      "env": {
        "YAMA_CONFIG_PATH": "/path/to/yama.yaml"
      }
    }
  }
}
```

Or if using the direct path:

```json
{
  "mcpServers": {
    "yama": {
      "command": "node",
      "args": ["path/to/yama-cli/dist/cli/src/mcp-server.js"],
      "env": {}
    }
  }
}
```

### Claude Desktop

For Claude Desktop, edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "yama": {
      "command": "yama",
      "args": ["mcp"]
    }
  }
}
```

### Other MCP Clients

Most MCP clients follow a similar pattern. You need to:

1. Configure the server command (usually `yama mcp` or the full path to the MCP server script)
2. Ensure the YAMA CLI is installed and accessible in your PATH
3. The server uses stdio transport, so it should work with any MCP-compatible client

## Monorepo Support

If you're working in a monorepo (like this YAMA repository), the MCP server needs to know which `yama.yaml` file to use. You can configure this using environment variables:

### Option 1: Set Working Directory (Recommended)

Set `YAMA_MCP_WORKDIR` to point to the directory containing your `yama.yaml`:

```json
{
  "mcpServers": {
    "yama": {
      "command": "yama",
      "args": ["mcp"],
      "env": {
        "YAMA_MCP_WORKDIR": "examples/todo-api"
      }
    }
  }
}
```

### Option 2: Set Config Path Directly

Set `YAMA_CONFIG_PATH` to point directly to your `yama.yaml` file:

```json
{
  "mcpServers": {
    "yama": {
      "command": "yama",
      "args": ["mcp"],
      "env": {
        "YAMA_CONFIG_PATH": "examples/todo-api/yama.yaml"
      }
    }
  }
}
```

**Note**: Use absolute paths for best results, especially on Windows:
```json
{
  "env": {
    "YAMA_MCP_WORKDIR": "C:\\Users\\USER\\Code\\yama\\examples\\todo-api"
  }
}
```

## How It Works

1. **Server Startup**: The MCP server starts and listens on stdio (standard input/output)
2. **Client Connection**: Your MCP client (Cursor, Claude Desktop, etc.) connects to the server
3. **Tool Discovery**: The client discovers available tools and resources
4. **Tool Execution**: When you ask the AI assistant to perform a YAMA action, it calls the appropriate tool
5. **Resource Access**: The AI can read resources to understand your project structure

## Example Usage

Once configured, you can ask your AI assistant things like:

- "Validate my yama.yaml configuration"
- "Show me all the endpoints in my YAMA project"
- "Generate types for my YAMA project"
- "What schemas are defined in my yama.yaml?"
- "Check the migration status"

The AI assistant will use the MCP tools and resources to answer these questions and perform actions on your YAMA project.

## Troubleshooting

### "Resource not available: yama://config"

This error means the MCP server cannot find a `yama.yaml` file. Solutions:

1. **For monorepos**: Set the `YAMA_MCP_WORKDIR` environment variable in your MCP configuration to point to your YAMA project directory:
   ```json
   {
     "mcpServers": {
       "yama": {
         "command": "yama",
         "args": ["mcp"],
         "env": {
           "YAMA_MCP_WORKDIR": "/path/to/your/yama/project"
         }
       }
     }
   }
   ```

2. **Make sure you're in the right directory**: The MCP server looks for `yama.yaml` in the current working directory (or the directory specified by `YAMA_MCP_WORKDIR`)
   ```bash
   cd /path/to/your/yama/project
   # or
   cd examples/todo-api
   ```

3. **Verify yama.yaml exists**:
   ```bash
   ls yama.yaml  # Unix/Mac
   dir yama.yaml # Windows
   ```

4. **Check Cursor's working directory**: Cursor may start the MCP server from a different directory. Try:
   - Opening your YAMA project folder in Cursor
   - Restarting Cursor after configuring MCP
   - Checking Cursor's MCP logs for the working directory
   - Using `YAMA_MCP_WORKDIR` environment variable to explicitly set the directory

### Server Won't Start

- Ensure YAMA CLI is installed: `npm install -g @betagors/yama-cli`
- Check that `yama` command is in your PATH: `which yama` (Unix) or `where yama` (Windows)
- Verify the MCP server script exists in the CLI package
- If developing YAMA locally, rebuild: `cd packages/cli && pnpm build`

### Tools Not Available

- Make sure you're in a directory with a `yama.yaml` file (or specify the path)
- Check that the MCP client has successfully connected to the server
- Review the MCP client logs for connection errors
- Verify the CLI is built: `cd packages/cli && pnpm build`

### Permission Issues

- Ensure the YAMA CLI has read/write permissions in your project directory
- On Windows, you may need to run your terminal as administrator for some operations

### Testing the MCP Server

To verify the MCP server works:

1. **Build the CLI** (if developing locally):
   ```bash
   cd packages/cli
   pnpm build
   ```

2. **Test from a directory with yama.yaml**:
   ```bash
   cd examples/todo-api
   yama mcp
   ```
   The server should start and wait for MCP protocol messages (it won't output anything until a client connects).

3. **Check Cursor MCP logs**: In Cursor, check the MCP server logs to see if it connected successfully and if there are any errors.

## Development

If you're developing YAMA itself and want to test the MCP server:

```bash
# From the YAMA repository root
cd packages/cli
pnpm build
node dist/cli/src/mcp-server.js
```

The server will run and wait for MCP protocol messages on stdio.





