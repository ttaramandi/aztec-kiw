// Types for the trait below
use dep::protocol_types::address::{AztecAddress, EthAddress};

trait Context {
    // fn new() -> Self;

    fn msg_sender(self) -> AztecAddress;
    fn address(self) -> AztecAddress;
    fn portal_address(self) -> EthAddress;
    fn chain_id(self) -> Field;
    fn version(self) -> Field;
}
