import assert from "node:assert";
import {PublicVmExecutionContext} from '../public_vm_execution_context.js';
import { Opcode } from './opcode.js';




/**
 * Jump to a given location.
 */
export class Jump extends Opcode {
    constructor(private operands: number[]) {
        super('add', 0x01, 1);
        assert(this.numberOfOperands = operands.length);
    }

     execute(context: PublicVmExecutionContext) {
      const [s0] = this.operands;
      context.pc = s0;
  }
}