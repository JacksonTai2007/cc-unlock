"use strict";

function buildPreloadPlan(options = {}) {
  return {
    antiDebug: Boolean(options.antiDebug),
    vmTrace: Boolean(options.vmTrace),
    sourceMapHinting: Boolean(options.sourceMapHinting),
    workerWatch: Boolean(options.workerWatch),
    notes: options.notes || []
  };
}

module.exports = { buildPreloadPlan };

