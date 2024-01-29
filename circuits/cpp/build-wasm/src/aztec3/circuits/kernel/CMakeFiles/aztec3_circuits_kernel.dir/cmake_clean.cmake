file(REMOVE_RECURSE
  "libaztec3_circuits_kernel.a"
  "libaztec3_circuits_kernel.pdb"
)

# Per-language clean rules from dependency scanning.
foreach(lang CXX)
  include(CMakeFiles/aztec3_circuits_kernel.dir/cmake_clean_${lang}.cmake OPTIONAL)
endforeach()
