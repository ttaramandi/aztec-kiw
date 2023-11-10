import { PublicExecution } from './execution.js';
import { Fr } from '@aztec/circuits.js';

//enum MemoryType {
//  U8,
//  U16,
//  U32,
//  U64,
//  //U128,
//  FIELD,
//};

export class PublicVmExecutionContext {
  readonly MEM_WORDS = 1024;
  public fieldMem: Fr[] = new Array<Fr>(this.MEM_WORDS).fill(Fr.ZERO);
  public readonly calldata: Fr[];

  constructor(
    public readonly execution: PublicExecution,
    //public readonly historicBlockData: HistoricBlockData,
    //public readonly globalVariables: GlobalVariables,
  ) {
    this.calldata = execution.args; // rename
  }
}