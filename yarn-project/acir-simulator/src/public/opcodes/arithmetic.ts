import { Fr } from '@aztec/foundation/fields';
import {PublicVmExecutionContext, MemoryType } from '../public_vm_execution_context.js';
import { Opcode } from './opcode.js';
import assert from 'node:assert';


/**
 * Add two field elements and store the result in a third.
 */
export class Add extends Opcode {
    constructor(private operands: number[]) {
        super('add', 0x01, 3);
        assert(this.numberOfOperands = operands.length);
    }

     execute(context: PublicVmExecutionContext) {
      const { memory } = context;
      const [s0, s1, d0] = this.operands;
      // TODO: check if by ref 
      const fieldMem = memory[MemoryType.FIELD];

      const s0Val = fieldMem[s0].toBigInt();
      const s1Val = fieldMem[s1].toBigInt();
      fieldMem[d0] = new Fr(s0Val + s1Val);

      context.pc += 1;
  }
}

/**
 * Subtract two field elements and store the result in a third.
 */
export class Sub extends Opcode {
    constructor(private operands: number[]) {
        super('sub', 0x02, 3);
        assert(this.numberOfOperands = operands.length);
    }

     execute(context: PublicVmExecutionContext) {
      const { memory} = context;
      const [s0, s1, d0] = this.operands;
      const fieldMem = memory[MemoryType.FIELD];

      
      const s0Val = fieldMem[s0].toBigInt();
      const s1Val = fieldMem[s1].toBigInt();
      fieldMem[d0] = new Fr(s0Val + s1Val);

      context.pc += 1;
    }
  }

/**
 * Multiply two field elements and store the result in a third.
 */
export class Mul extends Opcode {
    constructor(private operands: number[]) {
        super('mul', 0x03, 3);
        assert(this.numberOfOperands = operands.length);
    }

     execute(context: PublicVmExecutionContext) {
      const { memory } = context;
      const [s0, s1, d0] = this.operands;
      const fieldMem = memory[MemoryType.FIELD];
      
      const s0Val = fieldMem[s0].toBigInt();
      const s1Val = fieldMem[s1].toBigInt();
      fieldMem[d0] = new Fr(s0Val * s1Val);

      context.pc += 1;
    }
  }

/**
 * Divide two field elements and store the result in a third.
 */
export class Div extends Opcode {
    constructor(private operands: number[]) {
        super('div', 0x04, 3);
        assert(this.numberOfOperands = operands.length);
    }

     execute(context: PublicVmExecutionContext) {
      const { memory } = context;
      const [s0, s1, d0] = this.operands;
      const fieldMem = memory[MemoryType.FIELD];
      
      const s0Val = fieldMem[s0].toBigInt();
      const s1Val = fieldMem[s1].toBigInt();
      fieldMem[d0] = new Fr(s0Val / s1Val);

      context.pc += 1;
    }
  }