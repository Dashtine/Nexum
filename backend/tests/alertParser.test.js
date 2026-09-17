import test from 'node:test'
import assert from 'node:assert/strict'

import { parseAlertFields } from '../src/alertParser.js'

test('parses a standard price-based alert', () => {
  const parsed = parseAlertFields(`
Position: BUY
Contracts: 2
Take Profit: 24700.00
Stop Loss: 24645.25
`)

  assert.equal(parsed.isTest, false)
  assert.equal(parsed.side, 'buy')
  assert.equal(parsed.size, 2)
  assert.equal(parsed.takeProfitPrice, 24700)
  assert.equal(parsed.stopLossPrice, 24645.25)
})

test('parses a TEST alert with tick-based brackets', () => {
  const parsed = parseAlertFields({
    message: `TEST\nPosition: SELL\nContracts: 1\nTpTicks: 40\nSlTicks: 20`
  })

  assert.equal(parsed.isTest, true)
  assert.equal(parsed.side, 'sell')
  assert.equal(parsed.size, 1)
  assert.equal(parsed.takeProfitTicks, 40)
  assert.equal(parsed.stopLossTicks, 20)
})

test('returns nulls for required fields when an alert cannot be parsed', () => {
  const parsed = parseAlertFields('hello world')

  assert.equal(parsed.side, null)
  assert.equal(parsed.size, null)
  assert.equal(parsed.takeProfitPrice, null)
  assert.equal(parsed.stopLossPrice, null)
})
