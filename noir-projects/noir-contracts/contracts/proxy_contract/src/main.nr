contract Proxy {
    
    use dep::std::option::Option;

    use dep::aztec::{
        log::emit_unencrypted_log, state_vars::{public_state::PublicState, set::Set, map::Map},
        protocol_types::{abis::{function_selector::FunctionSelector}, address::AztecAddress},
        note::{note_viewer_options::NoteViewerOptions, utils as note_utils, note_header::NoteHeader}
    };
    use dep::value_note::{
            balance_utils,
            value_note::{
                ValueNote,
                VALUE_NOTE_LEN,
            },
    };
    use dep::easy_private_state::easy_private_state::EasyPrivateUint;

    // Add storage
    struct Storage {
        counters: Map<AztecAddress, EasyPrivateUint>,
    }

    #[aztec(private)]
    fn constructor(){}

    #[aztec(private)]
    fn initialize_counter(targetAddress: AztecAddress, headstart: u120, owner: AztecAddress, fn_select: FunctionSelector) {
        context.delegate_call_private_function(targetAddress,fn_select,[headstart as Field,owner.to_field()]);
    }

    #[aztec(private)]
      fn increment(targetAddress: AztecAddress, owner: AztecAddress, fn_select: FunctionSelector) {
        context.delegate_call_private_function(targetAddress,fn_select, [owner.to_field()]);
    }
    
    unconstrained fn get_counter(owner: AztecAddress) -> pub Field {
        let counters = storage.counters;
        balance_utils::get_balance(counters.at(owner).set)
    }
}













