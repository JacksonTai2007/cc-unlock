"use strict";

function classifyFrame(bytes) {
  const first = bytes?.[0];
  if (first === 0x08 || first === 0x0a) return "protobuf-like";
  if (first >= 0x82 && first <= 0x8f) return "msgpack-like";
  return "unknown";
}

function summarizeFrame(payload) {
  if (typeof payload === "string") {
    return { kind: "text", length: payload.length };
  }
  const bytes = payload instanceof Uint8Array ? payload : new Uint8Array(payload || []);
  return {
    kind: "binary",
    length: bytes.length,
    guess: classifyFrame(bytes)
  };
}

module.exports = { classifyFrame, summarizeFrame };

