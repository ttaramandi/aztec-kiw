use crate::{
    context::private_context::PrivContext,
    history::{
    note_inclusion::prove_note_inclusion, note_inclusion::_note_inclusion,
    nullifier_non_inclusion::prove_note_not_nullified, nullifier_non_inclusion::_nullifier_non_inclusion
},
    note::{utils::compute_siloed_nullifier, note_interface::NoteInterface}
};

pub fn prove_note_validity<Ctx, Note, N>(note: Note, context: &mut Ctx) where Note: NoteInterface<Ctx, N>, Ctx: PrivContext {
    prove_note_inclusion(note, *context);
    prove_note_not_nullified(note, context);
}

// A helper function that proves that a note is valid at the given block number
pub fn prove_note_validity_at<Ctx, Note, N>(
    note: Note,
    block_number: u32,
    context: &mut Ctx
) where Note: NoteInterface<Ctx, N>, Ctx: PrivContext {
    // We are calling the internal functions here because we want to avoid calling get_header_at twice
    let header = context.get_header_at(block_number);
    _note_inclusion(note, header);

    let nullifier = compute_siloed_nullifier(note, context);
    _nullifier_non_inclusion(nullifier, header);
}
