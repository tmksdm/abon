import { describe, expect, it } from 'vitest'
import { APP_VERSIONS, CURRENT_APP_VERSION } from './appVersions'

describe('app versions', () => {
  it('использует дату без .1 и последовательные номера выпусков одного дня', () => {
    const oldestFirst = [...APP_VERSIONS].reverse().map(({ version }) => version)
    expect(oldestFirst).toEqual([
      '260829', '260829.2', '260829.3', '260829.4', '260829.5', '260829.6', '260829.7', '260829.8', '260829.9', '260829.10', '260830',
    ])
    expect(CURRENT_APP_VERSION).toBe('260830')
  })
})
