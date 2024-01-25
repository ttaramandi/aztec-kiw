// A contract used along with `Parent` contract to test nested calls.
contract UnitTest {
    use dep::std::option::Option;
    use dep::std::test::OracleMock;

    use dep::aztec::{
        abi::{CallContext, PrivateContextInputs, PublicContextInputs},
        context::{PrivateContext, PublicContext, Context},
        log::emit_unencrypted_log,
        state_vars::{public_state::PublicState, singleton::Singleton},
        types::type_serialization::{
            field_serialization::{FieldSerializationMethods, FIELD_SERIALIZED_LEN},
            address_serialization::{AddressSerializationMethods, AZTEC_ADDRESS_SERIALIZED_LEN},
        },
        oracle::rand::rand,
    };
    use dep::aztec::protocol_types::{
        abis::{function_selector::FunctionSelector,side_effect::{SideEffect, SideEffectLinkedToNoteHash}},
        address::AztecAddress,
        constants::{VIEW_NOTE_ORACLE_RETURN_LENGTH,CALL_PRIVATE_FUNCTION_RETURN_SIZE},
        hash::hash_args,
    };
    use dep::field_note::field_note::{FieldNote, FieldNoteMethods, FIELD_NOTE_LEN};

    struct Storage {
        admin: PublicState<AztecAddress, AZTEC_ADDRESS_SERIALIZED_LEN>,
        admin_pvt: Singleton<FieldNote, FIELD_NOTE_LEN>,

    }
    impl Storage {
        fn init(context: Context) -> Self {
            Storage {
                admin: PublicState::new(
                    context,
                    1,
                    AddressSerializationMethods,
                ),
                admin_pvt: Singleton::new(context, 2, FieldNoteMethods),

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
        let serializedAdminValue = admin.serialize(); // [10]
        let randomHashValue = [1];
        let _mock1 = OracleMock::mock("storageWrite").with_params((1, serializedAdminValue)).returns(randomHashValue);
        init(PublicContextInputs::empty(), admin);
        _mock1.clear();

        OracleMock::mock("storageRead").with_params((1, 1)).returns(serializedAdminValue);
        let pub_circ_pub_inputs = get_admin(PublicContextInputs::empty());
        assert_eq(AztecAddress::from_field(pub_circ_pub_inputs.return_values[0]), admin);
    }

    //////////////////////
    // test private storage
    //////////////////////
    #[aztec(private)]
    fn init_pvt(admin: AztecAddress) {
        let mut admin_note = FieldNote::new(admin.to_field());
        storage.admin_pvt.initialize(&mut admin_note, false);
    }
    #[aztec(private)]
    fn update_pvt(admin: AztecAddress) {
        let mut admin_note = FieldNote::new(admin.to_field());
        storage.admin_pvt.replace(&mut admin_note, false);
    }
    #[aztec(private)]
    fn get_admin_pvt() -> FieldNote {
        storage.admin_pvt.view_note()
    }

    #[test]
    unconstrained fn test_private_storage() {
        let admin_pvt_addr = AztecAddress { inner: 10 };
        let admin_note = FieldNote::new(10);

        // create mock
        let storageSlot = 2;
        let randomHashValue = 0;
        let inner_hash = dep::aztec::note::note_hash::compute_inner_hash(storageSlot, admin_note.compute_note_hash());
        let _mock1 = OracleMock::mock("notifyCreatedNote").with_params((storageSlot, admin_note.serialize(), inner_hash)).returns(randomHashValue);

        // call fn 
        let pvt_circ_pub_inputs = init_pvt(PrivateContextInputs::empty(), admin_pvt_addr);
        // check 1 commitment was created:
        // pvt_circ_pub_inputs.new_commitments is a fixed size array of `SideEffect` objects - each with a counter
        // There should be just 1 non empty SideEffect object!
        assert(pvt_circ_pub_inputs.new_commitments[0] != SideEffect::empty()); // has some note hash!
        // check all subsequent commitments have 0 counter/ 0 value
        // note that side effect objects are typically sorted decreasingly so no need to check others 
        // if we check the `counter` on pvt_circ_pub_inputs.new_commitments[0]
        assert_eq(pvt_circ_pub_inputs.new_commitments[1], SideEffect::empty());

        // check 1 nullifier was created
        assert(pvt_circ_pub_inputs.new_nullifiers[0] != SideEffectLinkedToNoteHash::empty()); // has some nullifier
        // check all other are 0s..
        // ...
        _mock1.clear();

        // test reading the note:
        let mut returnVal = [0; VIEW_NOTE_ORACLE_RETURN_LENGTH];
        returnVal[0] = 1; // return header - num_notes
        returnVal[1] = 1; // return header - num_contract_address
        returnVal[2] = 1; // return header - nonce
        returnVal[3] = 0; // return header - is_transient
        returnVal[4] = admin_note.value; // note 1 - value
        // TODO: mock individual items. (print value going to `get_notes_oracle() in notes.nr)
        OracleMock::mock("getNotes").returns(returnVal).times(2);
        let pvt_circ_pub_inputs = get_admin_pvt(PrivateContextInputs::empty());
        assert_eq(pvt_circ_pub_inputs.return_values[0], 10);
    }

    //////////////////////
    // mock another function call
    //////////////////////
    #[aztec(private)]
    fn calls_public_and_private_from_private(admin: AztecAddress) {
        context.call_public_function(
            context.this_address(),
            FunctionSelector::from_signature("init((Field))"),
            [admin.to_field()]
        );
        context.call_private_function(
            context.this_address(),
            FunctionSelector::from_signature("update_pvt((Field))"),
            [admin.to_field()]
        );
    }
    // #[aztec(public)]
    // fn calls_public_from_public(admin: AztecAddress) {
    //     context.call_public_function(
    //         context.this_address(),
    //         FunctionSelector::from_signature("init((Field))"),
    //         [admin.to_field()]
    //     );
    // }

    #[test]
    fn test_pvt_calls_other_functions() {
        let admin = AztecAddress { inner: 11 };
        let serializedAdminValue = admin.serialize();
        let this_contract_address = AztecAddress::zero();
        let pub_fn_call_selector = FunctionSelector::from_signature("init((Field))");
        let pvt_fn_call_selector = FunctionSelector::from_signature("update_pvt((Field))");
        let args_hash = hash_args(serializedAdminValue);
        let side_effect_counter = 0;

        // mock response to call_private_function based on what is needed by  private_context.call_private_function_with_packed_args()
        let mut mocked_call_private_function_return_data = [0; CALL_PRIVATE_FUNCTION_RETURN_SIZE];
        mocked_call_private_function_return_data[0] = this_contract_address.to_field();
        mocked_call_private_function_return_data[1] = pvt_fn_call_selector.to_field(); // FunctionData.selector
        mocked_call_private_function_return_data[13] = args_hash;

        //  mock response to call_public_function based on what is needed by private_context.call_public_function_with_packed_args()
        let mut mocked_enqueued_public_fn_call_return_data = [0; dep::aztec::oracle::enqueue_public_function_call::ENQUEUE_PUBLIC_FUNCTION_CALL_RETURN_SIZE];
        mocked_enqueued_public_fn_call_return_data[0] = this_contract_address.to_field();
        mocked_enqueued_public_fn_call_return_data[1] = pub_fn_call_selector.to_field(); // FunctionData.selector
        mocked_enqueued_public_fn_call_return_data[13] = args_hash;

        OracleMock::mock("packArguments").with_params(serializedAdminValue).returns(args_hash).times(2);
        OracleMock::mock("callPrivateFunction").with_params((this_contract_address, pvt_fn_call_selector, args_hash, side_effect_counter)).returns(mocked_call_private_function_return_data);
        OracleMock::mock("enqueuePublicFunctionCall").with_params((this_contract_address, pub_fn_call_selector, args_hash, side_effect_counter)).returns(mocked_enqueued_public_fn_call_return_data);
        calls_public_and_private_from_private(PrivateContextInputs::empty(), admin);
        // this would call
        // for public update ->
        // OracleMock::mock("storageWrite").with_params((1, serializedAdminValue)).returns([args_hash]); // random hash value
        // init(PublicContextInputs::empty(), admin);
        // for private update ->
        // let mut returnVal = [0; VIEW_NOTE_ORACLE_RETURN_LENGTH];
        // returnVal[0] = 1; // return header - num_notes
        // returnVal[4] = admin_note.value; // note 1 - value
        // OracleMock::mock("getNotes").returns(returnVal).times(2);
        // let inner_hash = dep::aztec::note::note_hash::compute_inner_hash(storageSlot, admin_note.compute_note_hash());
        // let nullifier = admin_note.compute_nullifier());
        // OracleMock::mock("notifyNullifiedNote").with_params((nullifier, inner_hash)).returns(randomHashValue);
        // OracleMock::mock("notifyCreatedNote").with_params((storageSlot, admin_note.serialize(), inner_hash)).returns(randomHashValue);
        // 1 nullifier, 1 read request, 1 commitment
    }

    // authwits

    // l1<>l2

    unconstrained fn compute_note_hash_and_nullifier(
        contract_address: AztecAddress,
        nonce: Field,
        storage_slot: Field,
        serialized_note: [Field; 0]
    ) -> pub [Field; 4] {
        [0, 0, 0, 0]
    }
}
