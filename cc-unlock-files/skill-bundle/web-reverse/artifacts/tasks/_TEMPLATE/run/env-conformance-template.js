function snapshotDescriptor(target, key) {
  const descriptor = Object.getOwnPropertyDescriptor(target, key);
  if (!descriptor) {
    return null;
  }
  return {
    configurable: !!descriptor.configurable,
    enumerable: !!descriptor.enumerable,
    writable: "writable" in descriptor ? !!descriptor.writable : null,
    hasGetter: typeof descriptor.get === "function",
    hasSetter: typeof descriptor.set === "function",
    valueType: "value" in descriptor ? typeof descriptor.value : null,
    name: descriptor.value?.name ?? null,
    length: descriptor.value?.length ?? null
  };
}

function snapshotShape(value) {
  return {
    type: typeof value,
    tag: Object.prototype.toString.call(value),
    ownKeys: value && typeof value === "object" ? Reflect.ownKeys(value).map(String) : []
  };
}

function snapshotError(error) {
  return {
    name: error?.name ?? null,
    message: error?.message ?? null,
    stackTop: typeof error?.stack === "string" ? error.stack.split("\n").slice(0, 2) : []
  };
}

function logDescriptor(path, target, key) {
  console.log("[env-descriptor]", JSON.stringify({
    path,
    descriptor: snapshotDescriptor(target, key)
  }));
}

function logShape(path, value) {
  console.log("[env-shape]", JSON.stringify({
    path,
    shape: snapshotShape(value)
  }));
}

function logCallResult(path, fn, args = []) {
  try {
    const result = fn(...args);
    console.log("[env-call]", JSON.stringify({
      path,
      ok: true,
      resultShape: snapshotShape(result)
    }));
    return result;
  } catch (error) {
    console.log("[env-call]", JSON.stringify({
      path,
      ok: false,
      error: snapshotError(error)
    }));
    throw error;
  }
}

function logTypedArraySurface(label, factory) {
  const value = factory();
  console.log("[env-typed-array]", JSON.stringify({
    label,
    constructorName: value?.constructor?.name ?? null,
    byteLength: value?.byteLength ?? null,
    length: value?.length ?? null,
    tag: Object.prototype.toString.call(value)
  }));
  return value;
}

function logCryptoSurface(cryptoLike) {
  console.log("[env-crypto]", JSON.stringify({
    hasGetRandomValues: typeof cryptoLike?.getRandomValues === "function",
    hasSubtle: typeof cryptoLike?.subtle === "object" && cryptoLike?.subtle != null,
    tag: Object.prototype.toString.call(cryptoLike)
  }));
}

function logStorageRoundTrip(label, storageLike, key, value) {
  let stored = null;
  let error = null;
  try {
    storageLike.setItem(key, value);
    stored = storageLike.getItem(key);
  } catch (caught) {
    error = snapshotError(caught);
  }

  console.log("[env-storage]", JSON.stringify({
    label,
    key,
    stored,
    error
  }));
}

function logScheduler(label, fn) {
  const start = Date.now();
  fn(() => {
    console.log("[env-scheduler]", JSON.stringify({
      label,
      delayMs: Date.now() - start
    }));
  });
}

function logMicrotaskOrder(label) {
  const order = [];
  queueMicrotask(() => {
    order.push("queueMicrotask");
  });
  Promise.resolve().then(() => {
    order.push("promise");
  });
  setTimeout(() => {
    order.push("timeout");
    console.log("[env-microtask-order]", JSON.stringify({
      label,
      order
    }));
  }, 0);
}

module.exports = {
  logCallResult,
  logCryptoSurface,
  logDescriptor,
  logMicrotaskOrder,
  logScheduler,
  logShape,
  logStorageRoundTrip,
  logTypedArraySurface,
  snapshotDescriptor,
  snapshotError,
  snapshotShape
};
