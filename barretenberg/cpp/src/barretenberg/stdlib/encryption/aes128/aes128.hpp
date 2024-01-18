#pragma once

#include <array>
#include <vector>

#include "../../primitives/field/field.hpp"
#include "../../primitives/witness/witness.hpp"
#include "barretenberg/stdlib/primitives/circuit_builders/circuit_builders_fwd.hpp"

namespace bb::stdlib {
template <typename Builder>
std::vector<field_t<Builder>> aes128_encrypt_buffer_cbc(const std::vector<field_t<Builder>>& input,
                                                        const field_t<Builder>& iv,
                                                        const field_t<Builder>& key);

}
