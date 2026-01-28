// src/jsx/schemas/primitives.ts
// Zod schemas for primitive props - single source of truth
import { z } from 'zod'
import {
  SpacingToken,
  AlignToken,
  BackgroundToken,
  RadiusToken,
  ColorToken,
  SizeToken,
  WeightToken,
  FitToken,
} from './tokens'

// Children type - accepts VNode array or single VNode (normalized later)
const Children = z.any()

// Layout primitive: Col - Vertical stack
export const ColProps = z.object({
  gap: SpacingToken.optional(),
  align: AlignToken.optional(),
  padding: SpacingToken.optional(),
  children: Children.optional(),
})
export type ColProps = z.infer<typeof ColProps>

// Layout primitive: Row - Horizontal stack
export const RowProps = z.object({
  gap: SpacingToken.optional(),
  align: AlignToken.optional(),
  padding: SpacingToken.optional(),
  children: Children.optional(),
})
export type RowProps = z.infer<typeof RowProps>

// Layout primitive: Box - Container with styling
export const BoxProps = z.object({
  padding: SpacingToken.optional(),
  bg: BackgroundToken.optional(),
  radius: RadiusToken.optional(),
  children: Children.optional(),
})
export type BoxProps = z.infer<typeof BoxProps>

// Layout primitive: Spacer - Whitespace
export const SpacerProps = z.object({
  size: SpacingToken.optional(), // If absent, flex grow
})
export type SpacerProps = z.infer<typeof SpacerProps>

// Layout primitive: Slot - State-dependent placeholder
export const SlotProps = z.object({
  name: z.string(),
})
export type SlotProps = z.infer<typeof SlotProps>

// Content primitive: Text
export const TextProps = z.object({
  children: z.string().optional(),
  size: SizeToken.optional(),
  weight: WeightToken.optional(),
  color: ColorToken.optional(),
})
export type TextProps = z.infer<typeof TextProps>

// Content primitive: Icon
export const IconProps = z.object({
  name: z.string(),
  size: SizeToken.optional(),
  color: ColorToken.optional(),
})
export type IconProps = z.infer<typeof IconProps>

// Content primitive: Image
export const ImageProps = z.object({
  src: z.string(),
  alt: z.string().optional(),
  fit: FitToken.optional(),
})
export type ImageProps = z.infer<typeof ImageProps>

// Primitive type enum
export const PrimitiveType = z.enum([
  'col',
  'row',
  'box',
  'spacer',
  'slot',
  'text',
  'icon',
  'image',
  'component',
])
export type PrimitiveType = z.infer<typeof PrimitiveType>

// Props union for validation
export const PrimitiveProps = z.union([
  ColProps,
  RowProps,
  BoxProps,
  SpacerProps,
  SlotProps,
  TextProps,
  IconProps,
  ImageProps,
])
export type PrimitiveProps = z.infer<typeof PrimitiveProps>
