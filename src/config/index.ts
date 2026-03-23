import os from 'os'
export { type PrevConfig, defaultConfig, validateConfig } from './schema'
export { loadConfig, saveConfig, updateOrder, findConfigFile } from './loader'

/** Expand ~ to home directory in paths */
function expandHome(p: string): string {
  return p.startsWith('~/') ? p.replace('~', os.homedir()) : p
}

/** Gateway configuration — resolved once from env vars */
export const gatewayConfig = {
  proto: process.env.OPENCLAW_GATEWAY_PROTO || 'http',
  host: process.env.OPENCLAW_GATEWAY_HOST || 'host.docker.internal',
  port: parseInt(process.env.OPENCLAW_GATEWAY_PORT || '18789', 10),
  token: process.env.OPENCLAW_GATEWAY_TOKEN || '',
  model: process.env.OPENCLAW_MODEL || '',
  maxThinkingTokens: process.env.MAX_THINKING_TOKENS ? parseInt(process.env.MAX_THINKING_TOKENS, 10) : 0,
}

/** JSON render directory — contains json-render-ui/, json-render/, json-render-v2-app/ */
export const jsonRenderConfig = {
  /** Parent dir containing json-render-ui/, json-render/, json-render-v2-app/ */
  baseDir: expandHome(process.env.PREV_JSON_RENDER_DIR || ''),
  /** Direct path to json-render-v2-app/ — overrides baseDir/json-render-v2-app */
  v2AppDir: expandHome(process.env.PREV_JSON_RENDER_V2_APP_DIR || ''),
}
