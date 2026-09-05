# Stealth Hook Notes

- status: not-started
- targetPackage:
- targetPid:
- targetSo:
- targetOffsets: []
- upgradeRationale:
  - userModeFailureEvidence:
  - protectionTier:
  - taskType:            #取证 | 共存
  - deviceCapability:
    - arm64: unknown
    - kernelVersion: unknown
    - apatchInstalled: unknown
    - kernelPatchVersion: unknown
    - bootloaderUnlocked: unknown
- modeSelection:        #hwbp | pte-dbi | lsplant-stealth
- modeSelectionReason:
- externalToolSelection:
  - selected: false
  - github: https://github.com/xiaojianbang8888/xiaojianbang-stealth-hook
  - localKpmPath:
  - localUserspaceToolPath:
  - versionOrCommit:
  - sha256:
  - userDecision:
- deviceValidation:
  - kpmLoaded: false
  - selfCheckExecuted: false
  - selfCheckOutput:
  - notAttemptedReason:
- hookPoints:
  - so:
    offset:
    purpose:
    mode:
    hitEvidence:
    hitCount:
- antiDetectionAudit:
  - textCRC: untouched
  - mapsScan: hidden
  - ptraceProbe: spoofed
  - perfEventOpen: notAffected
  - artMethodPointer: original
  - selinux: enforcing
- blockers: []
- nextSteps: []
