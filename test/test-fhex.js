/* eslint-env mocha */

import * as chai from 'chai'
import { toHex, fromHex, toHexBits, fromHexBits } from '../fhex.js'

const { assert } = chai

// Helper: construct f64 from bit pattern and verify toHex output
function assertToHex (bits, expected) {
  const n = fromHexBits(bits)
  assert.notStrictEqual(n, null, `fromHexBits(${bits}) should not be null`)
  assert.strictEqual(toHex(/** @type {number} */ (n)), expected, `toHex(fromHexBits(${bits}))`)
}

describe('toHex', () => {
  const cases = [
    ['8000000000000000', '-0x0p+0'],
    ['0000000000000000', '0x0p+0'],
    ['c3b0000000000001', '-0x1.0000000000001p+60'],
    ['43b0000000000001', '0x1.0000000000001p+60'],
    ['ffefffffffffffff', '-0x1.fffffffffffffp+1023'],
    ['7fefffffffffffff', '0x1.fffffffffffffp+1023'],
    ['ffe0000000000000', '-0x1p+1023'],
    ['7fe0000000000000', '0x1p+1023'],
    ['8000000000000002', '-0x1p-1073'],
    ['0000000000000002', '0x1p-1073'],
    ['8000000000000001', '-0x1p-1074'],
    ['0000000000000001', '0x1p-1074'],
    ['7ff0000000000000', 'inf'],
    ['fff0000000000000', '-inf'],
    ['7ff8000000000000', 'nan'],
    ['7ff0000000000001', 'nan:0x1'],
    ['7fffffffffffffff', 'nan:0xfffffffffffff']
  ]

  for (const [bits, expected] of cases) {
    it(`${bits} -> ${expected}`, () => {
      assertToHex(bits, expected)
    })
  }

  it('common values', () => {
    assert.strictEqual(toHex(1.0), '0x1p+0')
    assert.strictEqual(toHex(-1.0), '-0x1p+0')
    assert.strictEqual(toHex(3.0), '0x1.8p+1')
    assert.strictEqual(toHex(10.0), '0x1.4p+3')
    assert.strictEqual(toHex(0.5), '0x1p-1')
    assert.strictEqual(toHex(Math.PI), '0x1.921fb54442d18p+1')
    assert.strictEqual(toHex(Math.E), '0x1.5bf0a8b145769p+1')
  })
})

describe('fromHex', () => {
  describe('basic', () => {
    it('simple values', () => {
      assert.strictEqual(fromHex('0x0p+0'), 0.0)
      assert.strictEqual(fromHex('0x1p+0'), 1.0)
      assert.strictEqual(fromHex('0x1p+1'), 2.0)
      assert.strictEqual(fromHex('0x1.8p+1'), 3.0)
      assert.strictEqual(fromHex('0x1.4p+3'), 10.0)
      assert.strictEqual(fromHex('-0x1.4p+3'), -10.0)
    })

    it('without exponent', () => {
      assert.strictEqual(fromHex('0x1'), 1.0)
      assert.strictEqual(fromHex('0x1.8'), 1.5)
      assert.strictEqual(fromHex('0xA'), 10.0)
    })
  })

  describe('special values', () => {
    it('infinity', () => {
      assert.strictEqual(fromHex('inf'), Infinity)
      assert.strictEqual(fromHex('-inf'), -Infinity)
      assert.strictEqual(fromHex('INF'), Infinity)
      assert.strictEqual(fromHex('Inf'), Infinity)
    })

    it('nan', () => {
      assert.ok(Number.isNaN(fromHex('nan')))
      assert.ok(Number.isNaN(fromHex('NaN')))
      assert.ok(Number.isNaN(fromHex('NAN')))
      assert.ok(Number.isNaN(fromHex('-nan')))
    })

    it('negative nan has sign bit set', () => {
      const neg = fromHex('-nan')
      assert.ok(Number.isNaN(neg))
      assert.strictEqual(toHexBits(/** @type {number} */ (neg)), 'fff8000000000000')
    })
  })

  describe('nan payload', () => {
    it('preserves payload', () => {
      const value = fromHex('nan:0x1')
      assert.ok(Number.isNaN(value))
      assert.strictEqual(toHexBits(/** @type {number} */ (value)), '7ff0000000000001')
    })

    it('max payload', () => {
      const value = fromHex('nan:0xfffffffffffff')
      assert.ok(Number.isNaN(value))
      assert.strictEqual(toHexBits(/** @type {number} */ (value)), '7fffffffffffffff')
    })

    it('negative nan payload', () => {
      const value = fromHex('-nan:0x123')
      assert.ok(Number.isNaN(value))
      assert.strictEqual(toHexBits(/** @type {number} */ (value)), 'fff0000000000123')
    })

    it('rejects zero payload', () => {
      assert.strictEqual(fromHex('nan:0x0'), null)
    })

    it('rejects oversize payload', () => {
      assert.strictEqual(fromHex('nan:0x10000000000000'), null)
    })
  })

  describe('underscores', () => {
    it('in mantissa', () => {
      assert.strictEqual(fromHex('0x1_0p+0'), 16.0)
      assert.strictEqual(fromHex('0x1.8_0p+1'), 3.0)
    })
  })

  describe('invalid input', () => {
    it('rejects bad input', () => {
      assert.strictEqual(fromHex(''), null)
      assert.strictEqual(fromHex('0x'), null)
      assert.strictEqual(fromHex('0x.'), null)
      assert.strictEqual(fromHex('0xp+0'), null)
      assert.strictEqual(fromHex('hello'), null)
    })
  })

  describe('whitespace', () => {
    it('trims whitespace', () => {
      assert.strictEqual(fromHex('  0x1p+0  '), 1.0)
      assert.strictEqual(fromHex('\t0x1.8p+1\n'), 3.0)
      assert.strictEqual(fromHex('  inf  '), Infinity)
    })
  })

  describe('case insensitive', () => {
    it('hex digits', () => {
      assert.strictEqual(fromHex('0xABC'), fromHex('0xabc'))
      assert.strictEqual(fromHex('0xAbC'), fromHex('0xabc'))
    })

    it('prefix and exponent', () => {
      assert.strictEqual(fromHex('0X1p+0'), 1.0)
      assert.strictEqual(fromHex('0x1P+0'), 1.0)
    })
  })

  describe('long mantissa', () => {
    it('f64 above midpoint rounds up', () => {
      const v = fromHex('0x1.0000000000000800000000000000000000000000001p+0')
      assert.strictEqual(toHexBits(/** @type {number} */ (v)), '3ff0000000000001')
    })

    it('all zeros is exact', () => {
      const v = fromHex('0x1.000000000000000000000000000000000000000000p+0')
      assert.strictEqual(toHexBits(/** @type {number} */ (v)), '3ff0000000000000')
    })
  })

  describe('subnormals', () => {
    it('smallest subnormal round-trip', () => {
      const hex = toHex(5e-324)
      assert.strictEqual(hex, '0x1p-1074')
      assert.strictEqual(fromHex(hex), 5e-324)
    })

    it('various subnormals round-trip', () => {
      const values = [
        Number.MIN_VALUE, // 5e-324
        Number.MIN_VALUE * 2,
        Number.MIN_VALUE * 1024
      ]
      for (const v of values) {
        const hex = toHex(v)
        const parsed = fromHex(hex)
        assert.strictEqual(
          toHexBits(v),
          toHexBits(/** @type {number} */ (parsed)),
          `subnormal round-trip failed: ${v} -> ${hex}`
        )
      }
    })
  })

  describe('overflow', () => {
    it('rounds to infinity', () => {
      const v = fromHex('0x1.fffffffffffff8p+1023')
      assert.strictEqual(v, Infinity)
    })

    it('max normal is exact', () => {
      assert.strictEqual(fromHex('0x1.fffffffffffffp+1023'), Number.MAX_VALUE)
    })
  })
})

describe('round-trip', () => {
  const values = [
    0.0, -0.0, 1.0, -1.0,
    Math.PI, Math.E,
    Number.MIN_VALUE, // smallest subnormal
    Number.MAX_VALUE,
    -Number.MAX_VALUE,
    Infinity, -Infinity
  ]

  for (const v of values) {
    it(`${Object.is(v, -0) ? '-0' : v}`, () => {
      const hex = toHex(v)
      const parsed = fromHex(hex)
      if (Object.is(v, -0)) {
        assert.ok(Object.is(parsed, -0), `expected -0, got ${parsed}`)
      } else {
        assert.strictEqual(parsed, v, `round-trip failed: ${v} -> ${hex} -> ${parsed}`)
      }
    })
  }

  it('NaN', () => {
    const hex = toHex(NaN)
    assert.strictEqual(hex, 'nan')
    assert.ok(Number.isNaN(fromHex(hex)))
  })

  it('NaN with payload', () => {
    const nan = fromHexBits('7ff0000000000123')
    const hex = toHex(/** @type {number} */ (nan))
    assert.strictEqual(hex, 'nan:0x123')
    const parsed = fromHex(hex)
    assert.ok(Number.isNaN(parsed))
    assert.strictEqual(toHexBits(/** @type {number} */ (parsed)), '7ff0000000000123')
  })
})

describe('toHexBits', () => {
  it('known values', () => {
    assert.strictEqual(toHexBits(0), '0000000000000000')
    assert.strictEqual(toHexBits(-0), '8000000000000000')
    assert.strictEqual(toHexBits(1.0), '3ff0000000000000')
    assert.strictEqual(toHexBits(-1.0), 'bff0000000000000')
    assert.strictEqual(toHexBits(Infinity), '7ff0000000000000')
    assert.strictEqual(toHexBits(-Infinity), 'fff0000000000000')
    assert.strictEqual(toHexBits(NaN), '7ff8000000000000')
  })
})

describe('fromHexBits', () => {
  it('known values', () => {
    assert.strictEqual(fromHexBits('0000000000000000'), 0)
    assert.ok(Object.is(fromHexBits('8000000000000000'), -0))
    assert.strictEqual(fromHexBits('3ff0000000000000'), 1.0)
    assert.strictEqual(fromHexBits('7ff0000000000000'), Infinity)
    assert.ok(Number.isNaN(fromHexBits('7ff8000000000000')))
  })

  it('accepts 0x prefix', () => {
    assert.strictEqual(fromHexBits('0x3ff0000000000000'), 1.0)
    assert.strictEqual(fromHexBits('0X3ff0000000000000'), 1.0)
  })

  it('rejects invalid input', () => {
    assert.strictEqual(fromHexBits(''), null)
    assert.strictEqual(fromHexBits('3ff000000000000'), null) // 15 chars
    assert.strictEqual(fromHexBits('3ff00000000000000'), null) // 17 chars
    assert.strictEqual(fromHexBits('zzzzzzzzzzzzzzzz'), null)
  })
})
