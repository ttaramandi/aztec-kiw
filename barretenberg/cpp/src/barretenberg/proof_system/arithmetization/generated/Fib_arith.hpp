
#pragma once
#include "barretenberg/proof_system/arithmetization/arithmetization.hpp"
namespace arithmetization {
class FibArithmetization : public Arithmetization<6, 0> {
  public:
    using FF = barretenberg::fr;
    struct Selectors {};
};
} // namespace arithmetization
