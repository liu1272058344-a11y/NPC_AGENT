import { spawn } from 'node:child_process'

export function runPipeline(payload, options = {}) {
  const python = options.python || process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3')
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
