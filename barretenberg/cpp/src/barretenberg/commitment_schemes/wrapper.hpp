#pragma once

#include "barretenberg/ecc/curves/bn254/g1.hpp"
#include "gemini/gemini.hpp"

namespace bb {

struct OpeningProof {
    std::vector<barretenberg::g1::affine_element> gemini;
    barretenberg::g1::affine_element shplonk;
    barretenberg::g1::affine_element kzg;
};

} // namespace bb
