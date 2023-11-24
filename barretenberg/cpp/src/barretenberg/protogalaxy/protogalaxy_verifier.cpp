#include "protogalaxy_verifier.hpp"
#include "barretenberg/proof_system/library/grand_product_delta.hpp"
namespace proof_system::honk {

template <class VerifierInstances>
void ProtoGalaxyVerifier_<VerifierInstances>::prepare_for_folding(std::vector<uint8_t> fold_data)
{
    transcript = BaseTranscript<FF>{ fold_data };
    auto index = 0;
    for (auto it = instances.begin(); it != instances.end(); it++, index++) {
        auto inst = *it;
        auto domain_separator = std::to_string(index);
        inst->instance_size = transcript.template receive_from_prover<uint32_t>(domain_separator + "_circuit_size");
        inst->public_input_size =
            transcript.template receive_from_prover<uint32_t>(domain_separator + "_public_input_size");
        inst->pub_inputs_offset =
            transcript.template receive_from_prover<uint32_t>(domain_separator + "_pub_inputs_offset");

        for (size_t i = 0; i < inst->public_input_size; ++i) {
            auto public_input_i =
                transcript.template receive_from_prover<FF>(domain_separator + "_public_input_" + std::to_string(i));
            inst->public_inputs.emplace_back(public_input_i);
        }
        auto [eta, beta, gamma] = transcript.get_challenges(
            domain_separator + "_eta", domain_separator + "_beta", domain_separator + "_gamma");
        const FF public_input_delta = compute_public_input_delta<Flavor>(
            inst->public_inputs, beta, gamma, inst->instance_size, inst->pub_inputs_offset);
        const FF lookup_grand_product_delta = compute_lookup_grand_product_delta<FF>(beta, gamma, inst->instance_size);
        inst->relation_parameters =
            RelationParameters<FF>{ eta, beta, gamma, public_input_delta, lookup_grand_product_delta };
        inst->alpha = transcript.get_challenge(domain_separator + "_alpha");

        // WORKTODO does verifier need to also fold relation parameters and alpha
    }
}

template <class VerifierInstances>
bool ProtoGalaxyVerifier_<VerifierInstances>::verify_folding_proof(std::vector<uint8_t> fold_data)
{
    prepare_for_folding(fold_data);
    auto delta = transcript.get_challenge("delta");
    auto accumulator = get_accumulator();
    auto log_instance_size = static_cast<size_t>(numeric::get_msb(accumulator->instance_size));
    auto deltas = compute_round_challenge_pows(log_instance_size, delta);
    std::vector<FF> perturbator_coeffs(log_instance_size + 1);
    for (size_t idx = 0; idx <= log_instance_size; idx++) {
        perturbator_coeffs[idx] = transcript.template receive_from_prover<FF>("perturbator_" + std::to_string(idx));
    }
    auto perturbator = Polynomial<FF>(perturbator_coeffs);
    auto perturbator_challenge = transcript.get_challenge("perturbator_challenge");
    auto perturbator_at_challenge = perturbator.evaluate(perturbator_challenge);

    // Thed degree of K(X) is dk - k - 1 = k(d - 1) - 1. Hence we need  k(d - 1) evaluations to represent it.
    std::array<FF, VerifierInstances::BATCHED_EXTENDED_LENGTH - VerifierInstances::NUM> combiner_quotient_evals = {};
    for (size_t idx = 0; idx < VerifierInstances::BATCHED_EXTENDED_LENGTH - VerifierInstances::NUM; idx++) {
        combiner_quotient_evals[idx] = transcript.template receive_from_prover<FF>(
            "combiner_quotient_" + std::to_string(idx + VerifierInstances::NUM));
    }
    Univariate<FF, VerifierInstances::BATCHED_EXTENDED_LENGTH, VerifierInstances::NUM> combiner_quotient(
        combiner_quotient_evals);

    auto combiner_challenge = transcript.get_challenge("combiner_quotient_challenge");
    auto combiner_quotient_at_challenge = combiner_quotient.evaluate(combiner_challenge);

    auto vanishing_polynomial_at_challenge = combiner_challenge * (combiner_challenge - FF(1));
    auto lagranges = std::vector<FF>{ FF(1) - combiner_challenge, combiner_challenge };

    auto expected_next_target_sum =
        perturbator_at_challenge * lagranges[0] + vanishing_polynomial_at_challenge * combiner_quotient_at_challenge;
    auto next_target_sum = transcript.template receive_from_prover<FF>("next_target_sum");
    bool verified = (expected_next_target_sum == next_target_sum);

    auto expected_betas_star = update_gate_separation_challenges(
        perturbator_challenge, accumulator->folding_parameters.gate_separation_challenges, deltas);
    for (size_t idx = 0; idx < log_instance_size; idx++) {
        auto expected_beta_star = transcript.template receive_from_prover<FF>("betas_star_" + std::to_string(idx));
        verified = verified & (expected_betas_star[idx] == expected_beta_star);
    }

    std::vector<FF> folded_public_inputs(instances[0]->public_inputs.size());
    auto folded_alpha = FF(0);
    for (size_t inst_idx = 0; inst_idx < VerifierInstances::NUM; inst_idx++) {
        auto instance = instances[inst_idx];
        auto inst_public_inputs = instance->public_inputs;
        for (size_t el_idx = 0; el_idx < inst_public_inputs.size(); el_idx++) {
            folded_public_inputs[el_idx] += inst_public_inputs[el_idx] * lagranges[inst_idx];
        }
        folded_alpha += instance->alpha + lagranges[inst_idx];
    }

    for (size_t idx = 0; idx < folded_public_inputs.size(); idx++) {
        auto public_input = transcript.template receive_from_prover<FF>("folded_public_input" + std::to_string(idx));
        verified = verified & (public_input == folded_public_inputs[idx]);
    }

    auto alpha = transcript.template receive_from_prover<FF>("folded_alpha");
    verified = verified & (alpha == folded_alpha);
    // all verification keys have the same size

    // auto acc_vk_view = accumulator->verification_key->pointer_view();
    // auto inst_vk_view = verifier_instances[1]->verification_key->pointer_view();
    // for (size_t idx = 0; idx < acc_vk_view.size(); idx++) {
    //     (*acc_vk_view[idx]) =
    //         (*acc_vk_view[idx]) * lagrange_0_at_challenge + (*inst_vk_view[idx]) * lagrange_1_at_challenge;
    // }

    return verified;
}

template class ProtoGalaxyVerifier_<VerifierInstances_<honk::flavor::Ultra, 2>>;
template class ProtoGalaxyVerifier_<VerifierInstances_<honk::flavor::GoblinUltra, 2>>;
} // namespace proof_system::honk