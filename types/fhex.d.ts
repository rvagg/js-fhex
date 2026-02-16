/**
 * Convert a number to an IEEE 754 hex float string.
 *
 * Handles all IEEE 754 double-precision values including signed zeros,
 * subnormals, infinities, and NaN with payload preservation.
 *
 * @param {number} n
 * @returns {string}
 */
export function toHex(n: number): string;
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
export function fromHex(str: string): number | null;
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
export function toHexBits(n: number): string;
/**
 * Construct a number from a raw IEEE 754 bit pattern hex string.
 *
 * Accepts a 16-character hex string with optional `0x`/`0X` prefix.
 * Returns `null` for invalid input.
 *
 * @param {string} s - 16-character hex string, optionally prefixed with `0x`
 * @returns {number | null}
 */
export function fromHexBits(s: string): number | null;
//# sourceMappingURL=fhex.d.ts.map