import { PublicVmExecutionContext } from "../public_vm_execution_context.js";

/**
 * Base class of a vm opcode
 */
export abstract class Opcode {
    constructor(
        /** Opcode name, used for debugging */
        public name: string,
        /** Opcode number */
        public opcode: number,
        /** The number of operands the command has */
        public numberOfOperands: number = 0,
    ){}

    abstract execute(context: PublicVmExecutionContext): void
}

