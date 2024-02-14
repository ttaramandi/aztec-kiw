import { FunctionSelector } from '@aztec/foundation/abi';
import {
  BufferReader,
  numToInt32BE,
  serializeBufferArrayToVector,
  serializeToBuffer,
} from '@aztec/foundation/serialize';
import { ContractClass } from '@aztec/types/contracts';

import { deflate, inflate } from 'pako';

import { FUNCTION_SELECTOR_NUM_BYTES } from '../constants.gen.js';

/**
 * Packs together a set of public functions for a contract class.
 * @remarks This function should no longer be necessary once we have a single bytecode per contract.
 */
export function packBytecode(publicFns: ContractClass['publicFunctions']): Buffer {
  return Buffer.from(
    deflate(
      serializeBufferArrayToVector(
        publicFns.map(fn =>
          serializeToBuffer(fn.selector, fn.isInternal, numToInt32BE(fn.bytecode.length), fn.bytecode),
        ),
      ),
      { raw: true, level: 9 },
    ),
  );
}

/**
 * Unpacks a set of public functions for a contract class from packed bytecode.
 * @remarks This function should no longer be necessary once we have a single bytecode per contract.
 */
export function unpackBytecode(buffer: Buffer): ContractClass['publicFunctions'] {
  const reader = BufferReader.asReader(inflate(buffer, { raw: true }));
  return reader.readVector({
    fromBuffer: (reader: BufferReader) => ({
      selector: FunctionSelector.fromBuffer(reader.readBytes(FUNCTION_SELECTOR_NUM_BYTES)),
      isInternal: reader.readBoolean(),
      bytecode: reader.readBuffer(),
    }),
  });
}
