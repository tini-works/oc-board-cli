import React from 'react'

const thinkCharColors = ['#c4b5fd', '#93c5fd', '#86efac', '#fda4af', '#fcd34d']

function colorizeThinkWord(word: string, keyPrefix: number) {
  return (
    <span key={keyPrefix} className="think-highlight">
      {word.split('').map((ch, ci) => (
        <span key={ci} style={{ color: thinkCharColors[ci % thinkCharColors.length] }}>{ch}</span>
      ))}
    </span>
  )
}

export function highlightThink(text: string) {
  const parts = text.split(/(\S*think\S*)/gi)
  if (parts.length === 1) return <>{text}</>
  return (
    <>
      {parts.map((p, i) =>
        /think/i.test(p) ? colorizeThinkWord(p, i) : p
      )}
    </>
  )
}
