/**
 * The sequencer configuration.
 */
export interface SequencerConfig {
  /**
   * The number of ms to wait between polling for pending txs.
   */
  transactionPollingIntervalMS?: number;
  /**
   * The maximum number of txs to include in a block.
   */
  maxTxsPerBlock?: number;
  /**
   * The minimum number of txs to include in a block.
   */
  minTxsPerBlock?: number;
  /**
   * Should the sequencer use the AVM to execute public functions?
   */
  useAVM?: boolean;
}
