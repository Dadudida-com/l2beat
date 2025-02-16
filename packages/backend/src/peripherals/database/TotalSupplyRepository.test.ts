import { Logger } from '@l2beat/backend-tools'
import { AssetId, ChainId, UnixTime } from '@l2beat/shared-pure'
import { expect } from 'earl'

import { describeDatabase } from '../../test/database'
import { testDeletingArchivedRecords } from './shared/deleteArchivedRecords.test'
import {
  TotalSupplyRecord,
  TotalSupplyRepository,
} from './TotalSupplyRepository'

const START = UnixTime.fromDate(new Date('2022-05-17'))
const mockTotalSupply = (
  totalSupply: bigint,
  offset: number,
  assetId: AssetId,
  chainId: ChainId,
) => {
  return {
    timestamp: START.add(offset, 'hours'),
    totalSupply,
    assetId,
    chainId,
  }
}

describeDatabase(TotalSupplyRepository.name, (database) => {
  const repository = new TotalSupplyRepository(database, Logger.SILENT)

  const ASSET_1 = AssetId('dai-dai-stablecoin')
  const ASSET_2 = AssetId('asset-2')
  const TOTAL_SUPPLY = 1000000000000000000n
  const DATA: TotalSupplyRecord[] = [
    mockTotalSupply(TOTAL_SUPPLY, 0, ASSET_1, ChainId.ETHEREUM),
    mockTotalSupply(TOTAL_SUPPLY, 1, ASSET_2, ChainId.ETHEREUM),
  ]

  afterEach(async () => {
    await repository.deleteAll()
  })

  describe(TotalSupplyRepository.prototype.getByTimestamp.name, () => {
    it('returns matching data for given timestamp', async () => {
      await repository.addOrUpdateMany(DATA)

      const additionalData = [
        mockTotalSupply(TOTAL_SUPPLY, 0, AssetId('asset-a'), ChainId.ETHEREUM),
        mockTotalSupply(TOTAL_SUPPLY, 0, AssetId('asset-b'), ChainId.ETHEREUM),
        mockTotalSupply(TOTAL_SUPPLY, 0, AssetId('asset-c'), ChainId.ETHEREUM),
      ]
      await repository.addOrUpdateMany(additionalData)

      const result = await repository.getByTimestamp(ChainId.ETHEREUM, START)

      expect(result).toEqualUnsorted([DATA[0], ...additionalData])
    })

    it('returns empty list if no data exists for given timestamp', async () => {
      await repository.addOrUpdateMany(DATA)

      const result = await repository.getByTimestamp(
        ChainId.ETHEREUM,
        START.add(1, 'days'),
      )
      expect(result).toEqual([])
    })

    it('one project one asset', async () => {
      const data = [
        mockTotalSupply(TOTAL_SUPPLY, 0, ASSET_1, ChainId.ETHEREUM),
        mockTotalSupply(TOTAL_SUPPLY, 1, ASSET_1, ChainId.ETHEREUM),
        mockTotalSupply(TOTAL_SUPPLY, 2, ASSET_1, ChainId.ETHEREUM),
      ]

      await repository.addOrUpdateMany(data)

      const result = await repository.getByTimestamp(ChainId.ETHEREUM, START)
      expect(result).toEqual([
        {
          totalSupply: TOTAL_SUPPLY,
          timestamp: START,
          assetId: ASSET_1,
          chainId: ChainId.ETHEREUM,
        },
      ])
    })

    it('many projects many assets', async () => {
      const data = [
        mockTotalSupply(TOTAL_SUPPLY, 0, ASSET_1, ChainId.ETHEREUM),
        mockTotalSupply(TOTAL_SUPPLY, 1, ASSET_1, ChainId.ETHEREUM),
        mockTotalSupply(TOTAL_SUPPLY, 2, ASSET_1, ChainId.ETHEREUM),

        mockTotalSupply(TOTAL_SUPPLY, 0, ASSET_2, ChainId.ETHEREUM),
        mockTotalSupply(TOTAL_SUPPLY, 1, ASSET_2, ChainId.ETHEREUM),
        mockTotalSupply(TOTAL_SUPPLY, 2, ASSET_2, ChainId.ETHEREUM),
      ]

      await repository.addOrUpdateMany(data)

      const result = await repository.getByTimestamp(ChainId.ETHEREUM, START)
      expect(result).toEqualUnsorted([
        {
          totalSupply: TOTAL_SUPPLY,
          timestamp: START,
          assetId: ASSET_1,
          chainId: ChainId.ETHEREUM,
        },
        {
          totalSupply: TOTAL_SUPPLY,
          timestamp: START,
          assetId: ASSET_2,
          chainId: ChainId.ETHEREUM,
        },
      ])
    })

    it('take chainId into consideration', async () => {
      await repository.addOrUpdateMany(DATA)

      const resultEth = await repository.getByTimestamp(ChainId.ETHEREUM, START)
      expect(resultEth).toEqual([DATA[0]])

      const resultArb = await repository.getByTimestamp(ChainId.ARBITRUM, START)
      expect(resultArb).toEqual([])
    })
  })

  describe(TotalSupplyRepository.prototype.addOrUpdateMany.name, () => {
    it('new rows only', async () => {
      await repository.addOrUpdateMany(DATA)

      const newRows: TotalSupplyRecord[] = [
        {
          totalSupply: TOTAL_SUPPLY,
          timestamp: START.add(2, 'hours'),
          assetId: AssetId('dai-dai-stablecoin'),
          chainId: ChainId.ETHEREUM,
        },
        {
          totalSupply: TOTAL_SUPPLY,
          timestamp: START.add(3, 'hours'),
          assetId: AssetId('dai-dai-stablecoin'),
          chainId: ChainId.ETHEREUM,
        },
      ]
      await repository.addOrUpdateMany(newRows)

      const result = await repository.getAll()
      expect(result).toEqualUnsorted([...DATA, ...newRows])
    })

    it('existing rows only', async () => {
      await repository.addOrUpdateMany(DATA)

      const existingRows: TotalSupplyRecord[] = [
        {
          timestamp: DATA[0].timestamp,
          totalSupply: DATA[0].totalSupply,
          assetId: DATA[0].assetId,
          chainId: ChainId.ETHEREUM,
        },
        {
          timestamp: DATA[1].timestamp,
          totalSupply: DATA[1].totalSupply,
          assetId: DATA[1].assetId,
          chainId: ChainId.ETHEREUM,
        },
      ]
      await repository.addOrUpdateMany(existingRows)

      const result = await repository.getAll()
      expect(result).toEqualUnsorted(existingRows)
    })

    it('mixed: existing and new rows', async () => {
      await repository.addOrUpdateMany(DATA)

      const mixedRows: TotalSupplyRecord[] = [
        {
          timestamp: DATA[1].timestamp,
          totalSupply: DATA[1].totalSupply,
          assetId: DATA[1].assetId,
          chainId: ChainId.ETHEREUM,
        },
        {
          timestamp: START.add(2, 'hours'),
          totalSupply: TOTAL_SUPPLY,
          assetId: AssetId('dai-dai-stablecoin'),
          chainId: ChainId.ETHEREUM,
        },
      ]
      await repository.addOrUpdateMany(mixedRows)

      const result = await repository.getAll()
      expect(result).toEqualUnsorted([DATA[0], ...mixedRows])
    })

    it('skips empty row modification', async () => {
      await repository.addOrUpdateMany(DATA)

      await expect(repository.addOrUpdateMany([])).not.toBeRejected()
    })
  })

  it(TotalSupplyRepository.prototype.getAll.name, async () => {
    await repository.addOrUpdateMany(DATA)

    const result = await repository.getAll()

    expect(result).toEqual(DATA)
  })

  it(TotalSupplyRepository.prototype.deleteAll.name, async () => {
    await repository.addOrUpdateMany(DATA)
    await repository.deleteAll()

    const result = await repository.getAll()

    expect(result).toEqual([])
  })

  testDeletingArchivedRecords(repository, fakeTotalSupply)
})

function fakeTotalSupply(timestamp: UnixTime): TotalSupplyRecord {
  return {
    timestamp,
    totalSupply: 0n,
    assetId: AssetId('fake'),
    chainId: ChainId.ARBITRUM,
  }
}
