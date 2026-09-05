# Frame Decryption Chain

## Task Mode
- [ ] Mode A: License analysis only
- [x] Mode B: Content decryption / clear frame recovery

## Encryption Mode Identified
- [ ] Unknown
- [ ] HLS Sample-AES
- [ ] DASH CENC (CTR)
- [ ] DASH CBCS
- [ ] ClearKey
- [ ] Raw MP4 CENC
- [ ] Non-CDM (JS/WASM direct decrypt)

## Key System
- [ ] Not identified
- [ ] Widevine (`com.widevine.alpha`)
- [ ] PlayReady (`com.microsoft.playready`)
- [ ] FairPlay (`com.apple.fps.1_0`)
- [ ] ClearKey (`org.w3.clearkey`)
- [ ] None (non-CDM path)

## Route Taken
- [ ] Blackbox (video capture / canvas / MediaRecorder)
- [ ] Clear frame boundary (EME events + SourceBuffer tracking)
- [ ] Pure algorithm (SubtleCrypto / CryptoJS / WASM decrypt)
- [ ] CDM message analysis (limited path)

## Blackbox Results
- Capture method: ________________
- Frame samples location: `run/clear-frame-samples/`
- Verification: [ ] Passed [ ] Failed [ ] Partial

## Clear Frame Boundary
- `encrypted` event timestamp: ________________
- `generateRequest` timestamp: ________________
- `keystatuseschange: usable` timestamp: ________________
- First successful `appendBuffer` after usable: ________________
- `requestVideoFrameCallback` first fired: ________________
- Gap analysis: ________________

## Pure Algorithm Results (if applicable)
- Algorithm: ________________
- Key source: ________________
- IV source: ________________
- Ciphertext/Plaintext pairs recorded: [ ] Yes [ ] No
- Local verification: [ ] Passed [ ] Failed

## CDM Message Analysis (if applicable)
- License endpoint: ________________
- Request format: [ ] JSON [ ] Protobuf [ ] Raw bytes
- Response format: [ ] JSON [ ] Protobuf [ ] Raw bytes
- JSVMP processes license response: [ ] Yes [ ] No
- Content key extractable: [ ] Yes [ ] No [ ] Limited

## JSVMP Linkage (if applicable)
- VM execution timing: ________________
- License response -> VM -> session.update mapping: ________________
- VM trace location: `run/vm-trace.jsonl`

## Known Limitations
- ________________

## UNKNOWNS
- ________________
