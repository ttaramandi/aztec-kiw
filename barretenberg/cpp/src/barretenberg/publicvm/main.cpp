#include "barretenberg/common/throw_or_abort.hpp"
#include <barretenberg/examples/simple/simple.hpp>
#include <barretenberg/srs/factories/file_crs_factory.hpp>

#include <cstdlib>

int main(int argc, char** argv)
{
    if (argc < 2) {
        throw_or_abort("Provide a path to the VM witness file");
    }
    // TODO: TS orchestrates
    // convert ACIR to brillig
    // generate powdr circuit from bytecode (and inputs?) - *_out.asm
    // run powdr witness generation
    // call C++ executable to generate and return proof
    info("witness file: ", argv[1]);
    // std::system(
    //     "cd ../ && "
    //     "/mnt/user-data/david/projects/3-aztec3/powdr/target/debug/bberg && "
    //     "/mnt/user-data/david/projects/3-aztec3/powdr/target/debug/powdr pil brillig_out.asm --field bn254 --force");
    srs::init_crs_factory("../srs_db/ignition");
    auto ptrs = examples::simple::create_builder_and_composer();
    auto proof = create_proof(ptrs);
    info("BBERG Proof ", proof);
    delete_builder_and_composer(ptrs);
}