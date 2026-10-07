/**
 * Public MCP server (Model Context Protocol) for AI agents, at
 * https://geckinspect.com/mcp (vercel.json rewrites /mcp here).
 *
 * Stateless Streamable HTTP: each POST carries one JSON-RPC message and
 * gets one JSON response. No session, no auth, read-only tools. The tool
 * logic lives in scripts/mcp/core.js, bundled to api/_lib/mcp-core.js.
 *
 * Tool calls are logged to public.agent_hits (path /mcp/<tool>) so the
 * weekly agent review can see which agents use which tools.
 */
import { SERVER_INFO, INSTRUCTIONS, TOOLS, callTool } from './_lib/mcp-core.js';
import { classifyAgent, logAgentHit } from './_lib/bots.js';

const SUPPORTED_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'];

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept, Mcp-Session-Id, Mcp-Protocol-Version, Authorization',
};

const reply = (body, status = 200) =>
  new Response(body == null ? null : JSON.stringify(body), {
    status,
    headers: { ...CORS, ...(body == null ? {} : { 'Content-Type': 'application/json' }) },
  });

const rpcError = (id, code, message) => ({ jsonrpc: '2.0', id: id ?? null, error: { code, message } });

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

// GET opens a server-to-client stream in the spec; this server has none.
// A plain GET from a browser or crawler gets a short description instead.
export function GET(request) {
  if ((request.headers.get('accept') || '').includes('text/event-stream')) {
    return new Response(null, { status: 405, headers: { ...CORS, Allow: 'POST, OPTIONS' } });
  }
  return reply({
    ...SERVER_INFO,
    description: INSTRUCTIONS,
    transport: 'streamable-http (POST JSON-RPC to this URL)',
    tools: TOOLS.map((t) => ({ name: t.name, description: t.description })),
    docs: 'https://geckinspect.com/data',
  });
}

export async function POST(request) {
  let msg;
  try {
    msg = await request.json();
  } catch {
    return reply(rpcError(null, -32700, 'Parse error'), 400);
  }
  if (Array.isArray(msg)) return reply(rpcError(null, -32600, 'Batching is not supported'), 400);
  if (!msg || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') {
    return reply(rpcError(msg?.id, -32600, 'Invalid request'), 400);
  }

  // Notifications (no id) need no answer.
  if (msg.id === undefined || msg.id === null) return reply(null, 202);

  const { id, method, params = {} } = msg;
  switch (method) {
    case 'initialize': {
      const asked = params.protocolVersion;
      return reply({
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: SUPPORTED_VERSIONS.includes(asked) ? asked : SUPPORTED_VERSIONS[0],
          capabilities: { tools: { listChanged: false } },
          serverInfo: SERVER_INFO,
          instructions: INSTRUCTIONS,
        },
      });
    }
    case 'ping':
      return reply({ jsonrpc: '2.0', id, result: {} });
    case 'tools/list':
      return reply({ jsonrpc: '2.0', id, result: { tools: TOOLS } });
    case 'tools/call': {
      const name = String(params.name || '');
      const result = await callTool(name, params.arguments);
      if (!result) return reply(rpcError(id, -32602, `Unknown tool: ${name}`));
      const ua = request.headers.get('user-agent') || '';
      const who = classifyAgent(ua) || { agent: 'mcp-client', kind: 'tool' };
      await logAgentHit({ ...who, path: `/mcp/${name}`, ua });
      return reply({ jsonrpc: '2.0', id, result });
    }
    default:
      return reply(rpcError(id, -32601, `Method not found: ${method}`));
  }
}
