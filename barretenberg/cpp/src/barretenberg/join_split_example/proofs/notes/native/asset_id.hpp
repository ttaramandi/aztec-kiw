#pragma once
#include <stdint.h>
#include <utility>

namespace bb::join_split_example {

std::pair<bool, uint32_t> deflag_asset_id(uint32_t const& asset_id);

bool get_asset_id_flag(uint32_t const& asset_id);

} // namespace bb::join_split_example