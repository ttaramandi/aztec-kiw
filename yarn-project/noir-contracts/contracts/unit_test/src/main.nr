// A contract used along with `Parent` contract to test nested calls.
contract UnitTest {
    use dep::std::option::Option;
    use dep::std::test::OracleMock;

    use dep::aztec::{
        abi::{CallContext, PrivateContextInputs},
        context::{PrivateContext, PublicContext, Context},
        log::emit_unencrypted_log,
        state_vars::public_state::PublicState,
        types::type_serialization::{
            field_serialization::{FieldSerializationMethods, FIELD_SERIALIZED_LEN},
            address_serialization::{AddressSerializationMethods, AZTEC_ADDRESS_SERIALIZED_LEN},
        },
        oracle::rand::rand,
    };
    use dep::aztec::protocol_types::{
        abis::function_selector::FunctionSelector,
        address::AztecAddress,
    };

    struct Storage {
        admin: PublicState<AztecAddress, AZTEC_ADDRESS_SERIALIZED_LEN>
    }
    impl Storage {
        fn init(context: Context) -> Self {
            Storage {
                // docs:start:storage_admin_init
                admin: PublicState::new(
                    context,
                    1,
                    AddressSerializationMethods,
                ),
            }
        }
    }

    #[aztec(private)]
    fn constructor() {}

    #[aztec(public)]
    fn init(new_admin: AztecAddress) {
        storage.admin.write(new_admin);
    }

    #[aztec(private)]
    fn add(a: Field, b: Field) -> Field {
        rand() + b
    }

    #[test]
    unconstrained fn test_add() {
        let priv_circ_pub_inputs = add(PrivateContextInputs::empty(), 1, 2);
        assert_eq(priv_circ_pub_inputs.return_values[0], 3);
    }
    // #[aztec(private)]
    // fn add_rand(b: Field) -> Field {
    //     rand() + b
    // }
    // #[test]
    // unconstrained fn test_add_rand() {
    //     OracleMock::mock("getRandomField").returns(1).times(1);
    //     OracleMock::mock("getRandomField").returns(2).times(1);
    //     OracleMock::mock("getRandomField").returns(3).times(1);
    //     let priv_circ_pub_inputs = add_rand(PrivateContextInputs::empty(), 2);
    //     assert(2.lt(priv_circ_pub_inputs.return_values[0]), "Is not less than!!");
    // }
    // Storage:
    // only mock storageWrite when called with the right args!
    // i.e. test args passed correctly

    unconstrained fn compute_note_hash_and_nullifier(
        contract_address: AztecAddress,
        nonce: Field,
        storage_slot: Field,
        serialized_note: [Field; 0]
    ) -> pub [Field; 4] {
        [0, 0, 0, 0]
    }
}
