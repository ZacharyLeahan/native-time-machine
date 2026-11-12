import { describe, expect, it } from 'vitest'
import { parseDesign, serializeDesign } from './design'
import type { PropertyDesign } from '../types'

describe('design persistence', () => {
  const design: PropertyDesign = { version: 8, siteId: 'test-site', name: 'Test garden', widthFt: 100, depthFt: 80, plants: [{ id: 'p1', speciesId: 'white-oak', xFt: 4, zFt: -7, plantedYear: 0 }] }

  it('round-trips a design without losing measurements', () => {
    expect(parseDesign(serializeDesign(design))).toEqual(design)
  })

  it('rejects unsupported or malformed data', () => {
    expect(() => parseDesign('{"version":1,"plants":[]}')).toThrow('invalid')
    expect(() => parseDesign('{"version":8,"siteId":"test","widthFt":100,"depthFt":100,"plants":[{}]}')).toThrow('invalid plant')
  })
})
