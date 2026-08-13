#!/usr/bin/env node
'use strict'

const fs = require('node:fs')
const path = require('node:path')
const process = require('node:process')

const FILE = path.join(process.env.HOME, '.claude', 'settings.json')

const TOP_ORDER = [
  'model',
  'effortLevel',
  'permissions',
  'skipDangerousModePermissionPrompt',
  'enabledPlugins',
  'extraKnownMarketplaces',
  'enableAllProjectMcpServers',
  'mcpServers',
  'hooks',
  'statusLine',
  'showThinkingSummaries',
  'showToolOutputs',
  'showProgress',
  'includeCoAuthoredBy',
  'includeGitInstructions',
  'autoMemoryEnabled',
  'autoUpdatesChannel',
  'cleanupPeriodDays',
  'feedbackSurveyRate',
  'env',
  '_abTao',
]

const ENV_ORDER = [
  'CLAUDE_CODE_SUBAGENT_MODEL',
  'CLAUDE_CODE_FAST_MODE',
  'USE_BUILTIN_RIPGREP',
  'BASH_DEFAULT_TIMEOUT_MS',
  'CLAUDE_BASH_NO_LOGIN',
  'CLAUDE_CODE_DISABLE_TERMINAL_TITLE',
  'CLAUDE_CODE_NO_FLICKER',
  'CLAUDE_CODE_AUTO_SAVE',
  'CLAUDE_CODE_STOP_HOOK_BLOCK_CAP',
  'DISABLE_EXTRA_USAGE_COMMAND',
  'ENABLE_TOOL_SEARCH',
  'CLAUDE_CODE_ATTRIBUTION_HEADER',
  'CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC',
  'CLAUDE_CODE_PLUGIN_PREFER_HTTPS',
  'CLAUDE_CODE_ENABLE_TELEMETRY',
  'OTEL_METRICS_INCLUDE_SESSION_ID',
  'SLACK_NOTIFY_CHANNEL',
]

function reorder(obj, order) {
  const result = {}
  for (const key of order) {
    if (key in obj)
      result[key] = obj[key]
  }
  for (const key of Object.keys(obj)) {
    if (!(key in result))
      result[key] = obj[key]
  }
  return result
}

try {
  const raw = fs.readFileSync(FILE, 'utf8')
  const data = JSON.parse(raw)

  const reordered = reorder(data, TOP_ORDER)
  if (reordered.env && typeof reordered.env === 'object') {
    reordered.env = reorder(reordered.env, ENV_ORDER)
  }

  const updated = `${JSON.stringify(reordered, null, 2)}\n`
  if (raw !== updated) {
    fs.writeFileSync(FILE, updated)
  }
}
catch {
  process.exit(0)
}
