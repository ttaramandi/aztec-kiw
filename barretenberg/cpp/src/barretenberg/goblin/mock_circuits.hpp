#pragma once

// #include "barretenberg/benchmark/ultra_bench/mock_proofs.hpp"
#include "barretenberg/commitment_schemes/commitment_key.hpp"
#include "barretenberg/crypto/ecdsa/ecdsa.hpp"
#include "barretenberg/flavor/goblin_ultra.hpp"
#include "barretenberg/goblin/goblin.hpp"
#include "barretenberg/proof_system/circuit_builder/goblin_ultra_circuit_builder.hpp"
#include "barretenberg/srs/global_crs.hpp"
#include "barretenberg/stdlib/encryption/ecdsa/ecdsa.hpp"
#include "barretenberg/stdlib/hash/sha256/sha256.hpp"
#include "barretenberg/stdlib/merkle_tree/membership.hpp"
#include "barretenberg/stdlib/merkle_tree/memory_store.hpp"
#include "barretenberg/stdlib/merkle_tree/merkle_tree.hpp"
#include "barretenberg/stdlib/primitives/curves/secp256k1.hpp"
#include "barretenberg/stdlib/primitives/packed_byte_array/packed_byte_array.hpp"
#include "barretenberg/stdlib/recursion/honk/verifier/ultra_recursive_verifier.hpp"

namespace bb {
class GoblinMockCircuits {
  public:
    using Curve = curve::BN254;
    using FF = Curve::ScalarField;
    using Fbase = Curve::BaseField;
    using Point = Curve::AffineElement;
    using CommitmentKey = bb::honk::pcs::CommitmentKey<Curve>;
    using OpQueue = bb::ECCOpQueue;
    using GoblinUltraBuilder = bb::GoblinUltraCircuitBuilder;
    using Flavor = bb::honk::flavor::GoblinUltra;
    using RecursiveFlavor = bb::honk::flavor::GoblinUltraRecursive_<GoblinUltraBuilder>;
    using RecursiveVerifier = bb::stdlib::recursion::honk::UltraRecursiveVerifier_<RecursiveFlavor>;
    using KernelInput = Goblin::AccumulationOutput;
    static constexpr size_t NUM_OP_QUEUE_COLUMNS = Flavor::NUM_WIRES;

    /**
     * @brief Populate a builder with a specified number of arithmetic gates; includes a PI
     *
     * @param builder
     * @param num_gates
     */
    static void construct_arithmetic_circuit(GoblinUltraBuilder& builder, size_t num_gates = 1)
    {
        // For good measure, include a gate with some public inputs
        {
            FF a = FF::random_element();
            FF b = FF::random_element();
            FF c = FF::random_element();
            FF d = a + b + c;
            uint32_t a_idx = builder.add_public_variable(a);
            uint32_t b_idx = builder.add_variable(b);
            uint32_t c_idx = builder.add_variable(c);
            uint32_t d_idx = builder.add_variable(d);

            builder.create_big_add_gate({ a_idx, b_idx, c_idx, d_idx, FF(1), FF(1), FF(1), FF(-1), FF(0) });
        }
        // Add arbitrary arithmetic gates to obtain a total of num_gates-many gates
        for (size_t i = 0; i < num_gates - 1; ++i) {
            FF a = FF::random_element();
            FF b = FF::random_element();
            FF c = FF::random_element();
            FF d = a + b + c;
            uint32_t a_idx = builder.add_variable(a);
            uint32_t b_idx = builder.add_variable(b);
            uint32_t c_idx = builder.add_variable(c);
            uint32_t d_idx = builder.add_variable(d);

            builder.create_big_add_gate({ a_idx, b_idx, c_idx, d_idx, FF(1), FF(1), FF(1), FF(-1), FF(0) });
        }
    }

    /**
     * @brief Populate a builder with some arbitrary goblinized ECC ops
     *
     * @param builder
     */
    static void construct_goblin_ecc_op_circuit(GoblinUltraBuilder& builder)
    {
        // Add a mul accum op and an equality op
        auto point = Point::one() * FF::random_element();
        auto scalar = FF::random_element();
        builder.queue_ecc_mul_accum(point, scalar);
        builder.queue_ecc_eq();
    }

    /**
     * @brief Populate a builder with some arbitrary but nontrivial constraints
     * @details Although the details of the circuit constructed here are arbitrary, the intent is to mock something a
     * bit more realistic than a circuit comprised entirely of arithmetic gates. E.g. the circuit should respond
     * realistically to efforts to parallelize circuit construction.
     *
     * @param builder
     */
    static void construct_mock_function_circuit(GoblinUltraBuilder& builder)
    {
        // WORKTODO: decide what to put here and how best to control circuit size
        stdlib::generate_sha256_test_circuit(builder, /*num_iterations=*/1);
        stdlib::generate_ecdsa_verification_test_circuit(builder, /*num_iterations=*/1);
        stdlib::merkle_tree::generate_merkle_membership_test_circuit(builder, /*num_iterations=*/1);
        construct_arithmetic_circuit(builder, 1 << 4);

        // WORKTODO: its not clear whether goblin ops will be supported for function circuits initially but for UGH can
        // only be used if some op gates are included so for now we'll assume each function circuit has some.
        construct_goblin_ecc_op_circuit(builder);
    }

    /**
     * @brief Mock the interactions of a simple curcuit with the op_queue
     * @todo The transcript aggregation protocol in the Goblin proof system can not yet support an empty "previous
     * transcript" (see issue #723) because the corresponding commitments are zero / the point at infinity. This
     * function mocks the interactions with the op queue of a fictional "first" circuit. This way, when we go to
     * generate a proof over our first "real" circuit, the transcript aggregation protocol can proceed nominally.
     * The mock data is valid in the sense that it can be processed by all stages of Goblin as if it came from a
     * genuine circuit.
     *
     *
     * @param op_queue
     */
    static void perform_op_queue_interactions_for_mock_first_circuit(std::shared_ptr<bb::ECCOpQueue>& op_queue)
    {
        bb::GoblinUltraCircuitBuilder builder{ op_queue };

        // Add some goblinized ecc ops
        construct_goblin_ecc_op_circuit(builder);

        op_queue->set_size_data();

        // Manually compute the op queue transcript commitments (which would normally be done by the merge prover)
        auto crs_factory_ = bb::srs::get_crs_factory();
        auto commitment_key = CommitmentKey(op_queue->get_current_size(), crs_factory_);
        std::array<Point, Flavor::NUM_WIRES> op_queue_commitments;
        size_t idx = 0;
        for (auto& entry : op_queue->get_aggregate_transcript()) {
            op_queue_commitments[idx++] = commitment_key.commit(entry);
        }
        // Store the commitment data for use by the prover of the next circuit
        op_queue->set_commitment_data(op_queue_commitments);
    }

    /**
     * @brief Generate a simple test circuit with some ECC op gates and conventional arithmetic gates
     *
     * @param builder
     */
    static void construct_simple_initial_circuit(GoblinUltraBuilder& builder)
    {
        // TODO(https://github.com/AztecProtocol/barretenberg/issues/800) Testing cleanup
        perform_op_queue_interactions_for_mock_first_circuit(builder.op_queue);

        // Add some arbitrary ecc op gates
        for (size_t i = 0; i < 3; ++i) {
            auto point = Point::random_element();
            auto scalar = FF::random_element();
            builder.queue_ecc_add_accum(point);
            builder.queue_ecc_mul_accum(point, scalar);
        }
        // queues the result of the preceding ECC
        builder.queue_ecc_eq(); // should be eq and reset

        construct_arithmetic_circuit(builder, 350000);
    }

    /**
     * @brief Construct a mock kernel circuit
     * @details This circuit contains (1) some basic/arbitrary arithmetic gates, (2) recursive verification of a
     * function circuit proof, and optionally (3) recursive verification of a previous kernel circuit proof
     *
     * TODO(https://github.com/AztecProtocol/barretenberg/issues/801): Pairing point aggregation not implemented
     * @param builder
     * @param function_accum {proof, vkey} for function circuit to be recursively verified
     * @param prev_kernel_accum {proof, vkey} for previous kernel circuit to be recursively verified
     */
    static void construct_mock_kernel_circuit(GoblinUltraBuilder& builder,
                                              const KernelInput& function_accum,
                                              const KernelInput& prev_kernel_accum)
    {
        // Generic operations e.g. state updates (just arith gates for now)
        GoblinMockCircuits::construct_arithmetic_circuit(builder, /*num_gates=*/1 << 4);

        // Execute recursive aggregation of function proof
        RecursiveVerifier verifier1{ &builder, function_accum.verification_key };
        verifier1.verify_proof(function_accum.proof);

        // Execute recursive aggregation of previous kernel proof if one exists
        if (!prev_kernel_accum.proof.proof_data.empty()) {
            RecursiveVerifier verifier2{ &builder, prev_kernel_accum.verification_key };
            verifier2.verify_proof(prev_kernel_accum.proof);
        }
    }
};
} // namespace bb