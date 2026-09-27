import { createAuthorizeHandlers } from '../../../../lib/mcp-server';

export const { GET, POST } = createAuthorizeHandlers({
  tokenEnvVar: 'IMMERSION_MCP_TOKEN',
  title: 'NGS Immersion',
});
