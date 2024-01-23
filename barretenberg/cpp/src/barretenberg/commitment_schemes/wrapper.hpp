#pragma once

#include "barretenberg/ecc/curves/bn254/g1.hpp"
#include "gemini/gemini.hpp"

namespace bb::honk {

struct OpeningProof {
    std::vector<g1::affine_element> gemini;
    g1::affine_element shplonk;
    g1::affine_element kzg;
};

} // namespace bb::honk
