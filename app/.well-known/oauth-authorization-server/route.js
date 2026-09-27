import { createAuthorizationServerMetadataHandler } from '../../../lib/mcp-server';

// Root-level fallback — see the sibling oauth-protected-resource/route.js
// comment.
export const GET = createAuthorizationServerMetadataHandler('/api/mcp');
