file(REMOVE_RECURSE
  "../../bin/aztec3-circuits.wasm"
  "../../bin/aztec3-circuits.wasm.pdb"
)

# Per-language clean rules from dependency scanning.
foreach(lang CXX)
  include(CMakeFiles/aztec3-circuits.wasm.dir/cmake_clean_${lang}.cmake OPTIONAL)
endforeach()
