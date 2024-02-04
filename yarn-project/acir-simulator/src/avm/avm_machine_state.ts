import { Fr } from '@aztec/circuits.js';

import { TaggedMemory } from './avm_memory_types.js';
import { AvmContractCallResults } from './avm_message_call_result.js';

export type InitialAvmMachineState = {
  l1GasLeft: number;
  l2GasLeft: number;
  daGasLeft: number;
};

/**
 * Avm state modified on an instruction-per-instruction basis.
 */
export class AvmMachineState {
  public l1GasLeft: number;
  /** gas remaining of the gas allocated for a contract call */
  public l2GasLeft: number;
  public daGasLeft: number;
  /** program counter */
  public pc: number = 0;

  /**
   * On INTERNALCALL, internal call stack is pushed to with the current pc + 1
   * On INTERNALRETURN, value is popped from the internal call stack and assigned to the pc.
   */
  public internalCallStack: number[] = [];

  /** Memory accessible to user code */
  public readonly memory: TaggedMemory = new TaggedMemory();

  /** If an instruction triggers a halt, context execution ends */
  public halted: boolean = false;
  /** Flags whether the execution has reverted normally (this does nto cover exceptional halts) */
  private reverted: boolean = false;

  /** Output data must NOT be modified once it is set */
  private output: Fr[] = [];

  /**
   * Create a new machine state
   * @param initialMachineState - The initial machine state passed to the avm
   */
  constructor(initialMachineState: InitialAvmMachineState) {
    this.l1GasLeft = initialMachineState.l1GasLeft;
    this.l2GasLeft = initialMachineState.l2GasLeft;
    this.daGasLeft = initialMachineState.daGasLeft;
  }

  /**
   * Most instructions just increment PC before they complete
   */
  public incrementPc() {
    this.pc++;
  }

  /**
   * Halt as successful
   * Output data must NOT be modified once it is set
   * @param output
   */
  public return(output: Fr[]) {
    this.halted = true;
    this.output = output;
  }

  /**
   * Halt as reverted
   * Output data must NOT be modified once it is set
   * @param output
   */
  public revert(output: Fr[]) {
    this.halted = true;
    this.reverted = true;
    this.output = output;
  }

  /**
   * Get a summary of execution results for a halted machine state
   * @returns summary of execution results
   */
  public getResults(): AvmContractCallResults {
    if (!this.halted) {
      throw new Error('Execution results are not ready! Execution is ongoing.');
    }
    return new AvmContractCallResults(this.reverted, this.output);
  }
}
