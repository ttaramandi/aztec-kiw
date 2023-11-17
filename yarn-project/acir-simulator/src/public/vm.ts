import { AztecAddress, CallContext, ContractStorageRead, ContractStorageUpdateRequest, EthAddress, Fr, FunctionData, FunctionSelector } from '@aztec/circuits.js';
import { AVMInstruction, Opcode, PC_MODIFIERS } from './opcodes.js';
import { createDebugLogger } from '@aztec/foundation/log';
import { PublicCall, PublicExecutionResult } from './execution.js';
import { PublicContractsDB, PublicStateDB } from './db.js';
import { FunctionL2Logs } from '@aztec/types';
import { ContractStorageActionsCollector } from './state_actions.js';
import { SideEffectCounter } from '../common/side_effect_counter.js';

// TODO: figure out what info needs to go to witgen and prover, and what info
// is really just for the TS code to keep track of the entire TX/callstack

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

class AVMCallState {
  static readonly MEM_REGION_WORDS = 4096; // 2**22 ?
  static readonly RETURN_BUFFER_WORDS = 128;

  public pc: number = 0; // TODO: should be u32
  public error: boolean = false;
  public returned: boolean = false;
  public call_stack: number[] = []; // TODO: should be u32[]
  //public l1GasUsed: number = 0; // or left?
  //public l2GasUsed: number = 0; // or left?
  /** Field memory region for this call */
  public fieldMemory: Fr[] = new Array<Fr>(AVMCallState.MEM_REGION_WORDS).fill(Fr.ZERO);
  /** Buffer to store returnData from nested calls */
  public returnBuffer: Fr[] = new Array<Fr>(AVMCallState.RETURN_BUFFER_WORDS).fill(Fr.ZERO);
}

export class AVMExecutor {
  constructor(
    private readonly stateDb: PublicStateDB,
    private readonly contractsDb: PublicContractsDB,
  ) {}

  public async simulate(context: PublicCall): Promise<PublicExecutionResult> {
    const avm = new AVM(
      context,
      new SideEffectCounter(),
      this.stateDb,
      this.contractsDb
    );
    await avm.init();
    return avm.simulate();
  }
}

class AVM {
  private log = createDebugLogger('aztec:simulator:avm_call_executor');

  private state = new AVMCallState();
  private instructions: AVMInstruction[] = [];

  // Components of the partial witness (inputs to witness generation)
  // collapsedStorageActions is used to retrieve latest value per slot
  private collapsedStorageActions: ContractStorageActionsCollector;
  private allStorageReads: ContractStorageRead[] = [];
  private allStorageUpdates: ContractStorageUpdateRequest[] = [];
  private nestedExecutions: PublicExecutionResult[] = [];
  //private unencryptedLogs: UnencryptedL2Log[] = [];
  // ^ these are computed gradually as instructions execute

  constructor(
    private context: PublicCall,
    private readonly sideEffectCounter: SideEffectCounter,
    private readonly stateDb: PublicStateDB,
    private readonly contractsDb: PublicContractsDB,
  ) {
    this.collapsedStorageActions = new ContractStorageActionsCollector(stateDb, context.contractAddress);
  }
  /**
   * Must be called before AVM can be executed or simulated.
   */
  async init(){
    this.instructions = await this.fetchAndDecodeBytecode();
  }

  /**
   * Execute this call.
   * Generate a partial witness.
   */
  public async simulate(): Promise<PublicExecutionResult> {
    this.log(`Simulating the Aztec Public VM`);

    const returnValues = await this.simulateInternal();
    //const [contractStorageReads, contractStorageUpdateRequests] = this.collapsedStorageActions.collect();

    // just rename args to calldata...
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
      contractStorageReads: this.allStorageReads,
      contractStorageUpdateRequests: this.allStorageUpdates,
      returnValues: returnValues,
      nestedExecutions: [],
      unencryptedLogs: FunctionL2Logs.empty(),
    };
  }

  /**
   * Execute each instruction based on the program counter.
   * End execution when the call errors or returns.
   */
  private async simulateInternal(): Promise<Fr[]> {
    while(this.state.pc < this.instructions.length && !this.state.error && !this.state.returned) {
      const returnData = await this.simulateNextInstruction();
      if (this.state.returned) {
        return returnData;
      }
      if (this.state.error) {
        throw new Error("Reverting is not yet supported in the AVM");
      }
    }
    throw new Error("Reached end of bytecode without RETURN or REVERT");
  }

  /**
   * Execute the instruction at the current program counter.
   */
  private async simulateNextInstruction(): Promise<Fr[]> {
    // TODO: check memory out of bounds
    const instr = this.instructions[this.state.pc];
    this.log(`Executing instruction (pc:${this.state.pc}): ${Opcode[instr.opcode]}`);
    switch (instr.opcode) {
      /////////////////////////////////////////////////////////////////////////
      // Arithmetic
      /////////////////////////////////////////////////////////////////////////
      case Opcode.ADD: {
        // TODO: consider having a single case for all arithmetic operations and then applying the corresponding function to the args
        // TODO: use actual field math
        this.state.fieldMemory[instr.d0] = new Fr((this.state.fieldMemory[instr.s0].toBigInt() + this.state.fieldMemory[instr.s1].toBigInt()) % Fr.MODULUS);
        this.log(`ADD: M[${instr.d0}] = M[${instr.s0}] + M[${instr.s1}] % Fr.MODULUS`);
        this.log(`ADD: M[${instr.d0}] = ${this.state.fieldMemory[instr.s0].toBigInt()} + ${this.state.fieldMemory[instr.s1].toBigInt()} = ${this.state.fieldMemory[instr.d0]}`);
        break;
      }
      case Opcode.SUB: {
        // TODO: use actual field math
        this.state.fieldMemory[instr.d0] = new Fr((this.state.fieldMemory[instr.s0].toBigInt() - this.state.fieldMemory[instr.s1].toBigInt()) % Fr.MODULUS);
        break;
      }
      //TODO: case Opcode.MUL
      case Opcode.DIV: {
        // TODO: use actual field math
        this.state.fieldMemory[instr.d0] = new Fr((this.state.fieldMemory[instr.s0].toBigInt() / this.state.fieldMemory[instr.s1].toBigInt()));
        break;
      }
      case Opcode.EQ: {
        // TODO: use actual field math
        this.state.fieldMemory[instr.d0] = new Fr((this.state.fieldMemory[instr.s0].toBigInt() == this.state.fieldMemory[instr.s1].toBigInt()));
        break;
      }
      case Opcode.LT: {
        // TODO: use actual field math
        this.state.fieldMemory[instr.d0] = new Fr((this.state.fieldMemory[instr.s0].toBigInt() < this.state.fieldMemory[instr.s1].toBigInt()));
        break;
      }
      case Opcode.LTE: {
        // TODO: use actual field math
        this.state.fieldMemory[instr.d0] = new Fr((this.state.fieldMemory[instr.s0].toBigInt() <= this.state.fieldMemory[instr.s1].toBigInt()));
        break;
      }
      /////////////////////////////////////////////////////////////////////////
      // Memory
      /////////////////////////////////////////////////////////////////////////
      case Opcode.SET: {
        // TODO: allow instr.s0 to be larger since SET accepts an immediate value
        this.log(`SET: M[${instr.d0}] = ${instr.s0}`);
        this.state.fieldMemory[instr.d0] = new Fr(instr.s0);
        break;
      }
      case Opcode.MOV: {
        // TODO: use u32 memory for addresses here
        const srcAddr = instr.s0Indirect ? Number(this.state.fieldMemory[instr.s0].toBigInt()) : instr.s0;
        const dstAddr = instr.d0Indirect ? Number(this.state.fieldMemory[instr.s0].toBigInt()) : instr.d0;
        if (instr.s0Indirect) {
          this.log(`MOV: source is indirect, so srcAddr is M[s0] = M[${instr.s0}] = ${srcAddr}`);
        }
        if (instr.d0Indirect) {
          this.log(`MOV: destination is indirect, so dstAddr is M[d0] = M[${instr.d0}] = ${dstAddr}`);
        }
        this.log(`MOV: M[${dstAddr}] = M[${srcAddr}]`);
        this.state.fieldMemory[dstAddr] = this.state.fieldMemory[srcAddr];
        break;
      }
      // TODO: RETURNDATASIZE and RETURNDATACOPY
      case Opcode.CALLDATASIZE: {
        // TODO: dest should be u32
        this.log(`CALLDATASIZE: M[${instr.d0}] = ${this.context.calldata.length}`);
        this.state.fieldMemory[instr.d0] = new Fr(this.context.calldata.length);
        break;
      }
      case Opcode.CALLDATACOPY: {
        /**
         * Might be best if this opcode doesn't truly accept dynamic length (lookups will be a pain)
         * Opcode can have a max copy size and compiler can break larger copies into smaller components
         */
        // TODO: srcOffset and copySize should be u32s
        const copySize = Number(this.state.fieldMemory[instr.s1].toBigInt());
        this.log(`CALLDATACOPY: M[${instr.d0}:${instr.d0+copySize}] = calldata[${instr.s0}:${instr.s0+copySize}]`);
        //assert instr.s0 + copySize <= context.calldata.length;
        //assert instr.d0 + copySize <= context.fieldMemory.length;
        for (let i = 0; i < copySize; i++) {
          this.log(`Copying calldata[${instr.s0+i}] (${this.context.calldata[instr.s0+i]}) to fieldMemory[${instr.d0+i}]`);
          this.state.fieldMemory[instr.d0+i] = this.context.calldata[instr.s0+i];
        }
        break;
      }
      /////////////////////////////////////////////////////////////////////////
      // Control flow
      /////////////////////////////////////////////////////////////////////////
      case Opcode.JUMP: {
        this.state.pc = instr.s0;
        break;
      }
      case Opcode.JUMPI: {
        this.state.pc = !this.state.fieldMemory[instr.sd].isZero() ? instr.s0 : this.state.pc + 1;
        break;
      }
      case Opcode.INTERNALCALL: {
        this.state.call_stack.push(this.state.pc + 1);
        this.state.pc = instr.s0;
        this.log(`INTERNALCALL: pushed pc:${this.state.call_stack.at(-1)} to call_stack and jumped to pc:${this.state.pc}`);
        break;
      }
      case Opcode.INTERNALRETURN: {
        if (this.state.call_stack.length === 0) {
          throw new Error("INTERNALRETURN: call_stack is empty - nowhere to return to");
        }
        this.state.pc = this.state.call_stack.pop()!;
        break;
      }
      /////////////////////////////////////////////////////////////////////////
      // Storage
      /////////////////////////////////////////////////////////////////////////
      case Opcode.SLOAD: {
        // TODO: use u32 memory for storage slot
        this.log(`SLOAD: M[${instr.d0}] = S[M[${instr.s0}]]`)
        const storageSlot = this.state.fieldMemory[instr.s0];
        this.state.fieldMemory[instr.d0] = await this.sload(storageSlot);
        this.log(`SLOAD value: ${this.state.fieldMemory[instr.s1]} (S[${storageSlot}])`)
        break;
      }
      case Opcode.SSTORE: {
        // TODO: use u32 memory for storage slot
        this.log(`SSTORE: S[M[${instr.d0}]] = M[${instr.s0}]`)
        const storageSlot = this.state.fieldMemory[instr.d0];
        const value = this.state.fieldMemory[instr.s0];
        this.log(`SSTORE: S[${storageSlot}] = ${value}`)
        await this.sstore(storageSlot, value);
        break;
      }
      case Opcode.RETURN: {
        const retSizeFr = this.state.fieldMemory[instr.s1];
        const retSize = Number(retSizeFr.toBigInt());
        this.log(`RETURN: M[${instr.s0}:${instr.s0 + retSize}] (size: ${retSize})`);
        //assert instr.s0 + retSize <= context.fieldMemory.length;
        this.state.returned = true;
        return this.state.fieldMemory.slice(instr.s0, instr.s0 + retSize);
      }
      /////////////////////////////////////////////////////////////////////////
      // Contract call control flow
      /////////////////////////////////////////////////////////////////////////
      case Opcode.CALL: {
        const gas = this.state.fieldMemory[instr.s0];
        this.log(`CALL was allocated ${gas} gas`);
        const addrFr = this.state.fieldMemory[instr.s1];
        const targetContractAddress = AztecAddress.fromBigInt(addrFr.toBigInt());

        // argsAndRetOffset = sd
        // size of argsAndRetOffset is 4:
        // - argsOffset: M[sd]
        // - argsSize: M[sd + 1]
        // - retOffset: M[sd + 2]
        // - retSize: M[sd + 3]
        // TODO: use u32 memory for offsets and sizes
        const argsOffset = Number(this.state.fieldMemory[instr.sd].toBigInt());
        const argsSize = Number(this.state.fieldMemory[instr.sd + 1].toBigInt());
        const retOffset = Number(this.state.fieldMemory[instr.sd + 2].toBigInt());
        const retSize = Number(this.state.fieldMemory[instr.sd + 3].toBigInt());
        this.log(`CALL: argsOffset=${argsOffset} argsSize=${argsSize} retOffset=${retOffset} retSize=${retSize}`);

        const calldata = this.state.fieldMemory.slice(argsOffset, argsOffset + argsSize);
        // For now, extract functionSelector here.
        // TODO: eventually functionSelector can become a use-case of calldata as in EVM.
        // FIXME: calldata[0] could be larger than 4-byte function selector!
        // FIXME this is not function selector in vm.test.ts examples!
        const functionSelector = new FunctionSelector(Number(calldata[0].toBigInt()));
        this.log(`Nested call in AVM: addr=${targetContractAddress} selector=${functionSelector}`);
        for (let i = 0; i < calldata.length; i++) {
          this.log(`\tInitializing nested calldata[${i}] = ${calldata[i]}`)
        }

        const portalAddress = (await this.contractsDb.getPortalContractAddress(targetContractAddress)) ?? EthAddress.ZERO;
        const isInternal = await this.contractsDb.getIsInternal(targetContractAddress, functionSelector);
        if (isInternal === undefined) {
          throw new Error(`ERR: Method not found - ${targetContractAddress.toString()}:${functionSelector.toString()}`);
        }

        const functionData = new FunctionData(functionSelector, isInternal, false, false);
        const nestedCallContext = CallContext.from({
          msgSender: this.context.contractAddress,
          portalContractAddress: portalAddress,
          storageContractAddress: targetContractAddress,
          functionSelector,
          isContractDeployment: false,
          isDelegateCall: false,
          isStaticCall: false,
        });
        const nestedContext = {
          contractAddress:targetContractAddress,
          functionData,
          calldata: calldata,
          callContext: nestedCallContext,
        };
        const nestedAVM = new AVM(
          nestedContext,
          this.sideEffectCounter,
          this.stateDb,
          this.contractsDb,
        );
        await nestedAVM.init();
        const childExecutionResult = await nestedAVM.simulate();
        this.nestedExecutions.push(childExecutionResult);
        this.log(`Returning from nested call: ret=${childExecutionResult.returnValues.join(', ')}`);

        // When retSize is provided (known at time of CALL), write return values to memory at provided offset.
        // Otherwise, write return values to start of returnBuffer.
        if (retSize > 0) {
          this.state.fieldMemory.splice(retOffset, retSize, ...childExecutionResult.returnValues);
        } else {
          this.state.returnBuffer.splice(0, retSize, ...childExecutionResult.returnValues);
        }
        break;
      }
      default: throw new Error(`AVM does not know how to process opcode ${Opcode[instr.opcode]} (aka ${instr.opcode}) at pc: ${this.state.pc}`);
    }
    if (!PC_MODIFIERS.includes(instr.opcode)) {
      this.state.pc++;
    }
    return [];
  }

  /**
   * Read a public storage word.
   * @param storageSlot - The starting storage slot.
   * @returns value - The value read from the storage slot.
   */
  private async sload(storageSlot: Fr): Promise<Fr> {
    const sideEffectCounter = this.sideEffectCounter.count();
    const value = await this.collapsedStorageActions.read(storageSlot, sideEffectCounter);
    this.allStorageReads.push(new ContractStorageRead(storageSlot, value, sideEffectCounter));
    this.log(`Oracle storage read: slot=${storageSlot.toString()} value=${value.toString()}`);
    return value;
  }
  /**
   * Write a word to public storage.
   * @param storageSlot - The storage slot.
   * @param value - The value to be written.
   */
  private async sstore(storageSlot: Fr, value: Fr) {
    const sideEffectCounter = this.sideEffectCounter.count();
    const oldValue = await this.collapsedStorageActions.peek(storageSlot);
    await this.collapsedStorageActions.write(storageSlot, value, sideEffectCounter);
    this.allStorageUpdates.push(new ContractStorageUpdateRequest(storageSlot, oldValue, value, sideEffectCounter));
    await this.stateDb.storageWrite(this.context.contractAddress, storageSlot, value);
    this.log(`Oracle storage write: slot=${storageSlot.toString()} value=${value.toString()}`);
  }

  private async fetchAndDecodeBytecode(): Promise<AVMInstruction[]> {
    this.log(`Fetching and decoding bytecode for ${this.context.contractAddress}:${this.context.functionData.selector}`);
    const bytecode = await this.contractsDb.getBytecode(this.context.contractAddress, this.context.functionData.selector);
    if (!bytecode) throw new Error(`Bytecode not found for ${this.context.contractAddress}:${this.context.functionData.selector}`);
    // TODO: consider decoding instructions individually as they are simulated
    return AVMInstruction.fromBytecodeBuffer(bytecode);
  }
}
