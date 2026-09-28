from .character_agent import CharacterAgent
from .game_agent import GameIdeaAgent
from .prompt_optimizer import PromptOptimizer
from .visual_agent import VisualAgent
from .world_agent import WorldAgent
from .asset_agent import AssetAgent

class PipelineController:
    """Model-agnostic orchestration boundary for the future multi-agent pipeline."""
    def __init__(self):
        self.game = GameIdeaAgent(); self.world = WorldAgent(); self.character = CharacterAgent()
        self.visual = VisualAgent(); self.optimizer = PromptOptimizer(); self.assets = AssetAgent()

    def run(self, requirement: str, style: str = '', asset_type: str = 'character'):
        project = self.game.run(requirement)
        project.style = style
        project.world = self.world.run(requirement, style)
        character = self.character.run(requirement, project.world.name)
        project.characters.append(character)
        visual = self.optimizer.optimize(self.visual.run(character, project.world.summary))
        project.assets.append(self.assets.create(character.character_id, asset_type, visual.visual_prompt))
        return {'project': project.to_dict(), 'visual': visual.to_dict()}
