from dataclasses import asdict, dataclass, field
from .asset import Asset
from .character import Character
from .world import WorldContext

@dataclass
class GameProject:
    project_id: str
    name: str
    genre: str = ''
    style: str = ''
    world: WorldContext | None = None
    characters: list[Character] = field(default_factory=list)
    assets: list[Asset] = field(default_factory=list)

    def to_dict(self):
        return asdict(self)
