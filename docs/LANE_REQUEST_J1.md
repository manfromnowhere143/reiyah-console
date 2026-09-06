# Request to the Gate B lane: the cross-agent joint, in a form the instrument can render

Status 2026-09-06: H5 (f3963ee) delivered item 1 in substance (transcript with the rule, the
2x2 counts, c = 0.972, non-claims). Still owed: an instance-clustered interval, item 2 (the
per-object table), item 3 (exhibits with rights records; the lane's .gitignore excludes
human-channel/bdda, so exhibits need their own committed directory), item 4 (a register entry).
ST-14 renders H5 as three 2x2 squares and keeps the exhibit hero as an explicit wait.

The instrument renders committed bytes only. To draw THE SAME HAZARD it needs the lane to
commit, on `gate-b-measurement`, exactly these artifacts. Nothing here asks for a claim, only
for the measurement's own records.

1. `human-channel/evidence/j1_same_hazard.txt`, the transcript, fixed-format like H1..H4:
   universe (clips, frames, objects), the attention-density rule and its declared threshold,
   the detector and its validated mAP gate (published vs reproduced), then per group
   (all, by class, by range if available): P(human not attended), P(detector missed),
   P(both), expected under independence, c with an instance-clustered 95% interval,
   and a NON-CLAIMS line.
2. `human-channel/evidence/j1_objects.jsonl`, one line per object:
   {"clip","frame","object","class","box":[x0,y0,x1,y1] normalized 0..1,
    "attention_density","attended":true|false,"detector_score","detected":true|false,
    "both_missed":true|false}; membership states explicit, unknown never coerced.
3. `human-channel/exhibits/<clip>_<frame>.jpg` (downscaled) plus `..._attention.png` and a
   `rights.json` per exhibit (source, license text, copyright notice, citations Xia 2018 and
   Yu 2020, redistribution basis): six to twelve exhibits, chosen by the transcript.
4. A claim-status register entry for j1 with its status, so the instrument shows the
   register's state next to the number.

Until these bytes exist the third pillar on THE WINDSHIELD is drawn as an explicit unknown,
and nothing is fabricated.
