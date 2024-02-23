use dep::aztec::protocol_types::address::AztecAddress;
use dep::aztec::{
    note::{note_header::NoteHeader, note_interface::NoteInterface, utils::compute_note_hash_for_consumption},
    oracle::{nullifier_key::get_nullifier_secret_key, get_public_key::get_public_key},
    log::emit_encrypted_log, hash::pedersen_hash, context::PrivateContext
};


struct MultiSigNote {
    owners: [AztecAddress; 5],
    private_key: Field,  // encryption private key
    threshold: u8,    // threshold for the multi-sig
    contract_address: AztecAddress, // We store the address of the contract itself, only to get the secret key to compute the nullifier
    header: NoteHeader,
}

impl NoteInterface<8> for MultiSigNote {
    fn serialize_content(self) -> [Field; 8] {
        let mut serialized_note: [Field; 8] = [0; 8];
        for i in 0..5 {
            serialized_note[i] = self.owners[i].to_field();
        }
        serialized_note[5] = self.private_key;
        serialized_note[5 + 1] = self.threshold as Field;
        serialized_note[5 + 2] = self.contract_address.to_field();
        serialized_note
    }

    fn deserialize_content(serialized_note: [Field; 8]) -> MultiSigNote {
        let mut owners: [AztecAddress; 5] = [AztecAddress::zero(); 5];
        for i in 0..5 {
            owners[i] = AztecAddress::from_field(serialized_note[i]);
        }
        let private_key = serialized_note[5];
        let threshold = serialized_note[5 + 1] as u8;
        let contract_address = AztecAddress::from_field(serialized_note[5 + 2]);
        MultiSigNote { owners, private_key, threshold, contract_address, header: NoteHeader::empty() }
    }

    fn compute_note_content_hash(note: MultiSigNote) -> Field {
        // TODO(#1205) Should use a non-zero generator index.
        pedersen_hash(note.serialize_content(), 0)
    }

   fn compute_nullifier(self, context: &mut PrivateContext) -> Field {
        let unique_siloed_note_hash = compute_note_hash_for_consumption(self);
        let secret = context.request_nullifier_secret_key(self.contract_address);
        // TODO(#1205) Should use a non-zero generator index.
        pedersen_hash([
            unique_siloed_note_hash,
            secret.low,
            secret.high,
        ],0)
    }

    fn compute_nullifier_without_context(self) -> Field {
        let unique_siloed_note_hash = compute_note_hash_for_consumption(self);
        let secret = get_nullifier_secret_key(self.contract_address);
        // TODO(#1205) Should use a non-zero generator index.
        pedersen_hash([
            unique_siloed_note_hash,
            secret.low,
            secret.high,
        ],0)
    }

    fn set_header(&mut self, header: NoteHeader) {
        self.header = header;
    }

    fn get_header(self) -> NoteHeader {
        self.header
    }

    // Broadcasts the note as an encrypted log on L1.
    fn broadcast(self, context: &mut PrivateContext, slot: Field) {
        for owner in self.owners {
            if !owner.is_zero() {
                let encryption_pub_key = get_public_key(owner);
                emit_encrypted_log(
                    context,
                    (*context).this_address(),
                    slot,
                    666+777,
                    encryption_pub_key,
                    self.serialize_content(),
                );
            }
        }
    }

    fn get_note_type_id() -> Field {
        666 + 777
    }
}

impl MultiSigNote {
    pub fn new(
        owners: [AztecAddress; 5],
        private_key: Field,
        threshold: u8,
        contract_address: AztecAddress
    ) -> MultiSigNote {
        MultiSigNote { owners, private_key, threshold, contract_address, header: NoteHeader::empty() }
    }
}
