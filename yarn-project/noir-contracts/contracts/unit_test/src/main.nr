// A contract used along with `Parent` contract to test nested calls.
contract UnitTest {
    use dep::std::option::Option;
    use dep::std::test::OracleMock;

    use dep::aztec::{
        abi::{CallContext, PrivateContextInputs, PublicContextInputs},
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

    //////////////////////
    // test a plain and simple function:
    //////////////////////
    #[aztec(private)]
    fn add(a: Field, b: Field) -> Field {
        a + b
    }
    #[test]
    unconstrained fn test_add() {
        let priv_circ_pub_inputs = add(PrivateContextInputs::empty(), 1, 2);
        assert_eq(priv_circ_pub_inputs.return_values[0], 3);
    }

    //////////////////////
    // test the simplest oracle call
    //////////////////////
    #[aztec(private)]
    fn add_rand(b: Field) -> Field {
        rand() + b
    }
    #[test]
    unconstrained fn test_add_rand() {
        // bug where times has to be > 1.
        OracleMock::mock("getRandomField").returns(3).times(2);
        let priv_circ_pub_inputs = add_rand(PrivateContextInputs::empty(), 2);
        assert(2.lt(priv_circ_pub_inputs.return_values[0]), "Is not less than!!");
    }

    //////////////////////
    // Test public Storage
    //////////////////////
    #[aztec(public)]
    fn init(new_admin: AztecAddress) {
        storage.admin.write(new_admin);
    }

    #[aztec(public)]
    fn get_admin() -> AztecAddress {
        storage.admin.read()
    }

    #[test]
    unconstrained fn test_public_storage() {
        // currently can't check how many times a mock was called. Feature needed!
        // For now, You know the `init()` fn called the right oracle with the right params, else it would have crashed.
        let admin = AztecAddress { inner: 10 };
        let serializedAdminValue = [10]; // set admin valy
        let randomHashValue = [1];
        let _mock1 = OracleMock::mock("storageWrite").with_params((1, serializedAdminValue)).returns(randomHashValue);
        init(PublicContextInputs::empty(), admin);
        _mock1.clear();

        OracleMock::mock("storageRead").with_params((1, 1)).returns(serializedAdminValue);
        let pub_circ_pub_inputs = get_admin(PublicContextInputs::empty());
        assert_eq(AztecAddress::from_field(pub_circ_pub_inputs.return_values[0]), admin);
    }

    //////////////////////

    unconstrained fn compute_note_hash_and_nullifier(
        contract_address: AztecAddress,
        nonce: Field,
        storage_slot: Field,
        serialized_note: [Field; 0]
    ) -> pub [Field; 4] {
        [0, 0, 0, 0]
    }
}
