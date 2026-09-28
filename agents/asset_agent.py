from schemas.asset import Asset

class AssetAgent:
    def create(self, source_id: str, asset_type: str, prompt: str) -> Asset:
        return Asset(asset_id=f'{source_id}-asset-v1', type=asset_type, source_id=source_id, prompt=prompt)

    def add_version(self, asset: Asset, prompt: str) -> Asset:
        return Asset(asset_id=asset.asset_id, type=asset.type, source_id=asset.source_id, prompt=prompt, url=asset.url, version=asset.version + 1, status=asset.status)
