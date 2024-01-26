#pragma once
#include <benchmark/benchmark.h>
#include <cstddef>

#include "barretenberg/goblin/mock_circuits.hpp"
#include "barretenberg/plonk/composer/standard_composer.hpp"
#include "barretenberg/plonk/composer/ultra_composer.hpp"
#include "barretenberg/proof_system/types/circuit_type.hpp"
#include "barretenberg/stdlib/encryption/ecdsa/ecdsa.hpp"
#include "barretenberg/stdlib/hash/keccak/keccak.hpp"
#include "barretenberg/stdlib/hash/sha256/sha256.hpp"
#include "barretenberg/stdlib/merkle_tree/membership.hpp"
#include "barretenberg/stdlib/merkle_tree/memory_store.hpp"
#include "barretenberg/stdlib/merkle_tree/memory_tree.hpp"
#include "barretenberg/stdlib/merkle_tree/merkle_tree.hpp"
#include "barretenberg/stdlib/primitives/bool/bool.hpp"
#include "barretenberg/stdlib/primitives/curves/secp256k1.hpp"
#include "barretenberg/stdlib/primitives/field/field.hpp"
#include "barretenberg/stdlib/primitives/packed_byte_array/packed_byte_array.hpp"
#include "barretenberg/stdlib/primitives/witness/witness.hpp"
#include "barretenberg/ultra_honk/ultra_composer.hpp"
#include "barretenberg/ultra_honk/ultra_prover.hpp"

namespace bb::mock_proofs {

/**
 * @brief Generate test circuit with basic arithmetic operations
 *
 * @param composer
 * @param num_iterations
 */
template <typename Builder> void generate_basic_arithmetic_circuit(Builder& builder, size_t log2_num_gates)
{
    stdlib::field_t a(stdlib::witness_t(&builder, fr::random_element()));
    stdlib::field_t b(stdlib::witness_t(&builder, fr::random_element()));
    stdlib::field_t c(&builder);
    size_t passes = (1UL << log2_num_gates) / 4 - 4;
    if (static_cast<int>(passes) <= 0) {
        throw std::runtime_error("too few gates");
    }

    for (size_t i = 0; i < passes; ++i) {
        c = a + b;
        c = a * c;
        a = b * b;
        b = c * c;
    }
}

/**
 * @brief Generate test circuit with specified number of sha256 hashes
 *
 * @param builder
 * @param num_iterations
 */
template <typename Builder> void generate_sha256_test_circuit(Builder& builder, size_t num_iterations)
{
    std::string in;
    in.resize(32);
    stdlib::packed_byte_array<Builder> input(&builder, in);
    for (size_t i = 0; i < num_iterations; i++) {
        input = stdlib::sha256<Builder>(input);
    }
}

// WORKTODO: just get rid of these pass-throughs and call the mock circuit methods directly in ultra bench
/**
 * @brief Generate test circuit with specified number of keccak hashes
 *
 * @param builder
 * @param num_iterations
 */
template <typename Builder> void generate_keccak_test_circuit(Builder& builder, size_t num_iterations)
{
    GoblinMockCircuits::generate_sha256_test_circuit(builder, num_iterations);
}

/**
 * @brief Generate test circuit with specified number of ecdsa verifications
 *
 * @param builder
 * @param num_iterations
 */
template <typename Builder> void generate_ecdsa_verification_test_circuit(Builder& builder, size_t num_iterations)
{
    GoblinMockCircuits::generate_ecdsa_verification_test_circuit(builder, num_iterations);
}

/**
 * @brief Generate test circuit with specified number of merkle membership checks
 *
 * @param builder
 * @param num_iterations
 */
template <typename Builder> void generate_merkle_membership_test_circuit(Builder& builder, size_t num_iterations)
{
    GoblinMockCircuits::generate_merkle_membership_test_circuit(builder, num_iterations);
}

// ultrahonk
inline honk::UltraProver get_prover(honk::UltraComposer& composer,
                                    void (*test_circuit_function)(honk::UltraComposer::CircuitBuilder&, size_t),
                                    size_t num_iterations)
{
    honk::UltraComposer::CircuitBuilder builder;
    test_circuit_function(builder, num_iterations);
    std::shared_ptr<honk::UltraComposer::Instance> instance = composer.create_instance(builder);
    return composer.create_prover(instance);
}

// standard plonk
inline plonk::Prover get_prover(plonk::StandardComposer& composer,
                                void (*test_circuit_function)(StandardCircuitBuilder&, size_t),
                                size_t num_iterations)
{
    StandardCircuitBuilder builder;
    test_circuit_function(builder, num_iterations);
    return composer.create_prover(builder);
}

// ultraplonk
inline plonk::UltraProver get_prover(plonk::UltraComposer& composer,
                                     void (*test_circuit_function)(honk::UltraComposer::CircuitBuilder&, size_t),
                                     size_t num_iterations)
{
    plonk::UltraComposer::CircuitBuilder builder;
    test_circuit_function(builder, num_iterations);
    return composer.create_prover(builder);
}
/**
 * @brief Performs proof constuction for benchmarks based on a provided circuit function
 *
 * @details This function assumes state.range refers to num_iterations which is the number of times to perform a given
 * basic operation in the circuit, e.g. number of hashes
 *
 * @tparam Builder
 * @param state
 * @param test_circuit_function
 */
template <typename Composer>
void construct_proof_with_specified_num_iterations(benchmark::State& state,
                                                   void (*test_circuit_function)(typename Composer::CircuitBuilder&,
                                                                                 size_t),
                                                   size_t num_iterations)
{
    srs::init_crs_factory("../srs_db/ignition");

    Composer composer;

    for (auto _ : state) {
        // Construct circuit and prover; don't include this part in measurement
        state.PauseTiming();
        auto prover = get_prover(composer, test_circuit_function, num_iterations);
        state.ResumeTiming();

        // Construct proof
        auto proof = prover.construct_proof();
    }
}

} // namespace bb::mock_proofs
