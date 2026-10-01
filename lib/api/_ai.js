import Anthropic from '@anthropic-ai/sdk';

// Task → provider registry for the text-only Haiku-class jobs. Server-only
// (lives in lib/api, outside pages/api, like _tag.js).
//
// Every task in LUNA_TASKS runs on Luna whenever OPENAI_API_KEY is set, and on
// Haiku otherwise. So the key's Vercel scope is the switch: add it to Preview
// only to try Luna while Production stays on Haiku. Which tasks are eligible is
// decided here, in code. One optional env var:
//
//   AI_FORCE_ANTHROPIC=1   → everything back to Haiku, whatever else is set
//
// Tagging (tag-*) is here too: John chose Luna for it on 2026-10-01 after the
// agreement check showed 93% within one level of Haiku's labels (54% exact).
// There is no ground truth for either model, so that was a cost-and-judgment
// call, not an accuracy result. The scholar-facing coaching and level-up copy
// are deliberately NOT here. Model IDs are API arguments and stay pinned to
// exact IDs.
export const HAIKU_MODEL = 'claude-haiku-4-5';
export const LUNA_MODEL = 'gpt-6-luna';

export const LUNA_TASKS = [
  'next-video',
  'suggest-topics',
  'suggest-interests',
  'scholar-digest',
  'scholar-topic-trends',
  'scholar-video-analysis',
  'tag-channel-level',
  'tag-video',
  'tag-video-topics',
  'tag-oet',
];

const OPENAI_URL = 'https://api.openai.com/v1/responses';
// Reasoning tokens count against max_output_tokens, so a tight cap can be spent
// entirely on thinking and return nothing. Headroom is added to the caller's cap.
const REASONING_HEADROOM = 600;
const TIMEOUT_MS = 20000;

export function providerFor(task, env = process.env) {
  if (!LUNA_TASKS.includes(task)) return 'anthropic';
  if (env.AI_FORCE_ANTHROPIC === '1' || !env.OPENAI_API_KEY) return 'anthropic';
  return 'luna';
}

async function callLuna({ prompt, maxTokens }) {
  const res = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    cache: 'no-store',
    signal: AbortSignal.timeout(TIMEOUT_MS),
    body: JSON.stringify({
      model: LUNA_MODEL,
      input: prompt,
      max_output_tokens: maxTokens + REASONING_HEADROOM,
      reasoning: { effort: 'low' },
      store: false,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      `OpenAI ${res.status}: ${err?.error?.message || res.statusText}`
    );
  }
  const data = await res.json();
  if (data.status === 'incomplete') {
    throw new Error(
      `OpenAI response incomplete (${data.incomplete_details?.reason || 'unknown'})`
    );
  }
  const text = (data.output || [])
    .filter((item) => item.type === 'message')
    .flatMap((item) => item.content || [])
    .filter((part) => part.type === 'output_text')
    .map((part) => part.text)
    .join('')
    .trim();
  if (!text) throw new Error('OpenAI returned no text');
  return text;
}

async function callHaiku({ prompt, maxTokens }) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const message = await client.messages.create({
    model: HAIKU_MODEL,
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: prompt }],
  });
  return message.content[0]?.text?.trim() || '';
}

// One user prompt in, one text answer out. A Luna failure (HTTP error,
// truncation, empty reply) falls back to Haiku for that call when an Anthropic
// key exists, so flipping a task can't make an endpoint fail where it worked
// before. Throws only when no provider could answer — callers keep their own
// catch blocks exactly as they had around the SDK call.
export async function completeText({ task, prompt, maxTokens }) {
  if (providerFor(task) === 'luna') {
    try {
      return await callLuna({ prompt, maxTokens });
    } catch (err) {
      console.error(
        `[ai:${task}] Luna failed${process.env.ANTHROPIC_API_KEY ? ', falling back to Haiku' : ''}:`,
        err?.message || err
      );
      if (!process.env.ANTHROPIC_API_KEY) throw err;
    }
  }
  return callHaiku({ prompt, maxTokens });
}
