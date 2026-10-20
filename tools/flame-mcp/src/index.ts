/**
 * FLAME MCP server over stdio. stdout carries the protocol only; the single
 * startup line and any fatal error go to stderr, without prompts or user data.
 */
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { SERVER_VERSION } from './config';
import { createServer } from './server';

async function main() {
  const server = createServer();
  await server.connect(new StdioServerTransport());
  process.stderr.write(`flame-mcp ${SERVER_VERSION} ready (stdio)\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`flame-mcp failed to start: ${error instanceof Error ? error.message : 'unknown error'}\n`);
  process.exit(1);
});
