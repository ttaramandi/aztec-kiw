
#include <benchmark/benchmark.h>
#include "barretenberg/honk/pcs/commitment_key.hpp"


std::shared_ptr<proof_system::honk::pcs::kzg::Params::CommitmentKey> create_commitment_key(const size_t num_points)
{
    return std::make_shared<proof_system::honk::pcs::kzg::Params::CommitmentKey>(num_points, "../srs_db/ignition");
}

constexpr size_t MAX_LOG_NUM_POINTS = 24;
constexpr size_t MAX_NUM_POINTS = 1 << MAX_LOG_NUM_POINTS;

auto key = create_commitment_key(MAX_NUM_POINTS);

template <typename Curve> void bench_commit(::benchmark::State& state)
{
    const size_t num_points = 1 << state.range(0);
    const auto polynomial = barretenberg::Polynomial<typename Curve::ScalarField>(num_points);
    for (auto _ : state) {
        benchmark::DoNotOptimize(key->commit(polynomial));
    }
}

BENCHMARK(bench_commit<curve::BN254>)->DenseRange(10, MAX_LOG_NUM_POINTS)->Unit(benchmark::kMillisecond);
