import { useState, useEffect } from 'react'

export interface CRContext {
  cr_id: string
  slug: string
  branch: string
  pr_number?: number
  pr_url?: string
  tunnel_url?: string
  user?: string
  created_at?: string
}

export function useCRContext(): CRContext | null {
  const [ctx, setCtx] = useState<CRContext | null>(null)

  useEffect(() => {
    fetch('/__prev/cr-context')
      .then(r => r.json())
      .then((d: { context: CRContext | null }) => setCtx(d.context))
      .catch(() => setCtx(null))
  }, [])

  return ctx
}
