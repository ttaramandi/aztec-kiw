
#define Avm_DECLARE_VIEWS(index)                                                                                       \
    using Accumulator = typename std::tuple_element<index, ContainerOverSubrelations>::type;                           \
    using View = typename Accumulator::View;                                                                           \
    [[maybe_unused]] auto avm_main_clk = View(new_term.avm_main_clk);                                                  \
    [[maybe_unused]] auto avm_main_first = View(new_term.avm_main_first);                                              \
    [[maybe_unused]] auto avm_mem_m_clk = View(new_term.avm_mem_m_clk);                                                \
    [[maybe_unused]] auto avm_mem_m_sub_clk = View(new_term.avm_mem_m_sub_clk);                                        \
    [[maybe_unused]] auto avm_mem_m_addr = View(new_term.avm_mem_m_addr);                                              \
    [[maybe_unused]] auto avm_mem_m_tag = View(new_term.avm_mem_m_tag);                                                \
    [[maybe_unused]] auto avm_mem_m_val = View(new_term.avm_mem_m_val);                                                \
    [[maybe_unused]] auto avm_mem_m_lastAccess = View(new_term.avm_mem_m_lastAccess);                                  \
    [[maybe_unused]] auto avm_mem_m_last = View(new_term.avm_mem_m_last);                                              \
    [[maybe_unused]] auto avm_mem_m_rw = View(new_term.avm_mem_m_rw);                                                  \
    [[maybe_unused]] auto avm_mem_m_in_tag = View(new_term.avm_mem_m_in_tag);                                          \
    [[maybe_unused]] auto avm_mem_m_tag_err = View(new_term.avm_mem_m_tag_err);                                        \
    [[maybe_unused]] auto avm_mem_m_one_min_inv = View(new_term.avm_mem_m_one_min_inv);                                \
    [[maybe_unused]] auto avm_alu_alu_clk = View(new_term.avm_alu_alu_clk);                                            \
    [[maybe_unused]] auto avm_alu_alu_ia = View(new_term.avm_alu_alu_ia);                                              \
    [[maybe_unused]] auto avm_alu_alu_ib = View(new_term.avm_alu_alu_ib);                                              \
    [[maybe_unused]] auto avm_alu_alu_ic = View(new_term.avm_alu_alu_ic);                                              \
    [[maybe_unused]] auto avm_alu_alu_op_add = View(new_term.avm_alu_alu_op_add);                                      \
    [[maybe_unused]] auto avm_alu_alu_op_sub = View(new_term.avm_alu_alu_op_sub);                                      \
    [[maybe_unused]] auto avm_alu_alu_op_mul = View(new_term.avm_alu_alu_op_mul);                                      \
    [[maybe_unused]] auto avm_alu_alu_op_div = View(new_term.avm_alu_alu_op_div);                                      \
    [[maybe_unused]] auto avm_alu_alu_op_not = View(new_term.avm_alu_alu_op_not);                                      \
    [[maybe_unused]] auto avm_alu_alu_op_eq = View(new_term.avm_alu_alu_op_eq);                                        \
    [[maybe_unused]] auto avm_alu_alu_ff_tag = View(new_term.avm_alu_alu_ff_tag);                                      \
    [[maybe_unused]] auto avm_alu_alu_u8_tag = View(new_term.avm_alu_alu_u8_tag);                                      \
    [[maybe_unused]] auto avm_alu_alu_u16_tag = View(new_term.avm_alu_alu_u16_tag);                                    \
    [[maybe_unused]] auto avm_alu_alu_u32_tag = View(new_term.avm_alu_alu_u32_tag);                                    \
    [[maybe_unused]] auto avm_alu_alu_u64_tag = View(new_term.avm_alu_alu_u64_tag);                                    \
    [[maybe_unused]] auto avm_alu_alu_u128_tag = View(new_term.avm_alu_alu_u128_tag);                                  \
    [[maybe_unused]] auto avm_alu_alu_u8_r0 = View(new_term.avm_alu_alu_u8_r0);                                        \
    [[maybe_unused]] auto avm_alu_alu_u8_r1 = View(new_term.avm_alu_alu_u8_r1);                                        \
    [[maybe_unused]] auto avm_alu_alu_u16_r0 = View(new_term.avm_alu_alu_u16_r0);                                      \
    [[maybe_unused]] auto avm_alu_alu_u16_r1 = View(new_term.avm_alu_alu_u16_r1);                                      \
    [[maybe_unused]] auto avm_alu_alu_u16_r2 = View(new_term.avm_alu_alu_u16_r2);                                      \
    [[maybe_unused]] auto avm_alu_alu_u16_r3 = View(new_term.avm_alu_alu_u16_r3);                                      \
    [[maybe_unused]] auto avm_alu_alu_u16_r4 = View(new_term.avm_alu_alu_u16_r4);                                      \
    [[maybe_unused]] auto avm_alu_alu_u16_r5 = View(new_term.avm_alu_alu_u16_r5);                                      \
    [[maybe_unused]] auto avm_alu_alu_u16_r6 = View(new_term.avm_alu_alu_u16_r6);                                      \
    [[maybe_unused]] auto avm_alu_alu_u16_r7 = View(new_term.avm_alu_alu_u16_r7);                                      \
    [[maybe_unused]] auto avm_alu_alu_u64_r0 = View(new_term.avm_alu_alu_u64_r0);                                      \
    [[maybe_unused]] auto avm_alu_alu_cf = View(new_term.avm_alu_alu_cf);                                              \
    [[maybe_unused]] auto avm_alu_alu_op_eq_diff_inv = View(new_term.avm_alu_alu_op_eq_diff_inv);                      \
    [[maybe_unused]] auto avm_main_pc = View(new_term.avm_main_pc);                                                    \
    [[maybe_unused]] auto avm_main_internal_return_ptr = View(new_term.avm_main_internal_return_ptr);                  \
    [[maybe_unused]] auto avm_main_sel_internal_call = View(new_term.avm_main_sel_internal_call);                      \
    [[maybe_unused]] auto avm_main_sel_internal_return = View(new_term.avm_main_sel_internal_return);                  \
    [[maybe_unused]] auto avm_main_sel_jump = View(new_term.avm_main_sel_jump);                                        \
    [[maybe_unused]] auto avm_main_sel_halt = View(new_term.avm_main_sel_halt);                                        \
    [[maybe_unused]] auto avm_main_sel_op_add = View(new_term.avm_main_sel_op_add);                                    \
    [[maybe_unused]] auto avm_main_sel_op_sub = View(new_term.avm_main_sel_op_sub);                                    \
    [[maybe_unused]] auto avm_main_sel_op_mul = View(new_term.avm_main_sel_op_mul);                                    \
    [[maybe_unused]] auto avm_main_sel_op_div = View(new_term.avm_main_sel_op_div);                                    \
    [[maybe_unused]] auto avm_main_sel_op_not = View(new_term.avm_main_sel_op_not);                                    \
    [[maybe_unused]] auto avm_main_sel_op_eq = View(new_term.avm_main_sel_op_eq);                                      \
    [[maybe_unused]] auto avm_main_in_tag = View(new_term.avm_main_in_tag);                                            \
    [[maybe_unused]] auto avm_main_op_err = View(new_term.avm_main_op_err);                                            \
    [[maybe_unused]] auto avm_main_tag_err = View(new_term.avm_main_tag_err);                                          \
    [[maybe_unused]] auto avm_main_inv = View(new_term.avm_main_inv);                                                  \
    [[maybe_unused]] auto avm_main_ia = View(new_term.avm_main_ia);                                                    \
    [[maybe_unused]] auto avm_main_ib = View(new_term.avm_main_ib);                                                    \
    [[maybe_unused]] auto avm_main_ic = View(new_term.avm_main_ic);                                                    \
    [[maybe_unused]] auto avm_main_mem_op_a = View(new_term.avm_main_mem_op_a);                                        \
    [[maybe_unused]] auto avm_main_mem_op_b = View(new_term.avm_main_mem_op_b);                                        \
    [[maybe_unused]] auto avm_main_mem_op_c = View(new_term.avm_main_mem_op_c);                                        \
    [[maybe_unused]] auto avm_main_rwa = View(new_term.avm_main_rwa);                                                  \
    [[maybe_unused]] auto avm_main_rwb = View(new_term.avm_main_rwb);                                                  \
    [[maybe_unused]] auto avm_main_rwc = View(new_term.avm_main_rwc);                                                  \
    [[maybe_unused]] auto avm_main_mem_idx_a = View(new_term.avm_main_mem_idx_a);                                      \
    [[maybe_unused]] auto avm_main_mem_idx_b = View(new_term.avm_main_mem_idx_b);                                      \
    [[maybe_unused]] auto avm_main_mem_idx_c = View(new_term.avm_main_mem_idx_c);                                      \
    [[maybe_unused]] auto avm_main_last = View(new_term.avm_main_last);                                                \
    [[maybe_unused]] auto avm_mem_m_rw_shift = View(new_term.avm_mem_m_rw_shift);                                      \
    [[maybe_unused]] auto avm_mem_m_tag_shift = View(new_term.avm_mem_m_tag_shift);                                    \
    [[maybe_unused]] auto avm_mem_m_val_shift = View(new_term.avm_mem_m_val_shift);                                    \
    [[maybe_unused]] auto avm_mem_m_addr_shift = View(new_term.avm_mem_m_addr_shift);                                  \
    [[maybe_unused]] auto avm_main_internal_return_ptr_shift = View(new_term.avm_main_internal_return_ptr_shift);      \
    [[maybe_unused]] auto avm_main_pc_shift = View(new_term.avm_main_pc_shift);                                        \
    [[maybe_unused]] auto avm_alu_alu_u16_r6_shift = View(new_term.avm_alu_alu_u16_r6_shift);                          \
    [[maybe_unused]] auto avm_alu_alu_u16_r0_shift = View(new_term.avm_alu_alu_u16_r0_shift);                          \
    [[maybe_unused]] auto avm_alu_alu_u16_r2_shift = View(new_term.avm_alu_alu_u16_r2_shift);                          \
    [[maybe_unused]] auto avm_alu_alu_u16_r7_shift = View(new_term.avm_alu_alu_u16_r7_shift);                          \
    [[maybe_unused]] auto avm_alu_alu_u16_r3_shift = View(new_term.avm_alu_alu_u16_r3_shift);                          \
    [[maybe_unused]] auto avm_alu_alu_u16_r1_shift = View(new_term.avm_alu_alu_u16_r1_shift);                          \
    [[maybe_unused]] auto avm_alu_alu_u16_r5_shift = View(new_term.avm_alu_alu_u16_r5_shift);                          \
    [[maybe_unused]] auto avm_alu_alu_u16_r4_shift = View(new_term.avm_alu_alu_u16_r4_shift);
