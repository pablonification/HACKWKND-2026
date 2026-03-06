# Semai Translation Evaluation Report

Generated: 2026-03-05T14:59:30.495Z

Total cases: 22
Passed: 20
Failed: 2
Critical failed: 0
Tier A failed: 0
Telemetry failures: 0
Request failures: 0
Warnings returned: 0
Fallback responses: 0
Average latency (ms): 102

## Tier Summary

| Tier | Total | Passed | Failed | Gate |
|---|---:|---:|---:|---|
| A | 8 | 8 | 0 | PASS |
| B | 8 | 8 | 0 | - |
| C | 6 | 4 | 2 | - |

## Provider Usage

| Provider | Count |
|---|---:|
| glossary | 17 |
| cerebras | 5 |

| ID | Tier | Priority | Pair | Input | Expected | Output | Provider | Model | Telemetry | Warning | Result |
|---|---|---|---|---|---|---|---|---|---|---|---|
| tierA-001 | A | critical | semai->en | bobolian | traditional healer | traditional healer | glossary | glossary-exact | - |  | PASS |
| tierA-002 | A | critical | semai->en | bobohiz | rice wine | rice wine | glossary | glossary-exact | - |  | PASS |
| tierA-003 | A | critical | semai->en | tong | forest spirit | forest spirit | glossary | glossary-exact | - |  | PASS |
| tierA-004 | A | critical | en->semai | traditional healer | bobolian | bobolian | glossary | glossary-exact | - |  | PASS |
| tierA-005 | A | critical | en->semai | rice wine | bobohiz | bobohiz | glossary | glossary-exact | - |  | PASS |
| tierA-006 | A | critical | en->semai | forest spirit | tong | tong | glossary | glossary-exact | - |  | PASS |
| tierA-007 | A | critical | ms->en | dukun tradisional | traditional healer | traditional healer | glossary | glossary-exact | - |  | PASS |
| tierA-008 | A | critical | ms->en | arak beras | rice wine | rice wine | glossary | glossary-exact | - |  | PASS |
| tierB-001 | B | high | semai->en | rumah | house | house | glossary | glossary-exact | - |  | PASS |
| tierB-002 | B | high | semai->en | terima kasih | thank you | thank you | glossary | glossary-exact | - |  | PASS |
| tierB-003 | B | high | en->semai | good morning | selamat pagi | selamat pagi | glossary | glossary-exact | - |  | PASS |
| tierB-004 | B | high | semai->en | selamat malam | good night | good night | glossary | glossary-exact | - |  | PASS |
| tierB-005 | B | high | semai->en | apa khabar | how are you | how are you | glossary | glossary-exact | - |  | PASS |
| tierB-006 | B | high | ms->en | saya suka hutan | i like the forest | I like the forest | cerebras | gpt-oss-120b | OK |  | PASS |
| tierB-007 | B | high | semai->en | anak | child | child | glossary | glossary-exact | - |  | PASS |
| tierB-008 | B | high | semai->en | keluarga | family | family | glossary | glossary-exact | - |  | PASS |
| tierC-001 | C | medium | semai->en | air | water | water | glossary | glossary-exact | - |  | PASS |
| tierC-002 | C | medium | semai->en | api | fire | fire | glossary | glossary-exact | - |  | PASS |
| tierC-003 | C | medium | semai->en | keluarga di rumah | family at house/home | family in house | cerebras | gpt-oss-120b | OK |  | FAIL |
| tierC-004 | C | medium | en->semai | the family says thank you | terima kasih | keluarga kata terima kasih | cerebras | gpt-oss-120b | OK |  | PASS |
| tierC-005 | C | medium | ms->en | keluarga itu minum air di rumah selepas makan nasi | family drank water at home after eating rice | The family drinks water in the house after eating rice. | cerebras | gpt-oss-120b | OK |  | FAIL |
| tierC-006 | C | medium | en->semai | good morning, traditional healer | bobolian | selamat pagi, bobolian | cerebras | gpt-oss-120b | OK |  | PASS |

