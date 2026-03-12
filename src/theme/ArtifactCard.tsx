import React, { useRef, useState } from 'react'
import type { Artifact, CommentThread } from '../server/routes/board'
import './ArtifactCard.css'

interface ArtifactCardProps {
  artifact: Artifact
  threads: CommentThread[]
  boardId: string
  onDragEnd: (artifactId: string, x: number, y: number) => void
  onCreateThread: (artifactId: string, xPct: number, yPct: number) => void
  onRefresh: () => void
}

export function ArtifactCard({ artifact, threads, boardId, onDragEnd, onCreateThread, onRefresh }: ArtifactCardProps) {
  const contentRef = useRef<HTMLDivElement>(null)
  const [openThreadId, setOpenThreadId] = useState<string | null>(null)

  const handleContentClick = (e: React.MouseEvent) => {
    const rect = contentRef.current?.getBoundingClientRect()
    if (!rect) return
    const xPct = Math.round(((e.clientX - rect.left) / rect.width) * 100)
    const yPct = Math.round(((e.clientY - rect.top) / rect.height) * 100)
    onCreateThread(artifact.id, xPct, yPct)
  }

  const title = artifact.title || artifact.source.split('/').pop() || artifact.id

  return (
    <div className="artifact-card">
      <div className="artifact-card-header">
        <span className="artifact-card-drag">⠿</span>
        <span className="artifact-card-title">{title}</span>
        <span className="artifact-card-type" data-type={artifact.type}>
          {artifact.type}
        </span>
      </div>

      <div className="artifact-card-content" ref={contentRef} onClick={handleContentClick}>
        {threads.map(thread => (
          <div
            key={thread.id}
            className="artifact-thread-dot"
            data-status={thread.status}
            style={{ left: `${thread.x_pct}%`, top: `${thread.y_pct}%` }}
            onClick={e => { e.stopPropagation(); setOpenThreadId(t => t === thread.id ? null : thread.id) }}
            title={`Thread: ${thread.comments.length} comments`}
          >
            {thread.comments.length}
          </div>
        ))}

        {artifact.type === 'preview' && (
          <iframe
            className="artifact-card-iframe"
            src={`/_preview-runtime?src=${artifact.source}`}
            title={title}
            loading="lazy"
          />
        )}
        {artifact.type === 'c3-doc' && (
          <div className="artifact-card-markdown">
            <em>c3 document: {artifact.source}</em>
          </div>
        )}
        {artifact.type === 'flow' && (
          <div className="artifact-card-mermaid">
            <em>Flow diagram: {artifact.source}</em>
          </div>
        )}
      </div>

      {threads.length > 0 && (
        <div className="artifact-card-footer">
          💬 {threads.length} thread{threads.length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  )
}
