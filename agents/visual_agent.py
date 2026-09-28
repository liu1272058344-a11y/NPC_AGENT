from schemas.character import Character
from schemas.visual import VisualPrompt

class VisualAgent:
    def run(self, character: Character, world_summary: str = '') -> VisualPrompt:
        p = character.profile
        v = character.visual
        prompt = f'{p.name}, {p.role}; appearance: {v.appearance}; costume: {v.costume}; weapon: {v.weapon}; environment: {v.environment}; world: {world_summary}'
        return VisualPrompt(visual_prompt=prompt, negative_prompt='blurry, low quality, inconsistent anatomy', style_tags=['game concept art'], subject=p.name, appearance=v.appearance, costume=v.costume, weapon=v.weapon, environment=v.environment, art_style='cinematic game art')
