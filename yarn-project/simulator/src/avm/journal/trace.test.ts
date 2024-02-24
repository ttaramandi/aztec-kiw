import { Fr } from '@aztec/foundation/fields';

import { WorldStateAccessTrace } from './trace.js';
import { TracedNullifierCheck } from './trace_types.js';

describe('world state access trace', () => {
  let trace: WorldStateAccessTrace;

  beforeEach(() => {
    trace = new WorldStateAccessTrace();
  });

  describe('UTXOs', () => {
    it('Should trace commitments', () => {
      const contractAddress = new Fr(1);
      const utxo = new Fr(2);
      trace.traceNewNoteHash(contractAddress, utxo);
      expect(trace.newNoteHashes).toEqual([utxo]);
      expect(trace.getAccessCounter()).toEqual(1);
    });
    it('Should trace nullifier checks', () => {
      const contractAddress = new Fr(1);
      const utxo = new Fr(2);
      const exists = true;
      const isPending = false;
      const leafIndex = new Fr(42);
      trace.traceNullifierCheck(contractAddress, utxo, exists, isPending, leafIndex);
      const expectedCheck: TracedNullifierCheck = {
        callPointer: Fr.ZERO,
        storageAddress: contractAddress,
        nullifier: utxo,
        exists: exists,
        counter: Fr.ZERO, // 0th access
        endLifetime: Fr.ZERO,
        isPending: isPending,
        leafIndex: leafIndex
      };
      expect(trace.nullifierChecks).toEqual([expectedCheck]);
    });
    it('Should trace nullifiers', () => {
      const contractAddress = new Fr(1);
      const utxo = new Fr(2);
      trace.traceNewNullifier(contractAddress, utxo);
      expect(trace.newNullifiers).toEqual([utxo]);
      expect(trace.getAccessCounter()).toEqual(1);
    });
  });

  it('Should merge two traces together', () => {
    const contractAddress = new Fr(1);
    const slot = new Fr(2);
    const value = new Fr(1);
    const valueT1 = new Fr(2);
    const nullifierExists = false;
    const nullifierIsPending = false;
    const nullifierLeafIndex = Fr.ZERO;
    const commitment = new Fr(10);
    const commitmentT1 = new Fr(20);
    const nullifierExistsT1 = true;
    const nullifierIsPendingT1 = false;
    const nullifierLeafIndexT1 = new Fr(42);

    const expectedNullifierCheck: TracedNullifierCheck = {
      callPointer: Fr.ZERO,
      storageAddress: contractAddress,
      nullifier: commitment,
      exists: nullifierExists,
      counter: new Fr(3), // 3rd access
      endLifetime: Fr.ZERO,
      isPending: nullifierIsPending,
      leafIndex: nullifierLeafIndex,
     };
    const expectedNullifierCheckT1: TracedNullifierCheck = {
      callPointer: Fr.ZERO,
      storageAddress: contractAddress,
      nullifier: commitmentT1,
      exists: nullifierExistsT1,
      counter: new Fr(8), // 8th access
      endLifetime: Fr.ZERO,
      isPending: nullifierIsPendingT1,
      leafIndex: nullifierLeafIndexT1,
     };

    trace.tracePublicStorageWrite(contractAddress, slot, value);
    trace.tracePublicStorageRead(contractAddress, slot, value);
    trace.traceNewNoteHash(contractAddress, commitment);
    trace.traceNullifierCheck(contractAddress, commitment, nullifierExists, nullifierIsPending, nullifierLeafIndex);
    trace.traceNewNullifier(contractAddress, commitment);
    expect(trace.getAccessCounter()).toEqual(5); // 5 accesses above

    const childTrace = new WorldStateAccessTrace(trace);
    childTrace.tracePublicStorageWrite(contractAddress, slot, valueT1);
    childTrace.tracePublicStorageRead(contractAddress, slot, valueT1);
    childTrace.traceNewNoteHash(contractAddress, commitmentT1);
    childTrace.traceNullifierCheck(contractAddress, commitmentT1, nullifierExistsT1, nullifierIsPendingT1, nullifierLeafIndexT1);
    childTrace.traceNewNullifier(contractAddress, commitmentT1);
    expect(childTrace.getAccessCounter()).toEqual(10);

    trace.acceptAndMerge(childTrace);
    expect(trace.getAccessCounter()).toEqual(10);

    const slotReads = trace.publicStorageReads?.get(contractAddress.toBigInt())?.get(slot.toBigInt());
    const slotWrites = trace.publicStorageWrites?.get(contractAddress.toBigInt())?.get(slot.toBigInt());
    expect(slotReads).toEqual([value, valueT1]);
    expect(slotWrites).toEqual([value, valueT1]);
    expect(trace.newNoteHashes).toEqual([commitment, commitmentT1]);
    expect(trace.nullifierChecks).toEqual([expectedNullifierCheck, expectedNullifierCheckT1]);
    expect(trace.newNullifiers).toEqual([commitment, commitmentT1]);
  });
});
