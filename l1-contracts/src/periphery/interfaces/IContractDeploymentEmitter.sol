// SPDX-License-Identifier: Apache-2.0
// Copyright 2023 Aztec Labs.
pragma solidity >=0.8.18;

/**
 * @title Contract Deployment Emitter Interface
 * @author Aztec Labs
 * @notice Interface for Contract Deployment Emitter
 * The contract is used to broadcast information about deployed contracts with public functions.
 */
interface IContractDeploymentEmitter {
  /**
   * @notice Links L1 and L2 addresses and stores the acir bytecode of the L2 contract
   * @param l2BlockNum - The L2 block number that the information is related to
   * @param aztecAddress - The address of the L2 counterparty
   * @param portalAddress - The address of the L1 counterparty
   * @param l2BlockHash - The hash of the L2 block that this is related to
   * @param contractClassId - The contract class id
   * @param saltedInitializationHash - Salted init hash
   * @param publicKeyHash - Public key hash
   * @param acir - The acir bytecode of the L2 contract
   * @dev See the link below for more info on partial address and public key:
   * https://github.com/AztecProtocol/aztec-packages/blob/master/docs/docs/concepts/foundation/accounts/keys.md#addresses-partial-addresses-and-public-keys
   * TODO: replace the link above with the link to deployed docs
   */
  event ContractDeployment(
    uint256 indexed l2BlockNum,
    bytes32 indexed aztecAddress,
    address indexed portalAddress,
    bytes32 l2BlockHash,
    bytes32 contractClassId,
    bytes32 saltedInitializationHash,
    bytes32 publicKeyHash,
    bytes acir
  );

  function emitContractDeployment(
    uint256 _l2BlockNum,
    bytes32 _aztecAddress,
    address _portalAddress,
    bytes32 _l2BlockHash,
    bytes32 _contractClassId,
    bytes32 _saltedInitializationHash,
    bytes32 _publicKeyHash,
    bytes calldata _acir
  ) external;
}
