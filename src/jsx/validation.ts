// src/jsx/validation.ts
// Configurable validation for JSX primitives
import { z } from 'zod'

/**
 * Validation mode controls how schema validation behaves:
 * - 'strict': throws on validation errors (useful for development/testing)
 * - 'warn': logs warnings but continues (default in DEV)
 * - 'off': no validation (default in production)
 */
export type ValidationMode = 'strict' | 'warn' | 'off'

// DEV mode flag
const DEV = process.env.NODE_ENV !== 'production'

// Current validation mode - defaults based on environment
let validationMode: ValidationMode = DEV ? 'warn' : 'off'

/**
 * Set the validation mode for JSX primitives
 * @param mode - The validation mode to use
 */
export function setValidationMode(mode: ValidationMode): void {
  validationMode = mode
}

/**
 * Get the current validation mode
 */
export function getValidationMode(): ValidationMode {
  return validationMode
}

/**
 * Validate props against a Zod schema based on current mode.
 * In 'strict' mode, throws on error.
 * In 'warn' mode, logs a warning and continues.
 * In 'off' mode, skips validation entirely.
 *
 * @param schema - Zod schema to validate against
 * @param props - Props to validate
 * @param componentName - Component name for error messages
 */
export function validateProps(
  schema: z.ZodType,
  props: unknown,
  componentName: string
): void {
  if (validationMode === 'off') {
    return
  }

  const result = schema.safeParse(props)

  if (!result.success) {
    const errorMessage = formatValidationError(componentName, result.error)

    if (validationMode === 'strict') {
      throw new Error(errorMessage)
    }

    // warn mode - log and continue
    console.warn(errorMessage)
  }
}

/**
 * Format Zod validation error for display
 */
function formatValidationError(componentName: string, error: z.ZodError): string {
  const issues = error.issues.map((issue) => {
    const path = issue.path.length > 0 ? `${issue.path.join('.')}: ` : ''
    return `  - ${path}${issue.message}`
  })

  return `[${componentName}] Invalid props:\n${issues.join('\n')}`
}
