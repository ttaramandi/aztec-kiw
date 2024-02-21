#[oracle(packArguments)]
fn pack_arguments_oracle<N>(_args: [Field; N]) -> Field {}

#[oracle(unpackArguments)]
fn unpack_arguments_oracle<N>(_args_hash: Field) -> [Field; N] {}

// TODO: explain what this does.
unconstrained pub fn pack_arguments<N>(args: [Field; N]) -> Field {
    pack_arguments_oracle(args)
}

// Returns the arguments that correspond to args_hash
unconstrained pub fn unpack_arguments<N>(args_hash: Field) -> [Field; N] {
    unpack_arguments_oracle(args_hash)
}
