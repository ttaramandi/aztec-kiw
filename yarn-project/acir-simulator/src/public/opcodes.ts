export enum Opcode {
  CALLDATASIZE,
  CALLDATACOPY,
  ADD,
  RETURN,
  JUMP,
  JUMPI,
}

export const PC_MODIFIERS = [ Opcode.JUMP, Opcode.JUMPI ];

export class AVMInstruction {
  constructor(
    public opcode: Opcode,
    public d0: number,
    public sd: number,
    public s0: number,
    public s1: number,
  ) {}
}
