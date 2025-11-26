/**
 * Generate TypeScript types for realtime channels and entity events
 */
export function generateRealtimeTypes(config: {
  realtime?: {
    entities?: Record<string, {
      enabled?: boolean;
      events?: ("created" | "updated" | "deleted")[];
      watchFields?: string[];
      channelPrefix?: string;
    }>;
    channels?: Array<{
      name: string;
      path: string;
      auth?: {
        required?: boolean;
        handler?: string;
      };
      params?: Record<string, {
        type: string;
        required?: boolean;
      }>;
    }>;
  };
  entities?: Record<string, any>;
}): string {
  const channels = config.realtime?.channels || [];
  const entityConfigs = config.realtime?.entities || {};
  const entities = config.entities || {};

  const channelTypes: string[] = [];
  const entityEventTypes: string[] = [];

  // Generate channel event types
  for (const channel of channels) {
    const channelName = channel.name;
    const typeName = `${channelName}ChannelEvents`;
    
    channelTypes.push(`
export interface ${typeName} {
  // Add your event types here
  // Example: 'alert': { message: string; type: 'info' | 'warning' | 'error' };
  [event: string]: unknown;
}`);
  }

  // Generate entity event types
  for (const [entityName, entityConfig] of Object.entries(entityConfigs)) {
    if (entityConfig.enabled) {
      const events = entityConfig.events || ["created", "updated", "deleted"];
      const channelPrefix = entityConfig.channelPrefix || entityName.toLowerCase();
      
      // Get entity type name (assume it matches entity name)
      const entityTypeName = entityName;
      
      entityEventTypes.push(`
export interface ${entityName}RealtimeEvents {
${events.map(e => `  '${e}': ${entityTypeName};`).join('\n')}
}`);
    }
  }

  // Generate combined types
  const channelTypeEntries = channels.map(c => `  '${c.name}': ${c.name}ChannelEvents;`).join('\n');
  const entityTypeEntries = Object.entries(entityConfigs)
    .filter(([_, config]) => config.enabled)
    .map(([name]) => `  '${name}': ${name}RealtimeEvents;`)
    .join('\n');

  return `// Auto-generated realtime types
// Do not edit manually - this file is generated from yama.yaml

${channelTypes.join('\n\n')}

${entityEventTypes.join('\n\n')}

// Combined type for all channels
export type RealtimeChannels = {
${channelTypeEntries || '  // No channels defined'}
};

// Combined type for all entity events
export type RealtimeEntities = {
${entityTypeEntries || '  // No entity events defined'}
};
`;
}

