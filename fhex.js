/**
 * Hex float conversion for JavaScript.
 *
 * Provides four functions:
 * - {@link toHex} for formatting floats as hex strings (`0x1.8p+1`)
 * - {@link fromHex} for parsing hex strings back to floats
 * - {@link toHexBits} for inspecting raw IEEE 754 bit patterns
 * - {@link fromHexBits} for constructing floats from raw bit patterns
 *
 * The format follows the IEEE 754 hex float specification — the same format
 * used by C's `%a` printf specifier and Java's `Double.toHexString()`.
 *
 * @module fhex
 */

const _buf = new ArrayBuffer(8)
const _view = new DataView(_buf)

// IEEE 754 f64 constants
const MASK64 = (1n << 64n) - 1n
const SIG_BITS = 52n
const SIG_MASK = (1n << SIG_BITS) - 1n
const EXP_MASK = 0x7ffn
const EXP_BIAS = 1023n
const MAX_EXP = 1024n
const MIN_EXP = -1023n
const QUIET_NAN_TAG = 1n << 51n
const HEX = '0123456789abcdef'
const MAX_SIG_DIGITS = 15

// fromHex constants
const FROM_SIG_BITS = 52
const FROM_EXP_BIAS = 1023n
const FROM_EXP_MIN = -1022n
const FROM_EXP_MAX = 1023n
const FROM_FULL_PREC = 53
const FROM_MIN_SUBNORMAL_EXP = -1074n

/**
 * Count leading zeros in a 64-bit value.
 *
 * @param {bigint} n - Value to count leading zeros in (treated as unsigned 64-bit)
 * @returns {number}
 */
function clz64 (n) {
  if (n === 0n) return 64
  let count = 0
  if (n <= 0xffffffffn) { count += 32 } else { n >>= 32n }
  if (n <= 0xffffn) { count += 16 } else { n >>= 16n }
  if (n <= 0xffn) { count += 8 } else { n >>= 8n }
  if (n <= 0xfn) { count += 4 } else { n >>= 4n }
  if (n <= 0x3n) { count += 2 } else { n >>= 2n }
  if (n <= 0x1n) { count += 1 }
  return count
}

/**
 * Convert a number to an IEEE 754 hex float string.
 *
 * Handles all IEEE 754 double-precision values including signed zeros,
 * subnormals, infinities, and NaN with payload preservation.
 *
 * @param {number} n
 * @returns {string}
 */
export function toHex (n) {
  _view.setFloat64(0, n)
  const bits = _view.getBigUint64(0)

  let s = ''
  const sign = bits >> 63n
  let exponent = ((bits >> SIG_BITS) & EXP_MASK) - EXP_BIAS
  let significand = bits & SIG_MASK

  if (sign !== 0n) {
    s += '-'
  }

  if (exponent === MAX_EXP) {
    if (significand === 0n) {
      return s + 'inf'
    }
    s += 'nan'
    if (significand !== QUIET_NAN_TAG) {
      s += ':0x' + significand.toString(16)
    }
    return s
  }

  const isZero = significand === 0n && exponent === MIN_EXP
  s += isZero ? '0x0' : '0x1'

  // Shift significand to top of 64-bit value (shift left by 64 - 52 = 12)
  significand = (significand << 12n) & MASK64

  if (significand !== 0n) {
    if (exponent === MIN_EXP) {
      // Subnormal: shift up past leading zeros and strip the implicit 1 bit
      const lz = clz64(significand)
      if (lz < 63) {
        significand = (significand << BigInt(lz + 1)) & MASK64
      } else {
        significand = 0n
      }
      exponent -= BigInt(lz)
    }

    if (significand !== 0n) {
      s += '.'
      for (let i = 0; i < MAX_SIG_DIGITS; i++) {
        if (significand === 0n) break
        s += HEX[Number((significand >> 60n) & 0xfn)]
        significand = (significand << 4n) & MASK64
      }
    }
  }

  s += 'p'
  if (isZero) {
    s += '+0'
  } else {
    let exp = Number(exponent)
    s += exp < 0 ? '-' : '+'
    if (exp < 0) exp = -exp
    s += String(exp)
  }

  return s
}

/**
 * Parse an IEEE 754 hex float string to a number.
 *
 * Accepted formats:
 * - Hex floats: `0x1.8p+1`, `0X1P-10`, `-0x1.abcdefp+100`
 * - Special values: `inf`, `-inf`, `nan`, `NaN`
 * - NaN with payload: `nan:0x123` (preserves signalling NaN bits)
 * - With underscores: `0x1_0p+0` (for readability)
 * - Leading/trailing whitespace is trimmed
 *
 * Returns `null` for invalid input including empty strings, missing `0x`
 * prefix, no digits in mantissa, invalid characters, and NaN payloads
 * that are zero or exceed the 52-bit significand.
 *
 * @param {string} str
 * @returns {number | null}
 */
export function fromHex (str) {
  const s = str.trim()
  if (s.length === 0) return null

  let negative = false
  let rest = s
  if (rest.startsWith('-')) {
    negative = true
    rest = rest.substring(1)
  } else if (rest.startsWith('+')) {
    rest = rest.substring(1)
  }

  if (/^inf$/i.test(rest)) {
    return negative ? -Infinity : Infinity
  }

  if (/^nan$/i.test(rest)) {
    if (negative) {
      _view.setBigUint64(0, 0xfff8000000000000n)
      return _view.getFloat64(0)
    }
    return NaN
  }

  const nanMatch = rest.match(/^nan:0x([0-9a-fA-F]+)$/i)
  if (nanMatch) {
    let payload
    try {
      payload = BigInt('0x' + nanMatch[1])
    } catch {
      return null
    }
    if (payload === 0n || payload > 0xfffffffffffffn) return null
    let nanBits = 0x7ff0000000000000n | payload
    if (negative) nanBits |= (1n << 63n)
    _view.setBigUint64(0, nanBits)
    return _view.getFloat64(0)
  }

  if (!/^0[xX]/.test(rest)) return null
  return parseHexFloat(rest.substring(2), negative)
}

/**
 * @param {string} s - mantissa string after "0x" prefix
 * @param {boolean} negative
 * @returns {number | null}
 */
function parseHexFloat (s, negative) {
  let mantissaStr, expStr
  const pPos = s.search(/[pP]/)
  if (pPos !== -1) {
    mantissaStr = s.substring(0, pPos)
    expStr = s.substring(pPos + 1)
  } else {
    mantissaStr = s
    expStr = '+0'
  }

  if (expStr.startsWith('+')) expStr = expStr.substring(1)
  const parsedExp = parseInt(expStr, 10)
  if (Number.isNaN(parsedExp)) return null

  const dotPos = mantissaStr.indexOf('.')
  let intStr, fracStr
  if (dotPos !== -1) {
    intStr = mantissaStr.substring(0, dotPos)
    fracStr = mantissaStr.substring(dotPos + 1)
  } else {
    intStr = mantissaStr
    fracStr = ''
  }

  const intClean = intStr.replaceAll('_', '')
  const fracClean = fracStr.replaceAll('_', '')
  if (intClean.length === 0 && fracClean.length === 0) return null

  // Accumulate hex digits into a BigInt significand. 60 bits provides
  // enough room for f64's 53-bit precision plus guard/round/sticky bits.
  let sig = 0n
  let sigBits = 0
  let overflowBits = 0
  let sticky = false

  for (const c of intClean) {
    const d = parseInt(c, 16)
    if (Number.isNaN(d)) return null
    if (sigBits < 60) {
      sig = (sig << 4n) | BigInt(d)
      sigBits += 4
    } else {
      overflowBits += 4
      if (d !== 0) sticky = true
    }
  }

  let fracDigitCount = 0
  for (const c of fracClean) {
    const d = parseInt(c, 16)
    if (Number.isNaN(d)) return null
    fracDigitCount++
    if (sigBits < 60) {
      sig = (sig << 4n) | BigInt(d)
      sigBits += 4
    } else {
      overflowBits += 4
      if (d !== 0) sticky = true
    }
  }

  const signBit = negative ? (1n << 63n) : 0n

  if (sig === 0n) {
    _view.setBigUint64(0, signBit)
    return _view.getFloat64(0)
  }

  const exp = BigInt(parsedExp) - BigInt(4 * fracDigitCount) + BigInt(overflowBits)

  // Normalise: find MSB position
  const leading = clz64(sig)
  const msb = 63 - leading
  let resultExp = exp + BigInt(msb)
  const currentBits = msb + 1

  // Determine target precision based on where the result falls
  let targetPrec
  if (resultExp >= FROM_EXP_MIN) {
    targetPrec = FROM_FULL_PREC
  } else if (resultExp >= FROM_MIN_SUBNORMAL_EXP) {
    targetPrec = Number(resultExp - FROM_MIN_SUBNORMAL_EXP + 1n)
  } else if (resultExp === FROM_MIN_SUBNORMAL_EXP - 1n) {
    targetPrec = 0
  } else {
    // Deep underflow
    _view.setBigUint64(0, signBit)
    return _view.getFloat64(0)
  }

  // Borderline underflow: value is between 0 and min subnormal
  if (targetPrec === 0) {
    const exactPower = sig === (1n << BigInt(msb)) && !sticky
    if (exactPower) {
      // Exactly at midpoint, round to even (0 is even)
      _view.setBigUint64(0, signBit)
      return _view.getFloat64(0)
    }
    // Above midpoint, round up to min subnormal
    _view.setBigUint64(0, signBit | 1n)
    return _view.getFloat64(0)
  }

  const [roundedSig, carry] = roundToPrecision(sig, currentBits, targetPrec, sticky)

  if (carry) resultExp += 1n

  // Overflow to infinity
  if (resultExp > FROM_EXP_MAX) {
    const infBits = signBit | ((FROM_EXP_MAX + FROM_EXP_BIAS + 1n) << BigInt(FROM_SIG_BITS))
    _view.setBigUint64(0, infBits)
    return _view.getFloat64(0)
  }

  let result
  if (resultExp >= FROM_EXP_MIN) {
    // Normal number
    const biasedExp = resultExp + FROM_EXP_BIAS
    const sigField = roundedSig & ((1n << BigInt(FROM_SIG_BITS)) - 1n)
    result = signBit | (biasedExp << BigInt(FROM_SIG_BITS)) | sigField
  } else {
    // Subnormal (exponent field = 0)
    const sigField = carry ? (roundedSig << 1n) : roundedSig
    result = signBit | sigField
  }

  _view.setBigUint64(0, result)
  return _view.getFloat64(0)
}

/**
 * Round a significand to target precision using IEEE 754 round-half-to-even.
 *
 * @param {bigint} sig
 * @param {number} currentBits
 * @param {number} targetBits
 * @param {boolean} sticky
 * @returns {[bigint, boolean]} [rounded significand, carry]
 */
function roundToPrecision (sig, currentBits, targetBits, sticky) {
  if (currentBits <= targetBits) {
    if (currentBits < targetBits) {
      return [sig << BigInt(targetBits - currentBits), false]
    }
    return [sig, false]
  }

  const shift = BigInt(currentBits - targetBits)
  const half = 1n << (shift - 1n)
  const mask = (1n << shift) - 1n
  const truncated = sig >> shift
  const remainder = sig & mask

  let roundUp
  if (remainder > half || (remainder === half && sticky)) {
    roundUp = true
  } else if (remainder === half) {
    roundUp = (truncated & 1n) !== 0n
  } else {
    roundUp = false
  }

  if (roundUp) {
    const rounded = truncated + 1n
    if (rounded >= (1n << BigInt(targetBits))) {
      return [rounded >> 1n, true]
    }
    return [rounded, false]
  }
  return [truncated, false]
}

/**
 * Get the raw IEEE 754 bit pattern of a number as a hex string.
 *
 * Returns a 16-character lowercase hex string representing the 64-bit
 * IEEE 754 double-precision encoding. Useful for inspecting NaN payloads
 * and sign bits that are not observable through normal JavaScript operations.
 *
 * @param {number} n
 * @returns {string} 16-character hex string (no `0x` prefix)
 */
export function toHexBits (n) {
  _view.setFloat64(0, n)
  const hi = _view.getUint32(0)
  const lo = _view.getUint32(4)
  return hi.toString(16).padStart(8, '0') + lo.toString(16).padStart(8, '0')
}

/**
 * Construct a number from a raw IEEE 754 bit pattern hex string.
 *
 * Accepts a 16-character hex string with optional `0x`/`0X` prefix.
 * Returns `null` for invalid input.
 *
 * @param {string} s - 16-character hex string, optionally prefixed with `0x`
 * @returns {number | null}
 */
export function fromHexBits (s) {
  s = s.trim()
  if (s.startsWith('0x') || s.startsWith('0X')) s = s.substring(2)
  if (s.length !== 16 || !/^[0-9a-fA-F]{16}$/.test(s)) return null
  _view.setUint32(0, parseInt(s.substring(0, 8), 16))
  _view.setUint32(4, parseInt(s.substring(8, 16), 16))
  return _view.getFloat64(0)
}
