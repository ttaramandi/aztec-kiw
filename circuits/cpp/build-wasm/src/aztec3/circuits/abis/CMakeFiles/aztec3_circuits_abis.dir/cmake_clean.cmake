file(REMOVE_RECURSE
  "libaztec3_circuits_abis.a"
  "libaztec3_circuits_abis.pdb"
)

# Per-language clean rules from dependency scanning.
foreach(lang CXX)
  include(CMakeFiles/aztec3_circuits_abis.dir/cmake_clean_${lang}.cmake OPTIONAL)
endforeach()
