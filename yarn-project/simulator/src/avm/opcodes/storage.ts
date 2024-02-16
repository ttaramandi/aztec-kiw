import { Fr } from '@aztec/foundation/fields';

import type { AvmContext } from '../avm_context.js';
import { Field } from '../avm_memory_types.js';
import { InstructionExecutionError } from '../errors.js';
import { Opcode, OperandType } from '../serialization/instruction_serialization.js';
import { Instruction } from './instruction.js';

abstract class BaseStorageInstruction extends Instruction {
  // Informs (de)serialization. See Instruction.deserialize.
  public static readonly wireFormat: OperandType[] = [
    OperandType.UINT8,
    OperandType.UINT8,
    OperandType.UINT32,
    OperandType.UINT32,
  ];

  constructor(protected indirect: number, protected aOffset: number, protected bOffset: number) {
    super();
  }
}

export class SStore extends /* temporarily disabled: BaseStorageInstruction*/ Instruction {
  static readonly type: string = 'SSTORE';
  static readonly opcode = Opcode.SSTORE;

  public static readonly wireFormat: OperandType[] = [
    OperandType.UINT8,
    OperandType.UINT8,
    OperandType.UINT32,
    OperandType.UINT32,
    OperandType.UINT32,
  ];

  constructor(private _indirect: number, private srcOffset: number, private /*temporary*/srcSize: number, private  slotOffset: number) {
    super();
  }

  async execute(context: AvmContext): Promise<void> {
    if (context.environment.isStaticCall) {
      throw new StaticCallStorageAlterError();
    }

    const slot = context.machineState.memory.get(this.slotOffset).toFr();
    const data = context.machineState.memory.getSlice(this.srcOffset, this.srcSize).map((field) => field.toFr());

    context.worldState.writeStorage(
      context.environment.storageAddress,
      slot,
      data,
    );

    context.machineState.incrementPc();
  }
}

export class SLoad extends BaseStorageInstruction {
  static readonly type: string = 'SLOAD';
  static readonly opcode = Opcode.SLOAD;

  constructor(indirect: number, slotOffset: number, dstOffset: number) {
    super(indirect, slotOffset, dstOffset);
  }

  async execute(context: AvmContext): Promise<void> {
    const slot = context.machineState.memory.get(this.aOffset);

    const data: Fr = await context.worldState.readStorage(context.environment.storageAddress, new Fr(slot.toBigInt()));

    context.machineState.memory.set(this.bOffset, new Field(data));

    context.machineState.incrementPc();
  }
}

/**
 * Error is thrown when a static call attempts to alter storage
 */
export class StaticCallStorageAlterError extends InstructionExecutionError {
  constructor() {
    super('Static calls cannot alter storage');
    this.name = 'StaticCallStorageAlterError';
  }
}
