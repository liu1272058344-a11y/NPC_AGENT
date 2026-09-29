const required = ['subject', 'appearance', 'costume', 'environment', 'lighting', 'camera', 'art_style']

export function criticPrompt(promptPackage) {
  const issues = required.filter((field) => typeof promptPackage?.[field] !== 'string' || !promptPackage[field].trim())
  return { valid: issues.length === 0, issues }
}
