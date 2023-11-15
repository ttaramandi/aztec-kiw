import { AztecAddress, CallContext, Fr, FunctionData } from '@aztec/circuits.js';
import { AVMInstruction, Opcode, PC_MODIFIERS } from './opcodes.js';
import { createDebugLogger } from '@aztec/foundation/log';
import { PublicCallContext, PublicExecutionResult, isPublicExecutionResult } from './execution.js';
import { PublicContractsDB, PublicStateDB } from './db.js';
import { FunctionL2Logs } from '@aztec/types';
import { ContractStorageActionsCollector } from './state_actions.js';
import { SideEffectCounter } from '../common/side_effect_counter.js';

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
//class AVM {
//  private log = createDebugLogger('aztec:simulator:avm_tx_executor');
//  private topCallExecutor: AVMCallExecutor;
//
//  public simulate() {
//    this.topCallExecutor.execute();
//
//  }
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
  private bytecode: AVMInstruction[];

  // Partial witness components (inputs to witness generation)
  // - storageActions
  // - nestedExecutions
  // - unencryptedLogs
  // - nastyOperations
  // ^ these are computed gradually as instructions execute
  private storageActions: ContractStorageActionsCollector;
  //private nestedExecutions: PublicExecutionResult[] = [];
  //private unencryptedLogs: UnencryptedL2Log[] = [];


  constructor(
    private context: PublicCallContext,
    private readonly sideEffectCounter: SideEffectCounter,
    private readonly stateDb: PublicStateDB,
    private readonly contractsDb: PublicContractsDB,
  ) {
    this.bytecode = this.fetchBytecode();

    this.storageActions = new ContractStorageActionsCollector(stateDb, context.contractAddress);
  }

  /**
   * Execute this call.
   * Generate a partial witness.
   */
  public async simulate(): Promise<PublicExecutionResult> {
    const execution = {
      contractAddress: this.context.contractAddress,
      functionData: this.context.functionData,
      args: this.context.calldata, // rename
      callContext: this.context.callContext
    };
    return {
      execution,
      newCommitments: [],
      newL2ToL1Messages: [],
      newNullifiers: [],
      contractStorageReads: [],
      contractStorageUpdateRequests: [],
      returnValues: await this.simulateInternal(),
      nestedExecutions: [],
      unencryptedLogs: FunctionL2Logs.empty(),
    };
  }

  /**
   * Execute this call.
   * Generate a partial witness.
   */
  private async simulateInternal(): Promise<Fr[]> {
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
          // TODO: consider having a single case for all arithmetic operations and then applying the corresponding function to the args
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
        case Opcode.SLOAD: {
          // TODO: use u32 memory for storage slot
          const storageSlot = this.state.fieldMemory[instr.s0];
          this.state.fieldMemory[instr.s1] = await this.sload(storageSlot);
          break;
        }
        case Opcode.SSTORE: {
          // TODO: use u32 memory for storage slot
          const storageSlot = this.state.fieldMemory[instr.d0];
          const value = this.state.fieldMemory[instr.s1];
          await this.sstore(storageSlot, value);
          break;
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

  private fetchBytecode(): AVMInstruction[] {
    // TODO get AVM bytecode directly, not ACIR?
    //const acir = await this.contractsDb.getBytecode(context.contractAddress, selector);
    //if (!acir) throw new Error(`Bytecode not found for ${context.contractAddress}:${selector}`);
    //return acir; // extract brillig or AVM bytecode
    return [
      new AVMInstruction(
        /*opcode*/ Opcode.CALLDATASIZE, // M[0] = CD.length
        /*d0:*/ 0, /*target memory address*/
        /*sd:*/ 0, /*unused*/
        /*s0:*/ 0, /*unused*/
        /*s1:*/ 0, /*unused*/
      ),
      new AVMInstruction(
        /*opcode*/ Opcode.CALLDATACOPY, // M[1:1+M[0]] = CD[0+M[0]]);
        /*d0:*/ 1, /*target memory address*/
        /*sd:*/ 0, /*unused*/
        /*s0:*/ 0, /*calldata offset*/
        /*s1:*/ 0, /*copy size*/
      ),
      new AVMInstruction(
        /*opcode*/ Opcode.ADD, // M[10] = M[1] + M[2]
        /*d0:*/ 10, /*target memory address*/
        /*sd:*/ 0, /*unused*/
        /*s0:*/ 1, /*to add*/
        /*s1:*/ 2, /*to add*/
      ),
      new AVMInstruction(
        /*opcode*/ Opcode.RETURN, // return M[10]
        /*d0:*/ 0, /*unused*/
        /*sd:*/ 0, /*unused*/
        /*s0:*/ 10, /*field memory offset*/
        /*s1:*/ 1, /*return size*/
      )
    ];

  }

  /**
   * Read the public storage data.
   * @param storageSlot - The starting storage slot.
   * @returns value - The value read from the storage slot.
   */
  public async sload(storageSlot: Fr): Promise<Fr> {
    //const values = [];
    //for (let i = 0; i < Number(numberOfElements); i++) {
      //const storageSlot = new Fr(startStorageSlot.value + BigInt(i));
      const sideEffectCounter = this.sideEffectCounter.count();
      const value = await this.storageActions.read(storageSlot, sideEffectCounter);
      this.log(`Oracle storage read: slot=${storageSlot.toString()} value=${value.toString()}`);
      //values.push(value);
      return value;
    //}
    //return values;
  }
  /**
   * Write some values to the public storage.
   * @param storageSlot - The storage slot.
   * @param value - The value to be written.
   */
  private async sstore(storageSlot: Fr, value: Fr) {
    //const newValues = [];
    //for (let i = 0; i < values.length; i++) {
      //const storageSlot = new Fr(startStorageSlot.value + BigInt(i));
      //const newValue = values[i];
      const sideEffectCounter = this.sideEffectCounter.count();
      await this.storageActions.write(storageSlot, value, sideEffectCounter);
      await this.stateDb.storageWrite(this.context.contractAddress, storageSlot, value);
      this.log(`Oracle storage write: slot=${storageSlot.toString()} value=${value.toString()}`);
      //newValues.push(newValue);
    //}
  }

}
