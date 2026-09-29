from dataclasses import dataclass, field

SCHEMA_VERSION = '0.2'

@dataclass
class AgentResult:
    run_id: str
    agent: str
    status: str
    data: dict = field(default_factory=dict)
    errors: list[dict] = field(default_factory=list)
    schema_version: str = SCHEMA_VERSION

    def to_dict(self):
        return {'schema_version': self.schema_version, 'run_id': self.run_id, 'agent': self.agent, 'status': self.status, 'data': self.data, 'errors': self.errors}
