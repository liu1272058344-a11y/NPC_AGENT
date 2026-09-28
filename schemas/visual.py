from dataclasses import asdict, dataclass, field

@dataclass
class VisualPrompt:
    visual_prompt: str = ''
    negative_prompt: str = ''
    style_tags: list[str] = field(default_factory=list)
    camera: str = ''
    lighting: str = ''
    subject: str = ''
    appearance: str = ''
    costume: str = ''
    weapon: str = ''
    environment: str = ''
    art_style: str = ''

    def to_dict(self):
        return asdict(self)
