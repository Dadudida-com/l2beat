import { Token } from '@l2beat/shared-pure'
import { readFileSync, writeFileSync } from 'fs'
import { parse, ParseError } from 'jsonc-parser'

import { Output, Source } from '../../../src/tokens/types'
import { ScriptLogger } from './ScriptLogger'

const SOURCE_FILE_PATH = './src/tokens/tokens.jsonc'
const OUTPUT_FILE_PATH = './src/tokens/generated.json'

export function readTokensFile(logger: ScriptLogger) {
  const sourceFile = readFileSync(SOURCE_FILE_PATH, 'utf-8')
  const errors: ParseError[] = []
  const parsed = parse(sourceFile, errors, {
    allowTrailingComma: true,
  }) as Record<string, string>
  if (errors.length > 0) console.error(errors)
  logger.assert(errors.length === 0, 'Cannot parse source.jsonc')
  const source = Source.parse(parsed)

  return source
}

export function readGeneratedFile(logger: ScriptLogger) {
  const outputFile = readFileSync(OUTPUT_FILE_PATH, 'utf-8')
  try {
    const output = Output.parse(JSON.parse(outputFile))
    return output
  } catch (e) {
    console.error(e)
    logger.assert(false, 'Cannot parse generated.json')
  }
}

export function saveResults(result: Token[]) {
  const comment = 'This file was autogenerated. Please do not edit it manually.'
  const outputJson = JSON.stringify(
    {
      comment: comment,
      tokens: result,
    },
    null,
    2,
  )
  writeFileSync(OUTPUT_FILE_PATH, outputJson + '\n')
}
