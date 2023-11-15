import { AztecAddress, CallContext, Fr, FunctionData } from '@aztec/circuits.js';
import { AVMInstruction, Opcode, PC_MODIFIERS } from './opcodes.js';
import { createDebugLogger } from '@aztec/foundation/log';
import { PublicCallContext } from './execution.js';

/**
 * VM object with top-level/tx-level state
 *     - VM can execute a TX which in turns executes each call
 * VM call/context object with call-level state
 *     - call can execute
 * 
 * There are a few different levels of state during execution:
 * 1. Call-level state that is modified by each instruction
 * 2. TX-level state that is modified by each call
 * 3. Top-level state that is modified by each TX
 * 4. Block-level state that remains constant for all TXs in a block
 * 
 * Within call-level state, there are values that will remain constant
 * for the duration of the call, and values that will be modified per-instruction
 * 
 * CallContext is constant for a call. It is the context in which the
 * call was triggered, but is not modified by the call.
 */

///**
// * 
// * @param bytecode 
// * @param context 
// * @returns 
// */
//class AVMTxExecutor {
//  private log = createDebugLogger('aztec:simulator:avm_tx_executor');
//  private topCallExecutor: AVMCallExecutor;
//
//  public execute() {
//    this.topCallExecutor.execute();
//
//  }
//
//}


/**
 * 
 */
class AVMCallState {
  readonly MEM_WORDS = 1024;
  public fieldMemory: Fr[] = new Array<Fr>(this.MEM_WORDS).fill(Fr.ZERO);
}

/**
 * 
 */
export class AVMCallExecutor {
  private log = createDebugLogger('aztec:simulator:avm_call_executor');

  private state = new AVMCallState();
  //private bytecode: AVMInstruction[];

  constructor(private context: PublicCallContext, private bytecode: AVMInstruction[]) {

    // TODO: fetch bytecode here?
    // bytecode = ...
  }

  /**
   * Execute this call.
   */
  public execute(): Fr[] {
    this.log(`Executing public vm`);
    // TODO: check memory out of bounds
    let pc = 0; // TODO: should be u32
    while(pc < this.bytecode.length) {
      const instr = this.bytecode[pc];
      this.log(`Executing instruction ${Opcode[instr.opcode]}`);
      switch (instr.opcode) {
        case Opcode.CALLDATASIZE: {
          // TODO: dest should be u32
          this.state.fieldMemory[instr.d0] = new Fr(this.context.calldata.length);
          break;
        }
        case Opcode.CALLDATACOPY: {
          // TODO: srcOffset and copySize should be u32s
          const copySize = this.state.fieldMemory[instr.s1].toBigInt();
          //assert instr.s0 + copySize <= context.calldata.length;
          //assert instr.d0 + copySize <= context.fieldMemory.length;
          for (let i = 0; i < copySize; i++) {
            this.state.fieldMemory[instr.d0+i] = this.context.calldata[instr.s0+i];
          }
          break;
        }
        case Opcode.ADD: {
          // TODO: actual field addition
          this.state.fieldMemory[instr.d0] = new Fr(this.state.fieldMemory[instr.s0].toBigInt() + this.state.fieldMemory[instr.s1].toBigInt());
          break;
        }
        case Opcode.JUMP: {
          pc = instr.s0;
          break;
        }
        case Opcode.JUMPI: {
          pc = !this.state.fieldMemory[instr.sd].isZero() ? instr.s0 : pc + 1;
          break;
        }
        case Opcode.RETURN: {
          const retSize = this.state.fieldMemory[instr.s1];
          //assert instr.s0 + retSize <= context.fieldMemory.length;
          return this.state.fieldMemory.slice(instr.s0, instr.s0 + Number(retSize.toBigInt()));
        }
        //case Opcode.CALL: {
        //  const retSize = this.state.fieldMemory[instr.s1];
        //  //assert instr.s0 + retSize <= context.fieldMemory.length;
        //  return this.state.fieldMemory.slice(instr.s0, instr.s0 + Number(retSize.toBigInt()));
        //}
      }
      if (!PC_MODIFIERS.includes(instr.opcode)) {
        pc++;
      }
    }
    throw new Error("Reached end of bytecode without RETURN or REVERT");
  }
}
