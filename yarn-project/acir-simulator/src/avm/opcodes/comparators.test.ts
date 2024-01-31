import { MockProxy, mock } from 'jest-mock-extended';

import { AvmMachineState } from '../avm_machine_state.js';
import { Field, TypeTag, Uint16, Uint32 } from '../avm_memory_types.js';
import { initExecutionEnvironment } from '../fixtures/index.js';
import { AvmJournal } from '../journal/journal.js';
import { Eq, Lt, Lte } from './comparators.js';
import { InstructionExecutionError } from './instruction.js';

describe('Comparators', () => {
  let machineState: AvmMachineState;
  let journal: MockProxy<AvmJournal>;

  beforeEach(async () => {
    machineState = new AvmMachineState(initExecutionEnvironment());
    journal = mock<AvmJournal>();
  });

  describe('Eq', () => {
    it('Should deserialize correctly', () => {
      const buf = Buffer.from([
        // opcode
        Eq.opcode,
        // indirect
        0x01,
        // inTag
        TypeTag.UINT64,
        // aOffset
        0x12,
        0x34,
        0x56,
        0x78,
        // bOffset
        0x23,
        0x45,
        0x67,
        0x89,
        // dstOffset
        0x34,
        0x56,
        0x78,
        0x9a,
      ]);

      const inst: Eq = Eq.deserialize(buf);
      expect(inst).toEqual(
        new Eq(
          /*indirect=*/ 0x01,
          /*inTag=*/ TypeTag.UINT64,
          /*aOffset=*/ 0x12345678,
          /*bOffset=*/ 0x23456789,
          /*dstOffset=*/ 0x3456789a,
        ),
      );
    });

    it('Should serialize correctly', () => {
      const inst = new Eq(
        /*indirect=*/ 0x01,
        /*inTag=*/ TypeTag.UINT64,
        /*aOffset=*/ 0x12345678,
        /*bOffset=*/ 0x23456789,
        /*dstOffset=*/ 0x3456789a,
      );

      const expected = Buffer.from([
        // opcode
        Eq.opcode,
        // indirect
        0x01,
        // inTag
        TypeTag.UINT64,
        // aOffset
        0x12,
        0x34,
        0x56,
        0x78,
        // bOffset
        0x23,
        0x45,
        0x67,
        0x89,
        // dstOffset
        0x34,
        0x56,
        0x78,
        0x9a,
      ]);
      expect(inst.serialize()).toEqual(expected);
    });

    it('Works on integral types', async () => {
      machineState.memory.setSlice(0, [new Uint32(1), new Uint32(2), new Uint32(3), new Uint32(1)]);

      [
        new Eq(/*indirect=*/ 0, TypeTag.UINT32, /*aOffset=*/ 0, /*bOffset=*/ 1, /*dstOffset=*/ 10),
        new Eq(/*indirect=*/ 0, TypeTag.UINT32, /*aOffset=*/ 0, /*bOffset=*/ 2, /*dstOffset=*/ 11),
        new Eq(/*indirect=*/ 0, TypeTag.UINT32, /*aOffset=*/ 0, /*bOffset=*/ 3, /*dstOffset=*/ 12),
      ].forEach(i => i.execute(machineState, journal));

      const actual = machineState.memory.getSlice(/*offset=*/ 10, /*size=*/ 4);
      expect(actual).toEqual([new Uint32(0), new Uint32(0), new Uint32(1)]);
    });

    it('Works on field elements', async () => {
      machineState.memory.setSlice(0, [new Field(1), new Field(2), new Field(3), new Field(1)]);

      [
        new Eq(/*indirect=*/ 0, TypeTag.FIELD, /*aOffset=*/ 0, /*bOffset=*/ 1, /*dstOffset=*/ 10),
        new Eq(/*indirect=*/ 0, TypeTag.FIELD, /*aOffset=*/ 0, /*bOffset=*/ 2, /*dstOffset=*/ 11),
        new Eq(/*indirect=*/ 0, TypeTag.FIELD, /*aOffset=*/ 0, /*bOffset=*/ 3, /*dstOffset=*/ 12),
      ].forEach(i => i.execute(machineState, journal));

      const actual = machineState.memory.getSlice(/*offset=*/ 10, /*size=*/ 4);
      expect(actual).toEqual([new Field(0), new Field(0), new Field(1)]);
    });

    it('InTag is checked', async () => {
      machineState.memory.setSlice(0, [new Field(1), new Uint32(2), new Uint16(3)]);

      const ops = [
        new Eq(/*indirect=*/ 0, TypeTag.FIELD, /*aOffset=*/ 0, /*bOffset=*/ 1, /*dstOffset=*/ 10),
        new Eq(/*indirect=*/ 0, TypeTag.UINT32, /*aOffset=*/ 0, /*bOffset=*/ 2, /*dstOffset=*/ 10),
        new Eq(/*indirect=*/ 0, TypeTag.UINT16, /*aOffset=*/ 1, /*bOffset=*/ 2, /*dstOffset=*/ 10),
        new Eq(/*indirect=*/ 0, TypeTag.UINT16, /*aOffset=*/ 1, /*bOffset=*/ 1, /*dstOffset=*/ 10),
      ];

      for (const o of ops) {
        await expect(() => o.execute(machineState, journal)).rejects.toThrow(InstructionExecutionError);
      }
    });
  });

  describe('Lt', () => {
    it('Should deserialize correctly', () => {
      const buf = Buffer.from([
        // opcode
        Lt.opcode,
        // indirect
        0x01,
        // inTag
        TypeTag.UINT64,
        // aOffset
        0x12,
        0x34,
        0x56,
        0x78,
        // bOffset
        0x23,
        0x45,
        0x67,
        0x89,
        // dstOffset
        0x34,
        0x56,
        0x78,
        0x9a,
      ]);

      const inst: Lt = Lt.deserialize(buf);
      expect(inst).toEqual(
        new Lt(
          /*indirect=*/ 0x01,
          /*inTag=*/ TypeTag.UINT64,
          /*aOffset=*/ 0x12345678,
          /*bOffset=*/ 0x23456789,
          /*dstOffset=*/ 0x3456789a,
        ),
      );
    });

    it('Should serialize correctly', () => {
      const inst = new Lt(
        /*indirect=*/ 0x01,
        /*inTag=*/ TypeTag.UINT64,
        /*aOffset=*/ 0x12345678,
        /*bOffset=*/ 0x23456789,
        /*dstOffset=*/ 0x3456789a,
      );

      const expected = Buffer.from([
        // opcode
        Lt.opcode,
        // indirect
        0x01,
        // inTag
        TypeTag.UINT64,
        // aOffset
        0x12,
        0x34,
        0x56,
        0x78,
        // bOffset
        0x23,
        0x45,
        0x67,
        0x89,
        // dstOffset
        0x34,
        0x56,
        0x78,
        0x9a,
      ]);
      expect(inst.serialize()).toEqual(expected);
    });

    it('Works on integral types', async () => {
      machineState.memory.setSlice(0, [new Uint32(1), new Uint32(2), new Uint32(0)]);

      [
        new Lt(/*indirect=*/ 0, TypeTag.UINT32, /*aOffset=*/ 0, /*bOffset=*/ 0, /*dstOffset=*/ 10),
        new Lt(/*indirect=*/ 0, TypeTag.UINT32, /*aOffset=*/ 0, /*bOffset=*/ 1, /*dstOffset=*/ 11),
        new Lt(/*indirect=*/ 0, TypeTag.UINT32, /*aOffset=*/ 0, /*bOffset=*/ 2, /*dstOffset=*/ 12),
      ].forEach(i => i.execute(machineState, journal));

      const actual = machineState.memory.getSlice(/*offset=*/ 10, /*size=*/ 4);
      expect(actual).toEqual([new Uint32(0), new Uint32(1), new Uint32(0)]);
    });

    it('Works on field elements', async () => {
      machineState.memory.setSlice(0, [new Field(1), new Field(2), new Field(0)]);

      [
        new Lt(/*indirect=*/ 0, TypeTag.FIELD, /*aOffset=*/ 0, /*bOffset=*/ 0, /*dstOffset=*/ 10),
        new Lt(/*indirect=*/ 0, TypeTag.FIELD, /*aOffset=*/ 0, /*bOffset=*/ 1, /*dstOffset=*/ 11),
        new Lt(/*indirect=*/ 0, TypeTag.FIELD, /*aOffset=*/ 0, /*bOffset=*/ 2, /*dstOffset=*/ 12),
      ].forEach(i => i.execute(machineState, journal));

      const actual = machineState.memory.getSlice(/*offset=*/ 10, /*size=*/ 4);
      expect(actual).toEqual([new Field(0), new Field(1), new Field(0)]);
    });

    it('InTag is checked', async () => {
      machineState.memory.setSlice(0, [new Field(1), new Uint32(2), new Uint16(3)]);

      const ops = [
        new Lt(/*indirect=*/ 0, TypeTag.FIELD, /*aOffset=*/ 0, /*bOffset=*/ 1, /*dstOffset=*/ 10),
        new Lt(/*indirect=*/ 0, TypeTag.UINT32, /*aOffset=*/ 0, /*bOffset=*/ 2, /*dstOffset=*/ 10),
        new Lt(/*indirect=*/ 0, TypeTag.UINT16, /*aOffset=*/ 1, /*bOffset=*/ 2, /*dstOffset=*/ 10),
        new Lt(/*indirect=*/ 0, TypeTag.UINT16, /*aOffset=*/ 1, /*bOffset=*/ 1, /*dstOffset=*/ 10),
      ];

      for (const o of ops) {
        await expect(() => o.execute(machineState, journal)).rejects.toThrow(InstructionExecutionError);
      }
    });
  });

  describe('Lte', () => {
    it('Should deserialize correctly', () => {
      const buf = Buffer.from([
        // opcode
        Lte.opcode,
        // indirect
        0x01,
        // inTag
        TypeTag.UINT64,
        // aOffset
        0x12,
        0x34,
        0x56,
        0x78,
        // bOffset
        0x23,
        0x45,
        0x67,
        0x89,
        // dstOffset
        0x34,
        0x56,
        0x78,
        0x9a,
      ]);

      const inst: Lte = Lte.deserialize(buf);
      expect(inst).toEqual(
        new Lte(
          /*indirect=*/ 0x01,
          /*inTag=*/ TypeTag.UINT64,
          /*aOffset=*/ 0x12345678,
          /*bOffset=*/ 0x23456789,
          /*dstOffset=*/ 0x3456789a,
        ),
      );
    });

    it('Should serialize correctly', () => {
      const inst = new Lte(
        /*indirect=*/ 0x01,
        /*inTag=*/ TypeTag.UINT64,
        /*aOffset=*/ 0x12345678,
        /*bOffset=*/ 0x23456789,
        /*dstOffset=*/ 0x3456789a,
      );

      const expected = Buffer.from([
        // opcode
        Lte.opcode,
        // indirect
        0x01,
        // inTag
        TypeTag.UINT64,
        // aOffset
        0x12,
        0x34,
        0x56,
        0x78,
        // bOffset
        0x23,
        0x45,
        0x67,
        0x89,
        // dstOffset
        0x34,
        0x56,
        0x78,
        0x9a,
      ]);
      expect(inst.serialize()).toEqual(expected);
    });

    it('Works on integral types', async () => {
      machineState.memory.setSlice(0, [new Uint32(1), new Uint32(2), new Uint32(0)]);

      [
        new Lte(/*indirect=*/ 0, TypeTag.UINT32, /*aOffset=*/ 0, /*bOffset=*/ 0, /*dstOffset=*/ 10),
        new Lte(/*indirect=*/ 0, TypeTag.UINT32, /*aOffset=*/ 0, /*bOffset=*/ 1, /*dstOffset=*/ 11),
        new Lte(/*indirect=*/ 0, TypeTag.UINT32, /*aOffset=*/ 0, /*bOffset=*/ 2, /*dstOffset=*/ 12),
      ].forEach(i => i.execute(machineState, journal));

      const actual = machineState.memory.getSlice(/*offset=*/ 10, /*size=*/ 4);
      expect(actual).toEqual([new Uint32(1), new Uint32(1), new Uint32(0)]);
    });

    it('Works on field elements', async () => {
      machineState.memory.setSlice(0, [new Field(1), new Field(2), new Field(0)]);

      [
        new Lte(/*indirect=*/ 0, TypeTag.FIELD, /*aOffset=*/ 0, /*bOffset=*/ 0, /*dstOffset=*/ 10),
        new Lte(/*indirect=*/ 0, TypeTag.FIELD, /*aOffset=*/ 0, /*bOffset=*/ 1, /*dstOffset=*/ 11),
        new Lte(/*indirect=*/ 0, TypeTag.FIELD, /*aOffset=*/ 0, /*bOffset=*/ 2, /*dstOffset=*/ 12),
      ].forEach(i => i.execute(machineState, journal));

      const actual = machineState.memory.getSlice(/*offset=*/ 10, /*size=*/ 4);
      expect(actual).toEqual([new Field(1), new Field(1), new Field(0)]);
    });

    it('InTag is checked', async () => {
      machineState.memory.setSlice(0, [new Field(1), new Uint32(2), new Uint16(3)]);

      const ops = [
        new Lte(/*indirect=*/ 0, TypeTag.FIELD, /*aOffset=*/ 0, /*bOffset=*/ 1, /*dstOffset=*/ 10),
        new Lte(/*indirect=*/ 0, TypeTag.UINT32, /*aOffset=*/ 0, /*bOffset=*/ 2, /*dstOffset=*/ 10),
        new Lte(/*indirect=*/ 0, TypeTag.UINT16, /*aOffset=*/ 1, /*bOffset=*/ 2, /*dstOffset=*/ 10),
        new Lte(/*indirect=*/ 0, TypeTag.UINT16, /*aOffset=*/ 1, /*bOffset=*/ 1, /*dstOffset=*/ 10),
      ];

      for (const o of ops) {
        await expect(() => o.execute(machineState, journal)).rejects.toThrow(InstructionExecutionError);
      }
    });
  });
});
