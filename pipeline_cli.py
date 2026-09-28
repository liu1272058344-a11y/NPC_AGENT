import json
import sys

from agents.controller import PipelineController


def main() -> None:
    payload = json.loads(sys.stdin.read() or '{}')
    requirement = str(payload.get('requirement', '')).strip()
    if not requirement:
        raise ValueError('requirement is required')
    result = PipelineController().run(
        requirement=requirement,
        style=str(payload.get('style', '')).strip(),
        asset_type=str(payload.get('assetType', 'character')).strip() or 'character',
    )
    print(json.dumps(result, ensure_ascii=False))


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(json.dumps({'error': str(error)}, ensure_ascii=False))
        raise
