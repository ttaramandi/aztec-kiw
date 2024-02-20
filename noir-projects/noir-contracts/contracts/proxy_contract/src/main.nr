// A contract used along with `Parent` contract to test nested calls.
contract Proxy {
    use dep::std::option::Option;

    use dep::aztec::{
        log::emit_unencrypted_log, state_vars::{public_state::PublicState, set::Set},
        protocol_types::{abis::{function_selector::FunctionSelector}, address::AztecAddress},
        note::{note_viewer_options::NoteViewerOptions, utils as note_utils, note_header::NoteHeader},
        state_vars::{singleton::Singleton}
    };
    use dep::value_note::value_note::{ValueNote, VALUE_NOTE_LEN};

    struct Storage {
        implementation: Singleton<ValueNote>,
        current_value: PublicState<Field>,
        a_private_value: Set<ValueNote>,
    }

    #[aztec(private)]
    fn constructor() {}

    #[aztec(private)]
    fn initialize(owner: AztecAddress, target_contract: AztecAddress) {
        let mut note = ValueNote::new(target_contract.to_field(), owner);
        storage.implementation.initialize(&mut note, true);
    }

    #[aztec(private)]
    fn upgrade(target_contract: AztecAddress, owner: AztecAddress) {
        let mut note = ValueNote::new(target_contract.to_field(), owner);
        storage.implementation.replace(&mut note, true);
    }

    #[aztec(private)]
    fn private_fallback(target_selector: Field, args_hash: Field) {
        let target_selector = FunctionSelector::from_field(target_selector);
        let target_note = storage.implementation.get_note(false);
        let target_address = AztecAddress::from_field(target_note.value);
        let _ = context.call_private_function_with_packed_args(target_address, target_selector, args_hash, false, true);
    }

    unconstrained fn view_private_value(amount: Field, owner: AztecAddress) -> pub Field {
        let options = NoteViewerOptions::new().select(0, amount, Option::none()).select(1, owner.to_field(), Option::none()).set_limit(1);
        let notes = storage.a_private_value.view_notes(options);
        notes[0].unwrap_unchecked().value
    }

    unconstrained fn view_public_value() -> pub Field {
        storage.current_value.read()
    }
}
