if(NOT CMAKE_BUILD_TYPE AND NOT CMAKE_CONFIGURATION_TYPES)
  set(CMAKE_BUILD_TYPE "Release" CACHE STRING "Choose the type of build." FORCE)
endif()
message(STATUS "Build type: ${CMAKE_BUILD_TYPE}")

if(CMAKE_BUILD_TYPE STREQUAL "RelWithAssert")
  add_compile_options(-O3)
  remove_definitions(-DNDEBUG)
endif()

if(CMAKE_BUILD_TYPE STREQUAL "RelDebugAssert")
  add_compile_options(-O2 -g)
  remove_definitions(-DNDEBUG)
endif()