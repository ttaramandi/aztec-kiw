add_executable(
    publicvm_cli
    main.cpp
)

target_link_libraries(
    publicvm_cli
    PRIVATE
    proof_system
    examples
)