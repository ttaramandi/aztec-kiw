import { CircuitsWasm, KernelCircuitPublicInputs, Proof, PublicCallRequest } from '@aztec/circuits.js';
import { computeTxHash } from '@aztec/circuits.js/abis';

import { arrayNonEmptyLength } from '@aztec/foundation/collection';
import { EncodedContractFunction } from './contract_data.js';
import { SignedTxExecutionRequest } from './tx_execution_request.js';
import { TxHash } from './tx_hash.js';
import { NoirLogs } from './noir_logs.js';

/**
 * Defines valid fields for a private transaction.
 */
type PrivateTxFields = 'data' | 'proof' | 'encryptedLogs';

/**
 * Defines valid fields for a public transaction.
 */
type PublicTxFields = 'txRequest';

/**
 * Defines private tx type.
 */
export type PrivateTx = Required<Pick<Tx, PrivateTxFields>> & Tx;

/**
 * Defines public tx type.
 */
export type PublicTx = Required<Pick<Tx, PublicTxFields>> & Tx;

/**
 * Checks if a tx is public.
 */
export function isPublicTx(tx: Tx): tx is PublicTx {
  return !!tx.txRequest;
}

/**
 * Checks if a tx is private.
 */
export function isPrivateTx(tx: Tx): tx is PrivateTx {
  return !!tx.data && !!tx.proof && !!tx.encryptedLogs;
}

/**
 * The interface of an L2 transaction.
 */
export class Tx {
  private txHash?: Promise<TxHash>;

  protected constructor(
    /**
     * Output of the private kernel circuit for this tx.
     */
    public readonly data?: KernelCircuitPublicInputs,
    /**
     * Proof from the private kernel circuit.
     */
    public readonly proof?: Proof,
    /**
     * Encrypted logs generated by the tx.
     */
    public readonly encryptedLogs?: NoirLogs,
    /**
     * Signed public function call data.
     */
    public readonly txRequest?: SignedTxExecutionRequest,
    /**
     * New public functions made available by this tx.
     */
    public readonly newContractPublicFunctions?: EncodedContractFunction[],
    /**
     * Enqueued public functions from the private circuit to be run by the sequencer.
     * Preimages of the public call stack entries from the private kernel circuit output.
     */
    public readonly enqueuedPublicFunctionCalls?: PublicCallRequest[],
  ) {
    const kernelPublicCallStackSize =
      data?.end.publicCallStack && arrayNonEmptyLength(data.end.publicCallStack, item => item.isZero());
    if (kernelPublicCallStackSize && kernelPublicCallStackSize > (enqueuedPublicFunctionCalls?.length ?? 0)) {
      throw new Error(
        `Missing preimages for enqueued public function calls in kernel circuit public inputs (expected ${kernelPublicCallStackSize}, got ${enqueuedPublicFunctionCalls?.length})`,
      );
    }
  }

  /**
   * Creates a new private transaction.
   * @param data - Public inputs of the private kernel circuit.
   * @param proof - Proof from the private kernel circuit.
   * @param encryptedLogs - Encrypted logs created by this tx.
   * @param newContractPublicFunctions - Public functions made available by this tx.
   * @param enqueuedPublicFunctionCalls - Preimages of the public call stack of the kernel output.
   * @returns A new private tx instance.
   */
  public static createPrivate(
    data: KernelCircuitPublicInputs,
    proof: Proof,
    encryptedLogs: NoirLogs,
    newContractPublicFunctions: EncodedContractFunction[],
    enqueuedPublicFunctionCalls: PublicCallRequest[],
  ): PrivateTx {
    return new this(
      data,
      proof,
      encryptedLogs,
      undefined,
      newContractPublicFunctions,
      enqueuedPublicFunctionCalls,
    ) as PrivateTx;
  }

  /**
   * Creates a new public transaction from the given tx request.
   * @param txRequest - The tx request.
   * @returns New public tx instance.
   */
  public static createPublic(txRequest: SignedTxExecutionRequest): PublicTx {
    return new this(undefined, undefined, undefined, txRequest) as PublicTx;
  }

  /**
   * Creates a new transaction containing both private and public calls.
   * @param data - Public inputs of the private kernel circuit.
   * @param proof - Proof from the private kernel circuit.
   * @param encryptedLogs - Encrypted logs created by this tx.
   * @param txRequest - The tx request defining the public call.
   * @returns A new tx instance.
   */
  public static createPrivatePublic(
    data: KernelCircuitPublicInputs,
    proof: Proof,
    encryptedLogs: NoirLogs,
    txRequest: SignedTxExecutionRequest,
  ): PrivateTx & PublicTx {
    return new this(data, proof, encryptedLogs, txRequest) as PrivateTx & PublicTx;
  }

  /**
   * Creates a new transaction from the given tx request.
   * @param data - Public inputs of the private kernel circuit.
   * @param proof - Proof from the private kernel circuit.
   * @param encryptedLogs - Encrypted logs created by this tx.
   * @param txRequest - The tx request defining the public call.
   * @returns A new tx instance.
   */
  public static create(
    data?: KernelCircuitPublicInputs,
    proof?: Proof,
    encryptedLogs?: NoirLogs,
    txRequest?: SignedTxExecutionRequest,
  ): Tx {
    return new this(data, proof, encryptedLogs, txRequest);
  }

  /**
   * Checks if a tx is private.
   * @returns True if the tx is private, false otherwise.
   */
  public isPrivate(): this is PrivateTx {
    return isPrivateTx(this);
  }

  /**
   * Checks if a tx is public.
   * @returns True if the tx is public, false otherwise.
   */
  public isPublic(): this is PublicTx {
    return isPublicTx(this);
  }

  /**
   * Construct & return transaction hash.
   * @returns The transaction's hash.
   */
  getTxHash(): Promise<TxHash> {
    if (this.isPrivate()) {
      // Private kernel functions are executed client side and for this reason tx hash is already set as first nullifier
      const firstNullifier = this.data?.end.newNullifiers[0];
      return Promise.resolve(new TxHash(firstNullifier.toBuffer()));
    }

    if (this.isPublic()) {
      if (!this.txHash) this.txHash = getTxHashFromRequest(this.txRequest);
      return this.txHash;
    }

    throw new Error('Tx data incorrectly set.');
  }

  /**
   * Convenience function to get array of hashes for an array of txs.
   * @param txs - The txs to get the hashes from.
   * @returns The corresponding array of hashes.
   */
  static async getHashes(txs: Tx[]): Promise<TxHash[]> {
    return await Promise.all(txs.map(tx => tx.getTxHash()));
  }

  /**
   * Clones a tx, making a deep copy of all fields.
   * @param tx - The transaction to be cloned.
   * @returns The cloned transaction.
   */
  static clone(tx: Tx): Tx {
    const publicInputs = tx.data === undefined ? undefined : KernelCircuitPublicInputs.fromBuffer(tx.data.toBuffer());
    const proof = tx.proof === undefined ? undefined : Proof.fromBuffer(tx.proof.toBuffer());
    const encryptedLogs = tx.encryptedLogs === undefined ? undefined : NoirLogs.fromBuffer(tx.encryptedLogs.toBuffer());
    const signedTxRequest = tx.txRequest?.clone();
    const publicFunctions =
      tx.newContractPublicFunctions === undefined
        ? undefined
        : tx.newContractPublicFunctions.map(x => {
            return EncodedContractFunction.fromBuffer(x.toBuffer());
          });
    const enqueuedPublicFunctions =
      tx.enqueuedPublicFunctionCalls === undefined
        ? undefined
        : tx.enqueuedPublicFunctionCalls.map(x => {
            return PublicCallRequest.fromBuffer(x.toBuffer());
          });
    return new Tx(publicInputs, proof, encryptedLogs, signedTxRequest, publicFunctions, enqueuedPublicFunctions);
  }
}

/**
 * Calculates the hash based on a SignedTxRequest.
 * @param txRequest - The SignedTxRequest.
 * @returns The tx hash.
 */
async function getTxHashFromRequest(txExecutionRequest: SignedTxExecutionRequest) {
  return new TxHash(computeTxHash(await CircuitsWasm.get(), await txExecutionRequest.toSignedTxRequest()).toBuffer());
}
