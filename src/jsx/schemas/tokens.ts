// src/jsx/schemas/tokens.ts
// Zod schemas for design tokens - single source of truth
import { z } from 'zod'

// Spacing tokens
export const SpacingToken = z.enum(['none', 'xs', 'sm', 'md', 'lg', 'xl', '2xl'])
export type SpacingToken = z.infer<typeof SpacingToken>

// Alignment tokens
export const AlignToken = z.enum(['start', 'center', 'end', 'stretch', 'between'])
export type AlignToken = z.infer<typeof AlignToken>

// Background tokens - shadcn-compatible
export const BackgroundToken = z.enum([
  'transparent',
  'background',
  'card',
  'primary',
  'secondary',
  'muted',
  'accent',
  'destructive',
  'input',
])
export type BackgroundToken = z.infer<typeof BackgroundToken>

// Border radius tokens
export const RadiusToken = z.enum(['none', 'sm', 'md', 'lg', 'xl', 'full'])
export type RadiusToken = z.infer<typeof RadiusToken>

// Color tokens - shadcn-compatible (foreground colors for text)
export const ColorToken = z.enum([
  'foreground',
  'card-foreground',
  'primary',
  'primary-foreground',
  'secondary',
  'secondary-foreground',
  'muted',
  'muted-foreground',
  'accent',
  'accent-foreground',
  'destructive',
  'destructive-foreground',
  'border',
  'ring',
])
export type ColorToken = z.infer<typeof ColorToken>

// Typography size tokens
export const SizeToken = z.enum(['xs', 'sm', 'base', 'lg', 'xl', '2xl'])
export type SizeToken = z.infer<typeof SizeToken>

// Font weight tokens
export const WeightToken = z.enum(['normal', 'medium', 'semibold', 'bold'])
export type WeightToken = z.infer<typeof WeightToken>

// Image fit tokens
export const FitToken = z.enum(['cover', 'contain', 'fill'])
export type FitToken = z.infer<typeof FitToken>
