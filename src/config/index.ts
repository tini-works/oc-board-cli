export { type PrevConfig, defaultConfig, validateConfig } from './schema'
export { loadConfig, saveConfig, updateOrder, findConfigFile } from './loader'

/** Gateway configuration — resolved once from env vars */
export const gatewayConfig = {
  proto: process.env.OPENCLAW_GATEWAY_PROTO || 'http',
  host: process.env.OPENCLAW_GATEWAY_HOST || 'host.docker.internal',
  port: parseInt(process.env.OPENCLAW_GATEWAY_PORT || '18789', 10),
  token: process.env.OPENCLAW_GATEWAY_TOKEN || '',
  model: process.env.OPENCLAW_MODEL || '',
  maxThinkingTokens: process.env.MAX_THINKING_TOKENS ? parseInt(process.env.MAX_THINKING_TOKENS, 10) : 0,
}
