#pragma once
#include "barretenberg/smt_verification/solver/solver.hpp"

namespace smt_terms {
using namespace smt_solver;

/**
 * @brief Finite Field element class.
 *
 * @details Can be a finite field symbolic variable or a constant.
 * Both of them support basic arithmetic operations: +, -, *, /.
 * Check the satisfability of a system and get it's model.
 *
 * TODO(alex): string compatible arithmetic operations?
 */
class FFTerm {
  public:
    Solver* solver;
    cvc5::Term term;

    FFTerm()
        : solver(nullptr)
        , term(cvc5::Term()){};

    explicit FFTerm(const std::string& t, Solver* slv, bool isconst = false, uint32_t base = 16);
    FFTerm(cvc5::Term& term, Solver* s)
        : solver(s)
        , term(term){};
    FFTerm(const FFTerm& other) = default;
    FFTerm(FFTerm&& other) = default;

    static FFTerm Var(const std::string& name, Solver* slv);
    static FFTerm Const(const std::string& val, Solver* slv, uint32_t base = 16);

    FFTerm(bb::fr value, Solver* s){
        std::stringstream buf; // TODO(alex): looks bad. Would be great to create tostring() converter
        buf << value;
        std::string tmp = buf.str();
        tmp[1] = '0';          // avoiding `x` in 0x prefix
        
        *this = Const(tmp, s);
    }
    
    void mod(){};

    FFTerm& operator=(const FFTerm& right) = default;
    FFTerm& operator=(FFTerm&& right) = default;

    FFTerm operator+(const FFTerm& other) const;
    void operator+=(const FFTerm& other);
    FFTerm operator-(const FFTerm& other) const;
    void operator-=(const FFTerm& other);
    FFTerm operator-() const;
    FFTerm operator*(const FFTerm& other) const;
    void operator*=(const FFTerm& other);
    FFTerm operator/(const FFTerm& other) const;
    void operator/=(const FFTerm& other);

    void operator==(const FFTerm& other) const;
    void operator!=(const FFTerm& other) const;

    FFTerm operator+(const bb::fr& rhs) const{
        return *this + FFTerm(rhs, this->solver);
    }
    void operator+=(const bb::fr& other){
        *this += FFTerm(other, this->solver);
    }
    FFTerm operator-(const bb::fr& other) const{
        return *this - FFTerm(other, this->solver);
    }
    void operator-=(const bb::fr& other){
        *this -= FFTerm(other, this->solver);
    }
    FFTerm operator*(const bb::fr& other) const{
        return *this * FFTerm(other, this->solver);
    }
    void operator*=(const bb::fr& other){
        *this *= FFTerm(other, this->solver);
    }
    FFTerm operator/(const bb::fr& other) const{
        return *this / FFTerm(other, this->solver);
    }
    void operator/=(const bb::fr& other){
        *this /= FFTerm(other, this->solver);
    }

    void operator==(const bb::fr& other) const{
        *this == FFTerm(other, this->solver);
    }
    void operator!=(const bb::fr& other) const{
        *this != FFTerm(other, this->solver);
    }

    operator std::string() const { return term.isFiniteFieldValue() ? term.getFiniteFieldValue() : term.toString(); };
    operator cvc5::Term() const { return term; };

    ~FFTerm() = default;
    friend std::ostream& operator<<(std::ostream& out, const FFTerm& k) { return out << k.term; }

    friend FFTerm batch_add(const std::vector<FFTerm>& children)
    {
        Solver* slv = children[0].solver;
        std::vector<cvc5::Term> terms(children.begin(), children.end());
        cvc5::Term res = slv->s.mkTerm(cvc5::Kind::FINITE_FIELD_ADD, terms);
        return { res, slv };
    }

    friend FFTerm batch_mul(const std::vector<FFTerm>& children)
    {
        Solver* slv = children[0].solver;
        std::vector<cvc5::Term> terms(children.begin(), children.end());
        cvc5::Term res = slv->s.mkTerm(cvc5::Kind::FINITE_FIELD_MULT, terms);
        return { res, slv };
    }
};

FFTerm operator+(const bb::fr& lhs, const FFTerm& rhs);
FFTerm operator-(const bb::fr& lhs, const FFTerm& rhs);
FFTerm operator*(const bb::fr& lhs, const FFTerm& rhs);
FFTerm operator/(const bb::fr& lhs, const FFTerm& rhs);
void operator==(const bb::fr& lhs, const FFTerm& rhs);
void operator!=(const bb::fr& lhs, const FFTerm& rhs);

} // namespace smt_terms