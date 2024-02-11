import { Fr } from '@aztec/foundation/fields';

import { HostAztecState } from './host_storage.js';


type TracedPublicStorageAccess = {
  contractAddress: Fr; // TODO: should be callPointer
  slot: Fr;
  value: Fr;
  counter: Fr;
};

/**
 * Data held within the journal
 */
export type JournalData = {
  newNoteHashes: Fr[];
  newNullifiers: Fr[];
  newL1Messages: Fr[][];
  newLogs: Fr[][];

  /** contract address -\> key -\> value */
  currentStorageValue: Map<bigint, Map<bigint, Fr>>;

  /** These traces will be an input to the AVM circuit to and Public Kernel.
   *
  /** contract address -\> key -\> value[] (stored in order of access) */
  storageReads: Array<TracedPublicStorageAccess>;
  /** contract address -\> key -\> value[] (stored in order of access) */
  storageWrites: Array<TracedPublicStorageAccess>;
};

/**
 * A cache of the current state of the AVM
 * The interpreter should make any state queries through this object
 *
 * When a nested context succeeds, it's journal is merge into the parent
 * When a call fails, it's journal is discarded and the parent is used from this point forward
 * When a call succeeds's we can merge a child into its parent
 */
export class AvmWorldState {
  /**
   * Reference to node's Aztec state
   * State reads fall back on node's Aztec state when
   * there is a miss in latest state (here) and parent state
   */
  private readonly hostAztecState: HostAztecState;
  /**
   * Parent world state journal
   * State reads fall back on parent when
   * there is a miss in latest state (here)
   */
  private readonly parentWorldState: AvmWorldState | undefined;

  /**
   * Latest public storage (including staged modifications)
   * Type: contract address -> key -> value
   */
  private publicStorage: Map<bigint, Map<bigint, Fr>> = new Map();

  /**
   * List of pending nullifiers per contract
   */
  private nullifiers: Map<bigint, Set<Fr>> = new Map();

  // World state access trace
  private sideEffectCounter = 0;
  // Reading state - must be tracked for vm execution
  // contract address -> key -> value[] (array stored in order of reads)
  //private storageReads: Map<bigint, Map<bigint, Fr[]>> = new Map();
  private storageReads: Array<TracedPublicStorageAccess> = [];
  //private storageWrites: Map<bigint, Map<bigint, Fr[]>> = new Map();
  private storageWrites: Array<TracedPublicStorageAccess> = [];

  // New written state
  private newNoteHashes: Fr[] = [];
  private newNullifiers: Fr[] = [];

  // Accrued Substate
  private newL2ToL1Messages: Fr[][] = [];
  private newUnencryptedLogs: Fr[][] = [];


  constructor(hostStorage: HostAztecState, parentWorldState?: AvmWorldState, sideEffectCounter = 0) {
    this.hostAztecState = hostStorage;
    this.parentWorldState = parentWorldState;
    this.sideEffectCounter = sideEffectCounter;
  }

  /**
   * Fork this world state, creating a world state usable by a nested call
   */
  public fork() {
    // TODO: should making a nested call increment side effect counter?
    return new AvmWorldState(this.hostAztecState, this, this.sideEffectCounter);
  }

  /**
   * Write storage into journal
   *
   * @param contractAddress -
   * @param key -
   * @param value -
   */
  public writeStorage(contractAddress: Fr, key: Fr, value: Fr) {
    let storageForContract = this.publicStorage.get(contractAddress.toBigInt());
    // If this contract's storage has no staged modifications, create a new Map to store them
    if (!storageForContract) {
      storageForContract = new Map();
      this.publicStorage.set(contractAddress.toBigInt(), storageForContract);
    }
    storageForContract.set(key.toBigInt(), value);

    // We want to keep track of all performed writes in the journal
    this.tracePublicStorageWrite(contractAddress, key, value);
  }

  /**
   * Read storage from journal
   * Read from host storage on cache miss
   *
   * @param contractAddress -
   * @param key -
   * @returns current value
   */
  public async readStorage(contractAddress: Fr, key: Fr): Promise<Fr> {
    // Do not early return as we want to keep track of reads in this.storageReads

    // First try this storage cache (if written to earlier during the current call's execution)
    let value = this.publicStorage.get(contractAddress.toBigInt())?.get(key.toBigInt());
    // Then try parent's storage cache (if it exists / written to earlier in this TX)
    if (!value && this.parentWorldState) {
      value = await this.parentWorldState?.readStorage(contractAddress, key);
    }
    // Finally try the host's Aztec state (a trip to the database)
    if (!value) {
      value = await this.hostAztecState.publicStorageDb.storageRead(contractAddress, key);
    }

    this.tracePublicStorageRead(contractAddress, key, value);
    return Promise.resolve(value);
  }

  public writeNoteHash(noteHash: Fr) {
    this.newNoteHashes.push(noteHash);
    this.sideEffectCounter++;
  }

  public writeNullifier(contractAddress: Fr, nullifier: Fr) {
    let nullifiersForContract = this.nullifiers.get(contractAddress.toBigInt());
    // If this contract's nullifier set has no pending nullifier, create a new Map to store them
    if (!nullifiersForContract) {
      nullifiersForContract = new Set();
      this.nullifiers.set(contractAddress.toBigInt(), nullifiersForContract);
    }
    if (nullifiersForContract.has(nullifier)) {
      throw new Error(`Nullifier ${nullifier} already exists for contract ${contractAddress}`);
    }
    nullifiersForContract.add(nullifier);

    this.newNullifiers.push(nullifier);
    this.sideEffectCounter++;
  }

  ///**
  // * Check for existence of the specified nullifier.
  // */
  //public async checkNullifierExists(contractAddress: Fr, nullifier: Fr): Promise<boolean> {
  //  const exists = await this.hostAztecState.nullifierDb.nullifierExists(nullifier);
  //  return exists;
  //}

  /**
   * Append to Accrued Substate vector of L1-To-L2 messages.
   * @param message - the payload
   */
  public writeL2ToL1Message(message: Fr[]) {
    this.newL2ToL1Messages.push(message);
    this.sideEffectCounter++;
  }

  /**
   * Append to Accrued Substate vector of unencryptedLogs.
   * @param log - the payload
   */
  public writeUnencryptedLog(log: Fr[]) {
    this.newUnencryptedLogs.push(log);
    this.sideEffectCounter++;
  }

  /**
   * Accept nested world state, merging in its journal, and accepting its state modifications
   * - Utxo objects are concatenated
   * - Public state changes are merged, with the value in the incoming journal taking precedent
   * - Public state journals (r/w logs), with the accessing being appended in chronological order
   */
  public acceptNestedWorldState(nestedCallState: AvmWorldState) {
    // Merge Public State
    this.acceptNestedCallPublicStorage(nestedCallState);

    // Merge UTXOs
    this.newNoteHashes = this.newNoteHashes.concat(nestedCallState.newNoteHashes);
    this.newL2ToL1Messages = this.newL2ToL1Messages.concat(nestedCallState.newL2ToL1Messages);
    this.newNullifiers = this.newNullifiers.concat(nestedCallState.newNullifiers);
    this.newUnencryptedLogs = this.newUnencryptedLogs.concat(nestedCallState.newUnencryptedLogs);

    // Append nested call's traces
    this.storageReads.push.apply(nestedCallState.storageReads);
    this.storageWrites.push.apply(nestedCallState.storageWrites);

    // Nested call increments the side effect counter and caller
    // must account for any side effects made by callee
    this.sideEffectCounter = nestedCallState.sideEffectCounter;
  }

  /**
   * Reject nested world state, merging in its journal, but not accepting its state modifications
   * - Utxo objects are concatenated
   * - Public state changes are dropped
   * - Public state journals (r/w logs) are maintained, with the accessing being appended in chronological order
   */
  public rejectNestedWorldState(nestedCallState: AvmWorldState) {
    // TODO: need to accept traces for rejected nested journals
    // Append nested call's traces
    this.storageReads.push.apply(nestedCallState.storageReads);
    this.storageWrites.push.apply(nestedCallState.storageWrites);

    // Nested call increments the side effect counter and caller
    // must account for any side effects made by callee
    this.sideEffectCounter = nestedCallState.sideEffectCounter;
  }

  /**
   * Access the current state of the journal
   *
   * @returns a JournalData object
   */
  public flush(): JournalData {
    return {
      newNoteHashes: this.newNoteHashes,
      newNullifiers: this.newNullifiers,
      newL1Messages: this.newL2ToL1Messages,
      newLogs: this.newUnencryptedLogs,
      currentStorageValue: this.publicStorage,
      storageReads: this.storageReads,
      storageWrites: this.storageWrites,
    };
  }

  /**
   * Trace a public storage read
   */
  private tracePublicStorageRead(contractAddress: Fr, slot: Fr, value: Fr): void {
    this.storageReads.push({ contractAddress, slot, value, counter: new Fr(this.sideEffectCounter) });
    this.sideEffectCounter++;
  }
  /**
   * Trace a public storage write
   */
  private tracePublicStorageWrite(contractAddress: Fr, slot: Fr, value: Fr): void {
    this.storageWrites.push({ contractAddress, slot, value, counter: new Fr(this.sideEffectCounter) });
    this.sideEffectCounter++;
  }

  /**
   * Merges a nested/child call's staged public storage modifications
   * into the current/parent.
   *
   * Staged modifications in the child take precedent as they are assumed
   * to occur after the parent's.
   *
   * @param nestedCallState - the nested call state to accept storage modifications from
   */
  private acceptNestedCallPublicStorage(nestedCallState: AvmWorldState) {
    // Iterate over all contracts with staged writes in the child.
    for (const [contractAddress, contractStorageInChild] of nestedCallState.publicStorage) {
      const contractStorageInParent = this.publicStorage.get(contractAddress);
      if (!contractStorageInParent) {
        // This contract has no storage writes staged in parent,
        // so just accept the child's storage for this contract as-is.
        this.publicStorage.set(contractAddress, contractStorageInChild);
      } else {
        // Child and parent both have staged writes for this contract.
        // Merge in the child's staged writes.
        for (const [slot, value] of contractStorageInChild) {
          contractStorageInParent.set(slot, value);
        }
      }
    }
  }
}
