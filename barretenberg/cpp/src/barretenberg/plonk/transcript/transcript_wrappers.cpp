#include "./transcript_wrappers.hpp"
#include "manifest.hpp"
#include <vector>

namespace transcript {
void StandardTranscript::add_field_element(const std::string& element_name, const fr& element)
{
    add_element(element_name, element.to_buffer());
}

fr StandardTranscript::get_field_element(const std::string& element_name) const
{
    return fr::serialize_from_buffer(&(get_element(element_name))[0]);
}

g1::affine_element StandardTranscript::get_group_element(const std::string& element_name) const
{
    return g1::affine_element::serialize_from_buffer(&(get_element(element_name))[0]);
}

std::vector<fr> StandardTranscript::get_field_element_vector(const std::string& element_name) const
{
    return many_from_buffer<fr>(get_element(element_name));
}

fr StandardTranscript::get_challenge_field_element(const std::string& challenge_name, const size_t idx) const
{
    return fr::serialize_from_buffer(&(get_challenge(challenge_name, idx))[0]);
}

fr StandardTranscript::get_challenge_field_element_from_map(const std::string& challenge_name,
                                                            const std::string& challenge_map_name) const
{
    return fr::serialize_from_buffer(&(get_challenge_from_map(challenge_name, challenge_map_name))[0]);
}
} // namespace transcript
