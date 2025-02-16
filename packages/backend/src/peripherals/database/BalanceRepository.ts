import { Logger } from '@l2beat/backend-tools'
import {
  AssetId,
  ChainId,
  EthereumAddress,
  UnixTime,
} from '@l2beat/shared-pure'
import { BalanceRow } from 'knex/types/tables'

import { BaseRepository, CheckConvention } from './shared/BaseRepository'
import { Database } from './shared/Database'
import {
  deleteHourlyUntil,
  deleteSixHourlyUntil,
} from './shared/deleteArchivedRecords'

export interface BalanceRecord {
  timestamp: UnixTime
  holderAddress: EthereumAddress
  assetId: AssetId
  balance: bigint
  chainId: ChainId
}

export interface DataBoundary {
  earliestBlockNumber: bigint | undefined
  latestBlockNumber: bigint | undefined
}

export class BalanceRepository extends BaseRepository {
  constructor(database: Database, logger: Logger) {
    super(database, logger)
    this.autoWrap<CheckConvention<BalanceRepository>>(this)
  }

  async getByChainAndTimestamp(
    chainId: ChainId,
    timestamp: UnixTime,
  ): Promise<BalanceRecord[]> {
    const knex = await this.knex()
    const rows = await knex('balances')
      .where('unix_timestamp', '=', timestamp.toDate())
      .andWhere('chain_id', '=', Number(chainId))

    return rows.map(toRecord)
  }

  async getByTimestamp(timestamp: UnixTime): Promise<BalanceRecord[]> {
    const knex = await this.knex()

    const rows = await knex('balances').where(
      'unix_timestamp',
      timestamp.toDate(),
    )

    return rows.map(toRecord)
  }

  async addOrUpdateMany(balances: BalanceRecord[]) {
    this.logger.info('addOrUpdateMany', {
      chainId: balances[0].chainId.toString(),
      rows: balances.length,
    })

    const rows = balances.map(toRow)
    const knex = await this.knex()
    await knex('balances')
      .insert(rows)
      .onConflict(['chain_id', 'unix_timestamp', 'holder_address', 'asset_id'])
      .merge()
    return rows.length
  }

  async addMany(balances: BalanceRecord[]) {
    const rows = balances.map(toRow)
    const knex = await this.knex()
    await knex.batchInsert('balances', rows, 10_000)
    return rows.length
  }

  async getAll(): Promise<BalanceRecord[]> {
    const knex = await this.knex()
    const rows = await knex('balances')
    return rows.map(toRecord)
  }

  async deleteAll() {
    const knex = await this.knex()
    return knex('balances').delete()
  }

  async deleteHourlyUntil(timestamp: UnixTime) {
    const knex = await this.knex()
    return deleteHourlyUntil(knex, 'balances', timestamp)
  }

  async deleteSixHourlyUntil(timestamp: UnixTime) {
    const knex = await this.knex()
    return deleteSixHourlyUntil(knex, 'balances', timestamp)
  }
}

function toRecord(row: BalanceRow): BalanceRecord {
  return {
    holderAddress: EthereumAddress(row.holder_address),
    assetId: AssetId(row.asset_id),
    timestamp: UnixTime.fromDate(row.unix_timestamp),
    balance: BigInt(row.balance),
    chainId: ChainId(row.chain_id),
  }
}

function toRow(record: BalanceRecord): BalanceRow {
  return {
    holder_address: record.holderAddress.toString(),
    asset_id: record.assetId.toString(),
    unix_timestamp: record.timestamp.toDate(),
    balance: record.balance.toString(),
    chain_id: Number(record.chainId),
  }
}
