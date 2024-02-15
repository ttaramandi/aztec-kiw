use dep::protocol_types::address::{AztecAddress, EthAddress};

use crate::context::context_trait::Context;
impl Context for AVMContext {
    #[oracle(sender)]
    fn msg_sender(self) -> AztecAddress {}

    #[oracle(address)]
    fn address(self) -> AztecAddress {}

    #[oracle(portal)]
    fn portal_address(self) -> EthAddress {}

    #[oracle(chainId)]
    fn chain_id(self) -> Field {}

    #[oracle(version)]
    fn version(self) -> Field {}
}

// Getters that will be converted by the transpiler into their
// own opcodes
struct AVMContext {}

impl AVMContext {
    // Empty new function enables retaining context.<value> syntax
    pub fn new() -> Self {
        Self {}
    }

    #[oracle(storageAddress)]
    fn storage_address(self) -> AztecAddress {}

    #[oracle(origin)]
    pub fn origin(self) -> AztecAddress {}

    #[oracle(feePerL1Gas)]
    pub fn fee_per_l1_gas(self) -> Field {}

    #[oracle(feePerL2Gas)]
    pub fn fee_per_l2_gas(self) -> Field {}

    #[oracle(feePerDaGas)]
    pub fn fee_per_da_gas(self) -> Field {}


    #[oracle(blockNumber)]
    pub fn block_number(self) -> Field {}

    #[oracle(timestamp)]
    pub fn timestamp(self) -> Field {}
    // #[oracle(contractCallDepth)]
    // pub fn contract_call_depth(self) -> Field {}
}
