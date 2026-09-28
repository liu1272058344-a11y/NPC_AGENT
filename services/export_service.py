class ExportService:
    def export_asset(self, asset) -> dict:
        return {'status': 'ready', 'asset': asset.to_dict() if hasattr(asset, 'to_dict') else asset, 'format': 'json'}
