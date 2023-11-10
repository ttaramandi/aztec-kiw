import { PublicExecution } from './execution.js';
import { Fr } from '@aztec/circuits.js';

/**
 * Memory page type
 */
export enum MemoryType {
 U8,
 U16,
 U32,
 U64,
 //U128,
 FIELD,
};

/**
 * Public Vm Execution Context.
 */
export class PublicVmExecutionContext {
  readonly MEM_WORDS = 1024;

  /** Field memory, an array of memory pages */
  public memory: {[key: number]: Fr}[] = [];
  /** Program counter */
  public pc = 0;

  // public fieldMem: Fr[] = new Array<Fr>(this.MEM_WORDS).fill(Fr.ZERO);

  /** Calldata */
  public readonly calldata: Fr[];

  constructor(
    /** Executor */
    public readonly execution: PublicExecution,
    //public readonly historicBlockData: HistoricBlockData,
    //public readonly globalVariables: GlobalVariables,
  ) {
    // NOTE: For the moment each memory page is a mapping in order to allow arbitrary indexing
    const numMemPages = Object.keys(MemoryType).length;
    for (let i = 0; i < numMemPages; i++) {
      this.memory[i] = {};
    }

    this.calldata = execution.args; // rename

  }
}