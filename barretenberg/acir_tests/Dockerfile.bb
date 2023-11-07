FROM 278380418400.dkr.ecr.eu-west-2.amazonaws.com/barretenberg-x86_64-linux-clang-assert

FROM node:18-alpine
RUN apk update && apk add git bash curl jq coreutils
COPY --from=0 /usr/src/barretenberg/cpp/build /usr/src/barretenberg/cpp/build
WORKDIR /usr/src/barretenberg/acir_tests
COPY . .
# Run every acir test through native bb build prove_then_verify flow.
# This ensures we test independent pk construction through real/garbage witness data paths.
RUN FLOW=prove_then_verify ./run_acir_tests.sh
# Run 1_mul through native bb build, all_cmds flow, to test all cli args.
RUN VERBOSE=1 FLOW=all_cmds ./run_acir_tests.sh 1_mul