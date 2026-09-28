import unittest

from agents.controller import PipelineController
from agents.prompt_optimizer import PromptOptimizer


class PipelineTest(unittest.TestCase):
    def test_controller_runs_content_pipeline(self):
        result = PipelineController().run('黑暗幻想 Boss 角色', 'dark fantasy')
        self.assertEqual(result['project']['world']['style'], 'dark fantasy')
        self.assertEqual(len(result['project']['characters']), 1)
        self.assertEqual(len(result['project']['assets']), 1)

    def test_prompt_critic_reports_missing_visual_fields(self):
        prompt = type('Prompt', (), {'subject': 'Boss', 'art_style': '', 'environment': '', 'camera': '', 'lighting': ''})()
        issues = PromptOptimizer().critique(prompt)
        self.assertIn('visual style', issues)
        self.assertIn('camera', issues)

    def test_asset_versioning(self):
        from agents.asset_agent import AssetAgent
        asset = AssetAgent().create('NPC001', 'character', 'v1')
        v2 = AssetAgent().add_version(asset, 'v2 corrupted knight')
        self.assertEqual(v2.version, 2)


if __name__ == '__main__':
    unittest.main()
