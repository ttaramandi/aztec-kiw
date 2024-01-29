file(REMOVE_RECURSE
  "../../../../bin/aztec3_circuits_rollup_tests"
  "../../../../bin/aztec3_circuits_rollup_tests.pdb"
)

# Per-language clean rules from dependency scanning.
foreach(lang CXX)
  include(CMakeFiles/aztec3_circuits_rollup_tests.dir/cmake_clean_${lang}.cmake OPTIONAL)
endforeach()
