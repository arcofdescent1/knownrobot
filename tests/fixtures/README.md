# Real metadata regression fixtures

These fixtures contain the unchanged `type`, `input_features`, and
`output_features` fields selected from public configurations retrieved on
September 16, 2026. They are metadata tests, not physical policy evaluations.

- ACT: https://huggingface.co/legalaspro/act-so101-pick-place-cube-30hz-dec7-v2/raw/19b56a188f1c9ec578ddd07c058b12dd980b23ff/config.json
- SmolVLA: https://huggingface.co/lerobot/smolvla_base/raw/c83c3163b8ca9b7e67c509fffd9121e66cb96205/config.json

SmolVLA source revision: `c83c3163b8ca9b7e67c509fffd9121e66cb96205`.
ACT source revision: `19b56a188f1c9ec578ddd07c058b12dd980b23ff`.
Fixtures deliberately do not invent robot, calibration, dataset revision, or
framework version metadata missing from the checkpoint configuration.
