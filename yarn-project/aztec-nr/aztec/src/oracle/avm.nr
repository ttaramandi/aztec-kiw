#[oracle(avm_sload)]
pub fn sload(
    _storage_slot: Field,
) -> Field {}

#[oracle(avm_sstore)]
pub fn sstore(
    _storage_slot: Field,
    _value: Field,
) {}

#[oracle(avm_call)]
pub fn call<ARGS_SIZE, RETURN_SIZE>(
    _gas: Field,
    _target_address: Field,
    _calldata: [Field; ARGS_SIZE],
) -> [Field; RETURN_SIZE] {}