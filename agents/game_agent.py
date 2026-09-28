from schemas.game import GameProject

class GameIdeaAgent:
    def run(self, requirement: str) -> GameProject:
        return GameProject(project_id='project-draft', name=requirement[:60] or 'Untitled Game')
