from schemas.world import WorldContext

class WorldAgent:
    def run(self, requirement: str, project_style: str = '') -> WorldContext:
        return WorldContext(name='Generated World', genre=requirement[:40], style=project_style, summary=requirement)
