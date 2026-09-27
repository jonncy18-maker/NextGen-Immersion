import { createProtectedResourceMetadataHandler } from '../../../lib/mcp-server';

// Root-level fallback for an MCP client that checks the origin's well-known
// path without a resource-specific suffix. This app has exactly one MCP
// resource (app/api/mcp), so it's unambiguous which one to point at.
export const GET = createProtectedResourceMetadataHandler('/api/mcp');
