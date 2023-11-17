import { createDebugLogger } from "@aztec/foundation/log";
import { log } from "console";

export enum Opcode {
  // Arithmetic
  ADD,
  SUB,
  MUL,
  DIV,
  EQ,
  // Memory
  SET,
  MOV,
  CALLDATASIZE,
  CALLDATACOPY,
  // Control flow
  JUMP,
  JUMPI,
  INTERNALCALL,
  INTERNALRETURN,
  // Storage
  SLOAD,
  SSTORE,
  // Contract call control flow
  RETURN,
  CALL,
}

export const PC_MODIFIERS = [ Opcode.JUMP, Opcode.JUMPI, Opcode.INTERNALCALL, Opcode.INTERNALRETURN ];

export class AVMInstruction {
  /** Size of an instruction */
  public static readonly BYTELEN = 1+4+4+4+4;

  constructor(
    public opcode: Opcode,
    public d0: number,
    public sd: number,
    public s0: number,
    public s1: number,
  ) {}

  //public toBuffer(offset: number = 0): Buffer {
  //  const buf = Buffer.alloc(AVMInstruction.BYTELEN);
  //  this.intoBuffer(buf, offset);
  //  return buf
  //}

  private intoBuffer(buf: Buffer, offset: number = 0) {
    buf.writeUInt8(this.opcode, offset);
    offset += 1;
    buf.writeUInt32BE(this.d0, offset);
    offset += 4;
    buf.writeUInt32BE(this.sd, offset);
    offset += 4;
    buf.writeUInt32BE(this.s0, offset);
    offset += 4;
    buf.writeUInt32BE(this.s1, offset);
    offset += 4;
  }

  public static fromBuffer(buf: Buffer, offset: number = 0): AVMInstruction {
    const log = createDebugLogger('aztec:simulator:avm_instructions');
    const opcode = buf.readUInt8(offset);
    offset += 1;
    const d0 = buf.readUInt32BE(offset); // d0
    offset += 4;
    const sd = buf.readUInt32BE(offset); // sd
    offset += 4;
    const s0 = buf.readUInt32BE(offset); // s0
    offset += 4;
    const s1 = buf.readUInt32BE(offset); // s1
    offset += 4;
    log(`Instruction from buffer: opcode:${opcode} d0:${d0} sd:${sd} s0:${s0} s1:${s1}`);
    return new AVMInstruction(opcode, d0, sd, s0, s1);
  }

  public static fromBytecodeBuffer(buf: Buffer): AVMInstruction[] {
    const log = createDebugLogger('aztec:simulator:avm_instructions');
    const numInstructions = buf.length / AVMInstruction.BYTELEN;
    const instructions: AVMInstruction[] = [];
    for (let pc = 0; pc < numInstructions; pc++) {
      const instr = AVMInstruction.fromBuffer(buf, pc * AVMInstruction.BYTELEN)
      log(`Decoded instruction (pc:${pc}): ${Opcode[instr.opcode]}`);
      instructions.push(instr);
    }
    return instructions;
  }

  public static toBytecode(instructions: AVMInstruction[]): Buffer {
    const buf = Buffer.alloc(AVMInstruction.BYTELEN * instructions.length);
    for (let i = 0; i < instructions.length; i++) {
      instructions[i].intoBuffer(buf, i * AVMInstruction.BYTELEN);
    }
    return buf;
  }
}
