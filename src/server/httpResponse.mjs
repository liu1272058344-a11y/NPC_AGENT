export const withRequestId = (body, requestId) => typeof requestId === 'string' && requestId.trim()
  ? { ...body, requestId }
  : body
