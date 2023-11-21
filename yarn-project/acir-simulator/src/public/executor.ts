import { GlobalVariables, HistoricBlockData, PublicCircuitPublicInputs } from '@aztec/circuits.js';
import { DebugLogger, createDebugLogger } from '@aztec/foundation/log';

import { Oracle } from '../acvm/index.js';
import { ExecutionError, createSimulationError } from '../common/errors.js';
import { SideEffectCounter } from '../common/index.js';
import { PackedArgsCache } from '../common/packed_args_cache.js';
import { AcirSimulator } from '../index.js';
import { CommitmentsDB, PublicContractsDB, PublicStateDB } from './db.js';
import { PublicCall, PublicExecution, PublicExecutionResult } from './execution.js';
import { PublicExecutionContext } from './public_execution_context.js';
import { PublicVmExecutionContext } from './public_vm_execution_context.js';
import { Fr } from '@aztec/circuits.js';
import { FunctionL2Logs } from '@aztec/types';
import { InvalidStructSignatureError } from 'viem';

import { AVMExecutor } from '../public-vm/avm.js';

/**
 * Handles execution of public functions.
 */
export class PublicExecutor {
  constructor(
    private readonly stateDb: PublicStateDB,
    private readonly contractsDb: PublicContractsDB,
    private readonly commitmentsDb: CommitmentsDB,
    private readonly blockData: HistoricBlockData,
  ) {}

  /**
   * Executes a public execution request.
   * @param execution - The execution to run.
   * @param globalVariables - The global variables to use.
   * @returns The result of the run plus all nested runs.
   */
  public async simulate(execution: PublicExecution, globalVariables: GlobalVariables): Promise<PublicExecutionResult> {
    // this is just to rename args to calldata
    const context = {
      contractAddress: execution.contractAddress,
      functionData: execution.functionData,
      calldata: execution.args,
      callContext: execution.callContext
    };
    const avm = new AVMExecutor(
      this.stateDb,
      this.contractsDb,
    );

    // Functions can request to pack arguments before calling other functions.
    // We use this cache to hold the packed arguments.
    //const packedArgs = await PackedArgsCache.create([]);

    //const sideEffectCounter = new SideEffectCounter();

    //const context = new PublicExecutionContext(
    //  execution,
    //  this.blockData,
    //  globalVariables,
    //  packedArgs,
    //  sideEffectCounter,
    //  this.stateDb,
    //  this.contractsDb,
    //  this.commitmentsDb,
    //);

    try {
      //return await executePublicFunction(execution, acir);
      return await avm.simulate(context);
    } catch (err) {
      throw createSimulationError(err instanceof Error ? err : new Error('Unknown error during public execution'));
    }
  }

//  public async generateWitness(outAsmPath: string) {
//    await tryExec(`cd ../../barretenberg/cpp/ && ${POWDR_BINDIR}/powdr pil ${outAsmPath} --field bn254 --force`);
//  }
//  public async prove() {
//    const log = createDebugLogger('aztec:simulator:public_vm_prove');
//    log(`Proving public vm`);
//
//    await tryExec('cd ../../barretenberg/cpp/build/ && ./bin/publicvm_cli dummy-path');
//  }
}
