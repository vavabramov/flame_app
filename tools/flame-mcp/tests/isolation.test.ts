import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const root = fileURLToPath(new URL('..', import.meta.url));
const appSrc = fileURLToPath(new URL('../../../src', import.meta.url));

function files(dir: string, ext = /\.(ts|tsx)$/): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path, ext) : ext.test(name) ? [path] : [];
  });
}

// The server and everything it pulls in from the app must stay free of these.
const FORBIDDEN = [
  /from ['"](node:)?(fs|fs\/promises|child_process|net|http|https|dgram|worker_threads|vm)['"]/,
  /from ['"](node:sqlite|expo-sqlite|expo-[a-z-]+|react-native)['"]/,
  /\beval\s*\(/,
  /\bnew Function\s*\(/,
  /\bfetch\s*\(/,
  /\brequire\s*\(/,
  /\bimport\s*\(/,
];

describe('isolation and least privilege', () => {
  const serverFiles = files(join(root, 'src'));
  const sharedFiles = ['catalog.ts', 'blueprint.types.ts', 'validate-blueprint.ts'].map((f) =>
    join(appSrc, 'features', 'blueprint', f),
  );

  it('server code and shared catalog use no file, network, shell, database or dynamic code', () => {
    for (const file of [...serverFiles, ...sharedFiles]) {
      const text = readFileSync(file, 'utf8');
      for (const pattern of FORBIDDEN) assert.doesNotMatch(text, pattern, `${file} matches ${pattern}`);
    }
  });

  it('shared app modules avoid the app-only "@/" alias', () => {
    for (const file of sharedFiles) assert.doesNotMatch(readFileSync(file, 'utf8'), /from '@\//, file);
  });

  it('the mobile app never imports the MCP package', () => {
    for (const file of files(appSrc)) {
      assert.doesNotMatch(readFileSync(file, 'utf8'), /tools\/flame-mcp|@modelcontextprotocol/, file);
    }
  });

  it('the stdio entry writes nothing to stdout itself', () => {
    for (const file of serverFiles) {
      assert.doesNotMatch(readFileSync(file, 'utf8'), /console\.(log|info|debug)|process\.stdout/, file);
    }
  });
});
