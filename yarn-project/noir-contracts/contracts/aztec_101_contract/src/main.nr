contract Aztec101 {

    use dep::aztec::note::{note_header::NoteHeader, utils as note_utils};
    use dep::std::option::Option;
    use dep::aztec::protocol_types::address::AztecAddress;
    use dep::aztec::context::Context;
    use dep::aztec::state_vars::singleton::Singleton;
    use dep::value_note::value_note::{ValueNote, ValueNoteMethods, VALUE_NOTE_LEN};

    struct Storage {
        counter: Singleton<ValueNote, VALUE_NOTE_LEN>
    }

    impl Storage {
        fn init(context: Context) -> Self {
            Self {
                counter: Singleton::new(context, 1, ValueNoteMethods),
            }
        }
    }

    #[aztec(private)]
    fn constructor(owner: AztecAddress) {
        let mut note = ValueNote::new(0, owner);
        storage.counter.initialize(&mut note, Option::some(owner), true);
    }

    #[aztec(private)]
    fn increment() {
        // Nullifying the existing note. And inserting the same value again
        let note = storage.counter.get_note(false);

        // Create a new note with the incremented value
        let mut new_note = ValueNote::new(note.value + 1, note.owner);

        // Nullify the existing note and insert the new note
        storage.counter.replace(&mut new_note, true);
    }

    #[aztec(private)]
    fn efficient_increment() {
        storage.counter.update(
            |old: ValueNote| {ValueNote::new(old.value + 1, old.owner)},
            true
        );
    }

    unconstrained fn get_counter() -> pub Field {
        let note = storage.counter.view_note();
        note.value
    }

    unconstrained fn compute_note_hash_and_nullifier(
        contract_address: AztecAddress,
        nonce: Field,
        storage_slot: Field,
        serialized_note: [Field; VALUE_NOTE_LEN]
    ) -> pub [Field; 4] {
        let note_header = NoteHeader::new(contract_address, nonce, storage_slot);
        note_utils::compute_note_hash_and_nullifier(ValueNoteMethods, note_header, serialized_note)
    }
}
