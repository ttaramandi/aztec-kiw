import { ContractArtifact, FunctionArtifact, FunctionType } from '@aztec/foundation/abi';
import { createConsoleLogger } from '@aztec/foundation/log';
import {
  generateContractArtifact,
  generateNoirContractInterface,
  generateTypescriptContractInterface,
} from '@aztec/noir-compiler';

import * as child from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import camelCase from 'lodash.camelcase';
import omit from 'lodash.omit';
import snakeCase from 'lodash.snakecase';
import upperFirst from 'lodash.upperfirst';
import { join as pathJoin } from 'path';
import { format } from 'util';

// const STATEMENT_TYPES = ['type', 'params', 'return'] as const;
const log = createConsoleLogger('aztec:noir-contracts');

const PROJECT_CONTRACTS = [
  { name: 'SchnorrSingleKeyAccount', target: '../aztec.js/src/artifacts/', exclude: [] },
  { name: 'SchnorrAccount', target: '../aztec.js/src/artifacts/', exclude: [] },
  { name: 'EcdsaAccount', target: '../aztec.js/src/artifacts/', exclude: [] },
];

const INTERFACE_CONTRACTS = ['private_token', 'private_token_airdrop', 'test'];

/**
 * Writes the contract to a specific project folder, if needed.
 * @param artifact - The artifact to write.
 */
function writeToProject(artifact: any) {
  for (const projectContract of PROJECT_CONTRACTS) {
    if (artifact.name === projectContract.name) {
      const toWrite = {
        ...artifact,
        functions: artifact.functions.map((f: any) => omit(f, projectContract.exclude)),
        // If we maintain debug symbols they will get committed to git.
        debug: undefined,
      };
      const targetFilename = pathJoin(projectContract.target, `${snakeCase(artifact.name)}_contract.json`);
      writeFileSync(targetFilename, JSON.stringify(toWrite, null, 2) + '\n');
      log(`Written ${targetFilename}`);
    }
  }
}

const TRANSPILER_BIN = process.env.TRANSPILER_BIN;

async function tryExec(cmd: string): Promise<string> {
  log(`Executing shell command: ${cmd}`);
  const result = await new Promise<string>((resolve, reject) => {
    child.exec(
      cmd,
      {},
      (error: child.ExecException | null, stdout: string, stderr: string) => {
        log(`stdout: ${stdout}`);
        log(`stderr: ${stderr}`);
        if (error) {
          reject(new Error (`Command failed: ${error}`));
        } else {
          resolve(stdout);
        }
      }
    );
  });
  return result;
}

async function acirToAvmBytecode(acir: Buffer): Promise<string> {
  const acirPath = (await tryExec('mktemp')).replace(/\n/, '');
  const outBrilligPath = (await tryExec('mktemp')).replace(/\n/, '');
  log(`temporarily writing acir to: ${acirPath}`);
  log(`temporarily generating brillig at: ${outBrilligPath}`);
  await tryExec(`echo -n ${acir.toString('base64')} > ${acirPath}`);
  await tryExec(`cd ../../barretenberg/cpp/ && ${TRANSPILER_BIN} ${acirPath} ${outBrilligPath}`);
  const avmBytecode = readFileSync(outBrilligPath, {encoding: 'base64'});
  // cleanup
  await tryExec(`rm ${acirPath} ${outBrilligPath}`);
  return avmBytecode
}

async function transpileUnconstrainedToAVM(artifact: ContractArtifact) {
  for (const func of artifact.functions) {
    if (func.functionType === FunctionType.UNCONSTRAINED && !/^view_/.test(func.name)) {
      // First, save the original unconstrained version of this function with modified name for view-only calls
      // This allows us to execute view-only unconstrained functions in the Brillig VM
      // but execute them in the AVM when in a public TX
      const origFunc: FunctionArtifact = {
        ...func,
        name: "view_" + func.name,
      }
      artifact.functions.push(origFunc);
      // Next transpile the originally-named function in-place and flag it as OPEN/public
      log(`Transpiling unconstrained function "${func.name}" from AVM test contract`);
      const avmBytecode = await acirToAvmBytecode(Buffer.from(func.bytecode, 'base64'));
      func.bytecode = avmBytecode;
      func.functionType = FunctionType.OPEN;
    }
  }
}

const main = async () => {
  const name = process.argv[2];
  if (!name) throw new Error(`Missing argument contract name`);

  const projectName = `${snakeCase(name)}_contract`;

  const contractName = upperFirst(camelCase(name));
  const artifactFile = `${projectName}-${contractName}.json`;

  const buildJsonFilePath = `./target/${artifactFile}`;
  const buildJson = JSON.parse(readFileSync(buildJsonFilePath).toString());

  const debugArtifactFile = `debug_${artifactFile}`;
  let debug = undefined;

  const isAvmContract = /^avm_/.test(projectName);

  log(`Is this an AVM contract? ${isAvmContract}`);
  // debug info gets messed up by transpilation and function-renaming for AVM contracts
  if (!isAvmContract) {
    log(`Attempting to read debug info from ${debugArtifactFile}`);
    try {
      const debugJsonFilePath = `./target/${debugArtifactFile}`;
      const debugJson = JSON.parse(readFileSync(debugJsonFilePath).toString());
      if (debugJson) {
        debug = debugJson;
      }
    } catch (err) {
      // Ignore
    }
  }

  // Remove extraneous information from the buildJson (which was output by Nargo) to hone in on the function data we actually care about:
  const artifactJson: ContractArtifact = generateContractArtifact({ contract: buildJson, debug });

  if (isAvmContract) {
    // mutates artifactJson by transpiling contract's unconstrained bytecode to AVM and tagging them as OPEN
    await transpileUnconstrainedToAVM(artifactJson)
  }

  // Write the artifact:
  const artifactsDir = 'src/artifacts';
  const artifactFileName = `${snakeCase(name)}_contract.json`;
  writeFileSync(pathJoin(artifactsDir, artifactFileName), JSON.stringify(artifactJson, null, 2) + '\n');
  log(`Written ${pathJoin(artifactsDir, artifactFileName)}`);

  // Write some artifacts to other packages in the monorepo:
  writeToProject(artifactJson);

  // Write a .ts contract interface, for consumption by the typescript code
  const tsInterfaceDestFilePath = `src/types/${name}.ts`;
  const tsAbiImportPath = `../artifacts/${artifactFileName}`;
  writeFileSync(tsInterfaceDestFilePath, generateTypescriptContractInterface(artifactJson, tsAbiImportPath));
  log(`Written ${tsInterfaceDestFilePath}`);

  // Write a .nr contract interface, for consumption by other Aztec.nr contracts
  if (INTERFACE_CONTRACTS.includes(name)) {
    const projectDirPath = `src/contracts/${projectName}`;
    const noirInterfaceDestFilePath = `${projectDirPath}/src/interface.nr`;
    try {
      writeFileSync(noirInterfaceDestFilePath, generateNoirContractInterface(artifactJson));
      log(`Written ${noirInterfaceDestFilePath}`);
    } catch (err) {
      log(`Error generating Aztec.nr interface for ${name}: ${err}`);
    }
  }
};

try {
  await main();
} catch (err: unknown) {
  log(format(`Error copying build output`, err));
  process.exit(1);
}
