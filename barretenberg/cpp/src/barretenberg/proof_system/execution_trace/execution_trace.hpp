#pragma once
#include "barretenberg/flavor/flavor.hpp"
#include "barretenberg/proof_system/composer/permutation_lib.hpp"
#include "barretenberg/srs/global_crs.hpp"

namespace bb {

template <class Flavor> class ExecutionTrace_ {
    using Builder = typename Flavor::CircuitBuilder;
    using Polynomial = typename Flavor::Polynomial;
    using FF = typename Flavor::FF;
    using TrackBlocks = typename Builder::Arithmetization::TraceBlocks;
    using Wires = std::array<std::vector<uint32_t, bb::ContainerSlabAllocator<uint32_t>>, Builder::NUM_WIRES>;
    using ProvingKey = typename Flavor::ProvingKey;

  public:
    static constexpr size_t NUM_WIRES = Builder::NUM_WIRES;

    struct TraceData {
        std::array<Polynomial, NUM_WIRES> wires;
        std::array<Polynomial, Builder::Arithmetization::NUM_SELECTORS> selectors;
        // A vector of sets (vectors) of addresses into the wire polynomials whose values are copy constrained
        std::vector<CyclicPermutation> copy_cycles;

        TraceData(size_t dyadic_circuit_size, Builder& builder)
        {
            // Initializate the wire and selector polynomials
            for (auto& wire : wires) {
                wire = Polynomial(dyadic_circuit_size);
            }
            for (auto& selector : selectors) {
                selector = Polynomial(dyadic_circuit_size);
            }
            copy_cycles.resize(builder.variables.size());
        }
    };

    /**
     * @brief Given a circuit, populate a proving key with wire polys, selector polys, and sigma/id polys
     *
     * @param builder
     */
    static void generate(Builder& builder, const std::shared_ptr<ProvingKey>&);

  private:
    /**
     * @brief Add the wire and selector polynomials from the trace data to a honk or plonk proving key
     *
     * @param trace_data
     * @param builder
     * @param proving_key
     */
    static void add_wires_and_selectors_to_proving_key(TraceData& trace_data,
                                                       Builder& builder,
                                                       const std::shared_ptr<typename Flavor::ProvingKey>& proving_key);

    /**
     * @brief Construct wire polynomials, selector polynomials and copy cycles from raw circuit data
     *
     * @param builder
     * @param dyadic_circuit_size
     * @return TraceData
     */
    static TraceData construct_trace_data(Builder& builder, size_t dyadic_circuit_size);

    /**
     * @brief Temporary helper method to construct execution trace blocks from existing builder structures
     * @details Eventually the builder will construct blocks directly
     *
     * @param builder
     * @return std::vector<TraceBlock>
     */
    static void create_execution_trace_blocks(Builder& builder);
};

} // namespace bb