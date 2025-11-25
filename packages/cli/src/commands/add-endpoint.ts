import inquirer from "inquirer";
import { existsSync } from "fs";
import { readYamaConfig, writeYamaConfig, getConfigDir } from "../utils/file-utils.ts";
import { findYamaConfig } from "../utils/project-detection.ts";
import { success, error, info } from "../utils/cli-utils.ts";
import { join } from "path";

interface AddEndpointOptions {
  config?: string;
}

interface EndpointDefinition {
  path: string;
  method: string;
  handler?: string;
  description?: string;
  params?: Record<string, { type: string; required: boolean }>;
  query?: Record<string, { type: string; required: boolean }>;
  body?: { type: string };
  response?: { type: string };
  auth?: {
    required?: boolean;
    roles?: string[];
  };
}

export async function addEndpointCommand(options: AddEndpointOptions): Promise<void> {
  const configPath = options.config || findYamaConfig() || "yama.yaml";

  if (!existsSync(configPath)) {
    error(`Config file not found: ${configPath}`);
    info("Run 'yama init' to create a yama.yaml file");
    process.exit(1);
  }

  try {
    const config = readYamaConfig(configPath) as {
      endpoints?: EndpointDefinition[];
      schemas?: Record<string, unknown>;
    };

    // Get available schemas for reference
    const availableSchemas = config.schemas ? Object.keys(config.schemas) : [];

    console.log("\n📡 Add New Endpoint\n");

    // Prompt for basic endpoint info
    const basicInfo = await inquirer.prompt([
      {
        type: "input",
        name: "path",
        message: "Endpoint path:",
        default: "/api/example",
        validate: (input: string) => {
          if (!input || !input.startsWith("/")) {
            return "Path must start with /";
          }
          return true;
        },
      },
      {
        type: "list",
        name: "method",
        message: "HTTP method:",
        choices: ["GET", "POST", "PUT", "PATCH", "DELETE"],
        default: "GET",
      },
      {
        type: "input",
        name: "handler",
        message: "Handler function name:",
        validate: (input: string) => {
          if (!input || input.trim().length === 0) {
            return "Handler name is required";
          }
          if (!/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(input)) {
            return "Handler name must be a valid JavaScript identifier";
          }
          return true;
        },
      },
      {
        type: "input",
        name: "description",
        message: "Description (optional):",
      },
    ]);

    // Ask about authentication
    const authInfo = await inquirer.prompt([
      {
        type: "confirm",
        name: "requiresAuth",
        message: "Require authentication?",
        default: false,
      },
      {
        type: "input",
        name: "roles",
        message: "Required roles (comma-separated, optional):",
        when: (answers) => answers.requiresAuth,
        filter: (input: string) => {
          if (!input || input.trim().length === 0) return undefined;
          return input.split(",").map((r) => r.trim()).filter((r) => r.length > 0);
        },
      },
    ]);

    // Ask about request body
    const bodyInfo = await inquirer.prompt([
      {
        type: "confirm",
        name: "hasBody",
        message: "Does this endpoint accept a request body?",
        default: ["POST", "PUT", "PATCH"].includes(basicInfo.method),
      },
      {
        type: "list",
        name: "bodyType",
        message: "Body schema type:",
        choices: availableSchemas.length > 0 
          ? [...availableSchemas, "Enter custom type"]
          : ["Enter custom type"],
        when: (answers) => answers.hasBody,
      },
      {
        type: "input",
        name: "bodyTypeCustom",
        message: "Body schema type name:",
        when: (answers) => answers.hasBody && answers.bodyType === "Enter custom type",
        validate: (input: string) => {
          if (!input || input.trim().length === 0) {
            return "Schema type name is required";
          }
          return true;
        },
      },
    ]);

    // Ask about response
    const responseInfo = await inquirer.prompt([
      {
        type: "list",
        name: "responseType",
        message: "Response schema type:",
        choices: availableSchemas.length > 0
          ? [...availableSchemas, "None", "Enter custom type"]
          : ["None", "Enter custom type"],
        default: availableSchemas.length > 0 ? availableSchemas[0] : "None",
      },
      {
        type: "input",
        name: "responseTypeCustom",
        message: "Response schema type name:",
        when: (answers) => answers.responseType === "Enter custom type",
        validate: (input: string) => {
          if (!input || input.trim().length === 0) {
            return "Schema type name is required";
          }
          return true;
        },
      },
    ]);

    // Ask about path parameters
    const pathParams: Record<string, { type: string; required: boolean }> = {};
    const pathParamMatches = basicInfo.path.match(/:(\w+)/g);
    if (pathParamMatches) {
      console.log("\n📝 Path parameters detected:");
      for (const param of pathParamMatches) {
        const paramName = param.substring(1); // Remove :
        const paramInfo = await inquirer.prompt([
          {
            type: "list",
            name: "type",
            message: `Type for parameter "${paramName}":`,
            choices: ["string", "number", "integer", "boolean"],
            default: "string",
          },
        ]);
        pathParams[paramName] = {
          type: paramInfo.type,
          required: true,
        };
      }
    }

    // Ask about query parameters
    const queryParams: Record<string, { type: string; required: boolean }> = {};
    const hasQuery = await inquirer.prompt([
      {
        type: "confirm",
        name: "hasQuery",
        message: "Does this endpoint accept query parameters?",
        default: false,
      },
    ]);

    if (hasQuery.hasQuery) {
      let addMore = true;
      while (addMore) {
        const queryInfo = await inquirer.prompt([
          {
            type: "input",
            name: "name",
            message: "Query parameter name:",
            validate: (input: string) => {
              if (!input || input.trim().length === 0) {
                return "Parameter name is required";
              }
              if (queryParams[input]) {
                return "Parameter already added";
              }
              return true;
            },
          },
          {
            type: "list",
            name: "type",
            message: "Parameter type:",
            choices: ["string", "number", "integer", "boolean"],
            default: "string",
          },
          {
            type: "confirm",
            name: "required",
            message: "Is this parameter required?",
            default: false,
          },
          {
            type: "confirm",
            name: "addMore",
            message: "Add another query parameter?",
            default: false,
          },
        ]);

        queryParams[queryInfo.name] = {
          type: queryInfo.type,
          required: queryInfo.required,
        };

        addMore = queryInfo.addMore;
      }
    }

    // Build endpoint definition
    const endpoint: EndpointDefinition = {
      path: basicInfo.path,
      method: basicInfo.method,
      handler: basicInfo.handler,
    };

    if (basicInfo.description) {
      endpoint.description = basicInfo.description;
    }

    if (Object.keys(pathParams).length > 0) {
      endpoint.params = pathParams;
    }

    if (Object.keys(queryParams).length > 0) {
      endpoint.query = queryParams;
    }

    if (bodyInfo.hasBody) {
      endpoint.body = {
        type: bodyInfo.bodyType === "Enter custom type" 
          ? bodyInfo.bodyTypeCustom 
          : bodyInfo.bodyType,
      };
    }

    if (responseInfo.responseType && responseInfo.responseType !== "None") {
      endpoint.response = {
        type: responseInfo.responseType === "Enter custom type"
          ? responseInfo.responseTypeCustom
          : responseInfo.responseType,
      };
    }

    if (authInfo.requiresAuth) {
      endpoint.auth = {
        required: true,
      };
      if (authInfo.roles && authInfo.roles.length > 0) {
        endpoint.auth.roles = authInfo.roles;
      }
    }

    // Add endpoint to config
    if (!config.endpoints) {
      config.endpoints = [];
    }
    config.endpoints.push(endpoint);

    // Write updated config
    writeYamaConfig(configPath, config);

    success(`Endpoint ${basicInfo.method} ${basicInfo.path} added successfully!`);

    // Offer to create handler file
    const configDir = getConfigDir(configPath);
    const handlersDir = join(configDir, "src", "handlers");
    const handlerFile = join(handlersDir, `${basicInfo.handler}.ts`);

    const createHandler = await inquirer.prompt([
      {
        type: "confirm",
        name: "create",
        message: `Create handler file at ${handlerFile}?`,
        default: true,
      },
    ]);

    if (createHandler.create) {
      const { mkdirSync } = await import("fs");
      const { dirname } = await import("path");
      mkdirSync(dirname(handlerFile), { recursive: true });

      const handlerTemplate = `import type { HttpRequest, HttpResponse } from "@betagors/yama-core";

export async function ${basicInfo.handler}(
  request: HttpRequest,
  reply: HttpResponse
): Promise<unknown> {
  // TODO: Implement handler logic
  return {};
}
`;

      const { writeFileSync } = await import("fs");
      writeFileSync(handlerFile, handlerTemplate, "utf-8");
      success(`Handler file created at ${handlerFile}`);
    }

    console.log("\n💡 Next steps:");
    console.log("   1. Implement the handler logic");
    console.log("   2. Run 'yama generate' to update types and SDK");
    console.log("   3. Run 'yama dev' to test your endpoint");
  } catch (err) {
    error(`Failed to add endpoint: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

