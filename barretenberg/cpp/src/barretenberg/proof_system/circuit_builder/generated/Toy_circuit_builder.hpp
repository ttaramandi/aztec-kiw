

// AUTOGENERATED FILE
#pragma once

#include "barretenberg/common/constexpr_utils.hpp"
#include "barretenberg/common/throw_or_abort.hpp"
#include "barretenberg/ecc/curves/bn254/fr.hpp"
#include "barretenberg/honk/proof_system/logderivative_library.hpp"
#include "barretenberg/proof_system/circuit_builder/circuit_builder_base.hpp"
#include "barretenberg/relations/generic_permutation/generic_permutation_relation.hpp"

#include "barretenberg/flavor/generated/Toy_flavor.hpp"
#include "barretenberg/relations/generated/Toy/toy_avm.hpp"
#include "barretenberg/relations/generated/Toy/two_column_perm.hpp"

using namespace barretenberg;

namespace proof_system {

template <typename FF> struct ToyFullRow {
    FF toy_first{};
    FF toy_q_tuple_set{};
    FF toy_set_1_column_1{};
    FF toy_set_1_column_2{};
    FF toy_set_2_column_1{};
    FF toy_set_2_column_2{};
    FF toy_x{};
    FF two_column_perm{};
    FF toy_x_shift{};
};

class ToyCircuitBuilder {
  public:
    using Flavor = proof_system::honk::flavor::ToyFlavor;
    using FF = Flavor::FF;
    using Row = ToyFullRow<FF>;

    // TODO: template
    using Polynomial = Flavor::Polynomial;
    using ProverPolynomials = Flavor::ProverPolynomials;

    static constexpr size_t num_fixed_columns = 9;
    static constexpr size_t num_polys = 8;
    std::vector<Row> rows;

    void set_trace(std::vector<Row>&& trace) { rows = std::move(trace); }

    ProverPolynomials compute_polynomials()
    {
        const auto num_rows = get_circuit_subgroup_size();
        ProverPolynomials polys;

        // Allocate mem for each column
        for (auto& poly : polys.get_all()) {
            poly = Polynomial(num_rows);
        }

        for (size_t i = 0; i < rows.size(); i++) {
            polys.toy_first[i] = rows[i].toy_first;
            polys.toy_q_tuple_set[i] = rows[i].toy_q_tuple_set;
            polys.toy_set_1_column_1[i] = rows[i].toy_set_1_column_1;
            polys.toy_set_1_column_2[i] = rows[i].toy_set_1_column_2;
            polys.toy_set_2_column_1[i] = rows[i].toy_set_2_column_1;
            polys.toy_set_2_column_2[i] = rows[i].toy_set_2_column_2;
            polys.toy_x[i] = rows[i].toy_x;
            polys.two_column_perm[i] = rows[i].two_column_perm;
        }

        polys.toy_x_shift = Polynomial(polys.toy_x.shifted());

        return polys;
    }

    [[maybe_unused]] bool check_circuit()
    {

        const FF gamma = FF::random_element();
        const FF beta = FF::random_element();
        proof_system::RelationParameters<typename Flavor::FF> params{
            .eta = 0,
            .beta = beta,
            .gamma = gamma,
            .public_input_delta = 0,
            .lookup_grand_product_delta = 0,
            .beta_sqr = 0,
            .beta_cube = 0,
            .eccvm_set_permutation_delta = 0,
        };

        ProverPolynomials polys = compute_polynomials();
        const size_t num_rows = polys.get_polynomial_size();

        const auto evaluate_relation = [&]<typename Relation>(const std::string& relation_name,
                                                              std::string (*debug_label)(int)) {
            typename Relation::SumcheckArrayOfValuesOverSubrelations result;
            for (auto& r : result) {
                r = 0;
            }
            constexpr size_t NUM_SUBRELATIONS = result.size();

            for (size_t i = 0; i < num_rows; ++i) {
                Relation::accumulate(result, polys.get_row(i), {}, 1);

                bool x = true;
                for (size_t j = 0; j < NUM_SUBRELATIONS; ++j) {
                    if (result[j] != 0) {
                        std::string row_name = debug_label(static_cast<int>(j));
                        throw_or_abort(
                            format("Relation ", relation_name, ", subrelation index ", row_name, " failed at row ", i));
                        x = false;
                    }
                }
                if (!x) {
                    return false;
                }
            }
            return true;
        };

        const auto evaluate_permutation = [&]<typename PermutationSettings>(const std::string& permutation_name) {
            // Check the tuple permutation relation
            proof_system::honk::logderivative_library::compute_logderivative_inverse<Flavor, PermutationSettings>(
                polys, params, num_rows);

            typename PermutationSettings::SumcheckArrayOfValuesOverSubrelations permutation_result;

            for (auto& r : permutation_result) {
                r = 0;
            }
            for (size_t i = 0; i < num_rows; ++i) {
                PermutationSettings::accumulate(permutation_result, polys.get_row(i), params, 1);
            }
            for (auto r : permutation_result) {
                if (r != 0) {
                    info("Tuple ", permutation_name, " failed.");
                    return false;
                }
            }
            return true;
        };

        if (!evaluate_relation.template operator()<Toy_vm::toy_avm<FF>>("toy_avm",
                                                                        Toy_vm::get_relation_label_toy_avm)) {
            return false;
        }

        if (!evaluate_permutation.template operator()<honk::sumcheck::two_column_perm_relation<FF>>(
                "two_column_perm")) {
            return false;
        }

        return true;
    }

    [[nodiscard]] size_t get_num_gates() const { return rows.size(); }

    [[nodiscard]] size_t get_circuit_subgroup_size() const
    {
        const size_t num_rows = get_num_gates();
        const auto num_rows_log2 = static_cast<size_t>(numeric::get_msb64(num_rows));
        size_t num_rows_pow2 = 1UL << (num_rows_log2 + (1UL << num_rows_log2 == num_rows ? 0 : 1));
        return num_rows_pow2;
    }
};
} // namespace proof_system
