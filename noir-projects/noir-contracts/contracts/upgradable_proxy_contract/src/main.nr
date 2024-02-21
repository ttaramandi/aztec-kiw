mod interfaces;

contract UpgradableProxy {
    use dep::field_note::field_note::FieldNote;

    use dep::aztec::{
        context::PrivateContext, note::{note_header::NoteHeader, utils as note_utils},
        hash::{compute_secret_hash},
        state_vars::{immutable_singleton::ImmutableSingleton, public_state::PublicState},
        oracle::arguments,
        protocol_types::{abis::function_selector::FunctionSelector, address::AztecAddress, hash}
    };

    use crate::interfaces::SlowMap;

    struct Storage {
        slow_update: ImmutableSingleton<FieldNote>,
        public_slow_update: PublicState<AztecAddress>,
    }

    global ADMIN_SLOW_TREE_STORAGE_SLOT: Field = 1;
    global TARGET_SLOW_TREE_STORAGE_SLOT: Field = 2;

    #[aztec(private)]
    fn constructor(admin: AztecAddress, target: AztecAddress, slow_updates_contract: AztecAddress) {
        let mut slow_note = FieldNote::new(slow_updates_contract.to_field());
        storage.slow_update.initialize(&mut slow_note, false);

        let slow = SlowMap::at(slow_updates_contract);
        slow.update_at_private(&mut context, ADMIN_SLOW_TREE_STORAGE_SLOT, admin.to_field());
        slow.update_at_private(&mut context, TARGET_SLOW_TREE_STORAGE_SLOT, target.to_field());

        let selector = FunctionSelector::from_signature("_initialize((Field))");
        context.call_public_function(
            context.this_address(),
            selector,
            [slow_updates_contract.to_field()]
        );
    }

    #[aztec(public)]
    internal fn _initialize(slow_updates_contract: AztecAddress) {
        storage.public_slow_update.write(slow_updates_contract);
        SlowMap::at(slow_updates_contract).initialize(context);
    }

    #[aztec(private)]
    fn private_fallback(fn_selector: FunctionSelector, args_hash: Field) {
        let slow = SlowMap::at(AztecAddress::from_field((storage.slow_update.get_note().value)));

        let admin = AztecAddress::from_field(slow.read_at(&mut context, ADMIN_SLOW_TREE_STORAGE_SLOT));

        if context.msg_sender() == admin {
            if fn_selector == FunctionSelector::from_signature("upgrade(AztecAddress)") {
                let args: [Field; 1] = arguments::unpack_arguments(args_hash);
                assert(hash::hash_args(args) == args_hash);
                let target = AztecAddress::from_field(args[0]);

                slow.update_at_private(&mut context, TARGET_SLOW_TREE_STORAGE_SLOT, target.to_field());
            } else {
                assert(false, "Admin called non-admin function");
            }
        } else {
            let target = AztecAddress::from_field(slow.read_at(&mut context, TARGET_SLOW_TREE_STORAGE_SLOT));
            // TODO: return the return value
            let _ = context.call_private_function_with_packed_args(target, fn_selector, args_hash, false, true);
        }
    }
}
