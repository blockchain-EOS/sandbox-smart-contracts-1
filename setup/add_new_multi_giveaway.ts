/**
 * How to use:
 *  - yarn execute <NETWORK> ./setup/add_new_multi_giveaway.ts <GIVEAWAY_NAME>
 *
 * GIVEAWAY_NAME: from data/giveaways/multi_giveaway_1/detective_letty.json then the giveaway name is: detective_letty
 */
import fs from 'fs-extra';
import hre from 'hardhat';
import {DeployFunction} from 'hardhat-deploy/types';

import {createClaimMerkleTree} from '../data/giveaways/multi_giveaway_1/getClaims';
import helpers, {MultiClaim} from '../lib/merkleTreeHelper';
const {calculateMultiClaimHash} = helpers;

const args = process.argv.slice(2);
const claimFile = args[0];

const func: DeployFunction = async function () {
  const {deployments, network, getChainId} = hre;
  const {execute, read, catchUnknownSigner} = deployments;
  const chainId = await getChainId();

  let claimData: MultiClaim[];
  try {
    claimData = fs.readJSONSync(
      `data/giveaways/multi_giveaway_1/${claimFile}.json`
    );
  } catch (e) {
    console.log('Error', e);
    return;
  }

  const {merkleRootHash, saltedClaims, tree} = createClaimMerkleTree(
    network.live,
    chainId,
    claimData
  );

  const giveawayContract = await deployments.getOrNull('Multi_Giveaway_1');
  if (!giveawayContract) {
    console.log('No Multi_Giveaway_1 deployment');
    return;
  }

  const currentAdmin = await read('Multi_Giveaway_1', 'getAdmin');

  await catchUnknownSigner(
    execute(
      'Multi_Giveaway_1',
      {from: currentAdmin, log: true},
      'addNewGiveaway',
      merkleRootHash,
      '0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF' // do not expire
    )
  );

  console.log(`New giveaway added with merkleRootHash: ${merkleRootHash}`);

  const claimsWithProofs: (MultiClaim & {proof: string[]})[] = [];
  for (const claim of saltedClaims) {
    claimsWithProofs.push({
      ...claim,
      proof: tree.getProof(calculateMultiClaimHash(claim)),
    });
  }
  const basePath = `./secret/multi-giveaway/${network.name}`;
  const proofPath = `${basePath}/.multi_claims_proofs_${claimFile}_${chainId}.json`;
  const rootHashPath = `${basePath}/.multi_claims_root_hash_${claimFile}_${chainId}.json`;
  fs.outputJSONSync(proofPath, claimsWithProofs);
  fs.outputFileSync(rootHashPath, merkleRootHash);
  console.log(`Proofs at: ${proofPath}`);
  console.log(`Hash at: ${rootHashPath}`);
};
export default func;

if (require.main === module) {
  func(hre);
}
