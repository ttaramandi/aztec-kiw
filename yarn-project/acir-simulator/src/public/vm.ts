import { Fr } from '@aztec/circuits.js';
import { AVMInstruction, Opcode, PC_MODIFIERS } from './opcodes.js';
import { PublicVmExecutionContext } from './public_vm_execution_context.js';
import { createDebugLogger } from '@aztec/foundation/log';

export async function vmExecute(bytecode: AVMInstruction[]/*Buffer*/,
                      context: PublicVmExecutionContext,
                      /*callback: any/*Oracle*/): Promise<Fr[]> {

  const log = createDebugLogger('aztec:simulator:public_vm_execution');
  log(`Executing public vm`);
  // TODO: check memory out of bounds
  let pc = 0; // TODO: should be u32
  while(pc < bytecode.length) {
    const instr = bytecode[pc];
    log(`Executing instruction ${Opcode[instr.opcode]}`);
    switch (instr.opcode) {
      case Opcode.CALLDATASIZE: {
        // TODO: dest should be u32
        context.fieldMem[instr.d0] = new Fr(context.calldata.length);
        break;
      }
      case Opcode.CALLDATACOPY: {
        // TODO: srcOffset and copySize should be u32s
        const copySize = context.fieldMem[instr.s1].toBigInt();
        //assert instr.s0 + copySize <= context.calldata.length;
        //assert instr.d0 + copySize <= context.fieldMem.length;
        for (let i = 0; i < copySize; i++) {
          context.fieldMem[instr.d0+i] = context.calldata[instr.s0+i];
        }
        break;
      }
      case Opcode.ADD: {
        // TODO: actual field addition
        context.fieldMem[instr.d0] = new Fr(context.fieldMem[instr.s0].toBigInt() + context.fieldMem[instr.s1].toBigInt());
        break;
      }
      case Opcode.JUMP: {
        pc = instr.s0;
        break;
      }
      case Opcode.JUMPI: {
        pc = !context.fieldMem[instr.sd].isZero() ? instr.s0 : pc + 1;
        break;
      }
      case Opcode.RETURN: {
        const retSize = context.fieldMem[instr.s1];
        //assert instr.s0 + retSize <= context.fieldMem.length;
        return context.fieldMem.slice(instr.s0, instr.s0 + Number(retSize.toBigInt()));
      }
    }
    if (!PC_MODIFIERS.includes(instr.opcode)) {
      pc++;
    }
  }
  throw new Error("Reached end of bytecode without RETURN or REVERT");
}
