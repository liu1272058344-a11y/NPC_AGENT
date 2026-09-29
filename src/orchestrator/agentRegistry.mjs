const agents = new Map()

export function registerAgent(name, handler, metadata = {}) { agents.set(name, { name, handler, metadata }); return agents.get(name) }
export function getAgent(name) { return agents.get(name) }
export function listAgents() { return [...agents.values()].map(({ name, metadata }) => ({ name, metadata })) }
