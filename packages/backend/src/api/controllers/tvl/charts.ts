import {
  TokenTvlApiChartPoint,
  TvlApiChartPoint,
  UnixTime,
} from '@l2beat/shared-pure'

import { ReportRecord } from '../../../peripherals/database/ReportRepository'
import { asNumber } from './asNumber'

export function addTokenMissingTimestamps(
  points: TokenTvlApiChartPoint[],
  hours: number,
): TokenTvlApiChartPoint[] {
  if (points.length === 0) return []
  const [min] = points[0]
  const [max] = points[points.length - 1]
  const timestampValues = new Map(
    points.map(([t, v1, v2]) => [t.toString(), [v1, v2]]),
  )
  const allPoints: TokenTvlApiChartPoint[] = []
  for (
    let timestamp = min;
    timestamp.lte(max);
    timestamp = timestamp.add(hours, 'hours')
  ) {
    const existing = timestampValues.get(timestamp.toString())
    const previous = allPoints[allPoints.length - 1]
    allPoints.push([
      timestamp,
      existing?.[0] ?? previous[1],
      existing?.[1] ?? previous[2],
    ])
  }
  return allPoints
}

export function addMissingTimestamps(
  points: TvlApiChartPoint[],
  hours: number,
): TvlApiChartPoint[] {
  if (points.length === 0) return []
  const [min] = points[0]
  const [max] = points[points.length - 1]
  const timestampValues = new Map(
    points.map(([t, ...values]) => [t.toString(), values]),
  )
  const allPoints: TvlApiChartPoint[] = []
  for (
    let timestamp = min;
    timestamp.lte(max);
    timestamp = timestamp.add(hours, 'hours')
  ) {
    const existing = timestampValues.get(timestamp.toString())
    const previous = allPoints[allPoints.length - 1]

    allPoints.push([
      timestamp,
      existing?.[0] ?? previous[1],
      existing?.[1] ?? previous[2],
      existing?.[2] ?? previous[3],
      existing?.[3] ?? previous[4],
      existing?.[4] ?? previous[5],
      existing?.[5] ?? previous[6],
      existing?.[6] ?? previous[7],
      existing?.[7] ?? previous[8],
    ])
  }
  return allPoints
}

export function getProjectAssetChartData(
  projectAssetReports: ReportRecord[],
  decimals: number,
  hours: number,
) {
  const balancesInTime = projectAssetReports.map((report) => ({
    timestamp: report.timestamp,
    usd: report.usdValue,
    asset: report.amount,
  }))

  return getChartPoints(balancesInTime, hours, decimals)
}

export function getChartPoints(
  balances: { usd: bigint; asset: bigint; timestamp: UnixTime }[],
  hours: number,
  decimals: number,
  usdFirst = false,
): TokenTvlApiChartPoint[] {
  const existing: TokenTvlApiChartPoint[] = balances.map((b) => {
    const usd = asNumber(b.usd, 2)
    const asset = asNumber(b.asset, decimals)
    return usdFirst ? [b.timestamp, usd, asset] : [b.timestamp, asset, usd]
  })
  return addTokenMissingTimestamps(existing, hours)
}
