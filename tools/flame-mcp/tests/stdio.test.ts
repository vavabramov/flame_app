import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const entry = fileURLToPath(new URL('../dist/index.js', import.meta.url));

describe('built server over real stdio', () => {
  it('starts, lists its tools, answers a call, and logs only to stderr', async () => {
    const transport = new StdioClientTransport({ command: process.execPath, args: [entry], stderr: 'pipe' });
    let stderr = '';
    transport.stderr?.on('data', (chunk: Buffer) => (stderr += chunk.toString()));

    const client = new Client({ name: 'stdio-test', version: '1.0.0' });
    await client.connect(transport);
    try {
      const { tools } = await client.listTools();
      assert.equal(tools.length, 7);
      const created = (await client.callTool({ name: 'create_draft', arguments: { templateId: 'read-more', templateVersion: '1.0.0' } })) as {
        structuredContent?: { validationStatus?: string };
      };
      assert.equal(created.structuredContent?.validationStatus, 'valid');
      const result = (await client.callTool({ name: 'get_capabilities', arguments: {} })) as { structuredContent?: { supportedTransferMode?: string } };
      assert.equal(result.structuredContent?.supportedTransferMode, 'manual-json');
    } finally {
      await client.close();
    }
    // Any non-protocol output on stdout would have broken the JSON-RPC stream above.
    assert.match(stderr, /^flame-mcp \S+ ready \(stdio\)\n$/);
  });
});
