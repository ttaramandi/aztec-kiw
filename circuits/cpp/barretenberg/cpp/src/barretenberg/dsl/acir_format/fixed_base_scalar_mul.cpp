#include "fixed_base_scalar_mul.hpp"

namespace acir_format {

void create_fixed_base_constraint(Builder& builder, const FixedBaseScalarMul& input)
{

    field_ct low_as_field = field_ct::from_witness_index(&builder, input.low);
    field_ct high_as_field = field_ct::from_witness_index(&builder, input.high);
    (void)high_as_field;
    auto public_key = group_ct::fixed_base_scalar_mul_g1<254>(low_as_field);

    builder.assert_equal(public_key.x.witness_index, input.pub_key_x);
    builder.assert_equal(public_key.y.witness_index, input.pub_key_y);
}

} // namespace acir_format
