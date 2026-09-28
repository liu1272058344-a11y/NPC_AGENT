from dataclasses import asdict, dataclass

@dataclass
class WorldContext:
    name: str = ''
    genre: str = ''
    style: str = ''
    summary: str = ''
    atmosphere: str = ''
    core_rule: str = ''
    central_conflict: str = ''

    def to_dict(self):
        return asdict(self)
