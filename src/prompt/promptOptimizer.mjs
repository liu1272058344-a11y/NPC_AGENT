export function optimizePrompt(promptPackage, critique = { issues: [] }) {
  const issues = Array.isArray(critique.issues) ? critique.issues : []
  const suffix = issues.length ? `, include ${issues.join(', ')}` : ''
  return { ...promptPackage, prompt: `${promptPackage.prompt || ''}${suffix}`.trim() }
}
