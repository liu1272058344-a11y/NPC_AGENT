from schemas.visual import VisualPrompt

class PromptOptimizer:
    def critique(self, prompt: VisualPrompt) -> list[str]:
        fields = {'character information': prompt.subject, 'visual style': prompt.art_style, 'environment': prompt.environment, 'camera': prompt.camera, 'lighting': prompt.lighting}
        return [name for name, value in fields.items() if not value]

    def optimize(self, prompt: VisualPrompt) -> VisualPrompt:
        missing = self.critique(prompt)
        prompt.visual_prompt = prompt.visual_prompt + (f"; add: {', '.join(missing)}" if missing else '')
        return prompt
