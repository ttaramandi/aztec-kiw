// TEST THESE
use crate::context::context_trait::Context;
use crate::context::private_context::PrivContext;
use crate::context::public_context::PubContext;

use crate::oracle::{storage::{storage_read, storage_write}};
use crate::history::public_value_inclusion::prove_public_value_inclusion;
use dep::std::option::Option;
use dep::protocol_types::traits::{Deserialize, Serialize};
use crate::state_vars::storage::Storage;

struct StablePublicState<Ctx, T> {
    context: Ctx,
    storage_slot: Field,
}

impl<Ctx, T> Storage<T> for StablePublicState<Ctx, T> {}

impl<Ctx, T> StablePublicState<Ctx, T> {
    pub fn new(
        // Note: Passing the contexts to new(...) just to have an interface compatible with a Map.
        context: C,
        storage_slot: Field
    ) -> Self where C: Context {
        assert(storage_slot != 0, "Storage slot 0 not allowed. Storage slots must start from 1.");
        Self { context, storage_slot }
    }

    // Intended to be only called once. 
    pub fn initialize<T_SERIALIZED_LEN>(self, value: T) where T: Serialize<T_SERIALIZED_LEN>, Ctx: Context, Ctx: PubContext {

        // TODO: Must throw if the storage slot is not empty -> cannot allow overwriting
        // This is currently impractical, as public functions are never marked `is_contract_deployment`
        // in the `call_context`, only private functions will have this flag set.
        let ctx: Ctx = self.context;
        let fields = T::serialize(value);
        for i in 0..fields.len() {
            storage_write(self.storage_slot + i, fields[i]);
        }
    }

    pub fn read_public<T_SERIALIZED_LEN>(self) -> T where T: Deserialize<T_SERIALIZED_LEN>, Ctx: Context, Ctx: PubContext {
        // assert(self.context.private.is_none(), "Public read only supported in public functions");
        let context: Ctx = self.context;
        let fields = storage_read(self.storage_slot);
        T::deserialize(fields)
    }

    pub fn read_private<T_SERIALIZED_LEN>(self) -> T  where T: Deserialize<T_SERIALIZED_LEN>, Ctx: PrivContext, Ctx: Context {
        // assert(self.context.public.is_none(), "Private read only supported in private functions");
        // let private_context = self.context.private.unwrap();
        let mut context: C = self.context;

        // Read the value from storage (using the public tree)
        let fields = storage_read(self.storage_slot);

        // Loop over the fields and prove their inclusion in the public tree
        for i in 0..fields.len() {
            // TODO: Update membership proofs to use current header (Requires #4179)
            // Currently executing unnecessary computation:
            // - a membership proof of the value in the public tree of the header 
            prove_public_value_inclusion(
                fields[i],
                self.storage_slot + i,
                (*context).address(),
                (*context)
            )
        }
        T::deserialize(fields)
    }
}
