from dataclasses import asdict, dataclass, field

@dataclass
class CharacterProfile:
    name: str = ''
    role: str = ''
    background: str = ''
    personality: list[str] = field(default_factory=list)

@dataclass
class CharacterVisual:
    appearance: str = ''
    costume: str = ''
    weapon: str = ''
    environment: str = ''

@dataclass
class Character:
    character_id: str
    profile: CharacterProfile = field(default_factory=CharacterProfile)
    visual: CharacterVisual = field(default_factory=CharacterVisual)

    def to_dict(self):
        return asdict(self)
