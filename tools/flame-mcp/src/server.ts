import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import { SERVER_NAME, SERVER_VERSION } from './config';
import { getCapabilities } from './tools/get-capabilities';
import { getTemplates, getTemplatesInput } from './tools/get-templates';

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } as const;

const asResult = (data: Record<string, unknown>) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
  structuredContent: data,
});

/** Builds the server with its read-only tools. No file, network, shell or database access. */
export function createServer(): McpServer {
  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });

  server.registerTool(
    'get_capabilities',
    {
      title: 'FLAME capabilities',
      description:
        'Lists the blueprint schema and catalog versions, the only supported templates and modules, the available tools, and what this server cannot do (it has no access to the phone database). Call this first.',
      inputSchema: z.object({}).strict(),
      annotations: READ_ONLY,
    },
    async () => asResult(getCapabilities()),
  );

  server.registerTool(
    'get_templates',
    {
      title: 'FLAME templates',
      description:
        'Describes the supported habit templates: required and optional fields, defaults, limits, clarifying questions, check-in and streak behavior, and what is unsupported. Optionally filter by an exact template ID.',
      inputSchema: getTemplatesInput,
      annotations: READ_ONLY,
    },
    async (args) => asResult(getTemplates(args)),
  );

  return server;
}
