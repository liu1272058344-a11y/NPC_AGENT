import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'

export function runPipeline(payload, options = {}) {
  const candidates = process.platform === 'win32'
    ? [path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Python', 'Python313', 'python.exe'), path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Python', 'Python312', 'python.exe'), path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Python', 'Python311', 'python.exe'), 'py', 'python']
    : ['python3', 'python']
  const python = options.python || process.env.PYTHON || candidates.find((candidate) => candidate && (candidate.includes('\\') ? existsSync(candidate) : true))
  return new Promise((resolve, reject) => {
    const child = spawn(python, ['pipeline_cli.py'], { cwd: options.cwd || process.cwd(), stdio: ['pipe', 'pipe', 'pipe'] })
    let stdout = ''; let stderr = ''
    child.stdout.on('data', (chunk) => { stdout += chunk })
    child.stderr.on('data', (chunk) => { stderr += chunk })
    child.on('error', (error) => reject(new Error(`Pipeline runtime unavailable: ${error.message}`)))
    child.on('close', (code) => {
      if (code !== 0) return reject(new Error(stderr.trim() || 'Pipeline execution failed'))
      try { const result = JSON.parse(stdout); if (result.error) return reject(new Error(result.error)); resolve(result) } catch { reject(new Error('Pipeline returned invalid JSON')) }
    })
    child.stdin.end(JSON.stringify(payload))
  })
}
