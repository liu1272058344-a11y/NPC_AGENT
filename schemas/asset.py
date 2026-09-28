from dataclasses import asdict, dataclass

@dataclass
class Asset:
    asset_id: str
    type: str
    source_id: str
    prompt: str
    url: str = ''
    version: int = 1
    status: str = 'draft'

    def to_dict(self):
        return asdict(self)
