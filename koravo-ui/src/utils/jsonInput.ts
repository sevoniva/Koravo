export type JsonObject = Record<string, unknown>

export class JsonInputError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'JsonInputError'
  }
}

export function parseJsonObject(text: string, label: string): JsonObject {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    throw new JsonInputError(`${label} must be valid JSON`)
  }

  if (!isJsonObject(value)) {
    throw new JsonInputError(`${label} must be a JSON object`)
  }

  return value
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
