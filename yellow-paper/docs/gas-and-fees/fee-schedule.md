# Fee Schedule

:::info
This section is a placeholder, we will flesh this out in much greater detail when we come to profile operations and assign gas costs
:::

<!-- prettier-ignore -->
| Action | Resource Domain | Consumption Calculation | Comment |
| -------- | -------- | -------- | ------- |
| Verifying the private kernel proof | L2 | Fixed L2/Transaction | |
| Verifying each nullifier against the world state    | L2     | Fixed L2/Tx nullifier     | |
| Verifying each nullifier against others in the same block     | L2     | Fixed L2/Tx nullifier     | Whilst not strictly a fixed cost, this would need to be allocated as a fixed cost as it depends on the composition of the rollup |
| Verifying log preimages against the sha256 log hashes contained in the private kernel public inputs | L2 | L2 gas per pre-image field | |
| Verifying contract deployment data against the sha256 hash of this data contained in the private kernel public inputs | L2 | L2 gas per hash | |  
| Publishing contract data to DA     | DA     | DA gas per byte     | |
| Publishing state updates to DA     | DA     | DA gas per byte     | |
| Publishing notes/tags to DA    | DA     | DA gas per byte     | |
| Publishing L2->L1 messages | L1 | Calldata gas per byte + processing & storing of the message | |
| Public function execution    | L2     | L2 gas per function opcode     | |
| Proving the public VM circuit for a public function     | L2     | Fixed L2/Tx public function     | |
| Proving the public kernel circuit for a public function    | L2     | Fixed L2/Tx public function   | |
| Proving the base rollup circuit | L2 | Fixed L2/Transaction |
| Proving the merge rollup circuit | L2 | Amortized L2/Transaction |
| Proving the root rollup circuit | L2 | Amortized L2/Transaction |
| Publishing the block header to L1 | L1 | Amortized L1/Transaction |
| Verifying the rollup proof | L1 | Amortized L1/Transaction |

The protocol defines 3 types of gas to measure resource consumption.

## L1 Gas

L1 Gas derives from the gas definition of Ethereum and quantifies the following operations.

:::danger
The values in this table are placeholders and need to be accurately calculated.
:::

| Name | Value | Description |
| -------- | --------- | ---------- |
| G<sub>verification</sub> | 300000 | The gas cost of executing the rollup transaction and posting the block header to L1 |
| G<sub>outbox</sub> | 50000 | The gas cost of posting an L2 to L1 message to the outbox |


## DA Gas

:::danger
This is a placeholder until we have selected and profiled a DA solution.
:::

DA Gas will be determined by the selected Data Availability layer. This gas measure will apply to the following set of operations.

| Name |
| ---------- |
| Publishing contract data     |
| Publishing state updates     |
| Publishing notes/tags    |

## L2 Gas

L2 Gas can be divided into a number of categories.

### Proving

Proving gas values are derived from the binary logarithm of the gate count of the circuit.

:::danger
Needs refining with actual gate counts
:::

| Name | Value | Description |
| ------- | ------- | -------- |
| G<sub>base<sub> | 128000 | Gas to pay for proving the base rollup circuit  |
| G<sub>merge<sub> | 32000 | Gas to pay for proving the merge rollup circuit  |
| G<sub>root<sub> | 64000 | Gas to pay for proving the root rollup circuit  |
| G<sub>kernel<sub> | 16000 | Gas to pay for proving the public kernel circuit  |
| G<sub>vm<sub> | 128000 | Gas to pay for proving the vm circuit  |

### Validation

Validation gas relates to the work required in ensuring transaction effects are valid.

:::danger
Values need benchmarking and refinement
:::

| Name | Value | Description |
| ------- | ------- | -------- |
| G<sub>nullifier<sub> | 100 | Gas to pay for ensuring the nullifier does not already exist either in the [state](../state/index.md) or in the pending transaction set  |
| G<sub>log<sub> | 4 per byte | Gas to pay for verifying log preimages against the sha256 log hashes contained in the private kernel public inputs  |
| G<sub>contract<sub> | 4 per byte | Gas to pay for verifying contract deployment data against the sha256 hash of this data contained in the private kernel public inputs  |
| G<sub>proof<sub> | 1000 | Gas to pay for verifying the private kernel proof  |

### Execution

Execution gas quantifies the resource 
