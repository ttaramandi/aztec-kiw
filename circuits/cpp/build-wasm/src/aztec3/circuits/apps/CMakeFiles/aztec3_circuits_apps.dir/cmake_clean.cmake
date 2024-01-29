file(REMOVE_RECURSE
  "libaztec3_circuits_apps.a"
  "libaztec3_circuits_apps.pdb"
)

# Per-language clean rules from dependency scanning.
foreach(lang CXX)
  include(CMakeFiles/aztec3_circuits_apps.dir/cmake_clean_${lang}.cmake OPTIONAL)
endforeach()
