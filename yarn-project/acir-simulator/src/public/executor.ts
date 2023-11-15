import { GlobalVariables, HistoricBlockData, PublicCircuitPublicInputs } from '@aztec/circuits.js';
import { DebugLogger, createDebugLogger } from '@aztec/foundation/log';

import { vmExecute } from './vm.js';
import { AVMInstruction, Opcode } from './opcodes.js';
import { Oracle } from '../acvm/index.js';
import { ExecutionError, createSimulationError } from '../common/errors.js';
import { SideEffectCounter } from '../common/index.js';
import { PackedArgsCache } from '../common/packed_args_cache.js';
import { AcirSimulator } from '../index.js';
import { CommitmentsDB, PublicContractsDB, PublicStateDB } from './db.js';
import { PublicExecution, PublicExecutionResult } from './execution.js';
import { PublicExecutionContext } from './public_execution_context.js';
import { PublicVmExecutionContext } from './public_vm_execution_context.js';
import { Fr } from '@aztec/circuits.js';
import { FunctionL2Logs } from '@aztec/types';
import { InvalidStructSignatureError } from 'viem';

//import { execFile } from 'child_process';
import {exec} from 'node:child_process';
import util from 'node:util';
import fs from 'fs';
import { log } from 'node:console';

const execPromise = util.promisify(exec);

const POWDR_BINDIR = process.env.POWDR_BINDIR;//'/mnt/user-data/david/projects/3-aztec3/powdr/target/debug/';

async function tryExec(cmd: string) {
  // promisify exec
  const log = createDebugLogger('aztec:simulator:public_vm_exec');

  try {
    const {stdout, stderr} = await execPromise(cmd);
    log(`STDOUT: ${stdout}`);
    log(`STDERR: ${stderr}`);
    return stdout;
  } catch (error) {
    log(`ERROR: ${error}`);
    throw error;
  }
}
/**
 * Execute a public function and return the execution result.
 */
export async function executePublicFunction(
  context: PublicVmExecutionContext,
  _bytecode: Buffer,
  log = createDebugLogger('aztec:simulator:public_execution'),
): Promise<PublicExecutionResult> {
  let bytecode = [
    new AVMInstruction(
      /*opcode*/ Opcode.CALLDATASIZE, // M[0] = CD.length
      /*d0:*/ 0, /*target memory address*/
      /*sd:*/ 0, /*unused*/
      /*s0:*/ 0, /*unused*/
      /*s1:*/ 0, /*unused*/
    ),
    new AVMInstruction(
      /*opcode*/ Opcode.CALLDATACOPY, // M[1:1+M[0]] = CD[0+M[0]]);
      /*d0:*/ 1, /*target memory address*/
      /*sd:*/ 0, /*unused*/
      /*s0:*/ 0, /*calldata offset*/
      /*s1:*/ 0, /*copy size*/
    ),
    new AVMInstruction(
      /*opcode*/ Opcode.ADD, // M[10] = M[1] + M[2]
      /*d0:*/ 10, /*target memory address*/
      /*sd:*/ 0, /*unused*/
      /*s0:*/ 1, /*to add*/
      /*s1:*/ 2, /*to add*/
    ),
    new AVMInstruction(
      /*opcode*/ Opcode.RETURN, // return M[10]
      /*d0:*/ 0, /*unused*/
      /*sd:*/ 0, /*unused*/
      /*s0:*/ 10, /*field memory offset*/
      /*s1:*/ 1, /*return size*/
    )
  ];
  const execution = context.execution;
  const { contractAddress, functionData } = execution;
  const selector = functionData.selector;
  log(`Executing public external function ${contractAddress.toString()}:${selector}`);

  //const vmCallback = new Oracle(context);
  const
    //returnValues,
    //newL2ToL1Msgs,
    //newCommitments,
    //newNullifiers,
    returnData
   = await vmExecute(bytecode, context /*, vmCallback*/);

  //const { contractStorageReads, contractStorageUpdateRequests } = context.getStorageActionData();
  //log(
  //  `Contract storage reads: ${contractStorageReads
  //    .map(r => r.toFriendlyJSON() + ` - sec: ${r.sideEffectCounter}`)
  //    .join(', ')}`,
  //);

  //const nestedExecutions = context.getNestedExecutions();
  //const unencryptedLogs = context.getUnencryptedLogs();

  return {
    execution,
    newCommitments: [],
    newL2ToL1Messages: [],
    newNullifiers: [],
    contractStorageReads: [],
    contractStorageUpdateRequests: [],
    returnValues: returnData,
    nestedExecutions: [],
    unencryptedLogs: FunctionL2Logs.empty(),
  };
}

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
    const selector = execution.functionData.selector;
    const acir = await this.contractsDb.getBytecode(execution.contractAddress, selector);
    if (!acir) throw new Error(`Bytecode not found for ${execution.contractAddress}:${selector}`);

    // Functions can request to pack arguments before calling other functions.
    // We use this cache to hold the packed arguments.
    const packedArgs = await PackedArgsCache.create([]);

    const sideEffectCounter = new SideEffectCounter();

    const context = new PublicVmExecutionContext(
      execution,
    );
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
      return await executePublicFunction(context, acir);
    } catch (err) {
      throw createSimulationError(err instanceof Error ? err : new Error('Unknown error during public execution'));
    }
  }

  public async bytecodeToPowdr(execution: PublicExecution) {
    const selector = execution.functionData.selector;
    const bytecode = await this.contractsDb.getBytecode(execution.contractAddress, selector);
    //log(`bytecode: ` + bytecode!.toString('base64'));
    // write bytecode to file
    // pass filename to powdr bberg main
    const bytecodePath = (await tryExec('mktemp')).replace(/\n/, '');
    const outAsmPath = (await tryExec('mktemp')).replace(/\n/, '');
    log(`writing bytecode to: ${bytecodePath}`);
    log(`writing out.asm to: ${outAsmPath}`);
    // writeFileSync to tmp file not working here
    //fs.writeFileSync(bytecodePath, bytecode!.toString('base64'));
    await tryExec(`echo -n ${bytecode!.toString('base64')} > ${bytecodePath}`);
    await tryExec(`cd ../../barretenberg/cpp/ && ${POWDR_BINDIR}/bberg ${bytecodePath} ${outAsmPath}`);
    return outAsmPath;
  }
  public async generateWitness(outAsmPath: string) {
    await tryExec(`cd ../../barretenberg/cpp/ && ${POWDR_BINDIR}/powdr pil ${outAsmPath} --field bn254 --force`);
  }
  public async prove() {
    const log = createDebugLogger('aztec:simulator:public_vm_prove');
    log(`Proving public vm`);

    await tryExec('cd ../../barretenberg/cpp/build/ && ./bin/publicvm_cli dummy-path');
  }
}
