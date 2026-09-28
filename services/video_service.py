class VideoService:
    def generate_video(self, prompt: str) -> dict:
        return {'status': 'queued', 'prompt': prompt, 'provider': None}
