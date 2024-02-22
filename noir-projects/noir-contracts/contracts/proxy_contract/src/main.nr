mod interfaces;
mod public_key_note;
mod value_note;

// A contract used along with `Parent` contract to test nested calls.
contract Proxy {
    use dep::std::option::Option;

    use dep::aztec::{
        log::emit_unencrypted_log,
        protocol_types::{abis::{function_selector::FunctionSelector}, address::AztecAddress, hash},
        note::{note_viewer_options::NoteViewerOptions, utils as note_utils, note_header::NoteHeader},
        oracle::arguments,
        state_vars::{
        immutable_singleton::ImmutableSingleton, public_state::PublicState, set::Set,
        stable_public_state::StablePublicState
    },
        context::Context
    };
    use dep::field_note::field_note::FieldNote;
    use crate::interfaces::SlowMap;
    use crate::public_key_note::PublicKeyNote;
    use crate::value_note::ValueNote;

    struct Storage {
        admin: StablePublicState<AztecAddress>,
        slow_update: ImmutableSingleton<FieldNote>,
        public_slow_update: PublicState<AztecAddress>,
    }

    impl Storage {
        fn init(context: Context) -> Self {
            Storage {
                admin: StablePublicState::new(context, 97),
                slow_update: ImmutableSingleton::new(context, 98),
                public_slow_update: PublicState::new(context, 99)
            }
        }
    }

    global TARGET_SLOW_TREE_STORAGE_SLOT: Field = 1;

    #[aztec(private)]
    fn constructor(admin: AztecAddress, target: AztecAddress, slow_updates_contract: AztecAddress) {
        let mut slow_note = FieldNote::new(slow_updates_contract.to_field());
        storage.slow_update.initialize(&mut slow_note, false);

        let selector = FunctionSelector::from_signature("_initialize((Field),(Field))");
        context.call_public_function(
            context.this_address(),
            selector,
            [slow_updates_contract.to_field(), admin.to_field()]
        );
    }

    #[aztec(public)]
    internal fn _initialize(slow_updates_contract: AztecAddress, admin: AztecAddress) {
        storage.public_slow_update.write(slow_updates_contract);
        SlowMap::at(slow_updates_contract).initialize(context);
        storage.admin.initialize(admin);
    }

    #[aztec(private)]
    fn upgrade(target: AztecAddress) {
        let slow = SlowMap::at(AztecAddress::from_field((storage.slow_update.get_note().value)));
        slow.update_at_private(&mut context, TARGET_SLOW_TREE_STORAGE_SLOT, target.to_field());
    }

    #[aztec(private)]
    fn private_fallback(fn_selector: Field, args_hash: Field) {
        let slow = SlowMap::at(AztecAddress::from_field((storage.slow_update.get_note().value)));

        let admin = storage.admin.read_private();
        if context.msg_sender() == admin {
            if fn_selector == FunctionSelector::from_signature("upgrade((Field))").to_field() {
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
            let _ = context.call_private_function_with_packed_args(
                target,
                FunctionSelector::from_field(fn_selector),
                args_hash,
                false,
                true
            );
        }
    }

    #[aztec(public)]
    fn public_fallback(fn_selector: Field, args_hash: Field) {
        let slow = SlowMap::at(storage.public_slow_update.read());
        let target = AztecAddress::from_field(slow.read_at_pub(context, TARGET_SLOW_TREE_STORAGE_SLOT));
        // TODO: return the return value
        let _ = context.call_public_function_with_packed_args(
            target,
            FunctionSelector::from_field(fn_selector),
            args_hash,
            false,
            true
        );
    }

    unconstrained fn compute_note_hash_and_nullifier(
        contract_address: AztecAddress,
        nonce: Field,
        storage_slot: Field,
        note_type_id: Field,
        serialized_note: [Field; 20]
    ) -> pub [Field; 4] {
        let note_header = NoteHeader::new(contract_address, nonce, storage_slot);

        if note_type_id == PublicKeyNote::get_note_type_id() {
            note_utils::compute_note_hash_and_nullifier(
                PublicKeyNote::deserialize_content,
                note_header,
                serialized_note
            )
        } else if note_type_id == FieldNote::get_note_type_id() {
            note_utils::compute_note_hash_and_nullifier(FieldNote::deserialize_content, note_header, serialized_note)
        } else {
            note_utils::compute_note_hash_and_nullifier(ValueNote::deserialize_content, note_header, serialized_note)
        }
    }
}
