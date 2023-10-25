#pragma once
#include "barretenberg/common/mem.hpp"
#include "barretenberg/common/serialize.hpp"
#include "barretenberg/common/streams.hpp"
#include "barretenberg/common/timer.hpp"

WASM_EXPORT void pedersen__init();

WASM_EXPORT void pedersen__compress_fields(uint8_t const* left, uint8_t const* right, uint8_t* result);

WASM_EXPORT void pedersen__compress(uint8_t const* inputs_buffer, uint8_t* output);

WASM_EXPORT void pedersen__compress_with_hash_index(uint8_t const* inputs_buffer, uint8_t* output, uint32_t hash_index);
WASM_EXPORT void pedersen__commit(uint8_t const* inputs_buffer, uint8_t* output);

WASM_EXPORT void pedersen__buffer_to_field(uint8_t const* data, size_t length, uint8_t* r);
