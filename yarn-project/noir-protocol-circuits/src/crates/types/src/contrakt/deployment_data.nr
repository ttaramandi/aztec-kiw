use crate::address::EthAddress;
use crate::constants::{
    CONTRACT_DEPLOYMENT_DATA_LENGTH,
    GENERATOR_INDEX__CONTRACT_DEPLOYMENT_DATA,
};
use crate::hash::pedersen_hash;
use crate::grumpkin_point::GrumpkinPoint;
use crate::traits::{Hash, Empty};

// docs:start:contract-deployment-data
struct ContractDeploymentData {
    deployer_public_key : GrumpkinPoint,
    constructor_vk_hash : Field,
    function_tree_root : Field,
    contract_address_salt : Field,
    portal_contract_address : EthAddress,
}
// docs:end:contract-deployment-data

impl Hash for ContractDeploymentData {
    fn hash(self) -> Field {
        pedersen_hash(self.serialize(), GENERATOR_INDEX__CONTRACT_DEPLOYMENT_DATA)
    }
}

impl Empty for ContractDeploymentData {
    fn empty() -> Self {
        Self {
            deployer_public_key : GrumpkinPoint::empty(),
            constructor_vk_hash : 0,
            function_tree_root : 0,
            contract_address_salt : 0,
            portal_contract_address : EthAddress::empty()
        }
    }
}

impl ContractDeploymentData {
    fn serialize(self) -> [Field; CONTRACT_DEPLOYMENT_DATA_LENGTH] {
        [
            self.deployer_public_key.x,
            self.deployer_public_key.y,
            self.constructor_vk_hash,
            self.function_tree_root,
            self.contract_address_salt,
            self.portal_contract_address.to_field(),
        ]
    }

    fn assert_is_zero(self) {
        self.deployer_public_key.assert_is_zero();
        assert(self.constructor_vk_hash == 0);
        assert(self.function_tree_root == 0);
        assert(self.contract_address_salt == 0);
        self.portal_contract_address.assert_is_zero();
    }

}
