import inquirer from "inquirer";
import type { DockerComposeConfig, ProjectInfo } from "./types.js";

/**
 * Dev tools selection interface
 */
export interface DevToolsSelection {
  database?: {
    type: "postgres" | "mysql" | "mariadb" | "mongodb";
    version?: string;
    includeAdmin?: boolean;
    adminTool?: "pgadmin" | "adminer";
  };
  cache?: {
    enabled: boolean;
    type: "redis";
    version?: string;
  };
  mailpit?: {
    enabled: boolean;
    version?: string;
  };
}

/**
 * Interactive wizard for Docker Compose setup
 */
export async function interactiveDockerComposeSetup(
  projectInfo: ProjectInfo
): Promise<DockerComposeConfig> {
  console.log("\n🐳 Docker Compose Setup Wizard\n");
  console.log("Let's configure your development environment with useful tools.\n");

  const answers = await inquirer.prompt([
    // Database selection
    {
      type: "list",
      name: "databaseType",
      message: "Which database would you like to include?",
      choices: [
        { name: "PostgreSQL (recommended)", value: "postgres" },
        { name: "MySQL", value: "mysql" },
        { name: "MariaDB", value: "mariadb" },
        { name: "MongoDB", value: "mongodb" },
        { name: "None", value: "none" },
      ],
      default: projectInfo.databasePlugin ? "postgres" : "none",
      when: () => {
        // Auto-select if database plugin is detected
        if (projectInfo.databasePlugin) {
          return false;
        }
        return true;
      },
    },
    {
      type: "input",
      name: "databaseVersion",
      message: "Database version (leave empty for latest):",
      default: (answers: any) => {
        if (answers.databaseType === "postgres") return "16-alpine";
        if (answers.databaseType === "mysql") return "8.0";
        if (answers.databaseType === "mariadb") return "11-alpine";
        if (answers.databaseType === "mongodb") return "7";
        return "latest";
      },
      when: (answers: any) => answers.databaseType && answers.databaseType !== "none",
    },
    {
      type: "confirm",
      name: "includeDbAdmin",
      message: "Include database admin tool?",
      default: true,
      when: (answers: any) => {
        const dbType = answers.databaseType || (projectInfo.databasePlugin ? "postgres" : null);
        return dbType && dbType !== "none" && dbType !== "mongodb";
      },
    },
    {
      type: "list",
      name: "dbAdminTool",
      message: "Which admin tool?",
      choices: [
        { name: "pgAdmin (PostgreSQL only)", value: "pgadmin" },
        { name: "Adminer (PostgreSQL, MySQL, MariaDB)", value: "adminer" },
      ],
      default: (answers: any) => {
        const dbType = answers.databaseType || (projectInfo.databasePlugin ? "postgres" : null);
        return dbType === "postgres" ? "pgadmin" : "adminer";
      },
      when: (answers: any) => answers.includeDbAdmin,
    },
    {
      type: "input",
      name: "pgAdminVersion",
      message: "pgAdmin version (leave empty for latest):",
      default: "latest",
      when: (answers: any) => answers.dbAdminTool === "pgadmin",
    },
    {
      type: "input",
      name: "adminerVersion",
      message: "Adminer version (leave empty for latest):",
      default: "latest",
      when: (answers: any) => answers.dbAdminTool === "adminer",
    },
    // Cache selection
    {
      type: "confirm",
      name: "includeCache",
      message: "Include Redis cache?",
      default: projectInfo.redisPlugin || false,
    },
    {
      type: "input",
      name: "redisVersion",
      message: "Redis version (leave empty for latest):",
      default: "7-alpine",
      when: (answers: any) => answers.includeCache !== false,
    },
    // Mailpit selection
    {
      type: "confirm",
      name: "includeMailpit",
      message: "Include Mailpit for email testing?",
      default: false,
    },
    {
      type: "input",
      name: "mailpitVersion",
      message: "Mailpit version (leave empty for latest):",
      default: "latest",
      when: (answers: any) => answers.includeMailpit,
    },
  ]);

  // Build Docker Compose config from answers
  const config: DockerComposeConfig = {};

  // Database configuration
  let dbType = answers.databaseType;
  if (!dbType && projectInfo.databasePlugin) {
    // Auto-detect from project - ask about admin tools
    dbType = "postgres"; // Default for detected database plugin
    config.includeDatabase = true;
    config.databaseType = dbType;
    
    // Still ask about admin tools if database was auto-detected
    if (answers.includeDbAdmin !== undefined) {
      if (answers.includeDbAdmin) {
        if (answers.dbAdminTool === "pgadmin") {
          config.includePgAdmin = true;
          if (answers.pgAdminVersion) {
            config.pgAdminVersion = answers.pgAdminVersion;
          }
        } else if (answers.dbAdminTool === "adminer") {
          config.includeAdminer = true;
          if (answers.adminerVersion) {
            config.adminerVersion = answers.adminerVersion;
          }
        }
      }
    }
  } else if (dbType && dbType !== "none") {
    config.includeDatabase = true;
    config.databaseType = dbType;
    if (answers.databaseVersion) {
      config.databaseVersion = answers.databaseVersion;
    }

    // Database admin tools
    if (answers.includeDbAdmin) {
      if (answers.dbAdminTool === "pgadmin") {
        config.includePgAdmin = true;
        if (answers.pgAdminVersion) {
          config.pgAdminVersion = answers.pgAdminVersion;
        }
      } else if (answers.dbAdminTool === "adminer") {
        config.includeAdminer = true;
        if (answers.adminerVersion) {
          config.adminerVersion = answers.adminerVersion;
        }
      }
    }
  }

  // Cache configuration
  const includeCache = answers.includeCache !== false;
  if (includeCache || projectInfo.redisPlugin) {
    config.includeRedis = true;
    if (answers.redisVersion) {
      config.redisVersion = answers.redisVersion;
    }
  }

  // Mailpit configuration
  if (answers.includeMailpit) {
    config.includeMailpit = true;
    if (answers.mailpitVersion) {
      config.mailpitVersion = answers.mailpitVersion;
    }
  }

  return config;
}
