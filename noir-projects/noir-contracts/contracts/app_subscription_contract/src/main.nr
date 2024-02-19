mod subscription_note;

contract AppSubscriptionContract {
    use dep::std;
    use dep::std::option::Option;

    use dep::aztec::protocol_types::{address::AztecAddress, abis::function_selector::FunctionSelector};

    use dep::aztec::{
        context::{PrivateContext, Context}, note::{note_header::NoteHeader, utils as note_utils},
        oracle::get_public_key::get_public_key,
        state_vars::{map::Map, singleton::Singleton, public_state::PublicState, stable_public_state::StablePublicState}
    };
    use dep::authwit::{
        entrypoint::{function_call::FunctionCall, app::AppPayload, fee::FeePayload},
        account::AccountActions, auth_witness::get_auth_witness
    };

    use crate::subscription_note::{SubscriptionNote, SUBSCRIPTION_NOTE_LEN};

    struct Storage {
        target_address: StablePublicState<AztecAddress>,
        subscription_token_address: StablePublicState<AztecAddress>,
        subscription_recipient_address: StablePublicState<AztecAddress>,
        subscription_price: StablePublicState<Field>,
        subscriptions: Map<AztecAddress, Singleton<SubscriptionNote>>,
    }

    global SUBSCRIPTION_DURATION_IN_BLOCKS = 5;

    // Constructs the contract
    #[aztec(private)]
    fn constructor(
        target_address: AztecAddress,
        subscription_recipient_address: AztecAddress,
        subscription_token_address: AztecAddress,
        subscription_price: Field
    ) {
        context.call_public_function(
            context.this_address(),
            FunctionSelector::from_signature("init((Field),(Field),(Field),Field)"),
            [
            target_address.to_field(), subscription_token_address.to_field(), subscription_recipient_address.to_field(), subscription_price
        ]
        );
    }

    #[aztec(private)]
    fn entrypoint(call: FunctionCall, user_address: AztecAddress) {
        assert(context.msg_sender().to_field() == 0);
        assert(call.target_address == storage.target_address.read_private());
        let note = storage.subscriptions.at(user_address).get_note(false);
        assert(note.remaining_txs as u64 > 0);

        context.call_public_function(
            context.this_address(),
            FunctionSelector::from_signature("assert_block_number(Field)"),
            [note.expiry_block_number]
        );

        if call.is_public {
            context.call_public_function_with_packed_args(
                call.target_address,
                call.function_selector,
                call.args_hash,
                false,
                false
            );
        } else {
            let _result = context.call_private_function_with_packed_args(
                call.target_address,
                call.function_selector,
                call.args_hash,
                false,
                false
            );
        }
    }

    #[aztec(public)]
    internal fn init(
        target_address: AztecAddress,
        subscription_token_address: AztecAddress,
        subscription_recipient_address: AztecAddress,
        subscription_price: Field
    ) {
        storage.target_address.initialize(target_address);
        storage.subscription_token_address.initialize(subscription_token_address);
        storage.subscription_recipient_address.initialize(subscription_recipient_address);
        storage.subscription_price.initialize(subscription_price);
    }

    #[aztec(public)]
    internal fn assert_block_number(expiry_block_number: Field) {
        assert(
            (context.block_number() + SUBSCRIPTION_DURATION_IN_BLOCKS) as u64
            >= expiry_block_number as u64
        );
    }

    #[aztec(private)]
    fn subscribe(subscriber_address: AztecAddress, nonce: Field, expiry_block_number: Field) {
        let _ = context.call_private_function(
            storage.subscription_token_address.read_private(),
            FunctionSelector::from_signature("transfer((Field),(Field),Field,Field)"),
            [
            context.msg_sender().to_field(), storage.subscription_recipient_address.read_private().to_field(), storage.subscription_price.read_private(), nonce
        ]
        );

        // Assert that the given expiry_block_number < current_block_number + SUBSCRIPTION_DURATION_IN_BLOCKS.
        context.call_public_function(
            context.this_address(),
            FunctionSelector::from_signature("assert_block_number(Field)"),
            [expiry_block_number]
        );

        let mut subscription_note = SubscriptionNote::new(subscriber_address, expiry_block_number, 10);
        if (!is_initialized(subscriber_address)) {
            storage.subscriptions.at(subscriber_address).initialize(&mut subscription_note, true);
        } else {
            storage.subscriptions.at(subscriber_address).replace(&mut subscription_note, true)
        }
    }

    // Compiler bug workaround. You can't call an unconstrained function in another module, unless its from an
    // unconstained function in your module.
    unconstrained fn is_initialized(subscriber_address: AztecAddress) -> pub bool {
        storage.subscriptions.at(subscriber_address).is_initialized()
    }
}
