from schemas.character import Character, CharacterProfile

class CharacterAgent:
    def run(self, requirement: str, world_name: str = '') -> Character:
        return Character(character_id='character-draft', profile=CharacterProfile(name='Generated Character', role=requirement[:60], background=f'Lives in {world_name}.', personality=['driven', 'guarded']))
