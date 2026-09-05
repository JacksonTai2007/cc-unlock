"use strict";

function noteSourceMap(bundleUrl, mapUrl, notes = []) {
  return {
    bundleUrl,
    mapUrl,
    notes
  };
}

module.exports = { noteSourceMap };

