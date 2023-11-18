#[oracle(avm_sload)]
pub fn sload(
    _storage_slot: Field,
) -> Field {}

unconstrained pub fn storage_read<T, N>(storage_slot: Field, deserialize: fn ([Field; N]) -> T)-> T {
    let mut fields = [0; N];
    fields[0] = sload(storage_slot);
    // FIXME: something seems broken in the transpiler for this loop
    // ... it might have something to do with the STORE that happens into the array memory?
    //for i in 0..1 {
    //    fields[i] = sload(storage_slot + i);
    //}
    //fields[0]
    deserialize(fields)
}

#[oracle(avm_sstore)]
pub fn sstore(
    _storage_slot: Field,
    _value: Field,
) {}

unconstrained pub fn storage_write<N>(storage_slot: Field, fields: [Field; N]) {
    for i in 0..N {
        sstore(storage_slot + i, fields[i]);
    }
}

#[oracle(avm_call)]
pub fn call<ARGS_SIZE, RETURN_SIZE>(
    _gas: Field,
    _target_address: Field,
    _calldata: [Field; ARGS_SIZE],
) -> [Field; RETURN_SIZE] {}