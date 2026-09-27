export const createRequestGuard = () => {
  let current = null
  let sequence = 0
  return {
    begin({ replace = false } = {}) {
      if (current && !replace) return null
      if (current) current.controller.abort()
      const request = { id: ++sequence, controller: new AbortController() }
      current = request
      return request
    },
    isCurrent(request) { return current?.id === request?.id },
    finish(request) { if (current?.id === request?.id) current = null },
    cancel() { current?.controller.abort(); current = null }
  }
}
