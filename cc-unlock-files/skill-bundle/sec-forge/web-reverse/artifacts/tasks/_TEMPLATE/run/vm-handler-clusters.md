# VM Handler Clusters

## Control Flow

- JMP / JCC (conditional jump)
- CALL / CALL_HOST / CALL_WASM (跨边界调用)
- RETURN / RET_VAL / RET_VOID
- THROW / TRY / CATCH / FINALLY
- SWITCH / CASE

## Data Movement

- PUSH_CONST / PUSH_REG / PUSH_UNDEFINED / PUSH_NULL
- POP / POP_TO_REG / POP_N
- LOAD_LOCAL / STORE_LOCAL
- LOAD_GLOBAL / STORE_GLOBAL
- LOAD_CLOSURE / STORE_CLOSURE
- LOAD_ARG / STORE_ARG
- DUP / SWAP / ROT

## Object / Property

- GETPROP / SETPROP / DELPROP
- GETELEM / SETELEM / DELELEM
- DEFPROP / DEFMETHOD
- HASOWNPROP / IN
- INSTANCEOF / TYPEOF

## Arithmetic / Logic

- ADD / SUB / MUL / DIV / MOD
- AND / OR / XOR / NOT / SHL / SHR / SAR
- EQ / NE / STRICT_EQ / STRICT_NE
- LT / GT / LE / GE
- INC / DEC / NEG

## String / Binary

- CONCAT / SLICE / SUBSTR
- CHARCODEAT / FROMCHARCODE
- REGEX_MATCH / REGEX_TEST / REGEX_REPLACE
- BASE64_ENCODE / BASE64_DECODE
- HEX_ENCODE / HEX_DECODE

## Environment Access

- **ENVREAD_NAVIGATOR** (navigator.xxx)
- **ENVREAD_SCREEN** (screen.xxx)
- **ENVREAD_WINDOW** (window.xxx, globalThis.xxx)
- **ENVREAD_DOCUMENT** (document.xxx)
- **ENVREAD_LOCATION** (location.xxx)
- **ENVREAD_PERFORMANCE** (performance.xxx)
- **ENVREAD_CRYPTO** (crypto.xxx)
- **ENVGET_USERAGENT** (navigator.userAgent)
- **ENVGET_PLATFORM** (navigator.platform)
- **ENVGET_LANGUAGE** (navigator.language)
- **ENVGET_HCL** (hardwareConcurrency, deviceMemory)
- **ENVGET_PLUGINS** (plugins, mimeTypes)
- **ENVGET_WEBDRIVER** (navigator.webdriver)
- **ENVGET_UA_DATA** (navigator.userAgentData)

## VM Internals

- INIT_VM / DESTROY_VM
- LOAD_BYTECODE / DECODE_BYTECODE
- CHECK_INTEGRITY / SELF_VERIFY
- OBFUSCATE_PC / DEOBFUSCATE_PC
- DYNAMIC_DISPATCH (运行时修改 dispatch 表)

## Bridge / FFI

- **CALL_WASM** (调用 WASM export)
- **CALL_HOST** (调用原生 JS API)
- **CALL_DYNAMIC** (eval / Function / setTimeout string)
- **CALL_JSON** (JSON.parse / JSON.stringify)
- **CALL_MATH** (Math.xxx)
- **CALL_DATE** (Date.now / new Date)
- **CALL_CRYPTO** (crypto.subtle / crypto.getRandomValues)

## UNKNOWNS

- 
