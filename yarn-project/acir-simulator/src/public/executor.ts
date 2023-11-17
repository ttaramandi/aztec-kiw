import { GlobalVariables, HistoricBlockData, PublicCircuitPublicInputs } from '@aztec/circuits.js';
import { DebugLogger, createDebugLogger } from '@aztec/foundation/log';

import { AVMInstruction, Opcode } from './opcodes.js';
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

//import { execFile } from 'child_process';
import {exec} from 'node:child_process';
import util from 'node:util';
import fs from 'fs';
import { log } from 'node:console';
import { AVMExecutor } from './vm.js';

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

    //const context = new PublicVmExecutionContext(
    //  execution,
    //);
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

export async function acirToAvmBytecode(acir: Buffer): Promise<Buffer> {
  const log = createDebugLogger('aztec:simulator:public_vm_acir_to_brillig');
  const acirPath = (await tryExec('mktemp')).replace(/\n/, '');
  const outBrilligPath = (await tryExec('mktemp')).replace(/\n/, '');
  log(`temporarily writing acir to: ${acirPath}`);
  log(`temporarily generating brillig at: ${outBrilligPath}`);
  // writeFileSync to tmp file not working here
  //fs.writeFileSync(bytecodePath, bytecode!.toString('base64'));
  await tryExec(`echo -n ${acir.toString('base64')} > ${acirPath}`);
  await tryExec(`cd ../../barretenberg/cpp/ && ${POWDR_BINDIR}/bberg ${acirPath} ${outBrilligPath}`);
  // Necessary to do base64 twice?
  const avmBytecode = fs.readFileSync(outBrilligPath, {encoding: 'base64'});
  return Buffer.from(avmBytecode, 'base64');
  //const avmBytecode = fs.readFileSync(outBrilligPath, {encoding: 'base64'});
  //return Buffer.from(avmBytecode, 'base64');
}