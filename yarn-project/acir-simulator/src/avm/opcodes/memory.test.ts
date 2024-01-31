import { Fr } from '@aztec/foundation/fields';

import { MockProxy, mock } from 'jest-mock-extended';

import { AvmMachineState } from '../avm_machine_state.js';
import { Field, TypeTag, Uint8, Uint16, Uint32, Uint64, Uint128 } from '../avm_memory_types.js';
import { initExecutionEnvironment } from '../fixtures/index.js';
import { AvmJournal } from '../journal/journal.js';
import { CMov, CalldataCopy, Cast, Mov, Set } from './memory.js';

describe('Memory instructions', () => {
  let machineState: AvmMachineState;
  let journal: MockProxy<AvmJournal>;

  beforeEach(async () => {
    machineState = new AvmMachineState(initExecutionEnvironment());
    journal = mock<AvmJournal>();
  });

  describe('SET', () => {
    it('Should deserialize correctly', () => {
      const buf = Buffer.from([
        // opcode
        Set.opcode,
        // indirect
        0x01,
        // inTag
        TypeTag.FIELD,
        // const (will be 128 bit)
        0x12,
        0x34,
        0x56,
        0x78,
        0x12,
        0x34,
        0x56,
        0x78,
        0x12,
        0x34,
        0x56,
        0x78,
        0x12,
        0x34,
        0x56,
        0x78,
        // dstOffset
        0x34,
        0x56,
        0x78,
        0x9a,
      ]);

      const inst = Set.deserialize(buf);
      expect(inst).toEqual(
        new Set(
          /*indirect=*/ 0x01,
          /*inTag=*/ TypeTag.FIELD,
          /*value=*/ 0x12345678123456781234567812345678n,
          /*dstOffset=*/ 0x3456789a,
        ),
      );
    });

    it('Should serialize correctly', () => {
      const inst = new Set(
        /*indirect=*/ 0x01,
        /*inTag=*/ TypeTag.FIELD,
        /*value=*/ 0x12345678123456781234567812345678n,
        /*dstOffset=*/ 0x3456789a,
      );

      const expected = Buffer.from([
        // opcode
        Set.opcode,
        // indirect
        0x01,
        // inTag
        TypeTag.FIELD,
        // const (will be 128 bit)
        0x12,
        0x34,
        0x56,
        0x78,
        0x12,
        0x34,
        0x56,
        0x78,
        0x12,
        0x34,
        0x56,
        0x78,
        0x12,
        0x34,
        0x56,
        0x78,
        // dstOffset
        0x34,
        0x56,
        0x78,
        0x9a,
      ]);
      expect(inst.serialize()).toEqual(expected);
    });

    it('should correctly set value and tag (uninitialized)', async () => {
      await new Set(/*indirect=*/ 0, /*inTag=*/ TypeTag.UINT16, /*value=*/ 1234n, /*offset=*/ 1).execute(
        machineState,
        journal,
      );

      const actual = machineState.memory.get(1);
      const tag = machineState.memory.getTag(1);

      expect(actual).toEqual(new Uint16(1234n));
      expect(tag).toEqual(TypeTag.UINT16);
    });

    it('should correctly set value and tag (overwriting)', async () => {
      machineState.memory.set(1, new Field(27));

      await new Set(/*indirect=*/ 0, /*inTag=*/ TypeTag.UINT32, /*value=*/ 1234n, /*offset=*/ 1).execute(
        machineState,
        journal,
      );

      const actual = machineState.memory.get(1);
      const tag = machineState.memory.getTag(1);

      expect(actual).toEqual(new Uint32(1234n));
      expect(tag).toEqual(TypeTag.UINT32);
    });
  });

  describe('CAST', () => {
    it('Should deserialize correctly', () => {
      const buf = Buffer.from([
        // opcode
        Cast.opcode,
        // indirect
        0x01,
        // dstTag
        TypeTag.FIELD,
        // aOffset
        0x12,
        0x34,
        0x56,
        0x78,
        // dstOffset
        0x34,
        0x56,
        0x78,
        0x9a,
      ]);

      const inst = Cast.deserialize(buf);
      expect(inst).toEqual(
        new Cast(/*indirect=*/ 0x01, /*dstTag=*/ TypeTag.FIELD, /*aOffset=*/ 0x12345678, /*dstOffset=*/ 0x3456789a),
      );
    });

    it('Should serialize correctly', () => {
      const inst = new Cast(
        /*indirect=*/ 0x01,
        /*dstTag=*/ TypeTag.FIELD,
        /*aOffset=*/ 0x12345678,
        /*dstOffset=*/ 0x3456789a,
      );

      const expected = Buffer.from([
        // opcode
        Cast.opcode,
        // indirect
        0x01,
        // dstTag
        TypeTag.FIELD,
        // aOffset
        0x12,
        0x34,
        0x56,
        0x78,
        // dstOffset
        0x34,
        0x56,
        0x78,
        0x9a,
      ]);
      expect(inst.serialize()).toEqual(expected);
    });

    it('Should upcast between integral types', () => {
      machineState.memory.set(0, new Uint8(20n));
      machineState.memory.set(1, new Uint16(65000n));
      machineState.memory.set(2, new Uint32(1n << 30n));
      machineState.memory.set(3, new Uint64(1n << 50n));
      machineState.memory.set(4, new Uint128(1n << 100n));

      [
        new Cast(/*indirect=*/ 0, /*dstTag=*/ TypeTag.UINT16, /*aOffset=*/ 0, /*dstOffset=*/ 10),
        new Cast(/*indirect=*/ 0, /*dstTag=*/ TypeTag.UINT32, /*aOffset=*/ 1, /*dstOffset=*/ 11),
        new Cast(/*indirect=*/ 0, /*dstTag=*/ TypeTag.UINT64, /*aOffset=*/ 2, /*dstOffset=*/ 12),
        new Cast(/*indirect=*/ 0, /*dstTag=*/ TypeTag.UINT128, /*aOffset=*/ 3, /*dstOffset=*/ 13),
        new Cast(/*indirect=*/ 0, /*dstTag=*/ TypeTag.UINT128, /*aOffset=*/ 4, /*dstOffset=*/ 14),
      ].forEach(i => i.execute(machineState, journal));

      const actual = machineState.memory.getSlice(/*offset=*/ 10, /*size=*/ 5);
      expect(actual).toEqual([
        new Uint16(20n),
        new Uint32(65000n),
        new Uint64(1n << 30n),
        new Uint128(1n << 50n),
        new Uint128(1n << 100n),
      ]);
      const tags = machineState.memory.getSliceTags(/*offset=*/ 10, /*size=*/ 5);
      expect(tags).toEqual([TypeTag.UINT16, TypeTag.UINT32, TypeTag.UINT64, TypeTag.UINT128, TypeTag.UINT128]);
    });

    it('Should downcast (truncating) between integral types', () => {
      machineState.memory.set(0, new Uint8(20n));
      machineState.memory.set(1, new Uint16(65000n));
      machineState.memory.set(2, new Uint32((1n << 30n) - 1n));
      machineState.memory.set(3, new Uint64((1n << 50n) - 1n));
      machineState.memory.set(4, new Uint128((1n << 100n) - 1n));

      [
        new Cast(/*indirect=*/ 0, /*dstTag=*/ TypeTag.UINT8, /*aOffset=*/ 0, /*dstOffset=*/ 10),
        new Cast(/*indirect=*/ 0, /*dstTag=*/ TypeTag.UINT8, /*aOffset=*/ 1, /*dstOffset=*/ 11),
        new Cast(/*indirect=*/ 0, /*dstTag=*/ TypeTag.UINT16, /*aOffset=*/ 2, /*dstOffset=*/ 12),
        new Cast(/*indirect=*/ 0, /*dstTag=*/ TypeTag.UINT32, /*aOffset=*/ 3, /*dstOffset=*/ 13),
        new Cast(/*indirect=*/ 0, /*dstTag=*/ TypeTag.UINT64, /*aOffset=*/ 4, /*dstOffset=*/ 14),
      ].forEach(i => i.execute(machineState, journal));

      const actual = machineState.memory.getSlice(/*offset=*/ 10, /*size=*/ 5);
      expect(actual).toEqual([
        new Uint8(20n),
        new Uint8(232),
        new Uint16((1n << 16n) - 1n),
        new Uint32((1n << 32n) - 1n),
        new Uint64((1n << 64n) - 1n),
      ]);
      const tags = machineState.memory.getSliceTags(/*offset=*/ 10, /*size=*/ 5);
      expect(tags).toEqual([TypeTag.UINT8, TypeTag.UINT8, TypeTag.UINT16, TypeTag.UINT32, TypeTag.UINT64]);
    });

    it('Should upcast from integral types to field', () => {
      machineState.memory.set(0, new Uint8(20n));
      machineState.memory.set(1, new Uint16(65000n));
      machineState.memory.set(2, new Uint32(1n << 30n));
      machineState.memory.set(3, new Uint64(1n << 50n));
      machineState.memory.set(4, new Uint128(1n << 100n));

      [
        new Cast(/*indirect=*/ 0, /*dstTag=*/ TypeTag.FIELD, /*aOffset=*/ 0, /*dstOffset=*/ 10),
        new Cast(/*indirect=*/ 0, /*dstTag=*/ TypeTag.FIELD, /*aOffset=*/ 1, /*dstOffset=*/ 11),
        new Cast(/*indirect=*/ 0, /*dstTag=*/ TypeTag.FIELD, /*aOffset=*/ 2, /*dstOffset=*/ 12),
        new Cast(/*indirect=*/ 0, /*dstTag=*/ TypeTag.FIELD, /*aOffset=*/ 3, /*dstOffset=*/ 13),
        new Cast(/*indirect=*/ 0, /*dstTag=*/ TypeTag.FIELD, /*aOffset=*/ 4, /*dstOffset=*/ 14),
      ].forEach(i => i.execute(machineState, journal));

      const actual = machineState.memory.getSlice(/*offset=*/ 10, /*size=*/ 5);
      expect(actual).toEqual([
        new Field(20n),
        new Field(65000n),
        new Field(1n << 30n),
        new Field(1n << 50n),
        new Field(1n << 100n),
      ]);
      const tags = machineState.memory.getSliceTags(/*offset=*/ 10, /*size=*/ 5);
      expect(tags).toEqual([TypeTag.FIELD, TypeTag.FIELD, TypeTag.FIELD, TypeTag.FIELD, TypeTag.FIELD]);
    });

    it('Should downcast (truncating) from field to integral types', () => {
      machineState.memory.set(0, new Field((1n << 200n) - 1n));
      machineState.memory.set(1, new Field((1n << 200n) - 1n));
      machineState.memory.set(2, new Field((1n << 200n) - 1n));
      machineState.memory.set(3, new Field((1n << 200n) - 1n));
      machineState.memory.set(4, new Field((1n << 200n) - 1n));

      [
        new Cast(/*indirect=*/ 0, /*dstTag=*/ TypeTag.UINT8, /*aOffset=*/ 0, /*dstOffset=*/ 10),
        new Cast(/*indirect=*/ 0, /*dstTag=*/ TypeTag.UINT16, /*aOffset=*/ 1, /*dstOffset=*/ 11),
        new Cast(/*indirect=*/ 0, /*dstTag=*/ TypeTag.UINT32, /*aOffset=*/ 2, /*dstOffset=*/ 12),
        new Cast(/*indirect=*/ 0, /*dstTag=*/ TypeTag.UINT64, /*aOffset=*/ 3, /*dstOffset=*/ 13),
        new Cast(/*indirect=*/ 0, /*dstTag=*/ TypeTag.UINT128, /*aOffset=*/ 4, /*dstOffset=*/ 14),
      ].forEach(i => i.execute(machineState, journal));

      const actual = machineState.memory.getSlice(/*offset=*/ 10, /*size=*/ 5);
      expect(actual).toEqual([
        new Uint8((1n << 8n) - 1n),
        new Uint16((1n << 16n) - 1n),
        new Uint32((1n << 32n) - 1n),
        new Uint64((1n << 64n) - 1n),
        new Uint128((1n << 128n) - 1n),
      ]);
      const tags = machineState.memory.getSliceTags(/*offset=*/ 10, /*size=*/ 5);
      expect(tags).toEqual([TypeTag.UINT8, TypeTag.UINT16, TypeTag.UINT32, TypeTag.UINT64, TypeTag.UINT128]);
    });

    it('Should cast between field elements', async () => {
      machineState.memory.set(0, new Field(12345678n));

      await new Cast(/*indirect=*/ 0, /*dstTag=*/ TypeTag.FIELD, /*aOffset=*/ 0, /*dstOffset=*/ 1).execute(
        machineState,
        journal,
      );

      const actual = machineState.memory.get(1);
      expect(actual).toEqual(new Field(12345678n));
      const tags = machineState.memory.getTag(1);
      expect(tags).toEqual(TypeTag.FIELD);
    });
  });

  describe('MOV', () => {
    it('Should deserialize correctly', () => {
      const buf = Buffer.from([
        // opcode
        Mov.opcode,
        // indirect
        0x01,
        // srcOffset
        0x12,
        0x34,
        0x56,
        0x78,
        // dstOffset
        0x34,
        0x56,
        0x78,
        0x9a,
      ]);

      const inst = Mov.deserialize(buf);
      expect(inst).toEqual(new Mov(/*indirect=*/ 0x01, /*srcOffset=*/ 0x12345678, /*dstOffset=*/ 0x3456789a));
    });

    it('Should serialize correctly', () => {
      const inst = new Mov(/*indirect=*/ 0x01, /*srcOffset=*/ 0x12345678, /*dstOffset=*/ 0x3456789a);

      const expected = Buffer.from([
        // opcode
        Mov.opcode,
        // indirect
        0x01,
        // srcOffset
        0x12,
        0x34,
        0x56,
        0x78,
        // dstOffset
        0x34,
        0x56,
        0x78,
        0x9a,
      ]);
      expect(inst.serialize()).toEqual(expected);
    });

    it('Should move integrals on different memory cells', async () => {
      machineState.memory.set(0, new Uint16(27));
      await new Mov(/*indirect=*/ 0, /*srcOffset=*/ 0, /*dstOffset=*/ 1).execute(machineState, journal);

      const actual = machineState.memory.get(1);
      const tag = machineState.memory.getTag(1);

      expect(actual).toEqual(new Uint16(27n));
      expect(tag).toEqual(TypeTag.UINT16);
    });

    it('Should move field elements on different memory cells', async () => {
      machineState.memory.set(0, new Field(27));
      await new Mov(/*indirect=*/ 0, /*srcOffset=*/ 0, /*dstOffset=*/ 1).execute(machineState, journal);

      const actual = machineState.memory.get(1);
      const tag = machineState.memory.getTag(1);

      expect(actual).toEqual(new Field(27n));
      expect(tag).toEqual(TypeTag.FIELD);
    });
  });

  describe('CMOV', () => {
    it('Should deserialize correctly', () => {
      const buf = Buffer.from([
        // opcode
        CMov.opcode,
        // indirect
        0x01,
        // aOffset
        0x12,
        0x34,
        0x56,
        0x78,
        // bOffset
        0xa2,
        0x34,
        0x56,
        0x78,
        // condOffset
        0xb2,
        0x34,
        0x56,
        0x78,
        // dstOffset
        0x34,
        0x56,
        0x78,
        0x9a,
      ]);

      const inst = CMov.deserialize(buf);
      expect(inst).toEqual(
        new CMov(
          /*indirect=*/ 0x01,
          /*aOffset=*/ 0x12345678,
          /*bOffset=*/ 0xa2345678,
          /*condOffset=*/ 0xb2345678,
          /*dstOffset=*/ 0x3456789a,
        ),
      );
    });

    it('Should serialize correctly', () => {
      const inst = new CMov(
        /*indirect=*/ 0x01,
        /*aOffset=*/ 0x12345678,
        /*bOffset=*/ 0xa2345678,
        /*condOffset=*/ 0xb2345678,
        /*dstOffset=*/ 0x3456789a,
      );

      const expected = Buffer.from([
        // opcode
        CMov.opcode,
        // indirect
        0x01,
        // aOffset
        0x12,
        0x34,
        0x56,
        0x78,
        // bOffset
        0xa2,
        0x34,
        0x56,
        0x78,
        // condOffset
        0xb2,
        0x34,
        0x56,
        0x78,
        // dstOffset
        0x34,
        0x56,
        0x78,
        0x9a,
      ]);
      expect(inst.serialize()).toEqual(expected);
    });

    it('Should move A if COND is true, on different memory cells (integral condition)', async () => {
      machineState.memory.set(0, new Uint32(123)); // A
      machineState.memory.set(1, new Uint16(456)); // B
      machineState.memory.set(2, new Uint8(2)); // Condition

      await new CMov(/*indirect=*/ 0, /*aOffset=*/ 0, /*bOffset=*/ 1, /*condOffset=*/ 2, /*dstOffset=*/ 3).execute(
        machineState,
        journal,
      );

      const actual = machineState.memory.get(3);
      const tag = machineState.memory.getTag(3);
      expect(actual).toEqual(new Uint32(123));
      expect(tag).toEqual(TypeTag.UINT32);
    });

    it('Should move B if COND is false, on different memory cells (integral condition)', async () => {
      machineState.memory.set(0, new Uint32(123)); // A
      machineState.memory.set(1, new Uint16(456)); // B
      machineState.memory.set(2, new Uint8(0)); // Condition

      await new CMov(/*indirect=*/ 0, /*aOffset=*/ 0, /*bOffset=*/ 1, /*condOffset=*/ 2, /*dstOffset=*/ 3).execute(
        machineState,
        journal,
      );

      const actual = machineState.memory.get(3);
      const tag = machineState.memory.getTag(3);
      expect(actual).toEqual(new Uint16(456));
      expect(tag).toEqual(TypeTag.UINT16);
    });

    it('Should move A if COND is true, on different memory cells (field condition)', async () => {
      machineState.memory.set(0, new Uint32(123)); // A
      machineState.memory.set(1, new Uint16(456)); // B
      machineState.memory.set(2, new Field(1)); // Condition

      await new CMov(/*indirect=*/ 0, /*aOffset=*/ 0, /*bOffset=*/ 1, /*condOffset=*/ 2, /*dstOffset=*/ 3).execute(
        machineState,
        journal,
      );

      const actual = machineState.memory.get(3);
      const tag = machineState.memory.getTag(3);
      expect(actual).toEqual(new Uint32(123));
      expect(tag).toEqual(TypeTag.UINT32);
    });

    it('Should move B if COND is false, on different memory cells (integral condition)', async () => {
      machineState.memory.set(0, new Uint32(123)); // A
      machineState.memory.set(1, new Uint16(456)); // B
      machineState.memory.set(2, new Field(0)); // Condition

      await new CMov(/*indirect=*/ 0, /*aOffset=*/ 0, /*bOffset=*/ 1, /*condOffset=*/ 2, /*dstOffset=*/ 3).execute(
        machineState,
        journal,
      );

      const actual = machineState.memory.get(3);
      const tag = machineState.memory.getTag(3);
      expect(actual).toEqual(new Uint16(456));
      expect(tag).toEqual(TypeTag.UINT16);
    });
  });

  describe('CALLDATACOPY', () => {
    it('Should deserialize correctly', () => {
      const buf = Buffer.from([
        // opcode
        CalldataCopy.opcode,
        // indirect
        0x01,
        // cdOffset
        0x12,
        0x34,
        0x56,
        0x78,
        // copysize
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

      const inst = CalldataCopy.deserialize(buf);
      expect(inst).toEqual(
        new CalldataCopy(
          /*indirect=*/ 0x01,
          /*cdOffset=*/ 0x12345678,
          /*copysize=*/ 0x23456789,
          /*dstOffset=*/ 0x3456789a,
        ),
      );
    });

    it('Should serialize correctly', () => {
      const inst = new CalldataCopy(
        /*indirect=*/ 0x01,
        /*cdOffset=*/ 0x12345678,
        /*copysize=*/ 0x23456789,
        /*dstOffset=*/ 0x3456789a,
      );

      const expected = Buffer.from([
        // opcode
        CalldataCopy.opcode,
        // indirect
        0x01,
        // cdOffset
        0x12,
        0x34,
        0x56,
        0x78,
        // copysize
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

    it('Writes nothing if size is 0', async () => {
      const calldata = [new Fr(1n), new Fr(2n), new Fr(3n)];
      machineState = new AvmMachineState(initExecutionEnvironment({ calldata }));
      machineState.memory.set(0, new Uint16(12)); // Some previous data to be overwritten

      await new CalldataCopy(/*indirect=*/ 0, /*cdOffset=*/ 0, /*copySize=*/ 0, /*dstOffset=*/ 0).execute(
        machineState,
        journal,
      );

      const actual = machineState.memory.get(0);
      expect(actual).toEqual(new Uint16(12));
    });

    it('Copies all calldata', async () => {
      const calldata = [new Fr(1n), new Fr(2n), new Fr(3n)];
      machineState = new AvmMachineState(initExecutionEnvironment({ calldata }));
      machineState.memory.set(0, new Uint16(12)); // Some previous data to be overwritten

      await new CalldataCopy(/*indirect=*/ 0, /*cdOffset=*/ 0, /*copySize=*/ 3, /*dstOffset=*/ 0).execute(
        machineState,
        journal,
      );

      const actual = machineState.memory.getSlice(/*offset=*/ 0, /*size=*/ 3);
      expect(actual).toEqual([new Field(1), new Field(2), new Field(3)]);
    });

    it('Copies slice of calldata', async () => {
      const calldata = [new Fr(1n), new Fr(2n), new Fr(3n)];
      machineState = new AvmMachineState(initExecutionEnvironment({ calldata }));
      machineState.memory.set(0, new Uint16(12)); // Some previous data to be overwritten

      await new CalldataCopy(/*indirect=*/ 0, /*cdOffset=*/ 1, /*copySize=*/ 2, /*dstOffset=*/ 0).execute(
        machineState,
        journal,
      );

      const actual = machineState.memory.getSlice(/*offset=*/ 0, /*size=*/ 2);
      expect(actual).toEqual([new Field(2), new Field(3)]);
    });

    // TODO: check bad cases (i.e., out of bounds)
  });
});
