import { AvmMachineState } from '../avm_machine_state.js';
import { IntegralValue } from '../avm_memory_types.js';
import { AvmJournal } from '../journal/journal.js';
import {
  Opcode,
  OperandPair,
  OperandType,
  serialize,
} from '../serialization/instruction_serialization.js';
import { Instruction, InstructionExecutionError } from './instruction.js';

export class Return extends Instruction {
  static type: string = 'RETURN';
  static readonly opcode: Opcode = Opcode.RETURN;

  // Instruction wire format with opcode.
  static readonly wireFormat: OperandPair[] = [
    [(_c: Return) => Return.opcode, OperandType.UINT8],
    [(c: Return) => c.indirect, OperandType.UINT8],
    [(c: Return) => c.returnOffset, OperandType.UINT32],
    [(c: Return) => c.copySize, OperandType.UINT32],
  ];

  constructor(private indirect: number, private returnOffset: number, private copySize: number) {
    super();
  }

  public serialize(): Buffer {
    return serialize(Return.wireFormat, this);
  }

  async execute(machineState: AvmMachineState, _journal: AvmJournal): Promise<void> {
    const returnData = machineState.memory.getSlice(this.returnOffset, this.copySize).map(word => word.toFr());

    machineState.setReturnData(returnData);

    this.halt(machineState);
  }
}

export class Revert extends Instruction {
  static type: string = 'RETURN';
  static readonly opcode: Opcode = Opcode.REVERT;

  // Instruction wire format with opcode.
  static readonly wireFormat: OperandPair[] = [
    [(_c: Revert) => Revert.opcode, OperandType.UINT8],
    [(c: Revert) => c.indirect, OperandType.UINT8],
    [(c: Revert) => c.returnOffset, OperandType.UINT32],
    [(c: Revert) => c.retSize, OperandType.UINT32],
  ];

  constructor(private indirect: number, private returnOffset: number, private retSize: number) {
    super();
  }


  public serialize(): Buffer {
    return serialize(Revert.wireFormat, this);
  }

  async execute(machineState: AvmMachineState, _journal: AvmJournal): Promise<void> {
    const returnData = machineState.memory
      .getSlice(this.returnOffset, this.returnOffset + this.retSize)
      .map(word => word.toFr());
    machineState.setReturnData(returnData);

    this.revert(machineState);
  }
}

export class Jump extends Instruction {
  static type: string = 'JUMP';
  static readonly opcode: Opcode = Opcode.JUMP;

  // Instruction wire format with opcode.
  static readonly wireFormat: OperandPair[] = [
    [(_c: Jump) => Jump.opcode, OperandType.UINT8],
    [(c: Jump) => c.jumpOffset, OperandType.UINT32],
  ];

  constructor(private jumpOffset: number) {
    super();
  }


  public serialize(): Buffer {
    return serialize(Jump.wireFormat, this);
  }

  async execute(machineState: AvmMachineState, _journal: AvmJournal): Promise<void> {
    machineState.pc = this.jumpOffset;
  }
}

export class JumpI extends Instruction {
  static type: string = 'JUMPI';
  static readonly opcode: Opcode = Opcode.JUMPI;

  // Instruction wire format with opcode.
  static readonly wireFormat: OperandPair[] = [
    [(_c: JumpI) => JumpI.opcode, OperandType.UINT8],
    [(c: JumpI) => c.indirect, OperandType.UINT8],
    [(c: JumpI) => c.loc, OperandType.UINT32],
    [(c: JumpI) => c.condOffset, OperandType.UINT32],
  ];

  constructor(private indirect: number, private loc: number, private condOffset: number) {
    super();
  }


  public serialize(): Buffer {
    return serialize(JumpI.wireFormat, this);
  }

  async execute(machineState: AvmMachineState, _journal: AvmJournal): Promise<void> {
    const condition = machineState.memory.getAs<IntegralValue>(this.condOffset);

    // TODO: reconsider this casting
    if (condition.toBigInt() == 0n) {
      this.incrementPc(machineState);
    } else {
      machineState.pc = this.loc;
    }
  }
}

export class InternalCall extends Instruction {
  static readonly type: string = 'INTERNALCALL';
  static readonly opcode: Opcode = Opcode.INTERNALCALL;

  // Instruction wire format with opcode.
  static readonly wireFormat: OperandPair[] = [
    [(_c: InternalCall) => InternalCall.opcode, OperandType.UINT8],
    [(c: InternalCall) => c.loc, OperandType.UINT32],
  ];

  constructor(private loc: number) {
    super();
  }


  public serialize(): Buffer {
    return serialize(InternalCall.wireFormat, this);
  }

  async execute(machineState: AvmMachineState, _journal: AvmJournal): Promise<void> {
    machineState.internalCallStack.push(machineState.pc + 1);
    machineState.pc = this.loc;
  }
}

export class InternalReturn extends Instruction {
  static readonly type: string = 'INTERNALRETURN';
  static readonly opcode: Opcode = Opcode.INTERNALRETURN;

  // Instruction wire format with opcode.
  static readonly wireFormat: OperandPair[] = [
    [(_c: InternalReturn) => InternalReturn.opcode, OperandType.UINT8],
  ];

  constructor() {
    super();
  }

  public serialize(): Buffer {
    return serialize(InternalReturn.wireFormat, this);
  }

  async execute(machineState: AvmMachineState, _journal: AvmJournal): Promise<void> {
    const jumpOffset = machineState.internalCallStack.pop();
    if (jumpOffset === undefined) {
      throw new InstructionExecutionError('Internal call empty!');
    }
    machineState.pc = jumpOffset;
  }
}
