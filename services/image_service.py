class ImageService:
    def generate_image(self, prompt: str) -> dict:
        return {'status': 'queued', 'prompt': prompt, 'provider': None}
