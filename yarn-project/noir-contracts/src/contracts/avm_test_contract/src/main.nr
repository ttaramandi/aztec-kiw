mod types;

// A contract used for testing the AVM (Aztec's Public VM)
contract AvmTest {
    use dep::std::option::Option;

    use dep::safe_math::SafeU120;

    use dep::aztec::log::emit_unencrypted_log;

    use dep::aztec::{
        abi,
        abi::PrivateContextInputs,
        context::{Context, PrivateContext},
        oracle::{
            avm::{storage_read, storage_write, sload, sstore, call},
            get_public_key::get_public_key,
            context::get_portal_address,
            rand::rand
        },
        types::vec::BoundedVec,
        constants_gen::EMPTY_NULLIFIED_COMMITMENT,
        state_vars::{avm_public_state::PublicState},
        //state_vars::{map::Map, public_state::PublicState, set::Set},
        state_vars::{map::Map, set::Set},
        types::type_serialization::{
            field_serialization::{FieldSerializationMethods, FIELD_SERIALIZED_LEN},
            bool_serialization::{BoolSerializationMethods, BOOL_SERIALIZED_LEN},
            aztec_address_serialization::{AztecAddressSerializationMethods, AZTEC_ADDRESS_SERIALIZED_LEN},
        },
        types::address::{AztecAddress},
    };
    //use dep::token_portal_content_hash_lib::{get_mint_private_content_hash, get_mint_public_content_hash};

    use crate::types::{
        transparent_note::{TransparentNote, TransparentNoteMethods, TRANSPARENT_NOTE_LEN},
        token_note::{TokenNote, TokenNoteMethods, TOKEN_NOTE_LEN},
        safe_u120_serialization::{SafeU120SerializationMethods, SAFE_U120_SERIALIZED_LEN}
    };


    //struct Map<V> {
    //    storage_slot: Field,
    //    state_var_constructor: fn(Context, Field) -> V,
    //}
    //impl<V> Map<V> {
    //    pub fn new(
    //        storage_slot: Field,
    //        state_var_constructor: fn(Field) -> V,
    //    ) -> Map<V> {
    //        assert(storage_slot != 0, "Storage slot 0 not allowed. Storage slots must start from 1.");
    //        Map {
    //            storage_slot,
    //            state_var_constructor,
    //        }
    //    }
    //    pub fn at(self, key: Field) -> V {
    //        // TODO(#1204): use a generator index for the storage slot
    //        let derived_storage_slot = dep::std::hash::pedersen([self.storage_slot, key])[0];

    //        let state_var_constructor = self.state_var_constructor;
    //        state_var_constructor(derived_storage_slot)
    //    }
    //}

    struct Storage {
        //admin: PublicState<AztecAddress, AZTEC_ADDRESS_SERIALIZED_LEN>,
        //public_balances: Map<PublicState<SafeU120, SAFE_U120_SERIALIZED_LEN>>,
        public_balances: Map<PublicState<Field, FIELD_SERIALIZED_LEN>>,
    }

    //impl Storage {
        //fn init() -> pub Self {
            //Storage {
                //admin: PublicState::new(
                    //1,
                    //AztecAddressSerializationMethods,
                //),
                //public_balances: Map::new(
                    //2,
                    //|slot| {
                        //PublicState::new(
                            //slot,
                            //SafeU120SerializationMethods,
                        //)
                    //},
                //),
            //}
        //}
    //}
    impl Storage {
        fn init(context: Context) -> pub Self {
            Storage {
                //admin: PublicState::new(
                //    context,
                //    1,
                //    AztecAddressSerializationMethods,
                //),
                public_balances: Map::new(
                    context,
                    6,
                    |context, slot| {
                        PublicState::new(
                            context,
                            slot,
                            FieldSerializationMethods,
                            //SafeU120SerializationMethods,
                        )
                    },
                ),
            }
        }
    }

    // FIXME: camelCase to snake_case!

    // Very basic example of a public function that just does an add
    unconstrained fn addExample(addArg0: Field, addArg1: Field) -> Field {
        addArg0 + addArg1
    }

    // Basic example of a public function that does some arithmetic
    // (unconstrained instead of public for now to force omission of macro-generated boilerplate)
    unconstrained fn arithmeticExample(addArg0: Field, addArg1: Field, subArg0: Field) -> Field {
        let added = addArg0 + addArg1;
        let doubled = added + added;
        let subbed = doubled - subArg0;
        subbed
    }

    unconstrained fn storageExample(addArg0: Field, slotArg: Field) -> Field {
        let readValue = sload(slotArg);
        let added = addArg0 + readValue;
        sstore(slotArg, added);
        sload(slotArg)
    }

    unconstrained fn nestedCallExample(nestedCallAddress: Field, addArg0: Field, addArg1: Field) -> Field {
        let gasLimit = 1234; // limit for nested call
        let returndata: [Field; 1] = call(gasLimit, nestedCallAddress, [addArg0, addArg1]);
        // To support dynamic returndata size, we need to first support RETURNDATASIZE/COPY and transpile them in
        // when a HeapVec is detected as the return type for this oracle.
        //let returndata = call(gasLimit, nestedCallAddress, [addArg0, addArg1]);
        returndata[0]
    }

    unconstrained fn public_balance_example(
        owner: AztecAddress,
    ) -> Field {
    //) -> u120 {
        let storage = Storage::init(Context::none());
        //storage.public_balances.at(owner.address).read().value
        storage.public_balances.at(owner.address).read() // as u120
    }
}
