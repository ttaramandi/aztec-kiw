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
            avm::{storage_read, storage_write, sload, sstore, call, msg_sender},
            get_public_key::get_public_key,
            context::get_portal_address,
            rand::rand
        },
        types::vec::BoundedVec,
        constants_gen::EMPTY_NULLIFIED_COMMITMENT,
        state_vars::{avm_public_state::PublicState},
        state_vars::{map::Map, set::Set},
        types::type_serialization::{
            field_serialization::{FieldSerializationMethods, FIELD_SERIALIZED_LEN},
            bool_serialization::{BoolSerializationMethods, BOOL_SERIALIZED_LEN},
            aztec_address_serialization::{AztecAddressSerializationMethods, AZTEC_ADDRESS_SERIALIZED_LEN},
        },
        types::address::{AztecAddress},
        selector::compute_selector,
    };
    use dep::authwit::{
        auth::{
            assert_current_call_valid_authwit_public_avm,
        },
    };

    use crate::types::{
        transparent_note::{TransparentNote, TransparentNoteMethods, TRANSPARENT_NOTE_LEN},
        token_note::{TokenNote, TokenNoteMethods, TOKEN_NOTE_LEN},
        safe_u120_serialization::{SafeU120SerializationMethods, SAFE_U120_SERIALIZED_LEN}
    };


    struct Storage {
        admin: PublicState<AztecAddress, AZTEC_ADDRESS_SERIALIZED_LEN>,
        minters: Map<PublicState<bool, BOOL_SERIALIZED_LEN>>,
        total_supply: PublicState<Field, FIELD_SERIALIZED_LEN>,
        public_balances: Map<PublicState<Field, FIELD_SERIALIZED_LEN>>,
    }

    impl Storage {
        fn init(context: Context) -> pub Self {
            Storage {
                admin: PublicState::new(
                    context,
                    1,
                    AztecAddressSerializationMethods,
                ),
                minters: Map::new(
                    context,
                    2,
                    |context, slot| {
                        PublicState::new(
                            context,
                            slot,
                            BoolSerializationMethods,
                        )
                    },
                ),
                total_supply: PublicState::new(
                    context,
                    4,
                    //SafeU120SerializationMethods,
                    FieldSerializationMethods,
                ),
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

    #[aztec(private)]
    fn constructor(admin: AztecAddress) {
        // FIXME: need to get AVM keccak256 working to use compute_selector
        //let selector = compute_selector("_initialize((Field))");
        let selector = 0x76c992eb;
        context.call_public_function(context.this_address(), selector, [admin.address]);
    }

    unconstrained fn _initialize(
        new_admin: AztecAddress,
    ) {
        storage.admin.write(new_admin);
        storage.minters.at(new_admin.address).write(true);
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

    unconstrained fn context_vars_example() -> Field {
        msg_sender()
    }

    unconstrained fn transfer_public(
        from: AztecAddress,
        to: AztecAddress,
        amount: Field,
        nonce: Field,
    ) -> Field {
        if (from.address != msg_sender()) {
            assert_current_call_valid_authwit_public_avm(from);
        } else {
            assert(nonce == 0, "invalid nonce");
        }

        //let amount = SafeU120::new(amount);
        let from_balance = storage.public_balances.at(from.address).read() - amount;
        storage.public_balances.at(from.address).write(from_balance);

        let to_balance = storage.public_balances.at(to.address).read() + amount;
        storage.public_balances.at(to.address).write(to_balance);

        1
    }

    unconstrained fn admin() -> Field {
        storage.admin.read().address
    }

    unconstrained fn is_minter(
        minter: AztecAddress,
    ) -> bool {
        storage.minters.at(minter.address).read()
    }

    //unconstrained fn total_supply() -> u120 {
    unconstrained fn total_supply() -> Field {
        //storage.total_supply.read().value
        storage.total_supply.read()
    }

    unconstrained fn balance_of_public(
        owner: AztecAddress,
    ) -> Field {
    //) -> u120 {
        let storage = Storage::init(Context::none());
        //storage.public_balances.at(owner.address).read().value
        storage.public_balances.at(owner.address).read() // as u120
    }

    unconstrained fn set_admin(
        new_admin: AztecAddress,
    ) {
        assert(storage.admin.read().eq(AztecAddress::new(msg_sender())), "caller is not admin");
        storage.admin.write(new_admin);
    }

    unconstrained fn set_minter(
        minter: AztecAddress,
        approve: bool,
    ) {
        assert(storage.admin.read().eq(AztecAddress::new(msg_sender())), "caller is not admin");
        storage.minters.at(minter.address).write(approve);
    }

    unconstrained fn mint_public(
        to: AztecAddress,
        amount: Field,
    ) -> Field {
        assert(storage.minters.at(msg_sender()).read(), "caller is not minter");
        //let amount = SafeU120::new(amount);
        let storageSlot = storage.public_balances.at(to.address);
        let new_balance = storageSlot.read() + amount;
        let mut supply = storage.total_supply.read();
        supply = supply + amount;

        storageSlot.write(new_balance);
        storage.total_supply.write(supply);
        1
    }
}
