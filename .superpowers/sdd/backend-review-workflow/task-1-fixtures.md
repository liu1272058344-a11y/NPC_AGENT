# Task 1 parser fixtures

These fixtures describe the contract cases used by the normalization helpers in
`src/agent/npcCreator.ts`, `server.mjs`, and `api/npc.ts`.

| Input | Expected result |
| --- | --- |
| `{"approved":true,"issues":[],"suggestions":[],"score":72}` | approved `true`, score `72` |
| `{"issues":["missing conflict"],"suggestions":[]}` | approved defaults to `false` |
| `````json\n{"approved":true,"issues":[],"suggestions":[]}\n````` | fenced JSON is accepted |
| `{"approved":false,"issues":["x"],"suggestions":["y"]` | missing closing brace is repaired |

Non JSON and empty output are converted to controlled errors by the parsers.
