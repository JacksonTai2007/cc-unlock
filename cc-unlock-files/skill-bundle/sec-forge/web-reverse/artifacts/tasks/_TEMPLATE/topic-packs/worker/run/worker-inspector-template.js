"use strict";

function recordWorkerCreation({
  kind,
  url = "",
  blobSource = "",
  creator = "",
  createTiming = "",
  role = "",
  notes = []
}) {
  return { kind, url, blobSource, creator, createTiming, role, notes };
}

function recordBlobWorkerChain({
  createFn = "",
  blobArgs = [],
  blobSourceFragments = [],
  objectUrlCallsite = "",
  consumer = "",
  notes = []
}) {
  return {
    createFn,
    blobArgs,
    blobSourceFragments,
    objectUrlCallsite,
    consumer,
    notes
  };
}

function recordWorkerMessage({
  direction,
  trigger = "",
  fields = [],
  summary = "",
  requestFieldMapping = [],
  notes = []
}) {
  return { direction, trigger, fields, summary, requestFieldMapping, notes };
}

function recordWorkerFieldMapping({
  requestField,
  mainThreadField = "",
  workerInputField = "",
  workerOutputField = "",
  finalCarrier = "",
  notes = []
}) {
  return {
    requestField,
    mainThreadField,
    workerInputField,
    workerOutputField,
    finalCarrier,
    notes
  };
}

module.exports = {
  recordWorkerCreation,
  recordBlobWorkerChain,
  recordWorkerMessage,
  recordWorkerFieldMapping
};
