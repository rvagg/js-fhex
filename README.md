# fhex

[![NPM](https://nodei.co/npm/fhex.svg?style=flat&data=n,v&color=blue)](https://nodei.co/npm/fhex/)

Hex float conversion for JavaScript: `toHex` for formatting, `fromHex` for parsing.

Uses the [IEEE 754 hexadecimal floating-point](https://en.wikipedia.org/wiki/Hexadecimal_floating_point) format (`±0xh.hhhp±d`) — the same format used by C's `%a` printf specifier and Java's `Double.toHexString()`.

## Requirements

Node.js >= 20

## Usage

```js
import { toHex, fromHex } from 'fhex'

// Formatting
toHex(3.0)    // '0x1.8p+1'
toHex(-10.0)  // '-0x1.4p+3'
toHex(0.5)    // '0x1p-1'

// Parsing
fromHex('0x1.8p+1')   // 3.0
fromHex('-0x1.4p+3')  // -10.0
fromHex('inf')        // Infinity
fromHex('nan')        // NaN

// Round-trip
const hex = toHex(Math.PI)       // '0x1.921fb54442d18p+1'
fromHex(hex) === Math.PI         // true
```

### Bit-level inspection

`toHexBits` and `fromHexBits` expose the raw 64-bit IEEE 754 encoding as a hex string. This is useful for inspecting NaN payloads and sign bits that are not observable through normal JavaScript operations.

```js
import { toHex, fromHex, toHexBits, fromHexBits } from 'fhex'

toHexBits(1.0)         // '3ff0000000000000'
toHexBits(NaN)         // '7ff8000000000000'
toHexBits(-0)          // '8000000000000000'

// Construct a NaN with a specific payload
const nan = fromHexBits('7ff0000000000123')
toHex(nan)             // 'nan:0x123'

// Round-trip NaN payloads through hex float format
const parsed = fromHex('nan:0x123')
toHexBits(parsed)      // '7ff0000000000123'
```

**Note:** JavaScript engines may canonicalize NaN payloads when values pass through arithmetic operations. The bit-level functions preserve payloads through `DataView`, but payloads may be lost if the NaN value is used in computations.

## Format

Floating point numbers are represented as `±0xh.hhhp±d`, where:

* `±` is the sign (`-` for negative, omitted for positive)
* `0x` is the hex prefix
* `h.hhh` is the significand in hexadecimal
* `p±d` is the exponent in decimal (base 2)

Special values:

* `±0x0p+0` for zero
* `±inf` for infinity
* `nan` for quiet NaN
* `nan:0x...` for NaN with payload

## Parsing features

* Underscores for readability: `0x1_000p+0`
* NaN payloads preserved: `nan:0x123`
* Case-insensitive: `INF`, `NaN`, `0X1P+0`
* Whitespace trimmed
* Optional exponent: `0x1.8` is equivalent to `0x1.8p+0`

## License

Apache-2.0
