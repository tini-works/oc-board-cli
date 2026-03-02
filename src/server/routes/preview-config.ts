// Route handler: /_preview-config/* - Serves preview config as JSON
import path from 'path'
import { existsSync } from 'fs'
import { buildPreviewConfig } from '../../content/previews'
import { parseFlowDefinition, parseFlowConfig } from '../../content/config-parser'
import { verifyFlow } from '../../content/flow-verifier'
import type { FlowConfig } from '../../content/preview-types'

export function createPreviewConfigHandler(rootDir: string) {
  return async (req: Request): Promise<Response | null> => {
    const url = new URL(req.url)
    if (!url.pathname.startsWith('/_preview-config/')) return null

    const pathAfterConfig = decodeURIComponent(url.pathname.slice('/_preview-config/'.length))
    const previewsDir = path.join(rootDir, 'previews')

    // Check if this is a multi-type path: flows/name, etc.
    const multiTypeMatch = pathAfterConfig.match(/^(components|screens|flows)\/(.+)$/)

    if (multiTypeMatch) {
      const [, type, name] = multiTypeMatch
      const previewDir = path.join(previewsDir, type, name)

      if (!previewDir.startsWith(previewsDir)) {
        return new Response('Forbidden', { status: 403 })
      }

      if (existsSync(previewDir)) {
        try {
          if (type === 'flows') {
            // Try new config.yaml format first
            const newConfigYaml = path.join(previewDir, 'config.yaml')
            const newConfigYml = path.join(previewDir, 'config.yml')
            const newConfigPath = existsSync(newConfigYaml) ? newConfigYaml : newConfigYml

            if (existsSync(newConfigPath)) {
              const result = await parseFlowConfig(newConfigPath, {
                injectId: true,
                injectKind: true,
                folderName: name,
              })
              if (result.data) {
                // Run verification and include results
                const verification = verifyFlow(result.data as FlowConfig, rootDir)
                return Response.json({
                  name: result.data.title || name,
                  description: result.data.description,
                  steps: result.data.steps || [],
                  _verification: verification,
                })
              }
            }

            // Fall back to legacy index.yaml
            const configPathYaml = path.join(previewDir, 'index.yaml')
            const configPathYml = path.join(previewDir, 'index.yml')
            const configPath = existsSync(configPathYaml) ? configPathYaml : configPathYml
            if (existsSync(configPath)) {
              const flow = await parseFlowDefinition(configPath)
              if (flow) {
                return Response.json(flow)
              }
            }
          } else {
            const config = await buildPreviewConfig(previewDir)
            return Response.json(config)
          }
          return Response.json({ error: 'Invalid config format' }, { status: 400 })
        } catch (err) {
          console.error('Error building preview config:', err)
          return Response.json({ error: String(err) }, { status: 500 })
        }
      }
    } else {
      // Legacy path: /_preview-config/button (assumes components)
      const previewDir = path.resolve(previewsDir, pathAfterConfig)

      if (!previewDir.startsWith(previewsDir)) {
        return new Response('Forbidden', { status: 403 })
      }

      if (existsSync(previewDir)) {
        try {
          const config = await buildPreviewConfig(previewDir)
          return Response.json(config)
        } catch (err) {
          console.error('Error building preview config:', err)
          return Response.json({ error: String(err) }, { status: 500 })
        }
      }
    }

    return null // Not found, let other handlers try
  }
}
