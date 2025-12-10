# Testing YAMA MCP Server

This guide will help you test the YAMA MCP (Model Context Protocol) server with your `yama.yaml` file.

## Prerequisites

1. ✅ **MCP Configuration**: You've already added `.cursor/mcp.json` with the correct configuration
2. ✅ **YAMA CLI Built**: The CLI has been built (run `cd packages/cli && pnpm build` if needed)
3. ✅ **YAMA File**: You have a `yama.yaml` file (e.g., in `examples/todo-api/`)

## Your Current Setup

Based on your `.cursor/mcp.json`:
- **MCP Server**: `yama mcp`
- **Working Directory**: `C:\Users\USER\Code\yama\examples\todo-api`
- **YAMA Config**: Should be at `C:\Users\USER\Code\yama\examples\todo-api\yama.yaml`

## Step 1: Verify MCP Server Can Start

First, let's test if the MCP server can start manually:

```powershell
# Navigate to your YAMA project directory
cd C:\Users\USER\Code\yama\examples\todo-api

# Start the MCP server (it will wait for MCP protocol messages)
yama mcp
```

The server should start without errors. It won't output anything until a client connects (this is normal for stdio-based MCP servers).

**Press Ctrl+C to stop it.**

## Step 2: Verify YAMA File is Valid

Test that your `yama.yaml` file is valid:

```powershell
cd C:\Users\USER\Code\yama\examples\todo-api
yama validate
```

This should validate your configuration without errors.

## Step 3: Test MCP in Cursor

### Restart Cursor

After configuring `.cursor/mcp.json`, you need to **restart Cursor** for the MCP server to be loaded.

1. Close Cursor completely
2. Reopen Cursor
3. The MCP server should automatically start

### Check MCP Connection

1. Open Cursor's MCP panel/logs (usually in the bottom panel or via Command Palette)
2. Look for the "yama" MCP server connection
3. Verify there are no connection errors

### Test MCP Tools via Chat

Once Cursor is restarted, you can test the MCP by asking the AI assistant to:

#### Test Resources (Read-only data):

1. **Read YAMA Configuration**:
   ```
   "Read my yama.yaml configuration"
   ```
   The AI should use the `yama://config` resource.

2. **List Endpoints**:
   ```
   "What endpoints are defined in my YAMA project?"
   ```
   The AI should use the `yama://endpoints` resource.

3. **List Schemas**:
   ```
   "Show me all schemas in my yama.yaml"
   ```
   The AI should use the `yama://schemas` resource.

4. **Check Migration Status**:
   ```
   "What's the migration status of my database?"
   ```
   The AI should use the `yama://migration-status` resource.

#### Test Tools (Actions):

1. **Validate Configuration**:
   ```
   "Validate my yama.yaml configuration"
   ```
   The AI should call the `yama_validate` tool.

2. **Generate Types**:
   ```
   "Generate TypeScript types for my YAMA project"
   ```
   The AI should call the `yama_generate` tool.

3. **Get Config**:
   ```
   "Show me my YAMA config"
   ```
   The AI should call the `yama_config` tool.

4. **List Endpoints**:
   ```
   "List all my endpoints"
   ```
   The AI should call the `yama_endpoints` tool.

5. **List Schemas**:
   ```
   "List all my schemas"
   ```
   The AI should call the `yama_schemas` tool.

6. **Check Schema Status**:
   ```
   "Check my schema migration status"
   ```
   The AI should call the `yama_migration_status` tool.

## Step 4: Manual Testing (Advanced)

If you want to test the MCP server manually using the MCP protocol, you can use the `@modelcontextprotocol/inspector` tool:

```powershell
# Install the inspector (if not already installed)
npm install -g @modelcontextprotocol/inspector

# Test the MCP server
cd C:\Users\USER\Code\yama\examples\todo-api
mcp-inspector yama mcp
```

Or use a simple Node.js script to test:

```javascript
// test-mcp.js
import { spawn } from 'child_process';

const proc = spawn('yama', ['mcp'], {
  cwd: 'C:\\Users\\USER\\Code\\yama\\examples\\todo-api',
  stdio: ['pipe', 'pipe', 'pipe']
});

// Send MCP initialize request
const initRequest = {
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: {
      name: 'test-client',
      version: '1.0.0'
    }
  }
};

proc.stdin.write(JSON.stringify(initRequest) + '\n');

proc.stdout.on('data', (data) => {
  console.log('Response:', data.toString());
});

proc.stderr.on('data', (data) => {
  console.error('Error:', data.toString());
});
```

## Troubleshooting

### Issue: "Resource not available: yama://config"

**Solution**: The MCP server can't find your `yama.yaml` file.

1. **Verify the path**: Check that `C:\Users\USER\Code\yama\examples\todo-api\yama.yaml` exists
2. **Check environment variable**: Your `YAMA_MCP_WORKDIR` should point to the directory containing `yama.yaml`
3. **Try absolute path**: Update `.cursor/mcp.json`:
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

### Issue: "Command not found: yama"

**Solution**: The `yama` command is not in your PATH.

1. **If developing locally**: Link the CLI globally:
   ```powershell
   cd packages\cli
   pnpm link --global
   ```

2. **Or use full path**: Update `.cursor/mcp.json` to use the full path:
   ```json
   {
     "mcpServers": {
       "yama": {
         "command": "node",
         "args": ["C:\\Users\\USER\\Code\\yama\\packages\\cli\\dist\\cli\\src\\mcp-server.js"],
         "env": {
           "YAMA_MCP_WORKDIR": "C:\\Users\\USER\\Code\\yama\\examples\\todo-api"
         }
       }
     }
   }
   ```

### Issue: MCP Server Not Starting in Cursor

**Solution**: 
1. **Restart Cursor** completely (close and reopen)
2. **Check Cursor MCP logs** for error messages
3. **Verify the command works** in PowerShell:
   ```powershell
   cd C:\Users\USER\Code\yama\examples\todo-api
   yama mcp
   ```

### Issue: Tools/Resources Not Available

**Solution**:
1. Make sure you're in a directory with a valid `yama.yaml`
2. Verify the MCP server connected successfully (check logs)
3. Try asking the AI to use a specific tool explicitly

## Available MCP Tools

The YAMA MCP server provides these tools:

1. **yama_validate** - Validate yama.yaml configuration
2. **yama_generate** - Generate TypeScript types and SDK
3. **yama_migration_generate** - Generate database migrations
4. **yama_migration_status** - Check migration status
5. **yama_config** - Read yama.yaml configuration
6. **yama_endpoints** - List all endpoints
7. **yama_schemas** - List all schemas
8. **yama_create** - Create a new YAMA project

## Available MCP Resources

The YAMA MCP server provides these resources:

1. **yama://config** - Read yama.yaml as JSON
2. **yama://endpoints** - List all endpoints
3. **yama://schemas** - List all schemas
4. **yama://migration-status** - Get migration status

## Next Steps

Once MCP is working:

1. **Use AI assistance**: Ask the AI to help you with YAMA configuration, validation, and code generation
2. **Iterate on your yama.yaml**: The AI can read your config and suggest improvements
3. **Generate code**: Use the AI to generate handlers, types, and migrations
4. **Debug issues**: The AI can help troubleshoot YAMA configuration problems

## Example Conversation

Here's an example of how you might interact with the AI once MCP is set up:

**You**: "Validate my yama.yaml and show me what endpoints I have"

**AI** (using MCP):
- Calls `yama_validate` tool → Validates your config
- Reads `yama://endpoints` resource → Lists your endpoints
- Provides feedback and suggestions

**You**: "Generate types for my project"

**AI** (using MCP):
- Calls `yama_generate` tool → Generates TypeScript types
- Shows you what was generated

---

**Happy testing!** 🚀



