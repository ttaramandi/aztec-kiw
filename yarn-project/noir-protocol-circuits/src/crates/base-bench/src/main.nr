use dep::rollup_lib::abis::append_only_tree_snapshot::AppendOnlyTreeSnapshot;
use dep::rollup_lib::abis::nullifier_leaf_preimage::NullifierLeafPreimage;
use dep::rollup_lib::merkle_tree::{calculate_subtree, calculate_empty_tree_root};

use dep::aztec::constants_gen::{
    MAX_NEW_NULLIFIERS_PER_TX,
    MAX_NEW_NULLIFIERS_PER_BASE_ROLLUP,
    NULLIFIER_SUBTREE_SIBLING_PATH_LENGTH,
    NULLIFIER_SUBTREE_HEIGHT,
};
use dep::types::abis::membership_witness::NullifierMembershipWitness;

fn check_permutation<N>(original_array: [Field; N], sorted_array: [Field; N], indexes: [u32; N]) {
    let mut seen_nullifier = [false; N];
    for i in 0..N {
        let index = indexes[i];
        let nullifier = sorted_array[i];
        let original_nullifier = original_array[index];
        assert_eq(nullifier, original_nullifier, "Invalid nullifier index");
        assert(!seen_nullifier[index], "Duplicated nullifier index");
        seen_nullifier[index] = true;
    }
}

fn check_high_to_low<N>(array: [Field; N]) {
    for i in 1..N {
        let item = array[i];
        let prev_item = array[i-1];
        let is_lt = less_than_field(item, prev_item);
        assert(is_lt | ((prev_item == 0) & (item == 0)), "Array must be sorted from high to low");
    }
}

fn create_nullifier_subtree<N>(leaves: [NullifierLeafPreimage; N]) -> Field {
    calculate_subtree(leaves.map(|leaf:NullifierLeafPreimage| leaf.hash()))
}

// Batched insertion
fn main(
    start_nullifier_tree_snapshot: AppendOnlyTreeSnapshot, 
    nullifiers_to_insert: [Field; MAX_NEW_NULLIFIERS_PER_BASE_ROLLUP],
    sorted_nullifiers: [Field; MAX_NEW_NULLIFIERS_PER_BASE_ROLLUP],
    sorted_nullifiers_indexes: [u32; MAX_NEW_NULLIFIERS_PER_BASE_ROLLUP],
    new_nullifiers_subtree_sibling_path: [Field; NULLIFIER_SUBTREE_SIBLING_PATH_LENGTH],
    low_nullifier_leaf_preimages: [NullifierLeafPreimage; MAX_NEW_NULLIFIERS_PER_BASE_ROLLUP],
    low_nullifier_membership_witness: [NullifierMembershipWitness; MAX_NEW_NULLIFIERS_PER_BASE_ROLLUP],
) -> pub AppendOnlyTreeSnapshot {
    // A high to low permutation to the nullifiers is provided to make the insertion use only one insertion strategy
    check_permutation(nullifiers_to_insert, sorted_nullifiers, sorted_nullifiers_indexes);
    check_high_to_low(sorted_nullifiers);

    // Now, update the existing leaves with the new nullifiers
    let mut current_nullifier_tree_root = start_nullifier_tree_snapshot.root;
    let mut nullifier_insertion_subtree = [NullifierLeafPreimage::default(); MAX_NEW_NULLIFIERS_PER_BASE_ROLLUP];
    let start_insertion_index = start_nullifier_tree_snapshot.next_available_leaf_index;

    for i in 0..sorted_nullifiers.len() {
        let nullifier = sorted_nullifiers[i];
        if nullifier != 0 {
            let low_nullifier_preimage = low_nullifier_leaf_preimages[i];
            let witness = low_nullifier_membership_witness[i];
            
            let is_less_than_nullifier = less_than_field(low_nullifier_preimage.leaf_value, nullifier);
            let is_next_greater_than = less_than_field(nullifier, low_nullifier_preimage.next_value);
            assert(is_less_than_nullifier & is_next_greater_than, "Invalid nullifier range");

            // Recreate the original low nullifier from the preimage
            let original_low_nullifier = NullifierLeafPreimage{
                leaf_value : low_nullifier_preimage.leaf_value,
                next_value : low_nullifier_preimage.next_value,
                next_index : low_nullifier_preimage.next_index,
            };

            // perform membership check for the low nullifier against the original root
            dep::rollup_lib::components::assert_check_membership(
                original_low_nullifier.hash(),
                witness.leaf_index,
                witness.sibling_path,
                current_nullifier_tree_root,
            );

            let nullifier_index = sorted_nullifiers_indexes[i];

            // Calculate the new value of the low_nullifier_leaf
            let updated_low_nullifier = NullifierLeafPreimage{
                leaf_value : low_nullifier_preimage.leaf_value,
                next_value : nullifier,
                next_index : start_insertion_index+nullifier_index, 
            };

            current_nullifier_tree_root = dep::rollup_lib::components::root_from_sibling_path(
                updated_low_nullifier.hash(), witness.leaf_index, witness.sibling_path);

            nullifier_insertion_subtree[nullifier_index] = NullifierLeafPreimage {
                leaf_value : nullifier,
                next_value : low_nullifier_preimage.next_value,
                next_index : low_nullifier_preimage.next_index,
            };
        }
    }

    let empty_nullifier_subtree_root = calculate_empty_tree_root(NULLIFIER_SUBTREE_HEIGHT);
    let leafIndexNullifierSubtreeDepth = start_insertion_index >> (NULLIFIER_SUBTREE_HEIGHT as u32);
    dep::rollup_lib::components::assert_check_membership(
        empty_nullifier_subtree_root,
        leafIndexNullifierSubtreeDepth as Field,
        new_nullifiers_subtree_sibling_path,
        current_nullifier_tree_root,
    );

    // Create new nullifier subtree to insert into the whole nullifier tree
    let nullifier_sibling_path = new_nullifiers_subtree_sibling_path;
    let nullifier_subtree_root = create_nullifier_subtree(nullifier_insertion_subtree);

    // Calculate the new root
    // We are inserting a subtree rather than a full tree here
    let subtree_index = start_insertion_index >> (NULLIFIER_SUBTREE_HEIGHT as u32);
    let new_root = dep::rollup_lib::components::root_from_sibling_path(nullifier_subtree_root, subtree_index as Field, nullifier_sibling_path);

    AppendOnlyTreeSnapshot {
        root: new_root,
        next_available_leaf_index: start_insertion_index + (nullifiers_to_insert.len() as u32),
    }
}

// Naive non-batched insertion
fn non_batched(
    start_nullifier_tree_snapshot: AppendOnlyTreeSnapshot, 
    nullifiers_to_insert: [Field; MAX_NEW_NULLIFIERS_PER_BASE_ROLLUP],
    new_nullifiers_sibling_paths: [[Field; NULLIFIER_SUBTREE_SIBLING_PATH_LENGTH]; MAX_NEW_NULLIFIERS_PER_BASE_ROLLUP],
    low_nullifier_leaf_preimages: [NullifierLeafPreimage; MAX_NEW_NULLIFIERS_PER_BASE_ROLLUP],
    low_nullifier_membership_witness: [NullifierMembershipWitness; MAX_NEW_NULLIFIERS_PER_BASE_ROLLUP],
) -> pub AppendOnlyTreeSnapshot {
    let mut current_nullifier_tree_root = start_nullifier_tree_snapshot.root;
    let start_insertion_index = start_nullifier_tree_snapshot.next_available_leaf_index;

    let empty_nullifier_hash = NullifierLeafPreimage::default().hash();

    for i in 0..nullifiers_to_insert.len() {
        let nullifier = nullifiers_to_insert[i];
        if nullifier != 0 {
            let low_nullifier_preimage = low_nullifier_leaf_preimages[i];
            let witness = low_nullifier_membership_witness[i];
            
            let is_less_than_nullifier = less_than_field(low_nullifier_preimage.leaf_value, nullifier);
            let is_next_greater_than = less_than_field(nullifier, low_nullifier_preimage.next_value);
            assert(is_less_than_nullifier & is_next_greater_than, "Invalid nullifier range");

            // Recreate the original low nullifier from the preimage
            let original_low_nullifier = NullifierLeafPreimage{
                leaf_value : low_nullifier_preimage.leaf_value,
                next_value : low_nullifier_preimage.next_value,
                next_index : low_nullifier_preimage.next_index,
            };

            // perform membership check for the low nullifier against the original root
            dep::rollup_lib::components::assert_check_membership(
                original_low_nullifier.hash(),
                witness.leaf_index,
                witness.sibling_path,
                current_nullifier_tree_root,
            );

            let new_nullifier_index = start_insertion_index + (i as u32);

            // Calculate the new value of the low_nullifier_leaf
            let updated_low_nullifier = NullifierLeafPreimage{
                leaf_value : low_nullifier_preimage.leaf_value,
                next_value : nullifier,
                next_index : new_nullifier_index, 
            };

            current_nullifier_tree_root = dep::rollup_lib::components::root_from_sibling_path(
                updated_low_nullifier.hash(), 
                witness.leaf_index, 
                witness.sibling_path
            );

            let nullifier_to_insert = NullifierLeafPreimage {
                leaf_value : nullifier,
                next_value : low_nullifier_preimage.next_value,
                next_index : low_nullifier_preimage.next_index,
            };

            let insertion_witness = new_nullifiers_sibling_paths[i];

            dep::rollup_lib::components::assert_check_membership(
                empty_nullifier_hash,
                new_nullifier_index as Field,
                insertion_witness,
                current_nullifier_tree_root,
            );

            current_nullifier_tree_root = dep::rollup_lib::components::root_from_sibling_path(
                nullifier_to_insert.hash(), 
                new_nullifier_index as Field, 
                insertion_witness
            );
        }
    }

    AppendOnlyTreeSnapshot {
        root: current_nullifier_tree_root,
        next_available_leaf_index: start_insertion_index + (nullifiers_to_insert.len() as u32),
    }
}

fn less_than_field(lhs: Field, rhs: Field) -> bool {
    dep::std::eddsa::lt_bytes32(lhs, rhs)
}