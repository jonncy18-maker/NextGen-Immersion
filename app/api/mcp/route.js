import { createMcpHandler } from '../../../lib/mcp-server';
import { MCP_TOOLS, callTool } from '../../../lib/mcp-tools';

// NGS Immersion's MCP server — the whole admin dashboard (scholar roster,
// goals, library management, tagging/import, mentor-prep AI reports) plus
// the handful of per-scholar actions that have no admin-console equivalent
// (marking a video watched, watch-later, next-video suggestions, ...),
// exposed to both Claude (claude.ai's OAuth connector, or a bare bearer
// header in Claude Code / Claude Desktop config) and ChatGPT (its
// "Access token / API key" custom-connector mode). One tool catalog serves
// both — see lib/mcp-tools.js.
//
// This URL intentionally lives at /api/mcp (not nested under a sub-path)
// specifically so it already satisfies ChatGPT's custom-connector
// requirement that the endpoint literally end in "/mcp" — no second,
// ChatGPT-shaped route needed the way a nested path would require.
async function instructions() {
  return `You are connected to NGS Immersion's admin MCP server — the comprehensible-input video platform NextGen Scholars use to track listening hours toward level-based milestones.

Every tool here calls this app's own pages/api/* routes exactly as the admin dashboard's UI does — same validation, same idempotency, same AI-tagging paths (Claude Haiku, claude-haiku-4-5). Ground every answer in tool results; never invent hours, levels, or scholar names.

House rules:
- Most tools act with admin privilege (cross-scholar). A few (get_scholar_progress, mark_video_watched, watch-later, next-video suggestions, comprehension rating, level celebration, progress coaching) require an explicit scholarId — get scholar ids from list_scholars first, never guess one.
- level_source matters: tag_channel/youtube_import set 'channel' or 'ai' (AI-derived, safe to re-classify later); update_video sets 'admin' (a manual override that future channel re-tagging will never touch). Don't call update_video casually — it's a permanent protection flag, not just a label.
- run_stale_check and run_backfill_durations consume real YouTube Data API quota in batches of 50 — don't run them speculatively.
- delete_video and delete_session are destructive (soft-delete and hard-delete respectively). Confirm with the person you're acting for before calling either.
- Dates are YYYY-MM-DD, program timezone is Asia/Manila. Program goal changes should generally be followed by update_program_goal's applyToAll only when that's actually intended — it overwrites every scholar's individual target.`;
}

export const POST = createMcpHandler({
  tokenEnvVar: 'IMMERSION_MCP_TOKEN',
  resourcePath: '/api/mcp',
  serverName: 'ngs-immersion',
  tools: MCP_TOOLS,
  callTool,
  instructions,
});
