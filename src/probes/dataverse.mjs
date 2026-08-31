// Dataverse read client for Copilot Studio agent components.
//
// Read-only by design. Agent Receipts never writes to an environment: it
// exists to check what is actually there, and a verifier that can also change
// the thing it verifies is not a verifier.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

export class ProbeError extends Error {}

export function token(envUrl) {
  if (process.env.MCS_TOKEN) return process.env.MCS_TOKEN.trim();
  const args = ['account', 'get-access-token', '--resource', envUrl.replace(/\/$/, ''),
    '--query', 'accessToken', '-o', 'tsv'];
  if (process.env.MCS_TENANT_ID) args.push('--tenant', process.env.MCS_TENANT_ID);
  try {
    return execFileSync('az', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch (e) {
    throw new ProbeError(
      `could not get a Dataverse token for ${envUrl}. Run "az login", or set MCS_TOKEN. (${e.message.split('\n')[0]})`
    );
  }
}

async function get(envUrl, path, tok) {
  const url = `${envUrl.replace(/\/$/, '')}/api/data/v9.2/${path}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${tok}`,
      Accept: 'application/json',
      'OData-MaxVersion': '4.0',
      'OData-Version': '4.0',
    },
  });
  if (!res.ok) {
    throw new ProbeError(`Dataverse ${res.status} ${res.statusText} for ${path}\n${(await res.text()).slice(0, 400)}`);
  }
  return res.json();
}

/**
 * Every probe reads through this one function, so `--fixture` gives the whole
 * probe surface a deterministic offline mode for CI and for tests.
 */
export async function loadComponents({ envUrl, botId, fixture }) {
  if (fixture) {
    const data = JSON.parse(readFileSync(fixture, 'utf8'));
    return { source: `fixture ${fixture}`, components: data.components ?? [], bot: data.bot ?? {} };
  }
  if (!envUrl || !botId) {
    throw new ProbeError('live probes need --env-url and --bot-id, or --fixture for an offline check');
  }
  const tok = token(envUrl);
  const select = 'name,schemaname,componenttype,data,description,botcomponentid';
  const comp = await get(
    envUrl,
    `botcomponents?$filter=_parentbotid_value eq ${botId}&$select=${select}&$top=5000`,
    tok
  );
  const bots = await get(envUrl, `bots(${botId})?$select=name,schemaname,configuration`, tok);
  return { source: `${envUrl} bot ${botId}`, components: comp.value ?? [], bot: bots ?? {} };
}

const KIND_RE = /^\s*kind:\s*(\S+)/m;

export function kindOf(component) {
  const m = KIND_RE.exec(component.data ?? '');
  return m ? m[1] : 'Unknown';
}

/**
 * Skills are stored as componenttype 9 with `kind: InlineAgentSkill` and the
 * entire SKILL.md carried in an indented `content:` block. componenttype alone
 * never identifies a skill, because type 9 also holds child agents and tools.
 */
export function skillsFrom(components) {
  return components
    .filter((c) => c.componenttype === 9 && kindOf(c) === 'InlineAgentSkill')
    .map((c) => ({
      schemaname: c.schemaname,
      name: skillName(c.schemaname),
      description: c.description ?? '',
      content: unwrapContent(c.data ?? ''),
    }));
}

function skillName(schemaname = '') {
  const m = /\.skill\.(.+?)_[A-Za-z0-9]{3}$/.exec(schemaname);
  if (m) return m[1];
  const parts = schemaname.split('.skill.');
  return (parts[1] ?? schemaname).replace(/_[A-Za-z0-9]{3}$/, '');
}

function unwrapContent(data) {
  const at = data.indexOf('content:');
  if (at === -1) return '';
  const body = data.slice(data.indexOf('\n', at) + 1);
  return body
    .split('\n')
    .map((l) => (l.startsWith('  ') ? l.slice(2) : l))
    .join('\n')
    .replace(/\s+$/, '');
}

// Harness detection reads recognizer names out of the bot configuration.
// Both names are observed artifacts, not a documented Microsoft contract:
// CLICopilotRecognizer appears in first-party test data, GenerativeAIRecognizer
// only in community tooling. Neither is on Microsoft Learn. So this returns
// "unknown" rather than guessing, and an unknown harness fails the gate.
export function harnessOf(bot) {
  const cfg = typeof bot.configuration === 'string' ? bot.configuration : JSON.stringify(bot.configuration ?? {});
  if (/CLICopilotRecognizer/.test(cfg)) return 'github-copilot';
  if (/GenerativeAIRecognizer/.test(cfg)) return 'standard';
  return 'unknown';
}
